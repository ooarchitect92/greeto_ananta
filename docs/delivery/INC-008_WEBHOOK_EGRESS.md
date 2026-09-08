# INC-008 — F07 proxy-side webhook egress

Date: 8 September 2026. Repository: `ooarchitect92/greeto_ananta`; target: `main` only.
Base inspected: `7891cd116bbefaf5017c8e11b24c5d35efbae1b6`.

## Scope and source precedence

The live repository already contains INC-007 source `18eb09a510518bd55268e2d9e4650f9c4dfad3f2`, including the `signing` Go package and newer conformance evidence. The older local ZIP used `signature` and a different panel layout. It is NOT reapplied. Existing signing, outbox, tenant, SQL, API and status history are preserved.

This increment implements the outbound leg **inside the architecture's required egress proxy**, not a direct-network substitute for that proxy. No service/listener, destination, identity, key, infrastructure, dependency, migration or deployment is registered. Scope contribution: WHK-007, SEC-009 and UX-003. Their original prerequisites, independent acceptance and release gates remain open.

The requested basis is Customer Action OS v1: §1.2 (authority/acknowledgements), §16.1–16.4 (F07 HTTPS/signatures/receiver acceptance/SSRF), §28.1 (workload identity), §30.2 (minimized diagnostics), §32.2 (bounded/cancellable code), and §35 (independent acceptance). This fills a missing F07 boundary; it does not insert work into F03 or change F01–F18 order.

## Implemented execution

1. Enforce the client concurrency bound, caller cancellation, scope/attempt IDs, exact five signing-header shapes and request-body bound.
2. Parse the public HTTPS destination without userinfo, ambiguous authority or fragments. Copy the exact already-signed body/headers; derive immutable URL/body/header-hash intent.
3. Require the existing Action Gateway/durable-attempt permit through the trusted `Authority.Check` port. A matching tenant string alone is never authority.
4. Resolve the exact fully qualified hostname under the original deadline. Inspect every returned A/AAAA address. Reject the complete answer set when any address is outside the public profile; do not silently select a safe-looking sibling.
5. Recheck current authority. Connect once to one validated literal IP and verify the actual peer matches it. Do not resolve the hostname again while dialing.
6. Complete TLS with system roots, the original DNS hostname and at least TLS 1.2. Recheck authority after the handshake, before handing the socket to HTTP.
7. Perform one POST with the unchanged body and signing headers. Do not follow redirects, inherit process proxy settings, reuse a connection or transparently replay the body.
8. Record the HTTP status as its own observation. Read/discard only a bounded response, accept identity encoding only, and normalize any valid Retry-After delta/date hint. Return no raw response body, cookies, Location, URL or signing headers.

Each invocation has one original deadline, one DNS result set and at most one socket/HTTP attempt. DNS/TCP/TLS preparation is synchronous under that context rather than relying on a potentially detached HTTP transport dial context. Cancellation closes the owned connection; admission failure creates no internal queue. This is an intentionally conservative first implementation; throughput/reuse/HTTP2 optimizations require qualification without weakening these invariants.

## Actual files and public parameters

| File | Boundary | Parameters, return, failure and ownership |
|---|---|---|
| `backend/services/webhook-dispatcher/egress/policy.go` | `Destination(raw, allowedPorts)` | Registered URL + approved host port profile → canonical URL/hostname/port or sanitized error; no DNS/I/O or permission grant. |
| Same | `PublicAddress(address)` | `netip.Addr` → public-profile eligibility. Unwraps mapped IPv4; rejects local/special/transition ranges. Not a complete deployment routing proof. |
| Same | `Fault.Error()` | Stable error code only; never a wrapped secret-bearing underlying error. |
| `backend/services/webhook-dispatcher/egress/client.go` | `New(authority, limits)` | Trusted permit verifier + explicit deployment profile → concurrent-safe client; no I/O/registration. |
| Same | `Client.Send(ctx, attempt)` | Authenticated context + durable signed attempt → `Result` and optional sanitized error. Exactly one outbound attempt; no retries or persistent writes. |
| Same | `Authority.Check(ctx, intent)` | Verify current workload, exact scope/endpoint/delivery/attempt, URL, byte hashes and live ownership/permit. Must honor cancellation; may not grant a new action or trust request-body claims. |
| Same | `IsFault(err, code)` | Stable error comparison without exposing URLs/response/driver errors. |
| `front end/src/features/implementation/egress-view.mjs` | `egressView(options)` | Server expected scope, authorized minimized observation, clock → read-only display. Missing/cross-scope/malformed/expired results are withheld. |
| Same | `egressParameters` | Read-only descriptions of host-owned parameters, not configurable browser permissions. |
| `front end/src/features/implementation/EgressBoundaryPanel.jsx` | `EgressBoundaryPanel(props)` | Optional expectedScope/observation → existing cards/notices/table. Cleanup-managed expiry timer only, no network or replay action. |
| `tools/check_webhook_egress.py` | `main()` | Existing Go/Node/TypeScript → bounded local reports. No install, provisioning or Git write. |

`Limits` requires all fields explicitly. `AllowedPorts`: 1–16 unique nonzero ports. `RequestBytes`: 1–4 MiB. `ResponseBytes`: 1–1 MiB, with one extra detection byte. `ResponseHeaderBytes`: 256–64 KiB. `Timeout`: 100 ms–30 seconds. `MaxConcurrent`: 1–256, immediate refusal when full. `MaxDNSAnswers`: 1–64. These are safety ceilings for a host-approved profile, not new customer plan limits or approved production tuning values. Existing signer body/time bounds still apply independently.

`Attempt` includes server Scope (tenant/workspace/environment UUIDs), endpoint and attempt UUIDs, registered URL, exactly the existing five F07 signature headers and exact body bytes. Its input buffers must not be mutated concurrently with entry. `Intent` contains copied string fields plus SHA-256 body/header bindings. IDs are opaque; they are never global metric labels.

`Result` includes validated attempt ID, outcome, observed status, canonical RetryAfter hint, response-byte count, completion flag, stable failure code and at most 16 stage records. Stage records contain only name/result/elapsed milliseconds. The host correlates them with authorized request/event IDs and sends them to its bounded telemetry pipeline. There is no blocking log sink in the network path. They are NOT a durable audit ledger.

## Acknowledgement and retry rules

- Before HTTP can start: errors are `blocked`; no endpoint acceptance was observed.
- After a socket is handed to HTTP with no conclusive response: errors are `unknown`, not a new safe-to-retry action.
- A received 2xx is `accepted_by_endpoint`, NOT business completion or proof that our delivery ledger committed.
- A response-body timeout, truncation, size limit or unsupported encoding after 2xx **does not erase that acceptance**. `Result` may therefore accompany a non-nil error. Callers MUST inspect the result before deciding any retry.
- 3xx is not followed. Other non-2xx remains an observed non-acceptance; the existing F07 lifecycle owner decides pause/retry/DLQ using current authority, deadline, identity and budget.
- Retry-After is only a canonical nonnegative delta or HTTP date hint, never arbitrary receiver text and never an automatic sleep. Invalid/duplicate hints are withheld.

No request reaches a real destination without the required host authority port. Production must deny dispatcher direct egress and require authenticated proxy access. Implementations of that port must verify an already-durable live attempt and exact current permit; a permissive test function is not an acceptable runtime binding. Do not expose this package as an unrestricted forwarding API.

## Public network and privacy profile

Only DNS HTTPS destinations are supported by this first profile. No numeric-IP endpoint, custom browser certificate bypass, wildcard authority, URL userinfo or private-network exception is provided. Prevalidated IDNs must be supplied as ASCII A-labels. Private enterprise targets remain the separate approved connector-agent path.

PublicAddress rejects IPv4 private, loopback, link-local/metadata, shared, documentation, benchmark, multicast/reserved and special-purpose blocks. IPv6 requires ordinary global-unicast space and rejects special/transition/documentation ranges; mapped IPv4 is normalized then checked. Several special anycast ranges are deliberately denied too. The list is a conservative reviewed profile, not a promise that every possible network-specific metadata/publicly-numbered internal route has been discovered. Deployment firewall/routing policy, registry maintenance and independent adversarial tests remain required.

For this identity-only response profile, no decompressor is invoked, so compression expansion cannot occur. Unsupported encoding preserves the observed HTTP status while withholding body collection. No sensitive response preview is generated in this increment.

## Frontend and contract boundaries

ImplementationCenter adds only the EgressBoundaryPanel import/mount beside existing readiness/tenant/outbox panels. Existing design classes and components remain. The data model is a PRIVATE presentation projection, not an added public API schema. Observations have expected scope, UTC observedAt/expiresAt, outcome/status, completion/bytes and diagnostic code; presentation lifetime is capped at 60 seconds. No view can certify deployment from a successful attempt.

The earlier complete frontend/media import remains incomplete. React build, accessibility and browser integration are not verified here. The diagnostic button is disabled; no user-entered URL, key, arbitrary shell command, approval bypass or replay action is enabled.

## Local evidence and remaining gates

Run `python tools/check_webhook_egress.py` from the repository root. The tested source passed 159 Go named leaf cases with race detector, 25 frontend model/source checks, Go vet, gofmt and two JSX syntax checks: **184 targeted named tests, zero failures**. Four fuzz seed cases also run as Go seeds but are excluded from that named-test total. New-package statement coverage: 95.8%. Detailed generated evidence is in `.local-build/webhook-egress/`; the committed summary is `INC-008_VERIFICATION.json`.

The wire fixtures use REAL Go TLS, hostname/certificate verification and HTTP parsing over in-memory sockets with synthetic authority/DNS/dial adapters. All private dial/root injection stays unexported in same-package tests. No public customer endpoint, credential or production infrastructure is contacted. This is stronger than string-only mocks, but it is not deployed firewall/DNS/proxy evidence, a load benchmark or the full repository regression suite. Test toolchains are observed Go 1.23.2 / Node 22.16.0, not qualified production images; GOV-002 remains open.

Remaining: authenticated proxy host, current Action Gateway/ownership/endpoint policy, durable attempt/replay/result storage, vault/rotation, real DNS/egress routing and network policy tests, CDC/Kafka integration, retries/fairness, independent security review, production toolchain qualification, complete frontend build, backups/restore and release gates. No task is certified Done. No migration, public API, F01–F18 order, dependency, infrastructure or release policy was changed. Remote evidence is recorded separately after verified publication; a local artifact is not a source push.

## Engineering references checked 8 September 2026

These support implementation mechanics, not a change to the supplied architecture:
- OWASP SSRF prevention: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- Go HTTP transport and ParseTime: https://pkg.go.dev/net/http
- Go TLS hostname/certificate verification: https://pkg.go.dev/crypto/tls
- Go netip address classification: https://pkg.go.dev/net/netip
- IANA IPv4 special-purpose registry: https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml
- IANA IPv6 special-purpose registry: https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml
