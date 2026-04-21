import { z } from 'zod';
import { apiClient } from './client';

const IntegrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  provider: z.string().optional()
});

const IntegrationListSchema = z.array(IntegrationSchema);

export const integrationsApi = {
  async list() {
    const result = await apiClient.get('/integrations');
    return IntegrationListSchema.parse(result?.data ?? result ?? []);
  }
};
