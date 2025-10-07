import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const { token, profile } = useAuth();
  const navigate = useNavigate();
  const primaryCta = () => {
    if (!token) return navigate('/signup');
    return navigate('/rides/request');
  };
  return (
    <main className="lagos-gradient-bg min-h-[calc(100vh-3.5rem)] flex flex-col">
      <section className="flex-1 w-full max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
        <div data-testid="landing-hero-copy" className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
            Move through Lagos <span className="text-brand">smarter</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-prose">
            Real-time matching, transparent surge, reliable ETAs. A lightweight ride platform built for emerging city scale and resilience.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button onClick={primaryCta} className="brand-btn text-sm h-11 px-6">
              {token ? 'Request a Ride' : 'Get Started'}
            </button>
            {!token && (
              <Link to="/login" className="inline-flex items-center text-sm font-medium text-brand hover:underline">
                Already have an account? Log in
              </Link>
            )}
          </div>
          <ul aria-label="Platform highlights" className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <li className="flex items-start gap-2"><span className="inline-block w-2.5 h-2.5 mt-1 rounded-full bg-emerald-500" aria-hidden="true"/>Low latency matching</li>
            <li className="flex items-start gap-2"><span className="inline-block w-2.5 h-2.5 mt-1 rounded-full bg-sky-500" aria-hidden="true"/>Transparent surge</li>
            <li className="flex items-start gap-2"><span className="inline-block w-2.5 h-2.5 mt-1 rounded-full bg-amber-500" aria-hidden="true"/>Resilient offline flows</li>
            <li className="flex items-start gap-2"><span className="inline-block w-2.5 h-2.5 mt-1 rounded-full bg-fuchsia-500" aria-hidden="true"/>Driver ranking fairness</li>
          </ul>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-br from-brand/20 to-amber-200/40 dark:from-brand/10 dark:to-amber-500/10 rounded-3xl blur-2xl" aria-hidden="true"></div>
          <div className="relative h-full rounded-3xl p-6 md:p-8 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xl backdrop-blur">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">Live Platform Signals</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40 flex flex-col" aria-label="Sample surge indicator">
                <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Surge</span>
                <span className="text-2xl font-bold text-amber-600">x1.2</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40 flex flex-col" aria-label="Sample matching latency">
                <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Match P50</span>
                <span className="text-2xl font-bold text-emerald-600">1.8s</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40 flex flex-col" aria-label="Sample active rides">
                <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Active Rides</span>
                <span className="text-2xl font-bold text-brand">128</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40 flex flex-col" aria-label="Sample availability">
                <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Drivers Online</span>
                <span className="text-2xl font-bold text-fuchsia-600">542</span>
              </div>
            </div>
            {profile && (
              <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">Welcome back, <span className="font-medium text-slate-700 dark:text-slate-200">{profile.name}</span>.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
