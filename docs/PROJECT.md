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

## Approved administration expansion

All admins may promote/remove existing verified accounts, with a last-admin safeguard. Reporting separates transaction-date collections/refunds from arrival-date confirmed booking value, with weekly/monthly/quarterly/yearly filtering. Full promo controls include complimentary reservations awaiting staff approval without payment proof. Booking calendars must use Philippines time and complete range data. Preserve the nature design while making active navigation and homepage text clearly visible.

## Approved appearance and reservation controls

Admins can replace marketing photos and accommodation galleries with recommended image dimensions, change logo, all main palette roles and contact email. Reservations has a daily table of every stay overlapping a selected Philippines day, in addition to calendar/history views. Guests can permanently delete their active awaiting-payment holds. Admins can permanently delete cancelled reservations, including receipts, financial entries and booking-specific audit history; historical reports change as explicitly selected. Delivered emails and provider backups are outside application deletion.

## Approved individual payment tracking

Separate Website Settings and Payment Settings. Guests choose the snapshotted payment option before its QR appears; retain that selection with proof. Admins verify a deposit, record later cash/GCash/bank/Other payments individually, and upload proof for online arrival payments. Proofs must remain viewable on the booking. Track gross receipts, refunds, net receipts and remaining balance per booking/method. Fully paid is independent of a staff-finished stay after checkout; completion requires arrival and zero balance. Refunds reopen balances. Preserve existing records and the nature design while auditing/fixing confirmed security, speed, content, UX and code-quality issues. No payment gateway or automated transfer is included.
