import { adminSupabase } from '../../../../lib/supabase';

export async function GET(req) {
  if (!process.env.ADMIN_PASSWORD || req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const db = adminSupabase();
    const { data: members, error: mErr } = await db.from('members').select('id, full_name, grade, member_code, qr_token').order('full_name');
    if (mErr) throw mErr;
    const { data: attendance, error: aErr } = await db.from('attendance').select('member_id, session_date');
    if (aErr) throw aErr;
    const byMember = new Map();
    const sessions = new Set();
    const attendanceByDate = new Map();
    for (const a of attendance) {
      sessions.add(a.session_date);
      attendanceByDate.set(a.session_date, (attendanceByDate.get(a.session_date) || 0) + 1);
      const x = byMember.get(a.member_id) || { visits: 0, last_visit: null };
      x.visits++;
      if (!x.last_visit || a.session_date > x.last_visit) x.last_visit = a.session_date;
      byMember.set(a.member_id, x);
    }
    const totalSessions = sessions.size;
    const rows = members.map(m => {
      const attendanceSummary = byMember.get(m.id) || { visits: 0, last_visit: null };
      let award = null;
      if (totalSessions > 0 && attendanceSummary.visits === totalSessions) award = 'Gold';
      else if (attendanceSummary.visits === 3) award = 'Silver';
      else if (attendanceSummary.visits < 2) award = 'Bronze';
      return { ...m, ...attendanceSummary, award };
    }).sort((a,b) => b.visits-a.visits || a.full_name.localeCompare(b.full_name));
    const gradeOrder = grade => grade === 'K' ? 0 : Number(grade) || 99;
    const playersByGrade = [...members.reduce((counts, member) => {
      counts.set(member.grade, (counts.get(member.grade) || 0) + 1);
      return counts;
    }, new Map())].map(([grade, count]) => ({ grade, count })).sort((a, b) => gradeOrder(a.grade) - gradeOrder(b.grade));
    const attendanceTrend = [...attendanceByDate].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    const awards = {
      Gold: rows.filter(row => row.award === 'Gold').length,
      Silver: rows.filter(row => row.award === 'Silver').length,
      Bronze: rows.filter(row => row.award === 'Bronze').length
    };
    return Response.json({
      rows,
      attendanceTrend,
      playersByGrade,
      awards,
      summary: { totalMembers: members.length, totalCheckins: attendance.length, uniqueSessions: totalSessions }
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Unable to load report.' }, { status: 500 });
  }
}
