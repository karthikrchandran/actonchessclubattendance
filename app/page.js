'use client';

import { useState } from 'react';
import QRCode from 'qrcode';

const grades = ['K','1','2','3','4','5','6','7','8','9','10','11','12'];

export default function Home() {
  const [mode, setMode] = useState('code');
  const [form, setForm] = useState({ name: '', grade: '', contact: '', memberCode: '' });
  const [status, setStatus] = useState(null);
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function submitCode(e) {
    e.preventDefault();
    await checkin({ memberCode: form.memberCode });
  }

  async function submitRegistration(e) {
    e.preventDefault();
    await checkin({ name: form.name, grade: form.grade, contact: form.contact }, true);
  }

  async function checkin(payload, showCard = false) {
    setLoading(true); setStatus(null); setCard(null);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');
      setStatus({ ok: true, text: data.alreadyCheckedIn ? `Already checked in today, ${data.firstName}.` : `Checked in! Welcome, ${data.firstName}.` });
      if (showCard && data.memberCode && data.qrToken) {
        const url = `${window.location.origin}/q/${data.qrToken}`;
        const qrDataUrl = await QRCode.toDataURL(url, { width: 360, margin: 2 });
        setCard({ name: data.fullName, grade: data.grade, memberCode: data.memberCode, qrDataUrl });
      }
      setForm({ name: '', grade: '', contact: '', memberCode: '' });
    } catch (err) {
      setStatus({ ok: false, text: err.message });
    } finally { setLoading(false); }
  }

  return (
    <main>
      <section className="card">
        <h1>♟ Acton Chess Club</h1>
        <p className="subtle">Saturday attendance check-in</p>

        <div className="tabs">
          <button type="button" className={mode === 'code' ? 'tab active' : 'tab'} onClick={() => { setMode('code'); setStatus(null); setCard(null); }}>Member PIN</button>
          <button type="button" className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => { setMode('register'); setStatus(null); setCard(null); }}>First visit</button>
        </div>

        {mode === 'code' ? <form onSubmit={submitCode}>
          <label>4-digit member PIN</label>
          <input className="member-code-input" value={form.memberCode} onChange={e => update('memberCode', e.target.value.replace(/\D/g, '').slice(0, 4))} required placeholder="Example: 4827" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" />
          <p className="small">Or scan your personal Acton Chess Club QR code with a phone.</p>
          <button disabled={loading}>{loading ? 'Checking in…' : 'Check in'}</button>
        </form> : <form onSubmit={submitRegistration}>
          <label>Player name</label>
          <input value={form.name} onChange={e => update('name', e.target.value)} autoComplete="name" required placeholder="First and last name" />

          <label>Grade</label>
          <select value={form.grade} onChange={e => update('grade', e.target.value)} required>
            <option value="">Select grade</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <label>Parent/guardian email or phone</label>
          <input value={form.contact} onChange={e => update('contact', e.target.value)} required placeholder="Email or phone" autoCapitalize="none" />
          <p className="small">Used to match the correct player. The contact itself is not stored.</p>
          <button disabled={loading}>{loading ? 'Creating member…' : 'Register & check in'}</button>
        </form>}

        {status && <div className={`message ${status.ok ? 'success' : 'error'}`}>{status.text}</div>}

        {card && <div className="member-card-wrap">
          <div className="member-card">
            <div className="club-mark">♟ ACTON CHESS CLUB</div>
            <h2>{card.name}</h2>
            <p>Grade {card.grade}</p>
            <img src={card.qrDataUrl} alt={`QR membership card for ${card.name}`} />
            <div className="code-label">MEMBER PIN</div>
            <div className="big-code">{card.memberCode}</div>
            <p className="card-note">Keep a screenshot of this card. Next Saturday, scan the QR or enter the 4-digit PIN.</p>
          </div>
        </div>}
      </section>
    </main>
  );
}
