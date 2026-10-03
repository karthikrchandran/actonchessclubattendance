# Acton Chess Club Attendance

A free recurring attendance app for phone or iPad check-in, with 4-digit member PINs, email/phone recovery, and personal QR membership cards.

## Check-in flow

### First visit
1. Player enters name, grade, and a parent/guardian or student email/phone.
2. Contact is normalized and hashed before storage; only a masked hint is retained.
3. The app creates a unique 4-digit numeric member PIN and a separate long random QR token.
4. Attendance is recorded for that date.
5. The web app displays a membership card containing both the QR code and member PIN. A screenshot can be kept on the family phone.

### Returning visit
A player can use any of these methods:
- Enter the 4-digit PIN on the club iPad.
- Enter the exact email or phone used at registration if the PIN was forgotten.
- Scan the personal QR code with a phone and tap **Confirm check-in**.

If siblings share the same registration contact, the email/phone recovery flow shows only the players attached to that exact contact so the correct child can be selected.

Only one attendance record is allowed per player per calendar day.

## QR behavior

No native mobile app is required. QR cards render directly in the web app through `/api/qr/[token]`, which generates the QR image on the server. Scanning the code opens `/q/[token]` in the phone browser and asks for confirmation before recording attendance.

## Admin report

`/admin` shows registered players, 4-digit member PINs, total visits, last visit, and a **View** button to re-open/print a player's QR membership card.

## Setup

1. Create a free Supabase project.
2. Open Supabase SQL Editor and run `schema.sql`.
3. Create a Vercel project from this repository.
4. Add these Vercel environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
5. Deploy.
6. Keep the root URL open on the club iPad.

## Privacy design

For younger children, use a parent/guardian contact. Older students may use their own email/phone if appropriate. The original contact value is not stored; only a SHA-256 hash plus a masked hint is retained.

The personal QR does not contain the child's name, grade, phone, or email. It contains only a long random token that maps to the member on the server.
