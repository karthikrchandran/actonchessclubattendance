import crypto from 'crypto';
import { adminSupabase } from '../../../lib/supabase';

function cleanName(v) { return v.trim().replace(/\s+/g, ' '); }
function normalizeName(v) { return cleanName(v).toLowerCase(); }
function normalizeContact(v) {
  const x = v.trim().toLowerCase();
  if (x.includes('@')) return x;
  return x.replace(/\D/g, '');
}
function hash(v) { return crypto.createHash('sha256').update(v).digest('hex'); }
function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function newCode() {
  // Four-digit numeric PIN. Leading zeroes are allowed (0000-9999).
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}
function newToken() { return crypto.randomBytes(24).toString('base64url'); }

async function allocateIdentity(db) {
  for (let i = 0; i < 32; i++) {
    const memberCode = newCode();
    const qrToken = newToken();
    const { data } = await db.from('members').select('id').or(`member_code.eq.${memberCode},qr_token.eq.${qrToken}`).limit(1);
    if (!data?.length) return { memberCode, qrToken };
  }
  throw new Error('Unable to allocate member identity');
}

async function recordAttendance(db, member) {
  const sessionDate = localDate();
  const { error } = await db.from('attendance').insert({ member_id: member.id, session_date: sessionDate });
  const alreadyCheckedIn = error?.code === '23505';
  if (error && !alreadyCheckedIn) throw error;
  return { alreadyCheckedIn, sessionDate };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const db = adminSupabase();

    // Fast returning-member check-in by 4-digit member PIN.
    if (body.memberCode) {
      const memberCode = String(body.memberCode).replace(/\D/g, '').slice(0, 4);
      const { data: member, error } = await db.from('members')
        .select('id, full_name, grade, member_code')
        .eq('member_code', memberCode)
        .maybeSingle();
      if (error) throw error;
      if (memberCode.length !== 4) return Response.json({ error: 'Enter your 4-digit member PIN.' }, { status: 400 });
      if (!member) return Response.json({ error: 'Member PIN not found. Please check the 4 digits or use your QR code.' }, { status: 404 });
      const attendance = await recordAttendance(db, member);
      return Response.json({ ok: true, ...attendance, firstName: member.full_name.split(' ')[0], fullName: member.full_name, grade: member.grade, memberCode: member.member_code });
    }

    // QR check-in. The QR contains only this random token.
    if (body.qrToken) {
      const qrToken = String(body.qrToken).trim();
      const { data: member, error } = await db.from('members')
        .select('id, full_name, grade, member_code')
        .eq('qr_token', qrToken)
        .maybeSingle();
      if (error) throw error;
      if (!member) return Response.json({ error: 'This member QR code is not recognized.' }, { status: 404 });
      const attendance = await recordAttendance(db, member);
      return Response.json({ ok: true, ...attendance, firstName: member.full_name.split(' ')[0], fullName: member.full_name, grade: member.grade, memberCode: member.member_code });
    }

    // First-time registration (also supports an existing v1 member).
    const name = cleanName(body.name || '');
    const grade = String(body.grade || '').trim();
    const contact = normalizeContact(body.contact || '');
    if (name.length < 2 || !grade || contact.length < 5) {
      return Response.json({ error: 'Please enter a valid name, grade, and parent/guardian email or phone.' }, { status: 400 });
    }

    const contactHash = hash(contact);
    const normalizedName = normalizeName(name);
    let { data: member, error: findError } = await db.from('members')
      .select('id, full_name, grade, member_code, qr_token')
      .eq('normalized_name', normalizedName)
      .eq('grade', grade)
      .eq('contact_hash', contactHash)
      .maybeSingle();
    if (findError) throw findError;

    let isNewMember = false;
    if (!member) {
      const { memberCode, qrToken } = await allocateIdentity(db);
      const { data, error } = await db.from('members').insert({
        full_name: name,
        normalized_name: normalizedName,
        grade,
        contact_hash: contactHash,
        contact_hint: contact.includes('@') ? contact.replace(/^(.{1,2}).*(@.*)$/, '$1***$2') : `***${contact.slice(-4)}`,
        member_code: memberCode,
        qr_token: qrToken
      }).select('id, full_name, grade, member_code, qr_token').single();
      if (error) throw error;
      member = data;
      isNewMember = true;
    } else if (!member.member_code || !member.qr_token) {
      // Upgrade members created with the earlier schema.
      const { memberCode, qrToken } = await allocateIdentity(db);
      const { data, error } = await db.from('members')
        .update({ member_code: member.member_code || memberCode, qr_token: member.qr_token || qrToken })
        .eq('id', member.id)
        .select('id, full_name, grade, member_code, qr_token')
        .single();
      if (error) throw error;
      member = data;
    }

    const attendance = await recordAttendance(db, member);
    return Response.json({
      ok: true,
      ...attendance,
      isNewMember,
      firstName: member.full_name.split(' ')[0],
      fullName: member.full_name,
      grade: member.grade,
      memberCode: member.member_code,
      qrToken: member.qr_token
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Unable to check in right now.' }, { status: 500 });
  }
}
