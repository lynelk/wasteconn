import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/app-params', () => ({
  appParams: { appId: 'test-app', token: 'test-token' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/api/base44Client', () => ({
  base44: {
    auth: {
      me: vi.fn(),
      logout: vi.fn(),
      redirectToLogin: vi.fn(),
    },
  },
}));

// ── Axios client mock ──────────────────────────────────────────────────────────
// We mock the module factory inline so the test controls the behaviour per test.
const mockAxiosGet = vi.fn();

vi.mock('@base44/sdk/dist/utils/axios-client', () => ({
  createAxiosClient: () => ({ get: mockAxiosGet }),
}));

// ── Consumer component ────────────────────────────────────────────────────────

function AuthConsumer() {
  const { authError, isLoadingAuth, isLoadingPublicSettings, isAuthenticated } = useAuth();

  if (isLoadingAuth || isLoadingPublicSettings) return <p>loading</p>;
  if (authError) return <p>error:{authError.type}</p>;
  if (isAuthenticated) return <p>authenticated</p>;
  return <p>unauthenticated</p>;
}

const { base44 } = await import('@/api/base44Client');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reflects user_not_registered error from public settings endpoint', async () => {
    const apiError = {
      status: 403,
      data: { extra_data: { reason: 'user_not_registered' } },
      message: 'Forbidden',
    };
    mockAxiosGet.mockRejectedValue(apiError);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByText('error:user_not_registered')).toBeInTheDocument()
    );
  });

  it('reflects auth_required error from public settings endpoint', async () => {
    const apiError = {
      status: 403,
      data: { extra_data: { reason: 'auth_required' } },
      message: 'Forbidden',
    };
    mockAxiosGet.mockRejectedValue(apiError);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByText('error:auth_required')).toBeInTheDocument()
    );
  });

  it('sets isAuthenticated=true when me() resolves', async () => {
    mockAxiosGet.mockResolvedValue({ id: 'app1', public_settings: {} });
    (base44.auth.me as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', role: 'admin' });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByText('authenticated')).toBeInTheDocument()
    );
  });

  it('sets auth_required error when me() returns 401', async () => {
    mockAxiosGet.mockResolvedValue({ id: 'app1', public_settings: {} });
    (base44.auth.me as ReturnType<typeof vi.fn>).mockRejectedValue({ status: 401, message: 'Unauthorized' });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByText('error:auth_required')).toBeInTheDocument()
    );
  });

  it('sets unknown error on unexpected public settings failure', async () => {
    mockAxiosGet.mockRejectedValue({ message: 'Network error' });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByText('error:unknown')).toBeInTheDocument()
    );
  });
});
