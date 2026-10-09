# Acton Chess Club Attendance

Next.js + Supabase attendance app for Acton Chess Club.

## Contact model

New registrations require:
- Player name
- Grade
- Parent/guardian email
- Parent/guardian phone

The supplied phone is also used as the WhatsApp number by default. A family can check **Use a different WhatsApp number** and provide a separate WhatsApp-capable number.

Existing members are NOT re-registered. Their member ID, 4-digit PIN, QR code, and attendance history are preserved. When an older member checks in by PIN or QR and any clear-text contact field is missing, the app asks them once to complete email, phone, and WhatsApp details on the existing record.

## Event contact QR code

`/join` is a contact-only signup page for event visitors. It records only a parent/guardian email and phone number as a `lead` row in `members`; no PIN, QR code, child details, or attendance record is created.

Use source-aware QR targets to identify where someone joined:

- `/join?source=bask-fair`
- `/join?source=great-road-stroll`
- `/join?source=weekly-meet`

When a lead later completes First visit registration, the app promotes the matching lead into an `active` member and generates the PIN and QR code at that point.

## Supabase migration

Run `schema.sql` in the Supabase SQL Editor before deploying this version. It adds `parent_email`, `parent_phone`, and `whatsapp_phone` without deleting existing data.

## Environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`

## Admin

`/admin` shows email, phone, WhatsApp number, attendance counts, and supports CSV export.

## One-time legacy contact recovery

Older member records that contain only `contact_hash` are not re-registered. After a successful PIN, QR, or legacy email/phone check-in, the app checks whether both `parent_email` and `parent_phone` are present. If either is missing, it shows a one-time recovery form. Once both values are saved, future check-ins do not show the recovery form.

The admin report includes a `legacy records still need recovery` count so recovery progress can be monitored.
