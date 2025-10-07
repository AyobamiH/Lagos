import React from 'react';
import { useRateLimit } from '../context/RateLimitContext';

export const GlobalRateLimitBanner: React.FC = () => {
  const { active, secondsLeft, retryAt } = useRateLimit();
  if (!active) return null;
  const pct = (() => {
    if (!retryAt) return 0;
    // assume initial window based on secondsLeft at first render; we can't know original easily so treat 60s cap for bar heuristically
    const estTotal = Math.max(secondsLeft, 1);
    return Math.min(100, Math.round(((estTotal - secondsLeft) / estTotal) * 100));
  })();
  return (
    <div role="status" aria-live="polite" style={{position:'fixed', top:0, left:0, right:0, background:'#ffe0e0', borderBottom:'1px solid #f5b5b5', display:'flex', flexDirection:'column', padding:'4px 8px', zIndex:10000}}>
      <div style={{fontSize:12, color:'#900', display:'flex', justifyContent:'space-between'}}>
        <span>Rate limited. Retrying in {secondsLeft}s</span>
      </div>
      <div style={{height:4, background:'#f9caca', borderRadius:2, overflow:'hidden', marginTop:4}}>
        <div style={{height:'100%', width:`${100-pct}%`, background:'#ff5a5a', transition:'width 0.5s linear'}} aria-hidden />
      </div>
    </div>
  );
};
