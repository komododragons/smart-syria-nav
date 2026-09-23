# Phase 31 — Critical Workflow Testing

## Goal
Add a repeatable automated test suite for Syriasan’s critical user journeys, API contracts, and privacy boundaries. The release gate must fail whenever an anonymous caller, an unrelated signed-in user, search, navigation, delivery, emergency, or developer API path can expose private residential fields.

## Test foundation
- Configure Vitest for fast unit and server-contract tests, React Testing Library for interactive UI tests, and Playwright for browser journeys.
- Add `test`, `test:unit`, `test:integration`, `test:e2e`, and `test:security` scripts with deterministic setup/cleanup and concise failure output.
- Keep fixtures isolated and clearly marked. Never copy production user data into tests.
- Add shared builders for public businesses, private residences, entrances, claims, temporary links, API clients, and bulk-import rows.

## Privacy-first release gate
- Add database-backed security tests using anonymous, owner, unrelated-user, reviewer, and API-key identities.
- Prove anonymous and unrelated users cannot read private residential nodes, codes, entrances, units, names, phone numbers, delivery notes, or private access instructions directly or through joins.
- Exercise every public surface: address resolution, search, public API v1, checkout resolution, delivery mode, emergency mode, QR targets, and normal navigation.
- Assert blocked responses contain only a generic private/not-found result, use `no-store`, and never contain sentinel private values.
- Verify owner-approved temporary shares expose only selected fields; revoked, expired, exhausted, and malformed tokens disclose nothing.
- Add concurrent tests for one-time-share consumption and API rate limits. If they expose race conditions, replace check-then-update behavior with atomic database operations and retain regression tests.
- Test API keys for missing, malformed, unknown, revoked, expired, inactive-client, insufficient-scope, valid-scope, and over-limit outcomes.

## Workflow coverage
- **Create address:** authenticated five-step creation, private-by-default home, public business option, generated Syriasan code, entrance coordinates, and success actions.
- **Resolve/search:** known public code, unknown/private/retired states, Arabic spelling variants, English names, category/locality filters, and residential exclusion.
- **Navigation:** selected entrance wins over building centre; visitor, parcel, commercial delivery, freight, emergency, and accessible contexts choose the correct allowed entrance and preserve `[lng, lat]` route geometry.
- **Claims and verification:** submission, duplicate/conflicting claim handling, unauthorized reviewer denial, approval/rejection, ownership transfer, competing-claim supersession, verification level, and audit records.
- **QR:** generated payload points only to the canonical authorized address URL; plate modes render; scanner accepts bare codes and Syriasan URLs, rejects unrelated input, and supports manual fallback.
- **Sharing:** owner privacy preferences override requested fields; lifetime is clamped; active link resolves; revoke and expiry close access.
- **Delivery/emergency:** public locations show the correct entrance and necessary operational details; private residential codes show no personal data without an authorized share.
- **Bulk import:** Arabic/English headers, coordinate/phone validation, within-file and existing-location duplicates, manager authorization, successful commit, generated codes, and partial failure reporting.
- **Arabic/English UI:** default Arabic RTL, English LTR, persisted language choice, natural address formatting, key workflow labels, and no missing accessible names.

## Implementation details
- Extract only small pure helpers needed for direct testing, such as QR-code parsing and import-row preparation; do not redesign workflows.
- Test server handlers through real `Request`/`Response` contracts and injectable database clients where practical; reserve mocks for third-party routing, camera, clipboard, and geolocation.
- Keep public-response snapshots explicit allow-lists rather than broad object snapshots, preventing new private fields from being added unnoticed.
- Use browser tests for the highest-value journeys and component behavior; use unit/integration tests for edge cases and permission matrices.
- Record Phase 31 in the roadmap only after all suites pass.

## Acceptance criteria
- Every requested workflow has at least one passing automated test at the appropriate layer.
- Privacy tests cover anonymous and unrelated authenticated access across direct data reads and all public application/API paths.
- No private residential sentinel appears in any unauthorized response body, page text, cacheable payload, or QR target.
- Expired/revoked/one-time links and rate limits remain correct under concurrent requests.
- The full suite runs from documented package scripts and passes alongside the TypeScript check.
