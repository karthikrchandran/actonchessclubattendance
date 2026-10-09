'use client';

import { use, useState } from 'react';

export default function QrCheckin({ params }) {
  const { token } = use(params);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pendingContact, setPendingContact] = useState(false);
  const [contact, setContact] = useState({ parentEmail: '', parentPhone: '', useDifferentWhatsApp: false, whatsappPhone: '' });
  function update(key, value) { setContact(c => ({ ...c, [key]: value })); }

  async function checkin() {
    setLoading(true); setStatus(null); setPendingContact(false);
    try {
      const res = await fetch('/api/checkin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ qrToken: token }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');
      setStatus({ ok: true, text: data.alreadyCheckedIn ? `${data.firstName} is already checked in today.` : `Checked in! Welcome, ${data.firstName}.` });
      if (data.needsContactUpdate) setPendingContact(true);
    } catch (err) { setStatus({ ok: false, text: err.message }); }
    finally { setLoading(false); }
  }

  async function saveContact(e) {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updateContactDetails: true, authQrToken: token, ...contact })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save contact information');
      setPendingContact(false);
      setStatus({ ok: true, text: `Contact information updated for ${data.firstName}.` });
    } catch (err) { setStatus({ ok: false, text: err.message }); }
    finally { setLoading(false); }
  }

  return <main><section className="card qr-checkin">
    <h1>♟ Acton Chess Club</h1><p className="subtle">Member QR check-in</p><p>Confirm that you are at today’s chess club meeting.</p>
    <button onClick={checkin} disabled={loading}>{loading ? 'Checking in…' : 'Confirm check-in'}</button>
    {status && <div className={`message ${status.ok ? 'success' : 'error'}`}>{status.text}</div>}
    {pendingContact && <form className="contact-restore" onSubmit={saveContact}>
      <h3>One-time contact recovery</h3>
      <p className="small">You are already checked in. Some older registrations stored only a one-way contact hash. Please confirm the parent/guardian email and phone once. After both are saved, this prompt will not appear again. This does not register the player again.</p>
      <label>Parent/guardian email</label><input type="email" value={contact.parentEmail} onChange={e => update('parentEmail', e.target.value)} required placeholder="parent@example.com" />
      <label>Parent/guardian phone</label><input inputMode="tel" value={contact.parentPhone} onChange={e => update('parentPhone', e.target.value)} required placeholder="978-555-1234" />
      <p className="small">Phone is required. The club will use this number for WhatsApp messages unless you specify a different WhatsApp number.</p>
      <label className="checkbox-row"><input type="checkbox" checked={contact.useDifferentWhatsApp} onChange={e => update('useDifferentWhatsApp', e.target.checked)} /><span>Use a different WhatsApp number</span></label>
      {contact.useDifferentWhatsApp && <><label>WhatsApp number</label><input inputMode="tel" value={contact.whatsappPhone} onChange={e => update('whatsappPhone', e.target.value)} required placeholder="WhatsApp-capable number" /></>}
      <button disabled={loading}>{loading ? 'Saving…' : 'Save contact information'}</button>
    </form>}
  </section></main>;
}
