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

## Phase 5 — temporary sharing (open)
- [ ] Field-level share toggles + expiry presets on temporary links
