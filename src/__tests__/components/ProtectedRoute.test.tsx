import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';

// ── AuthContext mock ──────────────────────────────────────────────────────────

vi.mock('@/lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/UserNotRegisteredError', () => ({
  default: () => <p>not-registered</p>,
}));

const { useAuth } = await import('@/lib/AuthContext');
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderProtectedRoute(authState: object, unauthElement = <p>login</p>) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          element={<ProtectedRoute unauthenticatedElement={unauthElement} />}
        >
          <Route path="/protected" element={<p>protected content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProtectedRoute', () => {
  it('shows fallback spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: true,
      authChecked: false,
      authError: null,
      checkUserAuth: vi.fn(),
    });

    const { container } = renderProtectedRoute({});
    // The default fallback renders the spinner div, not the route content
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders protected content when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoadingAuth: false,
      authChecked: true,
      authError: null,
      checkUserAuth: vi.fn(),
    });

    renderProtectedRoute({});
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('renders unauthenticated element when not authenticated and no error', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
      authChecked: true,
      authError: null,
      checkUserAuth: vi.fn(),
    });

    renderProtectedRoute({});
    expect(screen.getByText('login')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders UserNotRegisteredError when authError type is user_not_registered', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
      authChecked: true,
      authError: { type: 'user_not_registered', message: 'Not registered' },
      checkUserAuth: vi.fn(),
    });

    renderProtectedRoute({});
    expect(screen.getByText('not-registered')).toBeInTheDocument();
  });

  it('renders unauthenticated element for non-registration auth errors', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoadingAuth: false,
      authChecked: true,
      authError: { type: 'auth_required', message: 'Auth required' },
      checkUserAuth: vi.fn(),
    });

    renderProtectedRoute({});
    expect(screen.getByText('login')).toBeInTheDocument();
  });
});
