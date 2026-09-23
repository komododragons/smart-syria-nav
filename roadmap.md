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

## Phase 15 — Offline-first support [DONE]
- [x] Installable app: manifest, icons, theme colour, Add to Home Screen
- [x] Service worker (vite-plugin-pwa, published site only — never in preview/dev/iframe, ?sw=off kill switch)
- [x] Cached app shell: NetworkFirst pages, CacheFirst hashed assets, cached OSM tiles
- [x] Recently opened addresses cached locally and listed on /offline
- [x] Downloadable regional address packages per governorate (Damascus, Aleppo, Homs, Latakia, Tartous, …) — public addresses only; architecture leaves room for full map/routing payloads later
- [x] Offline banner warning that verification and route data may be outdated

## PHASE 16 — PUBLIC PLACE DATABASE — DONE
- place_category on location_nodes + businesses, validate_place_category() trigger (18 categories, public-only), partial indexes.
- src/lib/place-categories.ts (taxonomy + RESIDENTIAL_NODE_TYPES), src/lib/places.functions.ts (listPublicPlaces, placeCategoryCounts), /places directory route.
- searchNetwork accepts category + drops residential node types; /search has category chips; header links /places.
- Category pickers in create wizard business step and dashboard branch form.

PHASE 17 — SEARCH IMPROVEMENT — DONE

PHASE 18 — ROUTING CONTEXTS — DONE
- access_point_contexts table (7 contexts, allowed/approach/preferred road/vehicle note, RLS owner+staff)
- resolver + navigation pick the entrance mapped to the active context
- context switcher on /a/CODE and /navigation/CODE, owner editor in /my-addresses

PHASE 19 — ADDRESS QUALITY ENGINE — DONE
- Internal 0-100 quality score per public node (src/lib/quality.server.ts): coordinates, street/neighborhood, building number, entrance, landmark, verification level, recent confirmation (<=180d), duplicate confidence, routing accessibility.
- qualityDashboard server fn (src/lib/quality.functions.ts), staff-only (verifier/moderator/admin).
- /admin/quality dashboard with six lists: incomplete, potential duplicates, stale, unverified businesses, missing coordinates, reported locations. Score never shown publicly.

PHASE 20 — COMMUNITY CORRECTIONS — DONE
- Correction types: wrong_location, wrong_business_name, business_closed, entrance_changed, duplicate_location, incorrect_category, access_issue, other (legacy labels kept).
- correction_reports extended: business_id, target_field, original_value, suggested_value, decision, decision_note, reviewed_by, reviewed_at, applied, applied_at, updated_at + validate_correction_report() trigger.
- reportCorrection snapshots the original value; nothing is written to live data on submit.
- reviewCorrection = moderator decision (approved/rejected/needs_more_info) with optional apply (coords, business name/category, place category, closed) via admin client after role check, + audit_logs entry.
- /admin/corrections moderation queue (original vs suggested, filters, reviewer note); /my-corrections reporter tracking.

PHASE 21 — ANALYTICS — DONE
- address_events gains search_appearance + qr_scan attribution (?s=qr on QR links, logged from /a/CODE).
- searchNetwork records aggregate search appearances for public results only (admin client, best-effort, no query text, no identity).
- orgAnalytics extended: qr_scan / delivery_view / search_appearance totals, daily series, richer per-location rows.
- src/lib/analytics.functions.ts → platformAnalytics (staff-only via has_role admin/moderator/verifier): active + verified addresses, business locations, addresses/locations created, resolutions, QR scans, navigation starts, delivery views + share, search appearances, API requests (api_usage), corrections submitted, daily series, top public addresses (residential node types and non-public nodes excluded).
- /admin/analytics dashboard (noindex) + link from /admin. No individual residential behaviour is exposed anywhere.

PHASE 22 — MONETIZATION ARCHITECTURE — DONE (no pricing)
- Tables: account_plans (user OR organization, plan free/business/developer/enterprise, status active/trialing/past_due/canceled, source, started_at, expires_at, notes, updated_by; one row per subject; RLS own/org-member/admin read, admin write) and platform_settings (entitlements = {enforced:false, pricing_published:false}) + set_updated_at() trigger fn.
- src/lib/plans.ts: plan catalogue, entitlement keys, per-plan limits (-1 = unlimited), Arabic labels, effectivePlan/hasEntitlement/limitFor/withinLimit. No prices anywhere.
- src/lib/plans.server.ts: userPlan/organizationPlan/resolvedPlan/strongerPlan, requireEntitlement + requireCapacity gated behind the entitlements.enforced flag (advisory until pricing launches), EntitlementError.
- src/lib/plans.functions.ts: myEntitlements (effective plan + usage counters), planAdminOverview, setAccountPlan (admin, audit-logged), setEntitlementSettings (admin, audit-logged).
- /plans public comparison page (free tier explicitly permanent), /admin/plans console (assign plans, enforcement + pricing toggles), plan card in dashboard settings, header link.

PHASE 23 — PRIVACY AND SECURITY — DONE
- privacy_preferences table (per-user, RLS own-row only): allow_share_phone/unit/floor/name/instructions/parking, default_share_hours, max_share_hours, require_expiry + validate trigger.
- src/lib/privacy.functions.ts: readPrivacy, filterSharedFields, clampShareHours, myPrivacy, updatePrivacy (audit-logged), mySharingActivity (temporary_addresses + route_shares, aggregate only), revokeShare, revokeAllShares.
- Share creation in addresses.functions.createTemporaryAddress and vault.functions.shareFromVault now strips owner-disabled fields server-side and clamps lifetime to max_share_hours.
- /privacy centre (noindex): toggles, link lifetimes, live share list with per-link and panic revoke, data-separation explainer. Header link for signed-in users.
- platform_settings: public read policy removed, admin-only; plan flags now read through the server admin client.
- Privilege-escalation guards: guard_trust_fields (verification_level/confidence_score/verification_method/last_verified_at/created_by/owner_id frozen for non-staff on location_nodes, access_points, businesses), guard_smart_address_owner, guard_business_claim_review (claimant may only withdraw). All guard fns REVOKEd from PUBLIC.
- Remaining linter notices are the pre-existing 15 (PostGIS spatial_ref_sys, extensions in public, SECURITY DEFINER exposure) — untouched by request.

PHASE 24 — INTERNATIONALIZATION — DONE (ar RTL / en LTR across all pages, i18n layer in src/lib/i18n.tsx)

PHASE 25 — MOBILE-FIRST DESIGN — DONE (bottom tab bar, /scan QR camera + manual fallback, install prompt, data-saver map tiles, reduced-motion + touch-target CSS)

PHASE 26 — HOMEPAGE POSITIONING — DONE (hero proposition "عنوان واحد. وصول أسهل." / "One Address. Easier Arrival." atop the resolver side panel; explanation line; primary CTAs Find Address → /search, Create Address → /create; secondary links For Businesses → /dashboard, For Developers → /developers; removed redundant "Actions" card + resolver title demoted to "Resolve a code"; head meta updated; map-dominant split-screen identity preserved)

- PHASE 27 — CORE PRODUCT LOOP — DONE (LoopStepper component; create success screen with code/QR/share/navigate; arrival confirm+correct panel in navigation; loop shown on /a/$code)
- PHASE 28 — DATABASE ARCHITECTURE — DONE (reviewed existing schema; added only missing entities: qr_codes, verification_documents, imports, import_rows, routing_profiles + seeds. Existing tables cover addresses/units/entrances/access profiles/claims/verifications/corrections/businesses/shares/api keys/api usage/org members/address events/saved addresses.)

PHASE 29 — PERFORMANCE — DONE (geospatial GiST + FK/lookup indexes; 60s public-only resolve cache; public cache headers on /api/public/resolve, no-store otherwise; reused server Supabase client; query staleTime + intent route preloading; lazy QrCard chunk; tile preconnect + async decoding)

PHASE 30 — ACCESSIBILITY — DONE (WCAG-oriented skip navigation and focus visibility; dynamic Arabic/English lang+dir; keyboard map selection; accessible Radix dialogs; labelled forms; announced loading, result, success, and error states; selected-state semantics; 44px mobile targets.)

PHASE 31 — TESTING — IN PROGRESS (24 unit/security/API checks and 6 mobile/desktop browser journeys pass; coverage includes privacy defaults, public response redaction/cache rules, missing/malformed API authentication, codes, QR validation, i18n direction, public-place exclusion, entrance-first routing, resolve/delivery/emergency pages, and announced invalid manual scans. Database-backed owner-vs-unrelated-user tests, claims/verification, imports, temporary-share expiry/revocation, and concurrency checks remain gated on isolated test identities.)
