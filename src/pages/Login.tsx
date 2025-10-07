import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

export default function Login() {
  const { login, driverLogin, error, errorDetails, loading, profile, token } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'rider'|'driver'>('rider');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Determine redirect target: explicit ?next= param or profile page
  const searchParams = new URLSearchParams(location.search);
  const next = searchParams.get('next') || '/driver';

  // Redirect when we have both token and profile
  useEffect(() => {
    if (token && profile && submitted) {
      // If the logged-in user is a driver, go to driver panel; otherwise to profile unless next overrides.
      const isDriver = profile?.role === 'driver';
      const target = searchParams.get('next') || (isDriver ? '/driver' : '/profile');
      navigate(target, { replace: true });
    }
  }, [token, profile, submitted, navigate, next]);

  const phoneIssue = phone && !/^\+?[0-9]{6,20}$/.test(phone.replace(/[^0-9+]/g,'')) ? 'Phone format' : null;
  const pwIssue = password && password.length < 8 ? 'Min 8 chars' : null;
  const disable: boolean = !!(loading || !phone || !password || phoneIssue || pwIssue || (submitted && token && profile));

  function friendlyError(code?: string | null): string | null {
    if (!code) return null;
    switch(code) {
      case 'invalid_phone_format': return 'Phone number format is invalid.';
      case 'min_length_8': return 'Password must be at least 8 characters.';
      case 'invalid_credentials': return 'Incorrect phone or password.';
      case 'login_failed': return 'Login failed. Please try again.';
      case 'rate_limited': return 'Too many attempts. Please wait and retry.';
      default: return null;
    }
  }
  const fieldErr = (f:string) => (errorDetails||[]).filter(d=>d.field===f).map((d:any)=> d.msg||d.message)[0];
  return (
    <div className="auth-hero-container lagos-gradient-bg">
      <Card title={`Login (${mode})`} className="card-elevated w-full max-w-md">
        <div className="flex gap-2 mb-4">
          <Button type="button" variant={mode==='rider'? 'primary':'secondary'} disabled={mode==='rider'} onClick={()=>setMode('rider')} className="text-xs px-3 py-1">Rider</Button>
          <Button type="button" variant={mode==='driver'? 'primary':'secondary'} disabled={mode==='driver'} onClick={()=>setMode('driver')} className="text-xs px-3 py-1">Driver</Button>
        </div>
        <form
          onSubmit={async e=>{ e.preventDefault(); if(disable) return; setSubmitted(true); try { await (mode==='driver'? driverLogin(phone,password) : login(phone,password)); } catch { setSubmitted(false); } }}
          className="space-y-4"
        >
          <Input label="Phone" placeholder="+15551234567" value={phone} onChange={e=>setPhone(e.target.value)} error={fieldErr('phone') || phoneIssue} />
          <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} error={fieldErr('password') || pwIssue} />
          <div className="pt-2">
            <Button type="submit" loading={loading} disabled={disable} className="w-full">
              {loading? 'Logging in…' : (submitted && token && profile ? 'Redirecting…' : (mode==='driver'? 'Driver Login':'Login'))}
            </Button>
          </div>
        </form>
        {error && <p className="mt-4 text-sm text-red-600">{friendlyError(error) || error}</p>}
        {!error && submitted && token && !profile && <p className="mt-4 text-xs text-slate-500">Loading your profile…</p>}
      </Card>
    </div>
  );
}
