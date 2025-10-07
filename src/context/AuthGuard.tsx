import React from 'react';
import { useAuth } from './AuthContext';
import { Navigate } from 'react-router-dom';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const token = (auth as any)?.token;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const RiderGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth() as any;
  const token = auth?.token;
  const role = auth?.profile?.role;
  if (!token) return <Navigate to="/login" replace />;
  // While profile is loading, show a lightweight placeholder instead of a blank screen
  if (!role) {
    return (
      <div className="p-4 text-sm text-slate-600">
        Loading your profile…
      </div>
    );
  }
  if (role === 'driver') return <Navigate to="/driver" replace />;
  return <>{children}</>;
};

export const DriverGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth() as any;
  const token = auth?.token;
  if (!token) return <Navigate to="/login" replace />;
  if (auth?.profile?.role !== 'driver') return <Navigate to="/" replace />;
  return <>{children}</>;
};
