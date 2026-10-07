import { z } from 'zod';

export const ShopSchema = z.object({
    id: z.string(),
    name: z.string(),
});
