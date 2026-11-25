# Yvander’s Nature Hills project brief

1. **Project name:** Yvander’s Nature Hills
2. **Audience:** Prospective campers and venue visitors, registered guests, owner/admin staff.
3. **Outcome:** Discover the campsite and reserve real available inventory with manual payment verification.
4. **Journey:** Search → account → 30-minute hold → QR payment → screenshot → staff verification → confirmation email.
5. **Essentials:** Promotional pages; all offering types; guest history; booking/content admin; transactional emails.
6. **Excluded:** Payment gateway, automated refunds, channel sync, SMS, multi-offering cart.
7. **References:** Kinsley mountain hospitality layout; 15 supplied campsite photos/posters. Original brand is Yvander’s Nature Hills per user.
8. **Environment:** New project on Windows, Node/npm/Git present, no existing code. Desktop/mobile browser target.
9. **Constraints:** Managed services recommended; budget/deadline unknown; service credentials and verified business details outstanding.
10. **Success:** Guest can retrieve a persisted booking and confirmation; admin can maintain inventory/content without code.

## Acceptance criteria
- AC-01: A signed-in guest holds available inventory, uploads payment proof, and sees persisted pending status after reload.
- AC-02: Staff verifies payment, confirms once, and a queued confirmation email is delivered without duplicate booking actions.
- AC-03: Concurrent overlapping requests cannot exceed room/pool capacity.
- AC-04: Guests cannot access another guest’s records or private receipt; nonadmins cannot administer.
- AC-05: Admin can publish configured offerings, schedules, rates, images and page content.
- AC-06: Expired holds release capacity; failed upload and email have recoverable paths.

See IMPLEMENTATION-BRIEF.md for settled rules. Poster facts are draft content, not verified launch data.
