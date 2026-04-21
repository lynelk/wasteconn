import { z } from 'zod';
import { apiClient } from './client';

const PaymentSchema = z.object({
  id: z.string(),
  amount: z.number(),
  status: z.string(),
  customer_id: z.string().optional(),
  created_date: z.string().optional()
});

const PaymentListSchema = z.array(PaymentSchema);

export const paymentsApi = {
  async list(params = {}) {
    const query = new URLSearchParams(params).toString();
    const result = await apiClient.get(`/payments${query ? `?${query}` : ''}`);
    return PaymentListSchema.parse(result?.data ?? result ?? []);
  },
  async create(payload) {
    const result = await apiClient.post('/payments', payload);
    return PaymentSchema.parse(result?.data ?? result);
  }
};
