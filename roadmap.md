# Syriasan upgrade roadmap

## Phase 1 — address result card (done)
- [x] Rich address fields added to database (building number, parking, loading, accessibility, verification method/date)
- [x] `/a/$code` destination card: full details, map, travel modes, Share / Copy / QR / Save
- [x] Link from the home resolver panel

## Phase 2 — rich address model in the UI (open)
- [ ] Surface/edit new fields in the creation wizard and "my addresses" editing
- [ ] Business fields (category, opening hours) on the card

## Phase 3 — verification (in progress)
- [x] Claim this Address workflow: /claim/$id form (name, role, contact, method, notes) + private evidence uploads (claim-evidence bucket)
- [x] Admin review queue /admin/claims: filters, signed evidence links, notes, granted level, approve/reject
- [x] Conflict handling: competing pending claims flagged; approval supersedes the rest
- [x] Audit trail: submitted / withdrawn / approved / rejected / ownership transferred
- [ ] Verification state labels aligned with the six spec states across the app
- [ ] Claim flow for non-business addresses; suspicious-edit detection

## Phase 4 — delivery view — DONE (/d/:CODE mobile-first courier view)
- [ ] Mobile-first courier-only view per code

## Phase 5 — temporary sharing — DONE
- [x] Field-level share toggles (location/building/entrance/floor/unit/instructions/parking/phone/name)
- [x] Expiry presets 1h / 24h / 7d + custom hours, one-time use, optional label
- [x] Active links list with copy + revoke; /t/TOKEN redacts to the shared fields only, noindex

## Phase 6 — QR address system — DONE
- [x] Canonical public or authorized destination encoded in every QR
- [x] Download, print, and native share actions
- [x] Printable A6, A5, A4, sticker, door-plate, and shop-window templates
- [x] Optional business logo on address plates

## Phase 7 — Business location management [DONE]
- [x] Organizations + members + roles (owner/admin/manager/staff/viewer)
- [x] /dashboard with tabs: locations, addresses, verification, QR, plates, API, team, analytics, settings
- [x] Create / edit / archive-restore branches, attach existing owned businesses
- [x] QR download + address plate print per branch
- [x] address_events logging (resolve, navigate_start, delivery_view) feeding analytics

## Phase 8 — Bulk address import [DONE]
- [x] CSV / XLSX upload (Arabic + English headers), ready-made template
- [x] Validation (required fields, governorate, Syria coordinate bounds, phone format)
- [x] Duplicate detection: same name+branch, within 40 m of an existing branch, and inside the same file
- [x] Preview table with per-row status + downloadable error report
- [x] Confirmation step creates nodes, entrances and Syriasan codes in batches of 100
- [x] Export of codes, QR URLs, delivery URLs and full address info as CSV

## Phase 9 — E-commerce address component [DONE]
- [x] Public checkout endpoint /api/public/checkout (smart code or SY-TMP token, CORS, no-store)
- [x] Reusable SyriasanAddressField React component: resolve, show summary, explicit customer confirmation
- [x] Iframe widget /embed/address with postMessage `syriasan:address` for any store
- [x] Developer page /checkout-component: live demo, JSON contract, HTML/React/WooCommerce/Shopify snippets
- [x] Private units never disclosed without an owner-approved temporary link

## Phase 10 — Developer API v1 [DONE]
- [x] REST endpoints: POST /addresses, GET /addresses/{code}, GET /resolve/{code}, GET /search, POST /validate, POST /geocode, POST /reverse-geocode, GET /qr/{code}, GET /route, POST /keys/revoke
- [x] Mounted at /api/v1/* with /api/public/v1/* alias
- [x] SHA-256 hashed keys, bearer or x-api-key, expiry + revocation
- [x] Per-account and per-key scopes, 403 insufficient_scope
- [x] Per-minute rate limiting with X-RateLimit headers and 429
- [x] Usage metering (endpoint, method, status, scope, response time) + audit logs for writes/revocations
- [x] Private residential addresses never exposed (403 private)
- [x] Arabic API reference page at /api-reference

## Phase 11 — Developer Portal [DONE]
- [x] /docs portal: Authentication, Sandbox, Resolve, Validate, Search, Create, QR, Navigation, Webhooks, Errors, Rate Limits, Privacy
- [x] Copyable cURL / JavaScript / TypeScript samples per section (CodeTabs)
- [x] Live sandbox console (paste key, run real request, shows status + mode + rate-limit headers)
- [x] Sandbox mode: `test` clients simulate writes, X-Syriasan-Mode header on every response
- [x] Webhooks: api_webhooks table, create/list/test/delete endpoints, HMAC-SHA256 signed deliveries on address events

## Phase 12 — Embeddable Address Widget [DONE]
- [x] /widget.js loader: auto-init via data-syriasan-address, Syriasan.mount(), Syriasan.resolve(), hidden-field binding, auto height
- [x] /embed/address params (lang ar|en, compact, code, auto, title, origin) + widget protocol v1 messages
- [x] Bilingual field (Address found / Confirm Address), change-address flow
- [x] /widget page: live demo, HTML/JS/React/Flutter/native/REST snippets, protocol table, SDK architecture

## Phase 13 — Address Pass / private Address Vault [DONE]
- [x] /vault private page: saved addresses with categories (home, work, parents, warehouse, office, other), emoji chips, filter
- [x] Add by smart code with nickname + private note; edit category, copy code, remove
- [x] Secure sharing from the vault: field-level toggles, purpose, 1h/24h/7d/custom expiry, one-time use, active links with revoke
- [x] Owner-only sharing check; vault is noindex and readable only by its owner (RLS)

## Phase 14 — Emergency mode [DONE]
- [x] /e/CODE emergency view: code, coordinates (tap to copy), building, entrances, floor, best vehicle access, emergency entrance, elevator, wheelchair access, access notes
- [x] Copy Emergency Address (dispatch-friendly plain text), Share Emergency Location, Navigate
- [x] Linked from the destination card; noindex; no private residential data
- [x] Explicit notice: no official ambulance / civil-defense integration exists yet
