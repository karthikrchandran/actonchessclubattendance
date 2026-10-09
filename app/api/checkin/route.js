import crypto from 'crypto';
import { adminSupabase } from '../../../lib/supabase';

function cleanName(v) { return String(v || '').trim().replace(/\s+/g, ' '); }
function normalizeName(v) { return cleanName(v).toLowerCase(); }
function normalizeEmail(v) { return String(v || '').trim().toLowerCase(); }
function normalizePhone(v) { return String(v || '').replace(/\D/g, ''); }
function normalizeContact(v) {
  const x = String(v || '').trim().toLowerCase();
  if (x.includes('@')) return x;
  return normalizePhone(x);
}
function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function validPhone(v) { return normalizePhone(v).length >= 10; }
function hash(v) { return crypto.createHash('sha256').update(v).digest('hex'); }
function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function newCode() { return String(crypto.randomInt(0, 10000)).padStart(4, '0'); }
function newToken() { return crypto.randomBytes(24).toString('base64url'); }

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

async function getMemberByCredential(db, body) {
  if (body.authMemberCode) {
    const code = String(body.authMemberCode).replace(/\D/g, '').slice(0, 4);
    if (code.length !== 4) return null;
    const { data, error } = await db.from('members').select(memberSelect).eq('member_code', code).eq('member_status', 'active').maybeSingle();
    if (error) throw error;
    return data;
  }
  if (body.authQrToken) {
    const { data, error } = await db.from('members').select(memberSelect).eq('qr_token', String(body.authQrToken).trim()).eq('member_status', 'active').maybeSingle();
    if (error) throw error;
    return data;
  }
  if (body.authContact) {
    const normalized = normalizeContact(body.authContact);
    if (normalized.length < 5) return null;
    const { data, error } = await db.from('members').select(memberSelect).eq('contact_hash', hash(normalized)).eq('member_status', 'active').limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }
  return null;
}

async function saveContactDetails(db, member, body) {
  const email = normalizeEmail(body.parentEmail || '');
  const phone = normalizePhone(body.parentPhone || '');
  const useDifferentWhatsApp = Boolean(body.useDifferentWhatsApp);
  const whatsapp = useDifferentWhatsApp ? normalizePhone(body.whatsappPhone || '') : phone;

  if (!validEmail(email)) throw new Error('Enter a valid parent/guardian email address.');
  if (!validPhone(phone)) throw new Error('Enter a valid parent/guardian phone number.');
  if (useDifferentWhatsApp && !validPhone(whatsapp)) throw new Error('Enter a valid WhatsApp number.');

  const { data, error } = await db.from('members')
    .update({ parent_email: email, parent_phone: phone, whatsapp_phone: whatsapp })
    .eq('id', member.id)
    .select(memberSelect)
    .single();
  if (error) throw error;
  return data;
}

async function recordAttendance(db, member) {
  const sessionDate = localDate();
  const { error } = await db.from('attendance').insert({ member_id: member.id, session_date: sessionDate });
  const alreadyCheckedIn = error?.code === '23505';
  if (error && !alreadyCheckedIn) throw error;
  return { alreadyCheckedIn, sessionDate };
}

function memberResponse(member, attendance = {}) {
  return {
    ok: true,
    ...attendance,
    memberId: member.id,
    firstName: member.full_name.split(' ')[0],
    fullName: member.full_name,
    grade: member.grade,
    memberCode: member.member_code,
    qrToken: member.qr_token,
    hasEmail: Boolean(member.parent_email),
    hasPhone: Boolean(member.parent_phone),
    hasWhatsApp: Boolean(member.whatsapp_phone),
    // Legacy records prompt exactly once until both clear-text contact fields are recovered.
    needsContactUpdate: !member.parent_email || !member.parent_phone
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const db = adminSupabase();

    // Existing member contact completion. Requires the same PIN, QR token, or original hashed contact used to identify the member.
    if (body.updateContactDetails) {
      const member = await getMemberByCredential(db, body);
      if (!member) return Response.json({ error: 'Unable to verify this member. Please check in again.' }, { status: 401 });
      const updated = await saveContactDetails(db, member, body);
      return Response.json({ ...memberResponse(updated), contactSaved: true });
    }

    if (body.memberCode) {
      const memberCode = String(body.memberCode).replace(/\D/g, '').slice(0, 4);
      if (memberCode.length !== 4) return Response.json({ error: 'Enter your 4-digit member PIN.' }, { status: 400 });
      const { data, error } = await db.from('members').select(memberSelect).eq('member_code', memberCode).eq('member_status', 'active').maybeSingle();
      if (error) throw error;
      if (!data) return Response.json({ error: 'Member PIN not found. Try the email/phone option or use your QR code.' }, { status: 404 });
      const member = await ensureIdentity(db, data);
      const attendance = await recordAttendance(db, member);
      return Response.json({ ...memberResponse(member, attendance), verificationMethod: 'pin' });
    }

    // Existing-member lookup using the exact email/phone originally supplied. Older hashes remain usable.
    if (body.contactLookup) {
      const contact = normalizeContact(body.contactLookup);
      if (contact.length < 5) return Response.json({ error: 'Enter the email or phone used when the player registered.' }, { status: 400 });
      const contactHash = hash(contact);
      const { data, error } = await db.from('members').select(memberSelect).eq('contact_hash', contactHash).eq('member_status', 'active').order('full_name');
      if (error) throw error;
      if (!data?.length) {
        // Also support the new clear-text fields for members whose current contact differs from the legacy hash.
        const email = contact.includes('@') ? contact : null;
        const phone = contact.includes('@') ? null : contact;
        let query = db.from('members').select(memberSelect);
        query = email ? query.eq('parent_email', email) : query.or(`parent_phone.eq.${phone},whatsapp_phone.eq.${phone}`);
        query = query.eq('member_status', 'active');
        const second = await query.order('full_name');
        if (second.error) throw second.error;
        if (!second.data?.length) return Response.json({ error: 'No player was found with that email or phone.' }, { status: 404 });
        data.push(...second.data);
      }

      const members = [];
      for (const row of data) members.push(await ensureIdentity(db, row));
      if (members.length > 1) {
        return Response.json({
          ok: true,
          requiresSelection: true,
          verificationMethod: 'contact',
          verificationContact: contact,
          matches: members.map(m => ({ fullName: m.full_name, grade: m.grade, memberCode: m.member_code }))
        });
      }
      const member = members[0];
      const attendance = await recordAttendance(db, member);
      return Response.json({ ...memberResponse(member, attendance), verificationMethod: 'contact', verificationContact: contact });
    }

    if (body.qrToken) {
      const qrToken = String(body.qrToken).trim();
      const { data: member, error } = await db.from('members').select(memberSelect).eq('qr_token', qrToken).eq('member_status', 'active').maybeSingle();
      if (error) throw error;
      if (!member) return Response.json({ error: 'This member QR code is not recognized.' }, { status: 404 });
      const attendance = await recordAttendance(db, member);
      return Response.json({ ...memberResponse(member, attendance), verificationMethod: 'qr' });
    }

    // First-time registration: email AND phone are required. The supplied phone is the WhatsApp number unless a different one is explicitly provided.
    const name = cleanName(body.name);
    const grade = String(body.grade || '').trim();
    const email = normalizeEmail(body.parentEmail);
    const phone = normalizePhone(body.parentPhone);
    const useDifferentWhatsApp = Boolean(body.useDifferentWhatsApp);
    const whatsapp = useDifferentWhatsApp ? normalizePhone(body.whatsappPhone) : phone;

    if (name.length < 2 || !grade || !validEmail(email) || !validPhone(phone) || (useDifferentWhatsApp && !validPhone(whatsapp))) {
      return Response.json({ error: 'Please enter a valid name, grade, parent/guardian email, and phone number.' }, { status: 400 });
    }

    // Use email as the stable legacy contact hash for new records while storing all contact values in clear text.
    const contactHash = hash(email);
    const normalizedName = normalizeName(name);
    let { data: member, error: findError } = await db.from('members')
      .select(memberSelect)
      .eq('normalized_name', normalizedName)
      .eq('grade', grade)
      .eq('contact_hash', contactHash)
      .maybeSingle();
    if (findError) throw findError;

    let isNewMember = false;
    if (!member) {
      const { memberCode, qrToken } = await allocateIdentity(db);
      // Turn a contact-only event signup into a member rather than duplicating it.
      let leadQuery = db.from('members').select(memberSelect).eq('member_status', 'lead');
      leadQuery = leadQuery.or(`parent_email.eq.${email},parent_phone.eq.${phone}`).limit(1);
      const { data: lead, error: leadError } = await leadQuery.maybeSingle();
      if (leadError) throw leadError;

      const payload = {
        full_name: name, normalized_name: normalizedName, grade, contact_hash: contactHash,
        contact_hint: email.replace(/^(.{1,2}).*(@.*)$/, '$1***$2'),
        parent_email: email, parent_phone: phone, whatsapp_phone: whatsapp,
        member_status: 'active', member_code: memberCode, qr_token: qrToken
      };
      if (lead) {
        const { data, error } = await db.from('members').update(payload).eq('id', lead.id).select(memberSelect).single();
        if (error) throw error;
        member = data;
      } else {
        const { data, error } = await db.from('members').insert(payload).select(memberSelect).single();
        if (error) throw error;
        member = data;
      }
      isNewMember = true;
    } else {
      member = await ensureIdentity(db, member);
      member = await saveContactDetails(db, member, { parentEmail: email, parentPhone: phone, useDifferentWhatsApp, whatsappPhone: whatsapp });
    }

    const attendance = await recordAttendance(db, member);
    return Response.json({ ...memberResponse(member, attendance), isNewMember });
  } catch (e) {
    console.error('CHECKIN ERROR:', e);
    return Response.json({ error: 'Unable to check in right now.', detail: e?.message || String(e) }, { status: 500 });
  }
}
