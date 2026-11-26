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

## Appearance and daily reservations

Website & payment includes logo upload (recommended transparent PNG 1200×400), semantic hex/color-picker palette with scoped preview and contrast feedback, named marketing image replacement/reset with alternative text, and ordered gallery add/remove/reorder/reset. Hero/banner recommendations are 2400×1350; landscape/gallery/accommodation 1600×1200; portrait 1200×1600. Dimensions are guidance rather than upload rejection rules. Existing original files remain available. Main public marketing image uses, account illustration and accommodation fallback read the saved settings. Accommodation galleries remain in their offering editor with size guidance. The header/footer logo uses contain and preserves aspect ratio.

Palette roles cover public and staff backgrounds, text, borders, buttons and statuses. Photographic overlays remain fixed for readability. Existing contact email controls feed public footer/contact links. Saving persists through the existing content endpoint; unsaved changes affect only the scoped preview. Reset controls do not save automatically. Upload errors remain visible and save is disabled during upload.

Reservations opens in Daily list: date picker, previous/today/next, existing filters and 100-row pagination. It shows all overlapping stays in Philippines time, including arrival/departure, guest, status, total and Review. Other calendars, agenda and the full history table remain available. Administrator creation aligns the button with the input, with helper text in its own row and mobile stacking.

Permanent delete requires a separate explicit confirmation naming the booking. Guest controls appear only for an active awaiting-payment hold. Admin controls appear only on cancelled reservations, and explain financial-history erasure and changing reports. Server state remains authoritative; stale UI errors do not silently delete another state.

## Separate settings and booking payment records

Website Settings and Payment Settings are separate navigation items, forms and save actions. Website contains appearance/contact/FAQ/policy; Payment contains QR options and readiness. Every newly saved QR option is classified as GCash, Bank transfer or Other online payment; deposit percentages remain in accommodation configuration. Legacy options display an empty method selector until staff classify them.

Guests choose an option before seeing its single QR card. No QR appears before selection; changing selection replaces the displayed QR and instructions. Upload submits the selected option with proof. The selected method is a guest declaration; staff verify actual funds before confirming.

Booking review shows reservation status and payment status separately, with total/gross/refunds/net/remaining. Record payment asks for the individual amount (with a remaining-balance shortcut), method, received date, reference and acknowledgment. Online methods require existing unlinked proof or a new staff upload; cash needs no screenshot. History shows each entry's method/date/actor and linked proof; all booking proofs are also listed separately, including unverified uploads. Guests can open their booking proofs through the same private receipt action.

Finished is a separate manual checkout action available after arrival with zero balance. A refund may reopen payment status without erasing completion. Reservation tables show payment status/remaining; dashboard adds per-method collections/refunds/net. Errors remain visible and controls become usable again after failure.

The homepage hero, welcome image and accommodation cards use responsive optimization for bundled images. HTTPS owner images retain direct rendering to preserve existing arbitrary image-host support. Hero loads eagerly at high priority. Existing photographic styling and overlays are retained. Default FAQ copy no longer asserts an unverified food/pet policy.
