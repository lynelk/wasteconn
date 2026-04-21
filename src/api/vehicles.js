import { z } from 'zod';
import { apiClient } from './client';

const VehicleSchema = z.object({
  id: z.string(),
  status: z.string(),
  plate_number: z.string().optional(),
  created_date: z.string().optional()
});

const VehicleListSchema = z.array(VehicleSchema);

export const vehiclesApi = {
  async list(params = {}) {
    const query = new URLSearchParams(params).toString();
    const result = await apiClient.get(`/vehicles${query ? `?${query}` : ''}`);
    return VehicleListSchema.parse(result?.data ?? result ?? []);
  }
};
