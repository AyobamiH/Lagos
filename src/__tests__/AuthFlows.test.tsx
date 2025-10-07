import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import { BrowserRouter } from 'react-router-dom';

var signupMock: any, loginMock: any, profileMock: any;
vi.mock('../api/client', () => {
  signupMock = vi.fn().mockResolvedValue({ token: 'tok-signup' });
  loginMock = vi.fn().mockResolvedValue({ token: 'tok-login' });
  profileMock = vi.fn().mockResolvedValue({ _id: 'u1', name: 'User', phone: '+1', role: 'rider' });
  return {
    api: { signup: signupMock, login: loginMock, profile: profileMock },
    registerApiHooks: () => {},
    injectTokenAccessors: () => {},
    lastCorrelationId: null
  };
});
vi.mock('../rum/clientRUM', () => ({ cacheUserRole: () => {} }));

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  </BrowserRouter>
);

describe('Auth flows', () => {
  beforeEach(()=> { localStorage.clear(); signupMock.mockClear(); loginMock.mockClear(); profileMock.mockClear(); });
  it('signup sets token and loads profile', async () => {
    render(<Wrapper><Signup /></Wrapper>);
    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByPlaceholderText('+15551234567'), { target: { value: '+1234567' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: /Create Rider Account/i }));
    await waitFor(()=> expect(signupMock).toHaveBeenCalled());
    await waitFor(()=> expect(profileMock).toHaveBeenCalled());
  });
  it('login sets token', async () => {
    render(<Wrapper><Login /></Wrapper>);
    fireEvent.change(screen.getByPlaceholderText('+15551234567'), { target: { value: '+1234567' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: /Login/i }));
    await waitFor(()=> expect(loginMock).toHaveBeenCalled());
    await waitFor(()=> expect(profileMock).toHaveBeenCalled());
  });
});
