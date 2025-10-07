import React from 'react';
import { useRateLimit } from '../context/RateLimitContext';
import { t } from '../i18n/messages';

export const RateLimitBanner: React.FC = () => {
  const { active, secondsLeft } = useRateLimit();
  if (!active) return null;
  return (
    <div style={{position:'fixed', top:0, right:0, background:'#b91c1c', color:'#fff', padding:'4px 10px', fontSize:12, zIndex:99999, borderBottomLeftRadius:6}}>
  {t('rate_limited_banner')}: {secondsLeft}s
    </div>
  );
};