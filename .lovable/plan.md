# Universal accounts, address classification, and neutral business listings

## Goal
Keep one sign-in/account type for everyone. Classify the address itself—not the person—and make the basic national address layer free and neutral. Private residences remain private; genuine businesses remain discoverable even without a paid plan.

## What will change

### 1. Required address classification
- Add one canonical classification to every smart address:
  - Private residence
  - Business or shop
  - Office
  - Government institution
  - Healthcare facility
  - Hotel or accommodation
  - Building or residential complex
  - Warehouse or industrial facility
- Require the classification when creating or editing an address.
- Enforce privacy by classification on the server and in database rules:
  - Private residence is private by default and cannot be made publicly searchable.
  - All public/institutional/commercial classes use the public location layer and may have a business/place record.
- Preserve all current records. Existing records will be classified conservatively from their linked business, place category, and residential node type; ambiguous records will become `needs_classification` and their owner will be prompted before editing/publishing them.

### 2. Commercial-use detection and conversion review
- Add a review queue that records the address, reasons, score, status, owner response, reviewer, decision, and timestamps.
- Flag likely commercial misuse without deleting or hiding the address automatically. Signals include:
  - commercial terms in Arabic/English names or notes;
  - business category, hours, public phone, or website;
  - organization membership, multiple managers/employees, or multiple branches;
  - an already-known commercial location at the same node;
  - repeated navigation/direction activity from aggregate unrelated-use signals.
- Use deterministic, explainable rules rather than opaque AI. Deduplicate open flags and avoid storing visitor identity in detection evidence.
- Show the owner a bilingual notice asking them to convert the address into a free business listing.
- Add an owner conversion action and an administrator review action. Every classification, flag, conversion, and review decision is audit-logged.

### 3. Make private-address misuse unattractive
- Remove the public/private switch as an independent choice; derive visibility from classification.
- Ensure private residences never receive business metadata or public directory placement.
- Keep private addresses out of public search, nearby businesses, business analytics, leads, branch tools, and commercial contact actions.
- Keep secure code/link sharing and owner-only management for private residences. Existing privacy filters remain as a second layer.

### 4. Free foundational business layer
- Make these capabilities available on the free plan for correctly classified businesses:
  - business name and map position;
  - basic category;
  - Syriasan address code;
  - primary entrance and delivery pin;
  - ownership claim;
  - basic ownership review;
  - phone and opening hours.
- Never condition public search/map presence on subscription status. Search ranking will remain based on relevance, location, verification, and public usefulness—not payment.
- Keep paid plans for added control and value: enhanced verified badge, richer media/services, multiple entrances/floors/departments, branch management, business analytics, logistics integrations, API access, lead/booking buttons, and clearly labelled sponsored prominence.
- Update the plan catalogue and plans page with the message: “Add your basic business address to Syriasan for free. Upgrade to verify your business, manage branches, add detailed entrance and floor information, view analytics, and connect with customers and delivery providers.”

### 5. Existing workflows and administration
- Reuse the current create wizard, My Addresses, business dashboard, claims, search, places directory, and Admin Control Center.
- Add classification and review filters to the administrator address/business views.
- Preserve existing URLs, codes, redirects, claims, organizations, audit history, and public listings.
- Do not add payments, fake plans, fake businesses, or external integrations.

## Technical approach
- Add an address-classification enum/validated field and a commercial-review table through an additive migration, with explicit grants, RLS, indexes, validation triggers, and audit-safe functions.
- Backfill classifications in the migration using only existing deterministic data; do not overwrite user content.
- Centralize classification metadata and commercial-signal rules in shared modules so creation, editing, imports, API creation, and organization-created locations use the same validation.
- Gate premium actions at server functions, not only in the interface. Basic listing/resolution stays outside paid entitlement checks.
- Continue using aggregated address/navigation events; no personal residential behavior or visitor identity will be exposed.

## Verification
- Add tests for all eight classifications, mandatory classification, private-residence publication blocking, business conversion, review deduplication, free business discoverability, paid-feature boundaries, and audit logging.
- Re-run unit/security tests and critical browser journeys in Arabic RTL and English LTR, including mobile creation, search, conversion notice, and administrator review.
