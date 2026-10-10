'use client';

import { useEffect, useState } from 'react';

function titleCaseSource(value) {
  return String(value || 'General QR').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function Join() {
  const [source, setSource] = useState('General QR');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSource(titleCaseSource(new URLSearchParams(window.location.search).get('source')));
  }, []);

  async function submit(e) {
    e.preventDefault(); setLoading(true); setStatus(null);
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ parentEmail: email, parentPhone: phone, source }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save your details.');
      setStatus(data.alreadyMember ? 'You are already registered. We will keep you informed about club updates.' : data.alreadyJoined ? 'You are already on our updates list. Thank you!' : 'You are on the Acton Chess Club updates list. Thank you!');
      setEmail(''); setPhone('');
    } catch (err) { setStatus(err.message); } finally { setLoading(false); }
  }

  return <main><section className="card">
    <header className="club-header"><img className="club-logo" src="/acton-chess-club-logo.jpg" alt="Acton Chess Club rook logo" /><div><h1>Acton Chess Club</h1><p className="subtle">Get club updates</p></div></header>
    <p>Leave a parent/guardian email and mobile number for weekly meetings and upcoming events.</p>
    <form onSubmit={submit}>
      <label>Parent/guardian email</label>
      <input value={email} onChange={e => setEmail(e.target.value)} required type="email" autoComplete="email" autoCapitalize="none" placeholder="parent@example.com" />
      <label>Parent/guardian mobile number</label>
      <input value={phone} onChange={e => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" placeholder="978-555-1234" />
      <p className="small">We use this only for Acton Chess Club updates and do not share it.</p>
      <button disabled={loading}>{loading ? 'Saving…' : 'Get updates'}</button>
    </form>
    {status && <div className={`message ${status.startsWith('Unable') || status.startsWith('Enter') ? 'error' : 'success'}`}>{status}</div>}
  </section></main>;
}
