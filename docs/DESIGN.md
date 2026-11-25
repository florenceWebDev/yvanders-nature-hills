# Design direction

Selected: photographic nature retreat. Reference: https://kinsley.bslthemes.com/mountain/ — borrow large imagery, hospitality hierarchy, booking search and accommodation discovery; use original assets/copy. Rustic activity-first alternative considered.

Forest green, ivory/white, warm gold accents. Editorial serif headings, system sans body. 16px minimum body, visible keyboard focus, native date inputs, responsive card grids and reduced-motion support. Homepage promotes the campsite; detail page is the representative booking screen. Admin prioritizes legible forms/tables.

Supplied photos are permitted project inputs; room mappings, poster rates and policies need owner verification. No invented reviews, metrics, address or amenities. Show loading, empty, validation, upload, success, expiry and unavailable-service states.

## Implemented
Forest #173f35, deep #103329, ivory #f7f6f0, gold #e4c496; Libre Caslon Display headings, DM Sans body with local fallbacks. Shared buttons, offering cards, date search, pricing summary, status badges and admin form/table patterns. Supplied image derivatives are copies, not AI replacements. Full originals are preserved under assets/references/campsite-originals.

Desktop and mobile previews reviewed. Body content uses 16px and task controls use readable labels. Mobile hero sizing corrected after screenshot inspection. No fabricated reviews, ratings, addresses or business metrics.

Developer onboarding and workflow documentation now live in the handbook. Use the design guide for visible UI patterns and PROJECT for changed user journeys; no visual behavior changed in the documentation milestone.

## Navigation, readability and administration update

Active public links carry aria-current=page, stronger gold text and an underline; mobile uses a gold border/background. Nested accommodation pages activate Stay with us. Filters use aria-pressed and admin navigation marks the current section. Collapse header navigation at 1100px to avoid crowded tablet layouts.

Photographic homepage text now uses stronger overlays, white copy and supporting shadows. Body/muted colors are darker; small section labels and operational notices are larger. Preserve contrast when changing images. Desktop reporting uses labeled cards, bar trends with exact accessible tables, explicit date bases, and no invented demo earnings. Calendar maintains Monday-start seven-day geometry on desktop and switches to a chronological agenda at 800px rather than a misleading three-column month. Status text accompanies colors.


The full route/layout audit and remaining coverage limits are recorded in [AUDIT](AUDIT.md). Information and accommodation detail pages now have distinct browser titles.

## Configurable payment QRs

Admin → Website & payment provides up to three ordered payment options, each with a label, complete image preview/upload/replace, recipient and instructions. Add is disabled at three; remove and move up/down controls are keyboard accessible. Uploads preserve existing size/type checks, expose errors and disable payment controls/save while busy. Save persists the order; refresh remounts the editor from saved data. Zero options can be saved with payments disabled.

Guest instructions use booking snapshots and show every option with a separate open/save link. Cards use a container-width grid with a 220px minimum when available, equal columns, wrapping and centered contents. Images use contain rather than crop and cap at 300px width/340px height. Narrow containers stack cards without horizontal scrolling. Old single-QR snapshots still render. Guests pay through one option; proof submission remains unchanged.
