import crypto from 'crypto';
import { adminSupabase } from '../../../lib/supabase';

function cleanName(v) { return String(v || '').trim().replace(/\s+/g, ' '); }
function normalizeName(v) { return cleanName(v).toLowerCase(); }
function normalizeEmail(v) { return String(v || '').trim().toLowerCase(); }
function normalizePhone(v) { return String(v || '').replace(/\D/g, ''); }
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function validPhone(v) { return normalizePhone(v).length >= 10; }
function hash(v) { return crypto.createHash('sha256').update(v).digest('hex'); }
function newCode() { return String(crypto.randomInt(0, 10000)).padStart(4, '0'); }
function newToken() { return crypto.randomBytes(24).toString('base64url'); }
function cleanSource(v) { return String(v || 'General QR').trim().slice(0, 80) || 'General QR'; }

const memberSelect = 'id, full_name, grade, member_code, qr_token, parent_email, parent_phone, whatsapp_phone, contact_hash, member_status, lead_source';

async function allocateIdentity(db) {
  for (let i = 0; i < 32; i++) {
    const memberCode = newCode();
    const qrToken = newToken();
    const { data, error } = await db.from('members').select('id').or(`member_code.eq.${memberCode},qr_token.eq.${qrToken}`).limit(1);
    if (error) throw error;
    if (!data?.length) return { memberCode, qrToken };
  }
  throw new Error('Unable to allocate member identity');
}

async function ensureIdentity(db, member) {
  if (member.member_code && member.qr_token) return member;
  const { memberCode, qrToken } = await allocateIdentity(db);
  const { data, error } = await db.from('members')
    .update({ member_code: member.member_code || memberCode, qr_token: member.qr_token || qrToken })
    .eq('id', member.id)
    .select(memberSelect)
    .single();
  if (error) throw error;
  return data;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const name = cleanName(body.name);
    const normalizedName = normalizeName(name);
    const grade = String(body.grade || '').trim();
    const email = normalizeEmail(body.parentEmail);
    const phone = normalizePhone(body.parentPhone);
    const useDifferentWhatsApp = Boolean(body.useDifferentWhatsApp);
    const whatsapp = useDifferentWhatsApp ? normalizePhone(body.whatsappPhone) : phone;
    const source = cleanSource(body.source);

    if (name.length < 2 || !grade || !validEmail(email) || !validPhone(phone) || (useDifferentWhatsApp && !validPhone(whatsapp))) {
      return Response.json({ error: 'Please enter a valid player name, grade, parent/guardian email, and phone number.' }, { status: 400 });
    }

    const db = adminSupabase();
    const contactHash = hash(email);

    // Same parent contact may legitimately belong to multiple children. A duplicate is only
    // treated as the same member when name + grade + one supplied contact also match.
    const { data: candidates, error: candidateError } = await db.from('members')
      .select(memberSelect)
      .eq('normalized_name', normalizedName)
      .eq('grade', grade)
      .eq('member_status', 'active');
    if (candidateError) throw candidateError;

    let existing = (candidates || []).find(m =>
      m.contact_hash === contactHash ||
      normalizeEmail(m.parent_email) === email ||
      normalizePhone(m.parent_phone) === phone
    );

    if (existing) {
      existing = await ensureIdentity(db, existing);
      const { data: updated, error } = await db.from('members')
        .update({ parent_email: email, parent_phone: phone, whatsapp_phone: whatsapp, lead_source: source })
        .eq('id', existing.id)
        .select(memberSelect)
        .single();
      if (error) throw error;
      return Response.json({ ok: true, alreadyMember: true, member: updated });
    }

    const { memberCode, qrToken } = await allocateIdentity(db);
    const payload = {
      full_name: name,
      normalized_name: normalizedName,
      grade,
      contact_hash: contactHash,
      contact_hint: email.replace(/^(.{1,2}).*(@.*)$/, '$1***$2'),
      parent_email: email,
      parent_phone: phone,
      whatsapp_phone: whatsapp,
      member_status: 'active',
      lead_source: source,
      member_code: memberCode,
      qr_token: qrToken
    };

    // Preserve a contact-only legacy lead if one exists by converting a single matching lead.
    // Do not treat the parent contact itself as unique: siblings can create separate active members.
    const { data: emailLead, error: emailLeadError } = await db.from('members')
      .select('id')
      .eq('member_status', 'lead')
      .eq('parent_email', email)
      .limit(1);
    if (emailLeadError) throw emailLeadError;

    let lead = emailLead?.[0] || null;
    if (!lead) {
      const { data: phoneLead, error: phoneLeadError } = await db.from('members')
        .select('id')
        .eq('member_status', 'lead')
        .eq('parent_phone', phone)
        .limit(1);
      if (phoneLeadError) throw phoneLeadError;
      lead = phoneLead?.[0] || null;
    }

    let member;
    if (lead) {
      const { data, error } = await db.from('members').update(payload).eq('id', lead.id).select(memberSelect).single();
      if (error) throw error;
      member = data;
    } else {
      const { data, error } = await db.from('members').insert(payload).select(memberSelect).single();
      if (error) throw error;
      member = data;
    }

    return Response.json({ ok: true, alreadyMember: false, member });
  } catch (e) {
    console.error('JOIN ERROR:', e);
    return Response.json({ error: 'Unable to complete registration right now.', detail: e?.message || String(e) }, { status: 500 });
  }
}
