'use client';

import { useState } from 'react';

const awardNames = ['Gold', 'Silver', 'Bronze'];

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`));
}

function AttendanceTrend({ data }) {
  if (!data.length) return <div className="empty-report">No attendance has been recorded yet.</div>;
  const width = 720;
  const height = 220;
  const paddingX = 34;
  const paddingY = 28;
  const maxCount = Math.max(...data.map(point => point.count), 1);
  const x = index => data.length === 1 ? width / 2 : paddingX + index * ((width - paddingX * 2) / (data.length - 1));
  const y = count => height - paddingY - (count / maxCount) * (height - paddingY * 2);
  const points = data.map((point, index) => `${x(index)},${y(point.count)}`).join(' ');

  return <div className="trend-wrap">
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Player attendance by club date">
      {[0, 0.5, 1].map(level => <line key={level} x1={paddingX} x2={width - paddingX} y1={y(maxCount * level)} y2={y(maxCount * level)} className="chart-gridline" />)}
      <polyline points={points} className="trend-line" />
      {data.map((point, index) => <circle key={point.date} cx={x(index)} cy={y(point.count)} r="5" className="trend-point"><title>{formatDate(point.date)}: {point.count} players</title></circle>)}
    </svg>
    <div className="chart-range"><span>{formatDate(data[0].date)}</span><b>Peak: {maxCount} players</b><span>{formatDate(data[data.length - 1].date)}</span></div>
  </div>;
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/report', { headers: { 'x-admin-password': password } });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Unable to load report');
      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  function showCard(row) {
    if (!row.qr_token) return setError('This older member does not have a QR yet. Ask them to use email/phone check-in once to upgrade their record.');
    setSelected(row);
  }

  const rows = report?.rows || [];
  const maxGradeCount = Math.max(...(report?.playersByGrade || []).map(item => item.count), 1);

  return <main className="admin-main"><section className="admin-shell">
    <header className="admin-header">
      <div className="admin-title"><img className="brand-logo" src="/logo.jpg" alt="Acton Chess Club logo" /><div><div className="admin-brand">ACTON CHESS CLUB</div><h1>Attendance dashboard</h1><p className="subtle">Club participation, player progress, and recognition</p></div></div>
      {report && <button type="button" className="refresh-button" onClick={load} disabled={loading}>Refresh</button>}
    </header>
    <form onSubmit={load} className="admin-login">
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Admin password" required />
      <button disabled={loading}>{loading ? 'Loading…' : 'Load dashboard'}</button>
    </form>
    {error && <div className="message error">{error}</div>}

    {report && <>
      <div className="metric-grid">
        <div className="metric"><span>Registered players</span><strong>{report.summary.totalMembers}</strong></div>
        <div className="metric"><span>Total check-ins</span><strong>{report.summary.totalCheckins}</strong></div>
        <div className="metric"><span>Club Saturdays</span><strong>{report.summary.uniqueSessions}</strong></div>
        <div className="metric"><span>Average per session</span><strong>{report.summary.uniqueSessions ? (report.summary.totalCheckins / report.summary.uniqueSessions).toFixed(1) : '0'}</strong></div>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-section trend-section">
          <div className="section-heading"><div><span>ATTENDANCE</span><h2>Players by club date</h2></div></div>
          <AttendanceTrend data={report.attendanceTrend} />
        </section>

        <section className="dashboard-section grade-section">
          <div className="section-heading"><div><span>MEMBERSHIP</span><h2>Players per grade</h2></div></div>
          <div className="grade-bars">
            {report.playersByGrade.map(item => <div className="grade-row" key={item.grade}>
              <b>{item.grade === 'K' ? 'K' : `Grade ${item.grade}`}</b>
              <div className="grade-track"><span style={{width: `${(item.count / maxGradeCount) * 100}%`}} /></div>
              <strong>{item.count}</strong>
            </div>)}
            {!report.playersByGrade.length && <div className="empty-report">No players registered yet.</div>}
          </div>
        </section>
      </div>

      <section className="dashboard-section awards-section">
        <div className="section-heading"><div><span>RECOGNITION</span><h2>Attendance awards</h2></div><div className="award-key">Gold: all sessions · Silver: 3 sessions · Bronze: fewer than 2</div></div>
        <div className="award-grid">
          {awardNames.map(name => {
            const winners = rows.filter(row => row.award === name);
            return <div className={`award-column ${name.toLowerCase()}`} key={name}>
              <div className="award-title"><b>{name}</b><strong>{report.awards[name]}</strong></div>
              <div className="winner-list">{winners.map(row => <div key={row.id}><span>{row.full_name}</span><b>{row.visits} {row.visits === 1 ? 'visit' : 'visits'}</b></div>)}{!winners.length && <p>No qualifiers yet</p>}</div>
            </div>;
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><div><span>DETAIL</span><h2>Player attendance</h2></div><b>{rows.length} players</b></div>
        <div className="table-scroll"><table><thead><tr><th>Player</th><th>Grade</th><th>PIN</th><th>Visits</th><th>Last visit</th><th>Award</th><th>Card</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.id}><td><b>{r.full_name}</b></td><td>{r.grade}</td><td>{r.member_code || '—'}</td><td>{r.visits}</td><td>{formatDate(r.last_visit)}</td><td>{r.award ? <span className={`award-badge ${r.award.toLowerCase()}`}>{r.award}</span> : '—'}</td><td><button className="mini-button" type="button" onClick={() => showCard(r)}>View</button></td></tr>)}
        </tbody></table></div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><div><span>SESSIONS</span><h2>Attendance by date</h2></div></div>
        <div className="session-list">{[...report.attendanceTrend].reverse().map(item => <div key={item.date}><span>{formatDate(item.date)}</span><b>{item.count} {item.count === 1 ? 'player' : 'players'}</b></div>)}</div>
      </section>
    </>}

    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="member-card" onClick={e => e.stopPropagation()}>
      <img className="card-logo" src="/logo.jpg" alt="Acton Chess Club logo" />
      <div className="club-mark">ACTON CHESS CLUB</div>
      <h2>{selected.full_name}</h2><p>Grade {selected.grade}</p>
      <img src={`/api/qr/${encodeURIComponent(selected.qr_token)}`} alt={`QR membership card for ${selected.full_name}`} />
      <div className="code-label">MEMBER PIN</div><div className="big-code">{selected.member_code}</div>
      <p className="card-note">Scan this QR or enter the member PIN to check in.</p>
      <button type="button" onClick={() => window.print()}>Print card</button>
      <button type="button" className="secondary" onClick={() => setSelected(null)}>Close</button>
    </div></div>}
  </section></main>;
}
