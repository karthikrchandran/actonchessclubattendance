# Acton Chess Club Attendance

A free recurring attendance app for phone or iPad check-in, with both 4-digit member PINs and personal QR membership cards.

## Check-in flow

### First visit
1. Player enters name, grade, and one parent/guardian email or phone.
2. Contact is normalized and hashed before storage; only a masked hint is retained.
3. The app creates a unique 4-digit numeric member PIN and a separate long random QR token.
4. Attendance is recorded for that date.
5. The player sees a membership card containing both the QR code and member PIN. A screenshot can be kept on the family phone.

### Returning visit
- Enter the 4-digit numeric member PIN on the club iPad, **or**
- Scan the personal QR code with a phone and tap **Confirm check-in**.

Only one attendance record is allowed per player per calendar day.

## Admin report

`/admin` shows registered players, 4-digit member PINs, total visits, last visit, and a **View** button to re-open/print a player's QR membership card.

## Setup

1. Create a free Supabase project.
2. Open Supabase SQL Editor and run `schema.sql`.
   - If you already deployed v1, run the new `schema.sql` again. It safely adds the member-PIN and QR-token columns.
3. Create a Vercel project from this repository.
4. Add these Vercel environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
5. Deploy.
6. Keep the root URL open on the club iPad.

## Privacy design

For a children's club, use a parent/guardian contact rather than the child's phone/email. The contact value itself is not stored; only a SHA-256 hash plus a masked hint is retained.

The personal QR does **not** contain the child's name, grade, phone, or email. It contains only a long random token that maps to the member on the server.

## Existing v1 members

A member created before this update will automatically receive a member PIN and QR token the next time they use the **First visit** form with the same name, grade, and parent contact.

## Good next additions

- CSV report download
- Session attendance dashboard (today / month / all-time)
- Friendly attendance streaks or badges
- Bulk printable membership-card sheet
- Admin login with Supabase Auth instead of a shared password
