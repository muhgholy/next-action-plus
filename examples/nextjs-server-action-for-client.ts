'use server';

import { createSafeActionClient } from 'next-action-plus';
import { z } from 'zod';

// This is a Server Action that can be imported and called from a Client Component.
// Next.js will execute it on the server.
export const sayHello = createSafeActionClient()
	.schema(z.object({ name: z.string().min(1) }))
	.action(async ({ parsedInput }) => {
		return { message: `Hello ${parsedInput.name}` };
	});
