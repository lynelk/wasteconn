import { z } from 'zod';
import { apiClient } from './client';

const PickupSchema = z.object({
  id: z.string(),
  status: z.string(),
  customer_id: z.string().optional(),
  scheduled_date: z.string().optional(),
  created_date: z.string().optional()
});

const PickupListSchema = z.array(PickupSchema);

export const pickupsApi = {
  async list(params = {}) {
    const query = new URLSearchParams(params).toString();
    const result = await apiClient.get(`/pickups${query ? `?${query}` : ''}`);
    return PickupListSchema.parse(result?.data ?? result ?? []);
  },
  async create(payload) {
    const result = await apiClient.post('/pickups', payload);
    return PickupSchema.parse(result?.data ?? result);
  }
};
