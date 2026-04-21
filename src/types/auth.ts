export type AuthErrorType =
  | 'auth_required'
  | 'user_not_registered'
  | 'unknown'
  | string;

export interface AuthError {
  type: AuthErrorType;
  message: string;
}

export interface AuthStateUser {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuthContextValue {
  user: AuthStateUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: AuthError | null;
  appPublicSettings: Record<string, unknown> | null;
  logout: (shouldRedirect?: boolean) => void;
  navigateToLogin: () => void;
  checkAppState: () => Promise<void>;
}
