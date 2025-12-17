import 'server-only';

import { createSafeActionClient } from 'next-action-plus';
import { z } from 'zod';

// You can keep this as a single exported function.
// It feels like a normal Next.js Server Action, but with validation + types.
const action = createSafeActionClient()
	.schema(z.object({ name: z.string().min(1) }))
	.action(async ({ parsedInput }) => {
		return { message: `Hello ${parsedInput.name}` };
	});

export async function sayHello(input: { name: string }) {
	return action(input);
}
