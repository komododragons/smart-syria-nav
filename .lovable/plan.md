# Phase 30 — Accessibility

## Goal
Bring Syriasan’s public, account, business, developer, and staff experiences in line with WCAG 2.2 AA principles while preserving the Arabic-first civic design and existing workflows.

## What will change
- Add a global skip link, reliable focus styles, correct Arabic/English document language and direction, and a single consistent main-content landmark.
- Make navigation, dialogs, map controls, tabs, segmented choices, and other custom controls fully keyboard-operable with visible state and accessible names.
- Associate every visible form label, hint, error, and required state with its field; announce submissions, loading states, successful updates, and failures to screen readers.
- Replace ambiguous or color-only states with text/icon cues and improve low-contrast text, placeholders, borders, and focus rings using the existing Navy Trust tokens.
- Enforce 44×44 minimum touch targets for primary mobile controls without changing desktop information density.
- Improve Arabic accessibility: update `lang` and `dir` when language changes, preserve LTR for codes/coordinates, and use clear Arabic announcements and error wording.
- Fix heading order, image alternatives, semantic lists/tables, and hidden/focusable content where the audit identifies issues.

## Validation
- Audit representative public, signed-in, creation, search, navigation, business, and staff pages at desktop and phone sizes.
- Test keyboard-only traversal, focus visibility, modal dismissal, and form errors.
- Run automated accessibility checks and verify zero critical violations on representative routes.
- Re-run the project checks and record Phase 30 in the roadmap.

## Technical details
- Prefer existing shadcn/Radix primitives for dialogs and controls rather than custom focus management.
- Keep one `<main id="main-content">` in the shared layout; route pages remain section-based.
- Use `aria-live`/`role="alert"` only for meaningful dynamic changes to avoid repetitive announcements.
- Keep map visuals supplemental: address resolution and navigation information must remain available as structured text.
