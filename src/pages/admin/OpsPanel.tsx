import React, { useEffect, useState } from 'react';
import { useFeatureFlags } from '../../context/FeatureFlagsContext';
import { useDiagnostics } from '../../context/DiagnosticsContext';
import { useRateLimit } from '../../context/RateLimitContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useMutationQueue } from '../../context/MutationQueueContext';
import { lastCorrelationId, getLastResponseHeaders } from '../../api/client';
import { useState as useReactState } from 'react';

// OpsPanel is admin-only; kept lightweight. Heavy analytic widgets should be
// dynamically imported inside sections so the default admin bundle stays small.
export const OpsPanel: React.FC = () => {
  const { flags } = useFeatureFlags();
  const { data: diag } = useDiagnostics();
  const { active, secondsLeft } = useRateLimit();
  const { allOrdered } = useRealtime();
  const [swStatus, setSwStatus] = useState<any>('unknown');
  const mq = useMutationQueue();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e: any) => {
        if (e.data?.type === 'SW_VERSION') setSwStatus(e.data);
      });
      navigator.serviceWorker.controller?.postMessage({ type:'CHECK_VERSION' });
    }
  }, []);

  const headers = getLastResponseHeaders();
  const now = Date.now();
  return (
    <div style={{display:'grid', gap:12}}>
      <h2>Ops Panel</h2>
      <section style={{background:'#fafafa', padding:8, borderRadius:4}}>
        <h3>Feature Flags</h3>
        <pre style={{maxHeight:180, overflow:'auto'}}>{JSON.stringify(flags,null,2)}</pre>
      </section>
      <section style={{background:'#fafafa', padding:8, borderRadius:4}}>
        <h3>Diagnostics</h3>
        <pre style={{maxHeight:180, overflow:'auto'}}>{JSON.stringify(diag,null,2)}</pre>
      </section>
      <section style={{background:'#fafafa', padding:8, borderRadius:4}}>
        <h3>Realtime</h3>
        <p>Events buffered: {allOrdered.length}</p>
      </section>
      <section style={{background:'#fafafa', padding:8, borderRadius:4}}>
        <h3>Rate Limit</h3>
        <p>{active? `Active (${secondsLeft}s left)` : 'Inactive'}</p>
      </section>
      <section style={{background:'#fafafa', padding:8, borderRadius:4}}>
        <h3>Unified Action Queue</h3>
        <p>Pending: {mq.pending} {mq.processing && ' (processing...)'}</p>
        {!!mq.items.length && <ul style={{margin:0, paddingLeft:16, display:'grid', gap:4}}>
          {mq.items.map(i => {
            const waitMs = i.nextEligibleAt && i.nextEligibleAt > now ? (i.nextEligibleAt - now) : 0;
            return <li key={i.id} style={{fontSize:12, background:'#fff', padding:4, borderRadius:4}}>
              <strong>{i.kind}</strong> attempts:{i.attempts}
              {waitMs>0 && <span> next in {Math.ceil(waitMs/1000)}s</span>}
              {i.lastError && <span style={{color:'#c00'}}> err:{i.lastError}</span>}
            </li>;
          })}
        </ul>}
        <div style={{display:'flex', gap:8, marginTop:6, flexWrap:'wrap'}}>
          <button onClick={()=>mq.forceDrain()} disabled={mq.processing || !mq.pending}>Force Drain</button>
        </div>
      </section>
      <section style={{background:'#fafafa', padding:8, borderRadius:4}}>
        <h3>Last Response Meta</h3>
        <p style={{fontSize:12, margin:'4px 0'}}>Correlation ID: <code>{lastCorrelationId || 'n/a'}</code></p>
        {headers.etag && <p style={{fontSize:12, margin:'4px 0'}}>ETag: <code>{headers.etag}</code></p>}
        <details>
          <summary style={{cursor:'pointer', fontSize:12}}>Headers</summary>
          <pre style={{maxHeight:140, overflow:'auto'}}>{JSON.stringify(headers,null,2)}</pre>
        </details>
      </section>
      <section style={{background:'#fafafa', padding:8, borderRadius:4}}>
        <h3>Service Worker</h3>
        <pre>{JSON.stringify(swStatus,null,2)}</pre>
      </section>
    </div>
  );
};
