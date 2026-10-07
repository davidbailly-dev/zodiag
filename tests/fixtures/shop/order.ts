import { z } from 'zod';
import { OrderLineSchema } from './orderLine';
import { ShopSchema } from './shop';

export const OrderStatusSchema = z.enum(['completed', 'abandoned', 'refunded']);

export const OrderSchema = z.object({
    id: z.string(),
    shop: ShopSchema,
    status: OrderStatusSchema,
    lines: z.array(OrderLineSchema).min(1),
});

export type Order = z.infer<typeof OrderSchema>;
