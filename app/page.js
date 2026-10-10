'use client';

import { useState } from 'react';

const grades = ['K','1','2','3','4','5','6','7','8','9','10','11','12'];

function ContactFields({ values, onChange, prefix = '' }) {
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

export default function Home() {
  const [mode, setMode] = useState('code');
  const [returnMethod, setReturnMethod] = useState('pin');
  const [form, setForm] = useState({ name: '', grade: '', memberCode: '', lookupContact: '', parentEmail: '', parentPhone: '', useDifferentWhatsApp: false, whatsappPhone: '' });
  const [status, setStatus] = useState(null);
  const [card, setCard] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingContact, setPendingContact] = useState(null);
  const [restore, setRestore] = useState({ parentEmail: '', parentPhone: '', useDifferentWhatsApp: false, whatsappPhone: '' });

  function update(key, value) { setForm(f => ({ ...f, [key]: value })); }
  function updateRestore(key, value) { setRestore(f => ({ ...f, [key]: value })); }

  function resetMessages() {
    setStatus(null); setCard(null); setMatches([]); setPendingContact(null);
    setRestore({ parentEmail: '', parentPhone: '', useDifferentWhatsApp: false, whatsappPhone: '' });
  }

  async function submitCode(e) { e.preventDefault(); await checkin({ memberCode: form.memberCode }, false, { authMemberCode: form.memberCode }); }
  async function submitContact(e) { e.preventDefault(); await checkin({ contactLookup: form.lookupContact }, true, { authContact: form.lookupContact }); }
  async function submitRegistration(e) {
    e.preventDefault();
    await checkin({ name: form.name, grade: form.grade, parentEmail: form.parentEmail, parentPhone: form.parentPhone, useDifferentWhatsApp: form.useDifferentWhatsApp, whatsappPhone: form.whatsappPhone }, true);
  }
  async function chooseMatch(memberCode) { await checkin({ memberCode }, true, { authMemberCode: memberCode }); }

  async function saveRestoredContact(e) {
    e.preventDefault();
    if (!pendingContact) return;
    setLoading(true);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updateContactDetails: true, ...pendingContact.verifier, ...restore })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save contact information');
      setPendingContact(null);
      setRestore({ parentEmail: '', parentPhone: '', useDifferentWhatsApp: false, whatsappPhone: '' });
      setStatus({ ok: true, text: `Contact information updated for ${data.firstName}.` });
    } catch (err) {
      setStatus({ ok: false, text: err.message });
    } finally { setLoading(false); }
  }

  async function checkin(payload, showCard = false, verifier = null) {
    setLoading(true); setStatus(null); setCard(null); setPendingContact(null);
    try {
      const res = await fetch('/api/checkin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');

      if (data.requiresSelection) {
        setMatches(data.matches || []);
        setStatus({ ok: true, text: 'More than one player uses that contact. Select the correct player.' });
        return;
      }

      setMatches([]);
      setStatus({ ok: true, text: data.alreadyCheckedIn ? `Already checked in today, ${data.firstName}.` : `Checked in! Welcome, ${data.firstName}.` });
      if (data.needsContactUpdate && verifier) {
        const lookup = String(verifier.authContact || '').trim();
        const looksLikeEmail = lookup.includes('@');
        const looksLikePhone = !looksLikeEmail && lookup.replace(/\D/g, '').length >= 10;
        setRestore(r => ({
          ...r,
          parentEmail: data.hasEmail ? r.parentEmail : (looksLikeEmail ? lookup.toLowerCase() : ''),
          parentPhone: data.hasPhone ? r.parentPhone : (looksLikePhone ? lookup : '')
        }));
        setPendingContact({ firstName: data.firstName, verifier });
      }
      if (showCard && data.memberCode && data.qrToken) setCard({ name: data.fullName, grade: data.grade, memberCode: data.memberCode, qrToken: data.qrToken });
      setForm(f => ({ ...f, name: '', grade: '', memberCode: '', lookupContact: '', parentEmail: '', parentPhone: '', useDifferentWhatsApp: false, whatsappPhone: '' }));
    } catch (err) {
      setMatches([]); setStatus({ ok: false, text: err.message });
    } finally { setLoading(false); }
  }

  return <main><section className="card">
    <header className="club-header">
      <img className="club-logo" src="/acton-chess-club-logo.jpg" alt="Acton Chess Club rook logo" />
      <div><h1>Acton Chess Club</h1><p className="subtle">Saturday attendance check-in</p></div>
    </header>
    <fieldset className="mode-options" aria-label="Choose check-in type">
      <label className={mode === 'register' ? 'mode-option selected' : 'mode-option'}><input type="radio" name="checkin-mode" checked={mode === 'register'} onChange={() => { setMode('register'); resetMessages(); }} /><span>First visit</span></label>
      <label className={mode === 'code' ? 'mode-option selected' : 'mode-option'}><input type="radio" name="checkin-mode" checked={mode === 'code'} onChange={() => { setMode('code'); resetMessages(); }} /><span>Member check-in</span></label>
    </fieldset>

    {mode === 'code' ? <>
      <div className="return-options">
        <button type="button" className={returnMethod === 'pin' ? 'choice active' : 'choice'} onClick={() => { setReturnMethod('pin'); resetMessages(); }}>4-digit PIN</button>
        <button type="button" className={returnMethod === 'contact' ? 'choice active' : 'choice'} onClick={() => { setReturnMethod('contact'); resetMessages(); }}>Email / phone</button>
      </div>

      {returnMethod === 'pin' ? <form onSubmit={submitCode}>
        <label>4-digit member PIN</label>
        <input className="member-code-input" value={form.memberCode} onChange={e => update('memberCode', e.target.value.replace(/\D/g, '').slice(0, 4))} required placeholder="Example: 4827" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" />
        <p className="small">Or scan your personal Acton Chess Club QR code with a phone.</p>
        <button disabled={loading}>{loading ? 'Checking in…' : 'Check in'}</button>
        <button type="button" className="link-button" onClick={() => { setReturnMethod('contact'); resetMessages(); }}>Forgot your PIN? Use email or phone</button>
      </form> : <form onSubmit={submitContact}>
        <label>Email or phone used at registration</label>
        <input value={form.lookupContact} onChange={e => update('lookupContact', e.target.value)} required placeholder="Parent/guardian email or phone" autoCapitalize="none" />
        <p className="small">Use this if you forgot your PIN. Existing members are matched to the same record; no new registration is created.</p>
        <button disabled={loading}>{loading ? 'Finding player…' : 'Find me & check in'}</button>
      </form>}

      {matches.length > 0 && <div className="match-list">
        {matches.map(m => <button key={m.memberCode} type="button" className="match-button" disabled={loading} onClick={() => chooseMatch(m.memberCode)}><span>{m.fullName}</span><small>Grade {m.grade}</small></button>)}
      </div>}
    </> : <form onSubmit={submitRegistration}>
      <label>Player name</label>
      <input value={form.name} onChange={e => update('name', e.target.value)} autoComplete="name" required placeholder="First and last name" />
      <label>Grade</label>
      <select value={form.grade} onChange={e => update('grade', e.target.value)} required><option value="">Select grade</option>{grades.map(g => <option key={g} value={g}>{g}</option>)}</select>
      <ContactFields values={form} onChange={update} />
      <p className="small">Email, phone and WhatsApp number are stored in the private member record for club communications and are not shown on the public check-in screen.</p>
      <button disabled={loading}>{loading ? 'Creating member…' : 'Register & check in'}</button>
    </form>}

    {status && <div className={`message ${status.ok ? 'success' : 'error'}`}>{status.text}</div>}

    {pendingContact && <form className="contact-restore" onSubmit={saveRestoredContact}>
      <h3>One-time contact recovery</h3>
      <p className="small">You are already checked in. Some older registrations stored only a one-way contact hash. Please confirm the parent/guardian email and phone once so the club can restore the full contact information. You will not be asked again after both are saved, and this does not create a new registration.</p>
      <ContactFields values={restore} onChange={updateRestore} />
      <button disabled={loading}>{loading ? 'Saving…' : 'Save contact information'}</button>
    </form>}

    {card && <div className="member-card-wrap"><div className="member-card">
      <div className="club-mark">♟ ACTON CHESS CLUB</div><h2>{card.name}</h2><p>Grade {card.grade}</p>
      <img src={`/api/qr/${encodeURIComponent(card.qrToken)}`} alt={`QR membership card for ${card.name}`} />
      <div className="code-label">MEMBER PIN</div><div className="big-code">{card.memberCode}</div>
      <p className="card-note">Take a screenshot of this card. Next Saturday, scan the QR or enter the 4-digit PIN.</p>
    </div></div>}
  </section></main>;
}
