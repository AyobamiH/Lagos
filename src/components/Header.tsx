import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

interface HeaderProps {
  t: (key: string) => string;
  isDriver: boolean;
  hasScope?: (scope: string) => boolean;
  theme: string;
  toggle: () => void;
  authed?: boolean;
  name?: string | null;
}

export default function Header({ t, isDriver, hasScope, theme, toggle, authed = false, name }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const brandBtn = 'inline-flex items-center justify-center px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg shadow-sm h-9 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300';

  return (
    <>
      <div className="fixed top-0 left-0 px-2 py-1 bg-brand text-white text-[10px] z-50 rounded-br shadow">
        {t('app_mounted')}
      </div>

      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 h-14">
          {/* Logo / Home */}
          <Link
            to="/"
            className="font-bold text-slate-800 dark:text-slate-100 tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-md"
          >
            LagosRide
          </Link>

          {/* Desktop nav (hidden on small) */}
          <nav aria-label="Primary" className="hidden md:flex items-center gap-4 ml-4">
            {!isDriver && <NavLink className="nav-link" to="/rides/request">Request</NavLink>}
            {!isDriver && <NavLink className="nav-link" to="/rides">My Rides</NavLink>}
            <NavLink className="nav-link" to="/feedback">Feedback</NavLink>
            {isDriver && <NavLink className="nav-link" to="/driver">Driver</NavLink>}
            {hasScope?.('ride:lifecycle') && <NavLink className="nav-link" to="/payments">Payments</NavLink>}
            {hasScope?.('surge:admin') && <NavLink className="nav-link" to="/surge">Surge</NavLink>}
          </nav>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            {/* Desktop auth buttons (switch depending on session) */}
            {!authed && (
              <>
                <Link
                  to="/login"
                  className="hidden md:inline-flex text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className={`hidden md:inline-flex ${brandBtn}`}
                >
                  Sign Up
                </Link>
              </>
            )}
            {authed && (
              <>
                <Link
                  to="/profile"
                  className={`hidden md:inline-flex ${brandBtn}`}
                >
                  {name ? `${name.split(' ')[0]}` : 'Profile'}
                </Link>
              </>
            )}

            {/* Theme toggle — keep it visible always, but small and separated */}
            <button
              onClick={toggle}
              aria-label="Toggle color theme"
              className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((s) => !s)}
              aria-expanded={mobileOpen}
              aria-label="Open menu"
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 shadow-sm"
            >
              <svg className="w-5 h-5 text-slate-700 dark:text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu (small dropdown under header) */}
        <div className={`md:hidden ${mobileOpen ? 'block' : 'hidden'} bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700`}>
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-2">
            {!isDriver && <NavLink onClick={() => setMobileOpen(false)} className="py-2" to="/rides/request">Request</NavLink>}
            {!isDriver && <NavLink onClick={() => setMobileOpen(false)} className="py-2" to="/rides">My Rides</NavLink>}
            <NavLink onClick={() => setMobileOpen(false)} className="py-2" to="/feedback">Feedback</NavLink>
            {isDriver && <NavLink onClick={() => setMobileOpen(false)} className="py-2" to="/driver">Driver</NavLink>}
            {hasScope?.('ride:lifecycle') && <NavLink onClick={() => setMobileOpen(false)} className="py-2" to="/payments">Payments</NavLink>}
            {hasScope?.('surge:admin') && <NavLink onClick={() => setMobileOpen(false)} className="py-2" to="/surge">Surge</NavLink>}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2 flex flex-col gap-2">
              {!authed && (
                <>
                  <Link onClick={() => setMobileOpen(false)} to="/login" className="text-sm font-medium text-slate-700 dark:text-slate-200">Login</Link>
                  <Link onClick={() => setMobileOpen(false)} to="/signup" className={brandBtn}>Sign Up</Link>
                </>
              )}
              {authed && (
                <>
                  <Link onClick={() => setMobileOpen(false)} to="/profile" className={brandBtn}>{name ? `${name.split(' ')[0]}` : 'Profile'}</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
