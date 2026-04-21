import { describe, expect, it } from 'vitest';
import { ErrorTypes, handleApiError } from '@/lib/errorHandler';

describe('handleApiError', () => {
  it('maps 401 to auth error type', () => {
    const error = handleApiError({ status: 401, message: 'Unauthorized' });
    expect(error.type).toBe(ErrorTypes.AUTH);
  });

  it('maps 500 to server error type', () => {
    const error = handleApiError({ status: 500, message: 'Internal Error' });
    expect(error.type).toBe(ErrorTypes.SERVER);
  });
});
