import type { TSchema, TStandardSchemaV1 } from '../src/types';
import { createActionPlus } from '../src/index';
import { assertType, expectTypeOf, test } from 'vitest';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

test('Zod schema inference', () => {
	const action = createActionPlus()
		.schema(z.object({ name: z.string(), age: z.number() }))
		.action(async ({ parsedInput, ctx }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ name: string; age: number }>();
			expectTypeOf(ctx).toEqualTypeOf<Record<string, never>>();
			return parsedInput;
		});

	expectTypeOf<Parameters<typeof action>[0]>().toEqualTypeOf<{ name: string; age: number } | undefined>();
});

test('Generic sync schema inference', () => {
	const schema = {
		parse: (_: unknown) => ({ a: 'a' as const }),
	};

	const action = createActionPlus()
		.schema(schema)
		.action(async ({ parsedInput }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ a: 'a' }>();
			return parsedInput;
		});

	expectTypeOf<Parameters<typeof action>[0]>().toEqualTypeOf<unknown>();
});

test('Generic async schema inference', () => {
	const schema = {
		parseAsync: async (_: unknown) => ({ b: 123 as const }),
	};

	const action = createActionPlus()
		.schema(schema)
		.action(async ({ parsedInput }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ b: 123 }>();
			return parsedInput;
		});

	expectTypeOf<Parameters<typeof action>[0]>().toEqualTypeOf<unknown>();
});

test('Standard Schema inference', () => {
	type Std = TStandardSchemaV1<{ name: string }, { name: string; upper: string }>;

	const stdSchema: Std = {
		'~standard': {
			version: 1,
			vendor: 'test',
			validate: value => {
				const v = value as { name: string };
				return { value: { name: v.name, upper: v.name.toUpperCase() } };
			},
			types: {
				input: undefined as unknown as { name: string },
				output: undefined as unknown as { name: string; upper: string },
			},
		},
	};

	const action = createActionPlus()
		.schema(stdSchema)
		.action(async ({ parsedInput }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ name: string; upper: string }>();
			return parsedInput;
		});

	expectTypeOf<Parameters<typeof action>[0]>().toEqualTypeOf<{ name: string } | undefined>();
});

test('FormData input inference for ZodEffects (typed like zod-form-data)', () => {
	type ZodFD = z.ZodEffects<z.ZodObject<{ name: z.ZodString }>, { name: string }, FormData | { name: string }>;
	const fdSchema = z.preprocess(() => undefined, z.object({ name: z.string() })) as unknown as ZodFD;

	const action = createActionPlus()
		.schema(fdSchema)
		.action(async ({ parsedInput }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ name: string }>();
			return parsedInput.name;
		});

	expectTypeOf<Parameters<typeof action>[0]>().toEqualTypeOf<FormData | { name: string } | undefined>();
});

test('FormData input inference for real zod-form-data', () => {
	const schema = zfd.formData({
		name: zfd.text(),
	});

	const action = createActionPlus()
		.schema(schema)
		.action(async ({ parsedInput }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ name: string }>();
			return parsedInput.name;
		});

	type Input = Parameters<typeof action>[0];
	type HasFormData = FormData extends Exclude<Input, undefined> ? true : false;
	expectTypeOf<HasFormData>().toEqualTypeOf<true>();
});

test('FormData + File inference for real zod-form-data', () => {
	const schema = zfd.formData({
		upload: zfd.file(),
	});

	createActionPlus()
		.schema(schema)
		.action(async ({ parsedInput }) => {
			expectTypeOf(parsedInput.upload).toEqualTypeOf<File>();
			return parsedInput.upload.name;
		});
});

test('Schema chaining => intersection output', () => {
	const aSchema = { parse: (_: unknown) => ({ a: 'x' as const }) };
	const bSchema = { parse: (_: unknown) => ({ b: 1 as const }) };

	const action = createActionPlus()
		.schema(aSchema)
		.schema(bSchema)
		.action(async ({ parsedInput }) => {
			expectTypeOf(parsedInput).toEqualTypeOf<{ a: 'x'; b: 1 }>();
			return parsedInput;
		});

	type Input = Parameters<typeof action>[0];
	type Optional = undefined extends Input ? true : false;
	type NotOnlyFormData = Input extends FormData ? false : true;
	expectTypeOf<Optional>().toEqualTypeOf<true>();
	expectTypeOf<NotOnlyFormData>().toEqualTypeOf<true>();
});

test('TSchema accepts all supported shapes', () => {
	const schemas: TSchema[] = [
		z.string(),
		{ parse: (x: unknown) => x },
		{ parseAsync: async (x: unknown) => x },
		{
			'~standard': {
				version: 1,
				vendor: 'test',
				validate: async (value: unknown) => ({ value }),
			},
		},
	];

	assertType<TSchema[]>(schemas);
});

test('createActionPlus options are typed', () => {
	createActionPlus({
		logger: false,
		includeInputInErrorDetails: true,
		formatValidationError: ({ message, issues }) => {
			return new Error(message + String(issues.length));
		},
		formatError: ({ error }) => {
			return new Error(String(error));
		},
		onError: () => {},
	});
});
