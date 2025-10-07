import React from 'react';
import { useDiagnostics } from '../context/DiagnosticsContext';
const APP_VERSION = window.__APP_VERSION__ || 'dev';

export const DiagnosticsOverlay: React.FC = () => {
  const { data, latency, lastFetched } = useDiagnostics();
  if (!data) return null;
  const httpP95 = data?.performance?.httpP95 ?? data?.httpP95;
  const cfgHash = (() => {
    try { const raw = JSON.stringify(data.config || {}); let h = 0; for (let i=0;i<raw.length;i++) { h = ((h<<5)-h) + raw.charCodeAt(i); h |= 0; } return (h>>>0).toString(16).slice(0,6); } catch { return 'na'; }
  })();
  return (
    <div style={{position:'fixed', bottom:8, right:8, background:'rgba(0,0,0,0.75)', color:'#fff', padding:'8px 12px', borderRadius:6, fontSize:12, zIndex:9999, lineHeight:1.3}}>
      <strong>Diag</strong> v{APP_VERSION} cfg:{cfgHash} {latency!==null && <span>| lat {latency}ms</span>}<br/>
      p95 {httpP95}ms | ELag {data.eventLoopLagMs}ms | Casc {data.cascades?.active}<br/>
      Up {data.uptimeSec}s | Fetched {lastFetched ? new Date(lastFetched).toLocaleTimeString() : ''}
    </div>
  );
};
