import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

interface LocalFeedbackItem {
  _id?: string;
  id?: string;
  createdAt: string;
  message: string;
  optimistic?: boolean;
  editing?: boolean;
}

export const FeedbackPage: React.FC = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<LocalFeedbackItem[]>([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function load() {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const r = await api.listMyFeedback(token);
      const list: LocalFeedbackItem[] = r.items.map((it: any) => ({ _id: it._id || it.id, id: it.id || it._id, createdAt: it.createdAt, message: it.message }));
      setItems(list);
    } catch (e:any) { setError(e.friendlyMessage || e.error || 'Failed to load'); } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, [token]);

  async function submit() {
    if (!token || !message.trim()) return;
    setSubmitting(true);
    const temp: LocalFeedbackItem = { id: 'temp-'+Date.now(), createdAt: new Date().toISOString(), message: message.trim(), optimistic: true };
    setItems(prev => [temp, ...prev]);
    try {
      const r = await api.submitFeedback(token, message.trim());
      setItems(prev => prev.map(it => it.id === temp.id ? { _id: (r as any).id || (r as any)._id, id: (r as any).id || (r as any)._id, createdAt: r.createdAt || temp.createdAt, message: message.trim() } : it));
      setMessage('');
    } catch (e:any) {
      setItems(prev => prev.filter(it => it.id !== temp.id));
      setError(e.friendlyMessage || e.error || 'Submit failed');
    } finally { setSubmitting(false); }
  }

  function startEdit(id:string) {
    setItems(prev => prev.map(it => it.id===id? { ...it, editing:true }: it));
  }
  async function saveEdit(it: LocalFeedbackItem, newMessage:string) {
    if (!token) return;
    const prev = it.message;
    setItems(list => list.map(x => x.id===it.id? { ...x, message:newMessage, optimistic:true, editing:false }: x));
    try {
      await api.updateFeedback(token, it.id!, newMessage, it.createdAt);
      setItems(list => list.map(x => x.id===it.id? { ...x, optimistic:false }: x));
    } catch (e:any) {
      setItems(list => list.map(x => x.id===it.id? { ...x, message:prev, optimistic:false }: x));
      setError(e.friendlyMessage || e.error || 'Update failed');
    }
  }
  async function remove(it: LocalFeedbackItem) {
    if (!token) return;
    const snap = items;
    setItems(list => list.filter(x => x.id!==it.id));
    try { await api.deleteFeedback(token, it.id!); } catch (e:any) { setItems(snap); setError(e.friendlyMessage || 'Delete failed'); }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 space-y-6">
      <Card title="Submit Feedback">
        <div className="flex flex-col gap-3">
          <Input label="Message" placeholder="Share your thoughts" value={message} onChange={e=>setMessage(e.target.value)} error={message && message.trim().length>0 && message.trim().length<4 ? 'Min 4 chars' : undefined} />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={message.trim().length<4} loading={submitting}>Send</Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      <Card title="Your Feedback" className="bg-white dark:bg-slate-800">
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && !items.length && <p className="text-sm text-slate-500">No feedback yet.</p>}
        <ul className="flex flex-col gap-3">
          {items.map(it => (
            <li key={it.id} className="border border-slate-200 dark:border-slate-700 rounded-md p-3 relative group">
              {it.optimistic && <span className="absolute top-1 right-1 text-[10px] text-amber-600">pending</span>}
              {it.editing ? (
                <InlineEditItem item={it} onSave={saveEdit} onCancel={()=>setItems(prev=>prev.map(x=>x.id===it.id? { ...x, editing:false }: x))} />
              ) : (
                <div className="space-y-1">
                  <p className="text-sm whitespace-pre-wrap break-words">{it.message}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{new Date(it.createdAt).toLocaleString()}</p>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <Button type="button" variant="ghost" className="text-xs px-2 py-1" onClick={()=>startEdit(it.id!)}>Edit</Button>
                    <Button type="button" variant="ghost" className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={()=>remove(it)}>Delete</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

const InlineEditItem: React.FC<{ item: LocalFeedbackItem; onSave:(it:LocalFeedbackItem, msg:string)=>void; onCancel:()=>void }> = ({ item, onSave, onCancel }) => {
  const [val, setVal] = useState(item.message);
  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full min-h-[80px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        value={val}
        onChange={e=>setVal(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" className="text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="button" className="text-xs" disabled={val.trim().length<4} onClick={()=>onSave(item, val.trim())}>Save</Button>
      </div>
    </div>
  );
};
