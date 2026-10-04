'use client';

import { use, useState } from 'react';

export default function QrCheckin({ params }) {
  const { token } = use(params);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function checkin() {
    setLoading(true); setStatus(null);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ qrToken: token })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');
      setStatus({ ok: true, text: data.alreadyCheckedIn ? `${data.firstName} is already checked in today.` : `Checked in! Welcome, ${data.firstName}.` });
    } catch (err) {
      setStatus({ ok: false, text: err.message });
    } finally { setLoading(false); }
  }

  return <main><section className="card qr-checkin">
    <img className="brand-logo centered" src="/logo.jpg" alt="Acton Chess Club logo" />
    <h1>Acton Chess Club</h1>
    <p className="subtle">Member QR check-in</p>
    <p>Confirm that you are at today’s chess club meeting.</p>
    <button onClick={checkin} disabled={loading}>{loading ? 'Checking in…' : 'Confirm check-in'}</button>
    {status && <div className={`message ${status.ok ? 'success' : 'error'}`}>{status.text}</div>}
  </section></main>;
}
