# next-action-plus

![next-action-plus logo](https://raw.githubusercontent.com/muhgholy/next-action-plus/main/assets/next-action-plus.svg)

**next-action-plus** is a tiny TypeScript library for **type-safe Next.js Server Actions**.

You write a server action like you always do. You optionally add a schema. You get:

- Input validation (Zod compatible, but schema-agnostic)
- Correct `parsedInput` type inference
- A native-feeling API: `.schema(...).action(async (...) => ...)`

No framework lock-in. No new mental model.

## Table of contents

- [Why next-action-plus](#why-next-action-plus)
- [Install](#install)
- [Quick start](#quick-start)
- [Error handling](#error-handling)
- [Examples](#examples)
     - [Next.js Server Action](#nextjs-server-action)
     - [Client Component usage](#client-component-usage)
          - [FormData + File uploads](#formdata--file-uploads)
          - [Middleware (ctx)](#middleware-ctx)
          - [Schema-agnostic validation](#schema-agnostic-validation)
- [FAQ](#faq)
- [Release](#release)

## Why next-action-plus

Next.js Server Actions are great because they are simple: a function that runs on the server.
But when you accept user input, you usually need:

- validation
- safe parsing
- accurate types in the handler

next-action-plus keeps the **server action function shape** and adds **type-safe input parsing**.
You can treat your action like a normal function, and you still get strict TypeScript inference.

## Install

```bash
npm i next-action-plus
```

If you want Zod schemas, also install:

```bash
npm i zod
```

## Quick start

```ts
import { createActionPlus } from 'next-action-plus';
import { z } from 'zod';

export const sayHello = createActionPlus()
	.schema(z.object({ name: z.string().min(1) }))
	.action(async ({ parsedInput }) => {
		return { message: `Hello ${parsedInput.name}` };
	});
```

### What you get

- `sayHello` is still “just a function” you can call.
- `parsedInput` is inferred from your schema.
- The return type is inferred from your handler.

## Error handling

If schema validation fails, the action **throws** an `Error`.

The error message is intentionally short and looks like:

```txt
Input (name) is error: String must contain at least 1 character(s)
```

Notes:

- Only the **first** validation issue is used to build the message.
- The thrown error is an `ActionPlusValidationError` (extends `Error`) with a developer-friendly payload.
- The original validator error is preserved on `error.cause`.
- Normalized issues are available on `error.issues`.

```ts
try {
	await sayHello({ name: '' });
} catch (error) {
	// error.message => "Input (name) is error: ..."
	// (error as ActionPlusValidationError).code   => "VALIDATION_ERROR"
	// (error as ActionPlusValidationError).issues => [{ path, message, raw }]
	// (error as any).cause => original validator error (e.g. ZodError)
}
```

### Customizing errors (options)

`createActionPlus` accepts options to control logging and customize thrown errors.

```ts
import { createActionPlus } from 'next-action-plus';

export const client = createActionPlus({
	logger: false,
	formatValidationError: ({ message, issues, error }) => {
		const e = new Error(message);
		(e as any).issues = issues;
		(e as any).cause = error;
		return e;
	},
	onError: ({ phase, error }) => {
		// report errors (Sentry, etc)
		// phase: "validation" | "middleware" | "handler"
		void error;
	},
});
```

## Examples

### Next.js Server Action

This keeps the native Server Action feel.

```ts
import 'server-only';
import { createActionPlus } from 'next-action-plus';
import { z } from 'zod';

export const updateProfile = createActionPlus()
	.schema(z.object({ displayName: z.string().min(2) }))
	.action(async ({ parsedInput }) => {
		// parsedInput.displayName is string
		return { ok: true };
	});
```

### Client Component usage

You can import a Server Action into a Client Component and call it like a normal async function.
Next.js runs it on the server.

```tsx
'use client';

import { useState, useTransition } from 'react';
import { sayHello } from '@/app/actions';

export function SayHelloClient() {
	const [name, setName] = useState('');
	const [message, setMessage] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	return (
		<div>
			<input value={name} onChange={e => setName(e.target.value)} placeholder='Ada' />
			<button
				disabled={pending}
				onClick={() =>
					startTransition(async () => {
						const result = await sayHello({ name });
						setMessage(result.message);
					})
				}
			>
				{pending ? 'Sending…' : 'Say hello'}
			</button>
			{message ? <p>{message}</p> : null}
		</div>
	);
}
```

The snippets above are the full examples.

### FormData + File uploads

Works with `FormData` and `File` using `zod-form-data`.

If you chain multiple schemas and the input is a `FormData`, next-action-plus will first try to find a schema that can parse the `FormData` into a plain object, then validate the remaining schemas against that object.

```ts
import { createActionPlus } from 'next-action-plus';
import { zfd } from 'zod-form-data';

export const uploadAvatar = createActionPlus()
	.schema(
		zfd.formData({
			avatar: zfd.file(),
		}),
	)
	.action(async ({ parsedInput }) => {
		// parsedInput.avatar is File
		return { filename: parsedInput.avatar.name };
	});
```

### Middleware (ctx)

Add data to context in a type-safe way.

Validation runs first, then middleware runs, then your handler runs.

```ts
import { createActionPlus } from 'next-action-plus';
import { z } from 'zod';

const client = createActionPlus().use(async ({ next }) => next({ ctx: { userId: 'u_123' } }));

export const deletePost = client.schema(z.object({ postId: z.string() })).action(async ({ parsedInput, ctx }) => {
	// ctx.userId is string
	// parsedInput.postId is string
	return { ok: true };
});
```

### Schema-agnostic validation

You are not forced into one validator.

Supported schema shapes:

- Zod (`parse` / `parseAsync`)
- Generic `{ parse(...) }` and `{ parseAsync(...) }`
- Standard Schema v1 (`~standard.validate`)

If you already have a schema system, you can plug it in.

#### Schema chaining

You can chain multiple schemas. If they return objects, outputs are merged.

```ts
import { createActionPlus } from 'next-action-plus';

const s1 = { parse: (_: unknown) => ({ a: 'a' }) };
const s2 = { parse: (_: unknown) => ({ b: 2 }) };

export const demo = createActionPlus()
	.schema(s1)
	.schema(s2)
	.action(async ({ parsedInput }) => {
		// parsedInput is { a: string; b: number }
		return parsedInput;
	});
```

## FAQ

### Is next-action-plus only for Next.js?

No. It is built for the Server Actions style, but it runs in any Node 20+ runtime.

### Do I need to learn a new pattern?

No. The API is intentionally small: `createActionPlus() → .schema() → .use() → .action()`.

### Can I validate `FormData`?

Yes. Use `zod-form-data` (see [FormData + File uploads](#formdata--file-uploads)).

### Does it change my return types?

No. The returned action function keeps the exact return type of your handler.

### Can I chain multiple schemas?

Yes. Multiple schemas can validate the same base input. If they produce objects, outputs are merged.

## Release

This repository ships with `semantic-release`.

- Push Conventional Commits to `main`
- GitHub Actions runs `npm test`, `npm run build`, then publishes
