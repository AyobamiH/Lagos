import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { DiagnosticsOverlay } from './components/DiagnosticsOverlay';
import { useAuth } from './context/AuthContext';
import { DriverGuard, RiderGuard } from './context/AuthGuard';
import { Toasts } from './components/Toasts';
import { AuthGuard } from './context/AuthGuard';
import { useTheme } from './theme/ThemeProvider';
const Signup = lazy(()=>import('./pages/Signup'));
const Login = lazy(()=>import('./pages/Login'));
const Profile = lazy(()=>import('./pages/Profile'));
const Landing = lazy(()=>import('./pages/Landing'));
const RequestRide = lazy(()=>import('./pages/rides/RequestRide'));
const QuoteAndRequest = lazy(()=>import('./pages/rides/QuoteAndRequest'));
const RidesList = lazy(()=>import('./pages/rides/RidesList'));
const RideDetail = lazy(()=>import('./pages/rides/RideDetail'));
const Receipt = lazy(()=>import('./pages/rides/Receipt'));
const RideRequestWizard = lazy(()=>import('./pages/rides/RideRequestWizard').then(m=>({ default: m.RideRequestWizard })));
const OpsPanel = lazy(()=>import('./pages/admin/OpsPanel').then(m=>({ default: m.OpsPanel })));
const PaymentsPanel = lazy(()=>import('./pages/payments/PaymentsPanel').then(m=>({ default: m.PaymentsPanel })));
const SurgePanel = lazy(()=>import('./pages/admin/SurgePanel').then(m=>({ default: m.SurgePanel })));
const ManualAssignPanel = lazy(()=>import('./pages/admin/ManualAssignPanel').then(m=>({ default: m.ManualAssignPanel })));
const KycPanel = lazy(()=>import('./pages/driver/KycPanel').then(m=>({ default: m.KycPanel })));
import { useFeatureFlags } from './context/FeatureFlagsContext';
import { RateLimitBanner } from './components/RateLimitBanner';
import { DeadLetterPanel } from './components/DeadLetterPanel';
const DriverPanel = lazy(()=>import('./pages/driver/DriverPanel'));
const FeedbackPage = lazy(()=>import('./pages/feedback/FeedbackPage').then(m=>({ default: m.FeedbackPage })));

import { lastCorrelationId } from './api/client';
import { HomeIcon, CarIcon, ListIcon, ChatIcon, UserIcon } from './components/icons/Icons';
import { t } from './i18n/messages';
import Header from './components/Header';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props:any){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error:any){ return { error }; }
  componentDidCatch(error:any, info:any){ console.error('[ErrorBoundary]', error, info); }
  handleReload = () => { window.location.reload(); };
  render(){
    if (this.state.error) return <div style={{padding:16, background:'#fee', color:'#900'}}>
  <h3>{t('app_error_title')}</h3>
      <p style={{fontSize:12, opacity:0.7}}>Correlation: <code>{lastCorrelationId || 'n/a'}</code></p>
      <pre style={{whiteSpace:'pre-wrap', maxHeight:200, overflow:'auto'}}>{String(this.state.error)}</pre>
  <button onClick={this.handleReload} style={{marginTop:12}}>{t('reload_app')}</button>
    </div>;
    return this.props.children as any;
  }
}

export default function App() {
  const { isDriver, profile, hasScope, token } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const { theme, toggle } = useTheme();
  // Lightweight RUM: capture simple navigation & action timings and batch post
  const rumBuffer = useRef<any[]>([]);
  const lastNavTs = useRef<number>(performance.now());
  // Legacy inline RUM removed; dedicated clientRUM handles batching.
  useEffect(()=>{ /* placeholder to avoid unused vars warning */ if (rumBuffer.current.length===-1) console.log(lastNavTs.current); },[]);
  const location = useLocation();
  const navigate = useNavigate();
  // Redirect driver "home" to driver panel
  useEffect(() => {
    if (profile?.role === 'driver' && location.pathname === '/') {
      navigate('/driver', { replace: true });
    }
  }, [profile?.role, location.pathname]);
  const isActive = (path:string) => location.pathname === path;
  return (
    <ErrorBoundary>
  <Header t={t} isDriver={!!isDriver} hasScope={hasScope} theme={theme} toggle={toggle} authed={!!token} name={profile?.name||null} />
  <Suspense fallback={<div style={{padding:20}}>{t('loading')}</div>}>
  <Routes>
  <Route path="/" element={<Landing/>}/>
  <Route path="/signup" element={<Signup/>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/profile" element={<AuthGuard><Profile/></AuthGuard>}/>
    {/* Rider-only ride routes */}
    <Route path="/rides/request" element={<RiderGuard><RequestRide/></RiderGuard>}/>
    <Route path="/rides/quote" element={<RiderGuard><QuoteAndRequest/></RiderGuard>}/>
    <Route path="/rides/wizard" element={<RiderGuard><RideRequestWizard/></RiderGuard>}/>
    <Route path="/rides" element={<RiderGuard><RidesList/></RiderGuard>}/>
  <Route path="/feedback" element={<AuthGuard><FeedbackPage/></AuthGuard>} />
  <Route path="/rides/:rideId" element={<RiderGuard><RideDetail/></RiderGuard>}/>
  <Route path="/driver" element={<DriverGuard><DriverPanel/></DriverGuard>}/>
  <Route path="/driver/kyc" element={<DriverGuard><KycPanel/></DriverGuard>}/>
  <Route path="/payments" element={<AuthGuard><PaymentsPanel/></AuthGuard>}/>
  <Route path="/surge" element={<AuthGuard><SurgePanel/></AuthGuard>}/>
  <Route path="/manual-assign" element={<AuthGuard><ManualAssignPanel/></AuthGuard>}/>
  <Route path="/rides/:rideId/receipt" element={<AuthGuard><Receipt/></AuthGuard>}/>
  <Route path="/ops" element={<AuthGuard><OpsPanel/></AuthGuard>}/>
        <Route path="*" element={<Landing/>}/>
      </Routes>
      </Suspense>
      <DiagnosticsOverlay />
  <RateLimitBanner />
    <DeadLetterPanel />
      <Toasts />
      {/* Mobile bottom tab */}
      <div className="md:hidden bottom-tab-bar" role="navigation" aria-label="Primary mobile">
        {!isDriver && (
          <>
            <Link to="/" className={`bottom-tab-item ${isActive('/')? 'bottom-tab-item-active':''}`} aria-label="Home" aria-current={isActive('/')? 'page': undefined}>
              <HomeIcon />
              <span>Home</span>
            </Link>
            <Link to="/rides/request" className={`bottom-tab-item ${isActive('/rides/request')? 'bottom-tab-item-active':''}`} aria-label="Request" aria-current={isActive('/rides/request')? 'page': undefined}>
              <CarIcon />
              <span>Request</span>
            </Link>
            <Link to="/rides" className={`bottom-tab-item ${isActive('/rides')? 'bottom-tab-item-active':''}`} aria-label="Rides" aria-current={isActive('/rides')? 'page': undefined}>
              <ListIcon />
              <span>Rides</span>
            </Link>
            <Link to="/feedback" className={`bottom-tab-item ${isActive('/feedback')? 'bottom-tab-item-active':''}`} aria-label="Feedback" aria-current={isActive('/feedback')? 'page': undefined}>
              <ChatIcon />
              <span>Feedback</span>
            </Link>
            <Link to="/profile" className={`bottom-tab-item ${isActive('/profile')? 'bottom-tab-item-active':''}`} aria-label="Profile" aria-current={isActive('/profile')? 'page': undefined}>
              <UserIcon />
              <span>Profile</span>
            </Link>
          </>
        )}
        {isDriver && (
          <>
            <Link to="/driver" className={`bottom-tab-item ${isActive('/driver')? 'bottom-tab-item-active':''}`} aria-label="Driver Home" aria-current={isActive('/driver')? 'page': undefined}>
              <HomeIcon />
              <span>Home</span>
            </Link>
            <Link to="/driver" className={`bottom-tab-item ${isActive('/driver')? 'bottom-tab-item-active':''}`} aria-label="Driver" aria-current={isActive('/driver')? 'page': undefined}>
              <CarIcon />
              <span>Driver</span>
            </Link>
            <Link to="/profile" className={`bottom-tab-item ${isActive('/profile')? 'bottom-tab-item-active':''}`} aria-label="Profile" aria-current={isActive('/profile')? 'page': undefined}>
              <UserIcon />
              <span>Profile</span>
            </Link>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
