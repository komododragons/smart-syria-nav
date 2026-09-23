# Phase 33 — Future-Ready Integration Layer

## Existing foundation to reuse
- Keep the current v1 developer API, hashed keys, per-key scopes, rate limits, usage metering, signed webhooks, public-only resolution, QR, routing, delivery mode, organizations, and audit logs.
- Keep the existing contextual entrance resolver as the source of truth. Integrations receive the correct entrance and access instructions, never only a building centroid.
- Reuse the existing privacy boundary: public/business data may be resolved by API; private residential/unit data remains inaccessible unless the owner uses the existing temporary sharing flow.
- Reuse `address_events`, `navigation_events`, `api_usage`, verification state, business locations, and accepted correction records for metrics where they already provide reliable signals.

## What will be added
1. **Neutral integration contract**
   - Add a typed adapter registry for courier, e-commerce, banking, fintech, insurance, utilities, healthcare, hospitality, government, municipalities, emergency services, and logistics.
   - Each adapter maps a sector workflow to existing Syriasan routing contexts and declares supported capabilities. It contains no vendor names, credentials, network calls, or fake connection status.

2. **Stable API additions without breaking v1**
   - Add a capabilities endpoint so external systems can discover supported contexts, privacy rules, and contract version.
   - Add an idempotent external-events endpoint for approved lifecycle signals such as address used, navigation started, and destination reached.
   - Return a correlation identifier from API address resolution so a partner can report a later outcome without sending personal data, origin coordinates, names, phones, or unit details.
   - Keep all existing URLs and response fields; additions remain backward-compatible.

3. **Additive database migration**
   - Add integration journeys/events tied to an API client and public Syriasan code, with routing context, anonymous correlation ID, event source, timestamps, success state, and idempotency key.
   - Add constraints, indexes, grants, and RLS. Owners see only aggregate usage through existing authenticated functions; detailed rows remain service/admin controlled.
   - Do not replace tables, delete records, or seed production/demo integrations.

4. **Reliable event delivery**
   - Extend signed webhook event names for destination reached and accepted correction outcomes.
   - Keep webhook delivery best-effort and isolated from the originating API response.
   - Preserve API authentication, scopes, validation, rate limiting, audit logging, and no-store behavior for sensitive responses.

5. **Success metrics and north star**
   - Expand privacy-preserving admin analytics for monthly successful resolutions, navigation starts, QR scans, verified addresses, active business locations, delivery sessions, API resolutions, repeat address usage, successful corrections, and external application usage.
   - Define the north-star metric as confirmed `destination_reached` journeys using a Syriasan address, deduplicated by journey/correlation ID.
   - Never expose residential per-address behavior in dashboards or API output.

6. **Documentation and verification**
   - Document sector-neutral adapters, capabilities, idempotency, correlation IDs, lifecycle events, privacy boundaries, and credential separation in Arabic and English.
   - Add tests for adapter mappings, API authentication/scope enforcement, idempotency, residential blocking, event validation, metrics aggregation, and backward-compatible resolution payloads.
   - Run unit/security checks, type checks, and mobile/desktop browser journeys.

## External credentials
No external provider is connected in this phase. Future provider-specific adapters will be enabled only when a real partner and its credentials/contracts are supplied.
