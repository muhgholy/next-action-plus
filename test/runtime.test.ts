import { describe, expect, test, vi } from 'vitest';

import { ActionPlusValidationError, createActionPlus } from '../src/index';
import type { TStandardSchemaV1 } from '../src/types';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

describe('runtime', () => {
	test('zod schema: parses object input', async () => {
		const action = createActionPlus()
			.schema(z.object({ name: z.string() }))
			.action(async ({ parsedInput }) => {
				return { ok: true, name: parsedInput.name };
			});

		await expect(action({ name: 'Ada' })).resolves.toEqual({ ok: true, name: 'Ada' });
	});

	test('zod schema: validation failure throws formatted Error (message + cause)', async () => {
		const action = createActionPlus()
			.schema(z.object({ name: z.string().min(2) }))
			.action(async ({ parsedInput }) => {
				return { ok: true, name: parsedInput.name };
			});

		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await action({ name: 'A' });
			throw new Error('Expected action to throw');
		} catch (err: unknown) {
			expect(err).toBeInstanceOf(ActionPlusValidationError);
			expect((err as Error).message).toMatch(/^Input \(name\) is error: /);
			expect((err as { cause?: unknown }).cause).toBeInstanceOf(z.ZodError);
			expect((err as ActionPlusValidationError).issues.length).toBeGreaterThan(0);
			expect((err as ActionPlusValidationError).code).toBe('VALIDATION_ERROR');
		} finally {
			spy.mockRestore();
		}
	});

	test('options: logger=false disables console.error logging', async () => {
		const client = createActionPlus({ logger: false });
		const action = client.schema(z.object({ name: z.string().min(2) })).action(async ({ parsedInput }) => parsedInput.name);

		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		await expect(action({ name: 'A' })).rejects.toBeInstanceOf(ActionPlusValidationError);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	test('options: formatValidationError can return custom error (message preserved)', async () => {
		class MyValidationError extends Error {
			issues: unknown;
			constructor(message: string, issues: unknown) {
				super(message);
				this.name = 'MyValidationError';
				this.issues = issues;
			}
		}

		const client = createActionPlus({
			logger: false,
			formatValidationError: ({ message, issues, error }) => {
				const e = new MyValidationError(message, { issues, cause: error });
				return e;
			},
		});

		const action = client.schema(z.object({ name: z.string().min(2) })).action(async ({ parsedInput }) => parsedInput.name);

		await expect(action({ name: 'A' })).rejects.toMatchObject({
			name: 'MyValidationError',
			message: expect.stringMatching(/^Input \(name\) is error: /),
		});
	});

	test('generic sync schema: parse() works', async () => {
		const schema = {
			parse(input: unknown) {
				expect(typeof input).toBe('object');
				return { a: 'x' };
			},
		};

		const action = createActionPlus()
			.schema(schema)
			.action(async ({ parsedInput }) => parsedInput);

		await expect(action({})).resolves.toEqual({ a: 'x' });
	});

	test('generic async schema: parseAsync() works', async () => {
		const schema = {
			async parseAsync(_input: unknown) {
				return { b: 123 };
			},
		};

		const action = createActionPlus()
			.schema(schema)
			.action(async ({ parsedInput }) => parsedInput);

		await expect(action({})).resolves.toEqual({ b: 123 });
	});

	test('standard schema v1: validate() success + failure', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const standardSchema: TStandardSchemaV1<{ name: string }, { name: string }> = {
			'~standard': {
				version: 1,
				vendor: 'test',
				validate(value: unknown) {
					if (!value || typeof value !== 'object' || !('name' in value)) {
						return {
							issues: [
								{
									message: 'name is required',
									path: ['name'],
								},
							],
						};
					}

					const name = (value as { name?: unknown }).name;
					if (typeof name !== 'string') {
						return {
							issues: [
								{
									message: 'name must be a string',
									path: ['name'],
								},
							],
						};
					}

					return { value: { name } };
				},
			},
		};

		const action = createActionPlus()
			.schema(standardSchema)
			.action(async ({ parsedInput }) => ({ ok: true, name: parsedInput.name }));

		await expect(action({} as unknown as { name: string })).rejects.toThrow(/Input \(name\) is error: name is required/);
		await expect(action({ name: 'Linus' })).resolves.toEqual({ ok: true, name: 'Linus' });

		spy.mockRestore();
	});

	test('schema chaining merges object outputs (intersection behavior)', async () => {
		const s1 = { parse: (_: unknown) => ({ a: 'a' }) };
		const s2 = { parse: (_: unknown) => ({ b: 2 }) };

		const action = createActionPlus()
			.schema(s1)
			.schema(s2)
			.action(async ({ parsedInput }) => parsedInput);

		await expect(action({})).resolves.toEqual({ a: 'a', b: 2 });
	});

	test('multiple schemas validate against same base input (zod)', async () => {
		const action = createActionPlus()
			.schema(z.object({ foo: z.string() }))
			.schema(z.object({ bar: z.number() }))
			.action(async ({ parsedInput }) => parsedInput);

		await expect(action({ foo: 'x', bar: 1 })).resolves.toEqual({ foo: 'x', bar: 1 });
	});

	test('FormData: zod effects schema can parse FormData', async () => {
		type ZodFD = z.ZodEffects<z.ZodObject<{ name: z.ZodString }>, { name: string }, FormData | { name: string }>;

		const fdSchema = z.preprocess(
			(v: unknown) => {
				if (v instanceof FormData) return Object.fromEntries(v.entries());
				return v;
			},
			z.object({ name: z.string() }),
		) as unknown as ZodFD;

		const action = createActionPlus()
			.schema(fdSchema)
			.action(async ({ parsedInput }) => parsedInput.name);

		const fd = new FormData();
		fd.set('name', 'Grace');

		await expect(action(fd)).resolves.toBe('Grace');
	});

	test('FormData: zod-form-data zfd.formData parses new FormData()', async () => {
		const schema = zfd.formData({
			name: zfd.text(),
		});

		const action = createActionPlus()
			.schema(schema)
			.action(async ({ parsedInput }) => parsedInput.name);

		const fd = new FormData();
		fd.set('name', 'Margaret');

		await expect(action(fd)).resolves.toBe('Margaret');
	});

	test('FormData: zod-form-data zfd.file parses File in new FormData()', async () => {
		const schema = zfd.formData({
			upload: zfd.file(),
		});

		const action = createActionPlus()
			.schema(schema)
			.action(async ({ parsedInput }) => {
				return {
					name: parsedInput.upload.name,
					size: parsedInput.upload.size,
					type: parsedInput.upload.type,
				};
			});

		const fd = new FormData();
		const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
		fd.set('upload', file);

		const result = await action(fd);
		expect(result.name).toBe('hello.txt');
		expect(result.type).toBe('text/plain');
		expect(typeof result.size).toBe('number');
		expect(result.size).toBeGreaterThan(0);
	});

	test('FormData: standard schema can accept FormData input', async () => {
		const schema: TStandardSchemaV1<FormData | { name: string }, { name: string }> = {
			'~standard': {
				version: 1,
				vendor: 'test',
				validate(value: unknown) {
					const obj = value instanceof FormData ? Object.fromEntries(value.entries()) : value;
					if (!obj || typeof obj !== 'object' || !('name' in obj)) {
						return { issues: [{ message: 'missing name', path: ['name'] }] };
					}

					const name = (obj as { name?: unknown }).name;
					if (typeof name !== 'string') {
						return { issues: [{ message: 'name must be a string', path: ['name'] }] };
					}

					return { value: { name } };
				},
			},
		};

		const action = createActionPlus()
			.schema(schema)
			.action(async ({ parsedInput }) => parsedInput.name);

		const fd = new FormData();
		fd.set('name', 'Katherine');

		await expect(action(fd)).resolves.toBe('Katherine');
	});

	test('middleware: ctx is extended through chain', async () => {
		const action = createActionPlus()
			.use(async ({ next }) => next({ ctx: { a: 'x' } }))
			.use(async ({ ctx, next }) => {
				expect(ctx.a).toBe('x');
				return next({ ctx: { b: 1 } });
			})
			.action(async ({ ctx }) => ctx);

		await expect(action({})).resolves.toEqual({ a: 'x', b: 1 });
	});
});
