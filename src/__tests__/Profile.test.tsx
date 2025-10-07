import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import Profile from '../pages/Profile';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';

// Simple mock api override
var profileMock: any, submitFeedbackMock: any, listFeedbackMock: any;
vi.mock('../api/client', () => {
  profileMock = vi.fn().mockResolvedValue({ _id: 'u1', phone: '+123', name: 'Test User' });
  submitFeedbackMock = vi.fn().mockResolvedValue({ id: 'f1', createdAt: new Date().toISOString() });
  listFeedbackMock = vi.fn().mockResolvedValue({ items: [] });
  return {
    api: {
      profile: profileMock,
      submitFeedback: submitFeedbackMock,
      listMyFeedback: listFeedbackMock
    },
    registerApiHooks: () => {},
    injectTokenAccessors: () => {}
  };
});
vi.mock('../rum/clientRUM', () => ({ cacheUserRole: () => {} }));

// Helper auth wrapper injecting a fake token
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <MemoryRouter><ToastProvider><AuthProvider initialToken="t">{children}</AuthProvider></ToastProvider></MemoryRouter>;
};

describe('Profile feedback flow', () => {
  beforeEach(() => { localStorage.clear(); profileMock.mockClear(); submitFeedbackMock.mockClear(); listFeedbackMock.mockClear(); });

  it('renders profile and submits feedback', async () => {
    render(<Wrapper><Profile /></Wrapper>);

    await screen.findByText('Profile');
    const textarea = screen.getByPlaceholderText(/Share something/i);
    fireEvent.change(textarea, { target: { value: 'Great UX so far' } });
    const submitBtn = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitBtn);

    await waitFor(() => expect(submitFeedbackMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Saved/i)).toBeInTheDocument());
  });
});
