import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';

export default function Signup() {
  const { signup, driverSignup, error, errorDetails, loading, profile, token } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'rider'|'driver'>('rider');
  const navigate = useNavigate();

  const phoneIssue = phone && !/^\+?[0-9]{6,20}$/.test(phone.replace(/[^0-9+]/g,'')) ? 'Invalid phone format' : null;
  const pwIssue = password && password.length < 8 ? 'Min 8 characters required' : null;
  const disableSubmit = loading || !name || !phone || !password || !!phoneIssue || !!pwIssue;
  const fieldErr = (f:string) => (errorDetails||[]).filter(d=>d.field===f).map((d:any)=> d.msg||d.message)[0];

  // Redirect as soon as signup completes and profile loads
  useEffect(() => {
    if (token && profile) {
      const isDriver = profile?.role === 'driver';
      navigate(isDriver? '/driver' : '/profile', { replace: true });
    }
  }, [token, profile, navigate]);

  return (
    <div className="auth-hero-container lagos-gradient-bg">
      <Card title={`Signup (${mode})`} className="card-elevated w-full max-w-md">
        <div className="flex gap-2 mb-4">
          <Button type="button" variant={mode==='rider' ? 'primary':'secondary'} disabled={mode==='rider'} onClick={()=>setMode('rider')} className="text-xs px-3 py-1">Rider</Button>
          <Button type="button" variant={mode==='driver' ? 'primary':'secondary'} disabled={mode==='driver'} onClick={()=>setMode('driver')} className="text-xs px-3 py-1">Driver</Button>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); if (!disableSubmit) (mode==='driver'? driverSignup(name, phone, password) : signup(name, phone, password)); }}
          className="space-y-4"
        >
          <Input label="Name" placeholder="Jane Doe" value={name} onChange={e=>setName(e.target.value)} error={fieldErr('name')} />
          <Input label="Phone" placeholder="+15551234567" value={phone} onChange={e=>setPhone(e.target.value)} error={fieldErr('phone') || phoneIssue} />
          <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} error={fieldErr('password') || pwIssue} />
          <div className="pt-2">
            <Button type="submit" loading={loading} disabled={disableSubmit} className="w-full">
              {loading? 'Creating…' : (mode==='driver'? 'Create Driver Account':'Create Rider Account')}
            </Button>
          </div>
        </form>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </Card>
    </div>
  );
}
