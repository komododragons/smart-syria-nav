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
