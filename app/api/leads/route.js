import crypto from 'crypto';
import { adminSupabase } from '../../../lib/supabase';

function normalizeEmail(v) { return String(v || '').trim().toLowerCase(); }
function normalizePhone(v) { return String(v || '').replace(/\D/g, ''); }
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function validPhone(v) { return normalizePhone(v).length >= 10; }
function hash(v) { return crypto.createHash('sha256').update(v).digest('hex'); }
function cleanSource(v) { return String(v || 'General QR').trim().slice(0, 80) || 'General QR'; }
function hint(email) { return email.replace(/^(.{1,2}).*(@.*)$/, '$1***$2'); }

export async function POST(req) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.parentEmail);
    const phone = normalizePhone(body.parentPhone);
    if (!validEmail(email) || !validPhone(phone)) {
      return Response.json({ error: 'Enter a valid parent/guardian email and phone number.' }, { status: 400 });
    }

    const db = adminSupabase();
    const { data: existing, error: existingError } = await db.from('members')
      .select('id, member_status')
      .or(`parent_email.eq.${email},parent_phone.eq.${phone}`)
      .limit(1);
    if (existingError) throw existingError;

    if (existing?.length) {
      const record = existing[0];
      if (record.member_status === 'lead') {
        const { error } = await db.from('members').update({ lead_source: cleanSource(body.source) }).eq('id', record.id);
        if (error) throw error;
        return Response.json({ ok: true, alreadyJoined: true });
      }
      return Response.json({ ok: true, alreadyMember: true });
    }

    const { error } = await db.from('members').insert({
      contact_hash: hash(email), contact_hint: hint(email), parent_email: email,
      parent_phone: phone, member_status: 'lead', lead_source: cleanSource(body.source)
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    console.error('LEAD SIGNUP ERROR:', e);
    return Response.json({ error: 'Unable to save your contact details right now.' }, { status: 500 });
  }
}
