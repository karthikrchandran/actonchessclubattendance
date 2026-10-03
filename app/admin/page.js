'use client';

import { useState } from 'react';

export default function Admin() {
  const [password, setPassword] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  async function load(e) {
    e.preventDefault(); setError('');
    const res = await fetch('/api/admin/report', { headers: { 'x-admin-password': password } });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Unable to load report');
    setRows(data.rows); setSummary(data.summary);
  }

  function showCard(row) {
    if (!row.qr_token) return setError('This older member does not have a QR yet. Ask them to use email/phone check-in once to upgrade their record.');
    setSelected(row);
  }

  return <main><section className="card admin-card">
    <h1>Attendance report</h1>
    <form onSubmit={load} className="row">
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Admin password" required />
      <button style={{marginTop:0}}>Load report</button>
    </form>
    {error && <div className="message error">{error}</div>}
    {summary && <div className="message"><b>{summary.totalMembers}</b> registered players · <b>{summary.totalCheckins}</b> total check-ins · <b>{summary.uniqueSessions}</b> club dates</div>}
    {rows.length > 0 && <div className="table-scroll"><table><thead><tr><th>Player</th><th>Grade</th><th>PIN</th><th>Visits</th><th>Last visit</th><th>Card</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.id}><td>{r.full_name}</td><td>{r.grade}</td><td><b>{r.member_code || '—'}</b></td><td>{r.visits}</td><td>{r.last_visit || '—'}</td><td><button className="mini-button" type="button" onClick={() => showCard(r)}>View</button></td></tr>)}
    </tbody></table></div>}

    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="member-card" onClick={e => e.stopPropagation()}>
      <div className="club-mark">♟ ACTON CHESS CLUB</div>
      <h2>{selected.full_name}</h2><p>Grade {selected.grade}</p>
      <img src={`/api/qr/${encodeURIComponent(selected.qr_token)}`} alt={`QR membership card for ${selected.full_name}`} />
      <div className="code-label">MEMBER PIN</div><div className="big-code">{selected.member_code}</div>
      <p className="card-note">Scan this QR or enter the member PIN to check in.</p>
      <button type="button" onClick={() => window.print()}>Print card</button>
      <button type="button" className="secondary" onClick={() => setSelected(null)}>Close</button>
    </div></div>}
  </section></main>;
}
