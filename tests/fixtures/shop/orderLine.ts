import { z } from 'zod';

export const OrderLineSchema = z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
});
