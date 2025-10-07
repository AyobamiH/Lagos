import React from 'react';

export const SosButton: React.FC<{ onClick?: () => void; className?: string }> = ({ onClick, className='' }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="SOS Emergency"
    className={`fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full bg-red-600 text-white shadow-lg border border-red-700 focus:outline-none focus:ring-4 focus:ring-red-400 ${className}`}
  >
    SOS
  </button>
);
