import { z } from 'zod';

// `shopId` is a plain string: Zod cannot tell that it points to a shop.
export const OrderSchema = z.object({
    id: z.string(),
    shopId: z.string(),
    note: z.string().optional(),
});
