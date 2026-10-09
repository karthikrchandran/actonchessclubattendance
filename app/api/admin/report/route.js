import { adminSupabase } from '../../../../lib/supabase';

export async function GET(req) {
  if (!process.env.ADMIN_PASSWORD || req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const db = adminSupabase();
    const { data: members, error: mErr } = await db.from('members')
      .select('id, full_name, grade, member_code, qr_token, parent_email, parent_phone, whatsapp_phone, member_status, lead_source')
      .order('created_at', { ascending: false });
    if (mErr) throw mErr;
    const { data: attendance, error: aErr } = await db.from('attendance').select('member_id, session_date');
    if (aErr) throw aErr;

    const byMember = new Map();
    const sessions = new Set();
    for (const a of attendance) {
      sessions.add(a.session_date);
      const x = byMember.get(a.member_id) || { visits: 0, last_visit: null };
      x.visits++;
      if (!x.last_visit || a.session_date > x.last_visit) x.last_visit = a.session_date;
      byMember.set(a.member_id, x);
    }

    const rows = members.map(m => ({ ...m, ...(byMember.get(m.id) || { visits: 0, last_visit: null }) }))
      .sort((a,b) => (a.member_status === 'lead') - (b.member_status === 'lead') || b.visits-a.visits || String(a.full_name || '').localeCompare(String(b.full_name || '')));

    return Response.json({
      rows,
      summary: {
        totalMembers: members.filter(m => m.member_status === 'active').length,
        totalLeads: members.filter(m => m.member_status === 'lead').length,
        totalCheckins: attendance.length,
        uniqueSessions: sessions.size,
        completeContacts: members.filter(m => m.member_status === 'active' && m.parent_email && m.parent_phone).length,
        recoveryRemaining: members.filter(m => m.member_status === 'active' && (!m.parent_email || !m.parent_phone)).length,
        missingEmail: members.filter(m => m.member_status === 'active' && !m.parent_email).length,
        missingPhone: members.filter(m => m.member_status === 'active' && !m.parent_phone).length,
        missingWhatsApp: members.filter(m => m.member_status === 'active' && !m.whatsapp_phone).length
      }
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Unable to load report.', detail: e?.message || String(e) }, { status: 500 });
  }
}
