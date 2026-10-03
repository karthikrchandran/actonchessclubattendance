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
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}
function newToken() { return crypto.randomBytes(24).toString('base64url'); }

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
    .select('id, full_name, grade, member_code, qr_token')
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

function memberResponse(member, attendance) {
  return {
    ok: true,
    ...attendance,
    firstName: member.full_name.split(' ')[0],
    fullName: member.full_name,
    grade: member.grade,
    memberCode: member.member_code,
    qrToken: member.qr_token
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const db = adminSupabase();

    // Returning-member check-in by 4-digit member PIN.
    if (body.memberCode) {
      const memberCode = String(body.memberCode).replace(/\D/g, '').slice(0, 4);
      if (memberCode.length !== 4) return Response.json({ error: 'Enter your 4-digit member PIN.' }, { status: 400 });
      const { data, error } = await db.from('members')
        .select('id, full_name, grade, member_code, qr_token')
        .eq('member_code', memberCode)
        .maybeSingle();
      if (error) throw error;
      if (!data) return Response.json({ error: 'Member PIN not found. Try the email/phone option or use your QR code.' }, { status: 404 });
      const member = await ensureIdentity(db, data);
      const attendance = await recordAttendance(db, member);
      return Response.json(memberResponse(member, attendance));
    }

    // Forgot-PIN recovery/check-in using the exact email or phone used at registration.
    if (body.contactLookup) {
      const contact = normalizeContact(String(body.contactLookup));
      if (contact.length < 5) return Response.json({ error: 'Enter the email or phone used when the player registered.' }, { status: 400 });
      const contactHash = hash(contact);
      const { data, error } = await db.from('members')
        .select('id, full_name, grade, member_code, qr_token')
        .eq('contact_hash', contactHash)
        .order('full_name');
      if (error) throw error;
      if (!data?.length) return Response.json({ error: 'No player was found with that email or phone. Check the value or use First visit.' }, { status: 404 });

      const members = [];
      for (const row of data) members.push(await ensureIdentity(db, row));

      if (members.length > 1) {
        return Response.json({
          ok: true,
          requiresSelection: true,
          matches: members.map(m => ({ fullName: m.full_name, grade: m.grade, memberCode: m.member_code }))
        });
      }

      const member = members[0];
      const attendance = await recordAttendance(db, member);
      return Response.json(memberResponse(member, attendance));
    }

    // QR check-in. The QR contains only this random token.
    if (body.qrToken) {
      const qrToken = String(body.qrToken).trim();
      const { data: member, error } = await db.from('members')
        .select('id, full_name, grade, member_code, qr_token')
        .eq('qr_token', qrToken)
        .maybeSingle();
      if (error) throw error;
      if (!member) return Response.json({ error: 'This member QR code is not recognized.' }, { status: 404 });
      const attendance = await recordAttendance(db, member);
      return Response.json(memberResponse(member, attendance));
    }

    // First-time registration (also finds an existing member with the same name, grade and contact).
    const name = cleanName(body.name || '');
    const grade = String(body.grade || '').trim();
    const contact = normalizeContact(body.contact || '');
    if (name.length < 2 || !grade || contact.length < 5) {
      return Response.json({ error: 'Please enter a valid name, grade, and email or phone.' }, { status: 400 });
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
    } else {
      member = await ensureIdentity(db, member);
    }

    const attendance = await recordAttendance(db, member);
    return Response.json({ ...memberResponse(member, attendance), isNewMember });
  } catch (e) {
    console.error('CHECKIN ERROR:', e);
    return Response.json({ error: 'Unable to check in right now.' }, { status: 500 });
  }
}
