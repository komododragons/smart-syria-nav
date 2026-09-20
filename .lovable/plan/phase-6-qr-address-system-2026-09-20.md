# Phase 6 — QR address system

## What will be built
- Upgrade the existing QR popup into a complete QR action center for every address.
- Make the QR open the canonical public address page (`/a/CODE`) or the authorized temporary page (`/t/TOKEN`) without exposing private data.
- Add **Download QR**, **Print QR**, and **Share QR** actions.
- Add an **Address Plate** builder with A6, A5, A4, sticker, door-plate, and shop-window templates.
- Every plate will include the Syriasan name, QR code, smart code, Arabic scan instruction, and “Scan to Navigate”.
- Business plates may include the existing business logo when one is available.

## Experience
- Keep the current Arabic-first Navy Trust visual system.
- Show a live plate preview with a clear format selector and large actions.
- Preserve temporary-link expiry and field-level privacy; QR generation never changes address visibility.
- Ensure printable output uses the selected physical page size and excludes all surrounding interface controls.

## Technical details
- Extend the shared QR component rather than duplicating QR logic across pages.
- Export a high-resolution PNG from the rendered QR; use native share with a downloadable-file fallback when supported.
- Add format-specific print sizing and plate layouts in the global print stylesheet.
- Pass business logo data from business/address pages only; no database change is needed because businesses already have a `logo_url` field.
- Update all current QR entry points to canonical Syriasan URLs and add Phase 6 to the roadmap.
- Verify the QR dialog, download, plate formats, and print layout on desktop and mobile.
