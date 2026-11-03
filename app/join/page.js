'use client';

import { useEffect, useState } from 'react';

const grades = ['K','1','2','3','4','5','6','7','8','9','10','11','12'];

function titleCaseSource(value) {
  return String(value || 'General QR').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ContactFields({ values, onChange }) {
  return <>
    <label>Parent/guardian email</label>
    <input value={values.parentEmail} onChange={e => onChange('parentEmail', e.target.value)} required placeholder="parent@example.com" type="email" autoCapitalize="none" autoComplete="email" />

    <label>Parent/guardian phone</label>
    <input value={values.parentPhone} onChange={e => onChange('parentPhone', e.target.value)} required placeholder="978-555-1234" inputMode="tel" autoComplete="tel" />
    <p className="small">Phone is required. Acton Chess Club will use this number for WhatsApp messages unless you specify a different WhatsApp number below.</p>

    <label className="checkbox-row">
      <input type="checkbox" checked={values.useDifferentWhatsApp} onChange={e => onChange('useDifferentWhatsApp', e.target.checked)} />
      <span>This phone number does not receive WhatsApp messages / use a different WhatsApp number</span>
    </label>

    {values.useDifferentWhatsApp && <>
      <label>WhatsApp number</label>
      <input value={values.whatsappPhone} onChange={e => onChange('whatsappPhone', e.target.value)} required placeholder="WhatsApp-capable number" inputMode="tel" autoComplete="tel" />
    </>}
  </>;
}

export default function Join() {
  const [source, setSource] = useState('General QR');
  const [form, setForm] = useState({ name: '', grade: '', parentEmail: '', parentPhone: '', useDifferentWhatsApp: false, whatsappPhone: '' });
  const [status, setStatus] = useState(null);
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSource(titleCaseSource(new URLSearchParams(window.location.search).get('source')));
  }, []);

  function update(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setStatus(null); setCard(null);
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, source })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to complete registration.');

      const m = data.member;
      setCard({ name: m.full_name, grade: m.grade, memberCode: m.member_code, qrToken: m.qr_token });
      setStatus({
        ok: true,
        text: data.alreadyMember
          ? `${m.full_name} is already registered. Here is the existing member PIN and QR code.`
          : `${m.full_name} is registered. Save the PIN or QR code for future check-ins.`
      });
      setForm({ name: '', grade: '', parentEmail: '', parentPhone: '', useDifferentWhatsApp: false, whatsappPhone: '' });
    } catch (err) {
      setStatus({ ok: false, text: err.message });
    } finally { setLoading(false); }
  }

  return <main><section className="card">
    <header className="club-header"><img className="club-logo" src="/acton-chess-club-logo.jpg" alt="Acton Chess Club rook logo" /><div><h1>Acton Chess Club</h1><p className="subtle">Join the club</p></div></header>
    <p>Register the player once. We will create a 4-digit member PIN and personal QR code for future attendance check-ins.</p>
    <form onSubmit={submit}>
      <label>Player name</label>
      <input value={form.name} onChange={e => update('name', e.target.value)} autoComplete="name" required placeholder="First and last name" />
      <label>Grade</label>
      <select value={form.grade} onChange={e => update('grade', e.target.value)} required><option value="">Select grade</option>{grades.map(g => <option key={g} value={g}>{g}</option>)}</select>
      <ContactFields values={form} onChange={update} />
      <p className="small">A parent email or phone number may be shared by multiple children. Each player receives their own PIN and QR code.</p>
      <button disabled={loading}>{loading ? 'Creating membership…' : 'Join & create member card'}</button>
    </form>

    {status && <div className={`message ${status.ok ? 'success' : 'error'}`}>{status.text}</div>}

    {card && <div className="member-card-wrap"><div className="member-card">
      <div className="club-mark">♟ ACTON CHESS CLUB</div><h2>{card.name}</h2><p>Grade {card.grade}</p>
      <img src={`/api/qr/${encodeURIComponent(card.qrToken)}`} alt={`QR membership card for ${card.name}`} />
      <div className="code-label">MEMBER PIN</div><div className="big-code">{card.memberCode}</div>
      <p className="card-note">Take a screenshot of this card. At club meetings, scan the QR or enter the 4-digit PIN to check in.</p>
    </div></div>}
  </section></main>;
}
