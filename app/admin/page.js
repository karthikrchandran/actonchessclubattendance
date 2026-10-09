'use client';

import { useState } from 'react';

function csvEscape(value) {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);

  async function load(e) {
    e.preventDefault(); setError(''); setNotice('');
    const res = await fetch('/api/admin/report', { headers: { 'x-admin-password': password } });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Unable to load report');
    setRows(data.rows); setSummary(data.summary);
  }

  function showCard(row) {
    if (!row.qr_token) return setError('This older member does not have a QR yet. Ask them to check in once to upgrade their record.');
    setSelected(row);
  }

  async function copyEmails() {
    const emails = [...new Set(rows.map(r => r.parent_email).filter(Boolean))];
    if (!emails.length) return setError('No full email addresses have been restored yet.');
    await navigator.clipboard.writeText(emails.join('; '));
    setNotice(`${emails.length} email${emails.length === 1 ? '' : 's'} copied.`);
  }

  function downloadCsv() {
    const header = ['Status','Source','Player','Grade','PIN','Email','Phone','WhatsApp','Visits','Last visit'];
    const lines = [header.map(csvEscape).join(',')];
    for (const r of rows) {
      lines.push([r.member_status, r.lead_source, r.full_name, r.grade, r.member_code, r.parent_email, r.parent_phone, r.whatsapp_phone, r.visits, r.last_visit].map(csvEscape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'acton-chess-club-members.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return <main><section className="card admin-card">
    <h1>Attendance report</h1>
    <form onSubmit={load} className="row">
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Admin password" required />
      <button style={{marginTop:0}}>Load report</button>
    </form>
    {error && <div className="message error">{error}</div>}
    {notice && <div className="message success">{notice}</div>}
    {summary && <>
      <div className="message"><b>{summary.totalMembers}</b> registered players · <b>{summary.totalLeads}</b> event contacts · <b>{summary.totalCheckins}</b> total check-ins · <b>{summary.uniqueSessions}</b> club dates</div>
      <div className="message"><b>{summary.completeContacts}</b> contacts recovered · <b>{summary.recoveryRemaining}</b> legacy records still need recovery · <b>{summary.missingEmail}</b> missing email · <b>{summary.missingPhone}</b> missing phone</div>
      <div className="admin-actions">
        <button type="button" onClick={copyEmails}>Copy all emails</button>
        <button type="button" className="secondary" onClick={downloadCsv}>Download CSV</button>
      </div>
    </>}
    {rows.length > 0 && <div className="table-scroll"><table><thead><tr><th>Status</th><th>Source</th><th>Player</th><th>Grade</th><th>PIN</th><th>Email</th><th>Phone</th><th>WhatsApp</th><th>Visits</th><th>Last visit</th><th>Card</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.id}><td>{r.member_status === 'lead' ? 'Event contact' : r.member_status}</td><td>{r.lead_source || '—'}</td><td>{r.full_name || '—'}</td><td>{r.grade || '—'}</td><td><b>{r.member_code || '—'}</b></td><td>{r.parent_email || 'Needs restore'}</td><td>{r.parent_phone || 'Needs restore'}</td><td>{r.whatsapp_phone || '—'}</td><td>{r.visits}</td><td>{r.last_visit || '—'}</td><td>{r.member_status === 'active' ? <button className="mini-button" type="button" onClick={() => showCard(r)}>View</button> : '—'}</td></tr>)}
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
