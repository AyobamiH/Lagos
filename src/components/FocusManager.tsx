import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const FocusManager: React.FC = () => {
  const loc = useLocation();
  useEffect(() => {
    const h = document.querySelector('h1, h2, h3');
    if (h instanceof HTMLElement) { h.setAttribute('tabIndex','-1'); h.focus(); }
  }, [loc.pathname]);
  return null;
};
