"""Server-only F07 event identity bound to verified raw bytes.

Additive wrapper; the existing signature API is unchanged. No I/O, key lookup,
authorization, schema registry, replay write, HTTP acknowledgement or business effect.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import json
import re
from typing import Sequence

from .signature import HEADERS, KeyVersion, Policy, Proof, WebhookProofError, verify_webhook


@dataclass(frozen=True, slots=True)
class EventLimits:
    """Explicit host bounds: depth 1..64, tokens 4..65536, key bytes 8..4096.

    Root object depth is one. Tokens count keys, values and container delimiters;
    commas/colons do not count. Key lengths are decoded UTF-8 bytes.
    """
    max_depth: int
    max_tokens: int
    max_key_bytes: int


class WebhookEventError(ValueError):
    """Neutral code only; never attach JSON text, parser location, keys or headers."""
    def __init__(self, code: str = 'WEBHOOK_EVENT_ENVELOPE_INVALID') -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True, slots=True, repr=False)
class VerifiedEvent:
    """Local immutable result, NOT a serialized trust token or permission grant.

    Construct through verify_webhook_event. Python object construction/reflection
    is not a security boundary; do not accept instances across a trust boundary.
    No secret/header retained. Explicit raw_body access is sensitive.
    """
    event_id: str
    proof: Proof = field(repr=False)
    _raw: bytes = field(repr=False)

    def raw_body(self) -> bytes:
        """Return the exact immutable bytes, not reserialized JSON. No I/O."""
        return self._raw

    def __repr__(self) -> str:
        return '[verified webhook event: body omitted]'

    def __str__(self) -> str:
        return self.__repr__()


_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9_:-]{0,127}')
_NUMBER = re.compile(r'-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?')


class _Reader:
    """Bounded structural scan with native JSON string decoding.

    Unrelated numeric lexemes are never converted to floats/integers. No arbitrary
    object tree is materialized. Sets track duplicate decoded names at each depth.
    """
    def __init__(self, text: str, limits: EventLimits) -> None:
        self.text, self.limits = text, limits
        self.at, self.tokens = 0, 0
        self.event_id = ''
        self.decoder = json.JSONDecoder()

    def space(self) -> None:
        while self.at < len(self.text) and self.text[self.at] in ' \t\r\n':
            self.at += 1

    def peek(self) -> str:
        return self.text[self.at] if self.at < len(self.text) else ''

    def tick(self) -> None:
        self.tokens += 1
        if self.tokens > self.limits.max_tokens:
            raise WebhookEventError()

    def string(self) -> str:
        self.tick()
        try:
            value, end = self.decoder.raw_decode(self.text, self.at)
            if not isinstance(value, str):
                raise WebhookEventError()
            value.encode('utf-8', 'strict')  # rejects unpaired surrogate escapes
        except (ValueError, UnicodeError):
            raise WebhookEventError() from None
        self.at = end
        return value

    def value(self, depth: int) -> str | None:
        self.space()
        ch = self.peek()
        if ch in ('{', '['):
            self.container(depth)
            return None
        if ch == '"':
            return self.string()
        self.tick()
        for literal in ('true', 'false', 'null'):
            if self.text.startswith(literal, self.at):
                self.at += len(literal)
                return None
        match = _NUMBER.match(self.text, self.at)
        if match is None:
            raise WebhookEventError()
        self.at = match.end()
        return None

    def container(self, depth: int) -> None:
        if depth > self.limits.max_depth:
            raise WebhookEventError()
        opening = self.peek()
        closing = '}' if opening == '{' else ']'
        self.at += 1
        self.tick()
        self.space()
        names: set[str] = set()
        if self.peek() == closing:
            self.at += 1
            self.tick()
            return
        while True:
            key: str | None = None
            if opening == '{':
                if self.peek() != '"':
                    raise WebhookEventError()
                key = self.string()
                if len(key.encode('utf-8')) > self.limits.max_key_bytes or key in names:
                    raise WebhookEventError()
                names.add(key)
                if depth == 1 and key != 'event_id' and key.lower() == 'event_id':
                    raise WebhookEventError()
                self.space()
                if self.peek() != ':':
                    raise WebhookEventError()
                self.at += 1
            item = self.value(depth + 1)
            if depth == 1 and key == 'event_id':
                if not isinstance(item, str) or _ID.fullmatch(item) is None:
                    raise WebhookEventError()
                self.event_id = item
            self.space()
            if self.peek() == closing:
                self.at += 1
                self.tick()
                return
            if self.peek() != ',':
                raise WebhookEventError()
            self.at += 1
            self.space()

    def read(self) -> str:
        self.space()
        if self.peek() != '{':
            raise WebhookEventError()
        self.container(1)
        self.space()
        if self.at != len(self.text) or not self.event_id:
            raise WebhookEventError()
        return self.event_id


def verify_webhook_event(raw_body: bytes, raw_headers: Sequence[tuple[str, str]],
                         endpoint_keys: Sequence[KeyVersion], now: int,
                         policy: Policy, limits: EventLimits) -> VerifiedEvent:
    """Authenticate first, then compare the signed JSON event_id with its header.

    raw_body is immutable exact HTTP bytes; raw_headers preserves duplicate pairs.
    endpoint_keys, clock, signing policy and parser limits are receiver-owned, not
    request authority. Returns immutable bytes/proof and no key references.
    Raises unchanged WebhookProofError or neutral WebhookEventError. No HTTP ACK,
    replay suppression, schema/subscription/tenant approval or storage side effect.
    Callers still validate schema/scope and atomically record receipt/work before 2xx.
    """
    if not isinstance(limits, EventLimits) or any(type(v) is not int or not lo <= v <= hi
        for v, lo, hi in ((limits.max_depth, 1, 64), (limits.max_tokens, 4, 65536),
                          (limits.max_key_bytes, 8, 4096))):
        raise WebhookEventError('WEBHOOK_EVENT_LIMITS_INVALID')
    if not isinstance(policy, Policy) or type(policy.max_body_bytes) is not int or not 1 <= policy.max_body_bytes <= 1048576:
        raise WebhookProofError(True)
    if type(raw_body) is not bytes or len(raw_body) > policy.max_body_bytes or not (
        isinstance(raw_headers, (list, tuple)) and len(raw_headers) <= 128):
        raise WebhookProofError()
    for pair in raw_headers:
        if not isinstance(pair, (list, tuple)) or len(pair) != 2 or any(
            type(v) is not str or len(v) > 8192 for v in pair):
            raise WebhookProofError()
    selected: list[tuple[str, str]] = []
    for name in HEADERS.values():
        values = [v for k, v in raw_headers if k.lower() == name.lower()]
        if len(values) != 1:
            raise WebhookProofError()
        try:
            size = len(values[0].encode('utf-8', 'strict'))
        except UnicodeError:
            raise WebhookProofError() from None
        if size > 256:
            raise WebhookProofError()
        selected.append((name, values[0]))
    proof = verify_webhook(raw_body, selected, endpoint_keys, now, policy)
    try:
        text = raw_body.decode('utf-8', 'strict')
    except UnicodeError:
        raise WebhookEventError() from None
    event_id = _Reader(text, limits).read()
    if event_id != selected[0][1]:
        raise WebhookEventError()
    return VerifiedEvent(event_id, proof, raw_body)
