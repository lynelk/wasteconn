export class AppError extends Error {
  constructor(type, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.details = details;
  }
}

export const ErrorTypes = {
  NETWORK: 'network_error',
  VALIDATION: 'validation_error',
  AUTH: 'auth_error',
  SERVER: 'server_error',
  UNKNOWN: 'unknown_error'
};

export const handleApiError = (error) => {
  if (error?.status === 401 || error?.status === 403) {
    return new AppError(ErrorTypes.AUTH, error.message || 'Authentication required', error.payload);
  }

  if (error?.status >= 400 && error?.status < 500) {
    return new AppError(ErrorTypes.VALIDATION, error.message || 'Validation failed', error.payload);
  }

  if (error?.status >= 500) {
    return new AppError(ErrorTypes.SERVER, error.message || 'Server error', error.payload);
  }

  if (error instanceof TypeError) {
    return new AppError(ErrorTypes.NETWORK, 'Network request failed', error);
  }

  return new AppError(ErrorTypes.UNKNOWN, error?.message || 'Unexpected error', error);
};
