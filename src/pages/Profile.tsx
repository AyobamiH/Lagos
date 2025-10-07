import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Profile() {
  const auth = useAuth() as any;
  if (!auth) return <p>Not logged in. <Link to="/login">Login</Link></p>;
  const { profile, token, logout } = auth;
  const [message, setMessage] = useState('');
  const MIN_LEN = 4;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [mine, setMine] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [success, setSuccess] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number|null>(null);
  const [latencyMs, setLatencyMs] = useState<number|null>(null);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editingMessage, setEditingMessage] = useState('');
  const maxChars = 2000;

  useEffect(() => {
    if (!token) return;
    setLoadingList(true);
    api.listMyFeedback(token).then(d => setMine(d.items || [])).catch(()=>{}).finally(()=>setLoadingList(false));
  }, [token, success]);

  if (!token) return <p>Not logged in. <Link to="/login">Login</Link></p>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    if (trimmed.length < MIN_LEN) {
      setError(`feedback_too_short (min ${MIN_LEN})`);
      return;
    }
    const start = performance.now();
    setSubmitting(true); setError(null); setSuccess(false); setLatencyMs(null);
    try {
      const optimistic = {
        id: `tmp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        message: trimmed,
        optimistic: true
      };
      setMine(m => [optimistic, ...m]);
      const submitted = await api.submitFeedback(token!, trimmed);
      // Replace optimistic with real record
      setMine(m => m.map(it => it.id === optimistic.id ? { ...it, ...submitted, message: optimistic.message, optimistic: false } : it));
      setMessage('');
      setSuccess(true);
    } catch (e: any) {
      if (e.status === 429 && e.retryReset) {
        setRateLimitedUntil(e.retryReset);
      } else {
        setError(e.error || 'submit_failed');
      }
      // Rollback optimistic insert if present
      setMine(m => m.filter(it => !it.optimistic));
    } finally { setSubmitting(false); }
    setLatencyMs(Math.round(performance.now() - start));
  }

  function remainingCooldownSec() {
    if (!rateLimitedUntil) return 0;
    const diff = rateLimitedUntil - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }

  function startEdit(item: any) {
    setEditingId(item._id || item.id);
    setEditingMessage(item.message);
  }
  function cancelEdit() { setEditingId(null); setEditingMessage(''); }

  async function saveEdit(id: string) {
    if (!editingMessage.trim()) return;
    const item = mine.find(i => (i._id||i.id) === id);
    if (!item) return;
    try {
      const updated = await api.updateFeedback(token!, id, editingMessage.trim(), item.createdAt);
      setMine(m => m.map(it => (it._id||it.id) === id ? { ...it, message: editingMessage.trim(), createdAt: updated.createdAt } : it));
      cancelEdit();
    } catch (e:any) {
      if (e.status === 409) {
        // Conflict: refetch latest list then re-open editor preserving user changes for manual merge
        try {
          const latest = await api.listMyFeedback(token!);
          setMine(latest.items || []);
          // Re-open editing with preserved draft and notify
          setEditingId(id);
          setEditingMessage(editingMessage.trim());
          setError('edit_conflict_refresh');
        } catch { setError('edit_conflict_refresh'); }
      } else setError(e.error || 'edit_failed');
    }
  }

  async function deleteItem(id: string) {
    const prev = mine;
    setMine(m => m.filter(it => (it._id||it.id) !== id));
    try {
      await api.deleteFeedback(token!, id);
    } catch (e:any) {
      setError('delete_failed');
      setMine(prev); // rollback
    }
  }

  return (
    <div className="grid gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Profile</h2>
        <button
          className="px-4 h-10 rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700"
          onClick={async () => {
            try { if (token) { try { await api.logout(token); } catch {} } }
            finally { logout(); }
          }}
        >Logout</button>
      </div>

      {/* Identity Card */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 grid gap-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Name</div>
            <div className="text-base font-medium">{profile?.name || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Phone</div>
            <div className="text-base font-medium">{profile?.phone || '—'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Role</div>
            <div className="text-base font-medium capitalize">{profile?.role || '—'}</div>
          </div>
        </div>
      </section>

      {/* Role-specific Card */}
      {profile?.role === 'driver' ? (
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 grid gap-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Availability</div>
              <div className="text-base font-medium">{profile?.isAvailable ? 'Online' : 'Offline'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Rating</div>
              <div className="text-base font-medium">{typeof profile?.rating === 'number' ? profile.rating.toFixed(1) : '—'}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Last Active</div>
              <div className="text-base font-medium">{profile?.lastActiveAt ? new Date(profile.lastActiveAt).toLocaleString() : '—'}</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">KYC</div>
              <div className={`text-base font-medium ${profile?.kycStatus === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>{profile?.kycStatus || '—'}</div>
            </div>
            <div className="flex gap-2">
              {profile?.kycStatus !== 'approved' && (
                <Link to="/driver/kyc" className="px-4 h-10 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-600">Complete KYC</Link>
              )}
              <Link to="/driver" className="px-4 h-10 rounded-lg bg-sky-500 text-slate-900 font-semibold hover:bg-sky-600">Open Driver Panel</Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 grid gap-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Payment Methods</div>
              <div className="text-base font-medium">{Array.isArray(profile?.paymentMethods) && profile.paymentMethods.length ? profile.paymentMethods.join(', ') : 'Cash only'}</div>
            </div>
            <Link to="/profile#payments" className="px-4 h-10 rounded-lg bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-600">Add a card</Link>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h3 className="font-medium mt-0">Send Feedback</h3>
        <form onSubmit={submit} className="grid gap-2">
          <textarea
            placeholder="Share something that was confusing or needs improvement"
            value={message}
            onChange={e=>setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
            maxLength={2000}
          />
          <small className={`${message.length > maxChars * 0.9 ? 'text-red-600' : message.length > maxChars * 0.75 ? 'text-amber-600' : 'text-slate-500'}`}>
            {message.length}/{maxChars}
          </small>
          <div className="flex gap-2 items-center">
            <button type="submit" disabled={submitting || !message.trim() || message.trim().length < MIN_LEN || remainingCooldownSec()>0} className="px-4 h-10 rounded-lg bg-slate-800 text-slate-100 disabled:opacity-50">Submit</button>
            {submitting && <span>Submitting...</span>}
            {success && !submitting && <span className="text-emerald-600">Saved</span>}
            {latencyMs !== null && !submitting && <span className="text-xs opacity-70">lat {latencyMs}ms</span>}
            {remainingCooldownSec()>0 && <span className="text-red-600">Cooldown {remainingCooldownSec()}s</span>}
          </div>
          {message.trim().length>0 && message.trim().length < MIN_LEN && <p className="text-red-600 text-xs">Minimum {MIN_LEN} characters</p>}
          {error && <p className="text-red-600">{error}</p>}
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h3 className="font-medium mt-0">Your Recent Feedback</h3>
        {loadingList && <p>Loading...</p>}
        {!loadingList && !mine.length && <p>No feedback yet.</p>}
        <ul className="grid gap-2 list-none p-0 m-0">
          {mine.map(item => {
            const id = item._id || item.id;
            const isEditing = editingId === id;
            return (
              <li key={id} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                <div className="text-xs opacity-70 flex gap-2 items-center">
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  {item.optimistic && <em className="text-slate-500">sending...</em>}
                </div>
                {!isEditing && <div className="whitespace-pre-wrap">{item.message}</div>}
                {isEditing && (
                  <div className="grid gap-2">
                    <textarea value={editingMessage} onChange={e=>setEditingMessage(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
                    <div className="flex gap-2">
                      <button onClick={()=>saveEdit(id)} disabled={!editingMessage.trim()} className="px-3 h-9 rounded bg-slate-800 text-slate-100 disabled:opacity-50">Save</button>
                      <button onClick={cancelEdit} className="px-3 h-9 rounded border border-slate-300 dark:border-slate-600">Cancel</button>
                    </div>
                  </div>
                )}
                {!isEditing && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={()=>startEdit(item)} disabled={item.optimistic} className="px-3 h-9 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50">Edit</button>
                    <button onClick={()=>deleteItem(id)} disabled={item.optimistic} className="px-3 h-9 rounded bg-red-500 text-white disabled:opacity-50">Delete</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
