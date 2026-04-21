import { appParams } from '@/lib/app-params';
import { logger } from '@/lib/logger';
import { handleApiError } from '@/lib/errorHandler';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-App-Id': appParams.appId
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withAuth = (headers = {}) => {
  if (!appParams.token) {
    return { ...DEFAULT_HEADERS, ...headers };
  }

  return {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${appParams.token}`,
    ...headers
  };
};

const shouldRetry = (error, retries) => {
  if (retries <= 0) return false;
  if (error?.name === 'AbortError') return false;
  return !error?.status || error.status >= 500;
};

export const createApiClient = ({ baseUrl = '/api', retries = 2 } = {}) => {
  const request = async (path, options = {}, retriesLeft = retries) => {
    const start = Date.now();

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: withAuth(options.headers)
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.text();

      if (!response.ok) {
        const httpError = {
          status: response.status,
          message: payload?.message || `HTTP ${response.status}`,
          payload
        };

        throw httpError;
      }

      logger.info('api.response', {
        path,
        method: options.method || 'GET',
        durationMs: Date.now() - start,
        status: response.status
      });

      return payload;
    } catch (error) {
      if (shouldRetry(error, retriesLeft)) {
        await wait(250 * (retries - retriesLeft + 1));
        return request(path, options, retriesLeft - 1);
      }

      logger.error('api.error', {
        path,
        method: options.method || 'GET',
        durationMs: Date.now() - start,
        error
      });

      throw handleApiError(error);
    }
  };

  return {
    get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options = {}) =>
      request(path, {
        ...options,
        method: 'POST',
        body: JSON.stringify(body)
      }),
    put: (path, body, options = {}) =>
      request(path, {
        ...options,
        method: 'PUT',
        body: JSON.stringify(body)
      }),
    patch: (path, body, options = {}) =>
      request(path, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify(body)
      }),
    delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' })
  };
};

export const apiClient = createApiClient();
