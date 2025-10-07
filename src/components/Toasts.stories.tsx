import React from 'react';
import { ToastProvider } from '../context/ToastContext';
import { Toasts } from './Toasts';

export default { title: 'Components/Toasts', component: Toasts };

export const Basic = () => (
  <ToastProvider>
    <div style={{padding:20}}>
      <p>Trigger a toast programmatically in code example.</p>
    </div>
    <Toasts />
  </ToastProvider>
);
