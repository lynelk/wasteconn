import { z } from 'zod';
import { apiClient } from './client';

const SessionSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  role: z.string().optional()
});

export const authApi = {
  async me() {
    const result = await apiClient.get('/auth/me');
    return SessionSchema.parse(result?.data ?? result);
  }
};
