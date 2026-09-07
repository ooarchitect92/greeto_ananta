"""F07 customer-webhook v1 helpers; NOT a Meta/Telegram verifier.

Only exact-byte authentication is implemented. No I/O, key lookup, tenant grant,
replay receipt, HTTP acknowledgement or business effect is performed. Endpoint
keys and clocks must be supplied by the authorized server, never the request.
"""
from __future__ import annotations
from dataclasses import dataclass
import hashlib
import hmac
import re
from types import MappingProxyType
from typing import Mapping, Sequence

HEADERS = MappingProxyType({'event': 'X-Platform-Event-Id', 'delivery': 'X-Platform-Delivery-Id',
    'timestamp': 'X-Platform-Timestamp', 'key': 'X-Platform-Key-Id', 'signature': 'X-Platform-Signature'})
_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9_:-]{0,127}')
_KEY = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}')
_TIME = re.compile(r'(0|[1-9][0-9]{0,9})')
_SIGNATURE = re.compile(r'v1=[0-9a-f]{64}')
_MAX_UNIX = 9999999999


@dataclass(frozen=True)
class Policy:
    """Explicit seconds/byte limits; no replay window is silently selected."""
    max_age_seconds: int
    max_future_skew_seconds: int
    max_body_bytes: int


@dataclass(frozen=True)
class KeyVersion:
    """Endpoint/environment-owned random bytes, never a password or request key.

    Signing interval is [not_before, sign_until); verification overlap ends at
    verify_until exclusively. Revoked keys cannot sign or verify. Do not log keys.
    """
    id: str
    secret: bytes
    not_before: int
    sign_until: int
    verify_until: int
    revoked: bool = False


@dataclass(frozen=True)
class Proof:
    """Authenticated delivery/body only. The event-ID header is NOT proof data.

    Persist delivery_id + body_sha256 under authenticated endpoint scope for
    conflict/replay checks. A valid signature does not supply a durable receipt.
    """
    delivery_id: str
    key_id: str
    attempted_at: int
    body_sha256: str


class WebhookProofError(ValueError):
    """Payload-free stable code for neutral HTTP mapping by the owning handler."""
    def __init__(self, config: bool = False) -> None:
        self.code = 'WEBHOOK_SIGNING_CONFIG_INVALID' if config else 'WEBHOOK_PROOF_INVALID'
        super().__init__(self.code)


def _integer(n: object, lo: int, hi: int) -> bool:
    return type(n) is int and lo <= n <= hi


def _matches(pattern: re.Pattern[str], value: object) -> bool:
    return isinstance(value, str) and pattern.fullmatch(value) is not None


def _policy(p: Policy, now: int) -> None:
    if not isinstance(p, Policy) or not _integer(now, 0, _MAX_UNIX) or not (
        _integer(p.max_age_seconds, 1, 86400) and
        _integer(p.max_future_skew_seconds, 0, p.max_age_seconds) and
        _integer(p.max_body_bytes, 1, 1048576)):
        raise WebhookProofError(True)


def _key(k: KeyVersion) -> None:
    if not isinstance(k, KeyVersion) or not _matches(_KEY, k.id) or not (
        isinstance(k.secret, bytes) and 32 <= len(k.secret) <= 4096 and
        _integer(k.not_before, 0, _MAX_UNIX) and _integer(k.sign_until, k.not_before + 1, _MAX_UNIX) and
        _integer(k.verify_until, k.sign_until, _MAX_UNIX) and type(k.revoked) is bool):
        raise WebhookProofError(True)


def _mac(body: bytes, delivery: str, at: str, secret: bytes) -> bytes:
    digest = hmac.new(secret, f'{at}.{delivery}.'.encode('ascii'), hashlib.sha256)
    digest.update(body)
    return digest.digest()


def sign_webhook(raw_body: bytes, event_id: str, delivery_id: str, key: KeyVersion,
                 now: int, policy: Policy) -> Mapping[str, str]:
    """Return F07 headers for authorized, already-durable delivery state.

    raw_body: immutable serialized bytes; send precisely these bytes. event_id
    and delivery_id: stable opaque IDs, with no '.' framing delimiter. key/now/
    policy: trusted endpoint key, Unix-second clock and explicit bounds. Retry
    keeps delivery_id but refreshes now. No send, receipt write or ACK occurs.
    Raises WebhookProofError for config, bounds, key intervals or revocation.
    """
    _policy(policy, now)
    _key(key)
    if not isinstance(raw_body, bytes) or len(raw_body) > policy.max_body_bytes or not (
        _matches(_ID, event_id) and _matches(_ID, delivery_id)) or key.revoked or not (
        key.not_before <= now < key.sign_until):
        raise WebhookProofError()
    at = str(now)
    return MappingProxyType({HEADERS['event']: event_id, HEADERS['delivery']: delivery_id,
        HEADERS['timestamp']: at, HEADERS['key']: key.id,
        HEADERS['signature']: 'v1=' + _mac(raw_body, delivery_id, at, key.secret).hex()})


def verify_webhook(raw_body: bytes, raw_headers: Sequence[tuple[str, str]],
                   endpoint_keys: Sequence[KeyVersion], now: int, policy: Policy) -> Proof:
    """Verify raw bytes, clock window, one/two route-owned keys and exact proof.

    raw_headers must preserve pairs/duplicates; a collapsed dictionary is rejected.
    endpoint_keys come from authenticated endpoint/environment config, not request
    IDs/URLs. Returns Proof only; no event schema, grant, replay ledger or ACK is
    certified. The receiver validates the signed body/event ID and durably records
    its scoped receipt/effect before 2xx. Raw timestamps are not deduplication keys.
    Raises neutral WebhookProofError; never echoes input/secret material.
    """
    _policy(policy, now)
    if not isinstance(endpoint_keys, (list, tuple)) or not 1 <= len(endpoint_keys) <= 2:
        raise WebhookProofError(True)
    for k in endpoint_keys:
        _key(k)
    if len(endpoint_keys) == 2 and (endpoint_keys[0].id == endpoint_keys[1].id or
        hmac.compare_digest(endpoint_keys[0].secret, endpoint_keys[1].secret)):
        raise WebhookProofError(True)
    if not isinstance(raw_body, bytes) or len(raw_body) > policy.max_body_bytes or not (
        isinstance(raw_headers, (list, tuple)) and len(raw_headers) <= 128):
        raise WebhookProofError()
    for pair in raw_headers:
        if not isinstance(pair, (tuple, list)) or len(pair) != 2 or any(
            not isinstance(v, str) or len(v) > 8192 for v in pair):
            raise WebhookProofError()
    def one(name: str) -> str:
        values = [v for k, v in raw_headers if k.lower() == name.lower()]
        if len(values) != 1:
            raise WebhookProofError()
        return values[0]
    event, delivery, at, kid, sig = (one(HEADERS[k]) for k in ('event', 'delivery', 'timestamp', 'key', 'signature'))
    if not (_matches(_ID, event) and _matches(_ID, delivery) and _matches(_TIME, at) and
            _matches(_KEY, kid) and _matches(_SIGNATURE, sig)):
        raise WebhookProofError()
    attempted_at = int(at)
    if (attempted_at <= now and now - attempted_at > policy.max_age_seconds) or (
        attempted_at > now and attempted_at - now > policy.max_future_skew_seconds):
        raise WebhookProofError()
    selected = next((k for k in endpoint_keys if k.id == kid), None)
    if selected is None or selected.revoked or not (selected.not_before <= attempted_at < selected.sign_until and
                                                   selected.not_before <= now < selected.verify_until):
        raise WebhookProofError()
    if not hmac.compare_digest(bytes.fromhex(sig[3:]), _mac(raw_body, delivery, at, selected.secret)):
        raise WebhookProofError()
    return Proof(delivery, kid, attempted_at, hashlib.sha256(raw_body).hexdigest())
