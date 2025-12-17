import type { z } from 'zod';

/**
 * Helper type for `zod-form-data` (and similar) schemas.
 *
 * `zod-form-data`'s `zfd.formData(...)` wraps an object schema in a `z.preprocess`,
 * so the resulting schema is a `ZodEffects` whose input includes `FormData`.
 */
export type TZodFormDataSchemaFactory = {
	<T extends z.ZodRawShape>(shape: T): z.ZodEffects<z.ZodObject<T>, z.output<z.ZodObject<T>>, FormData | z.input<z.ZodObject<T>>>;
	<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T, z.output<T>, FormData | z.input<T>>;
};

export type TZodAcceptsFormData<S extends z.ZodTypeAny> = S extends z.ZodEffects<z.ZodTypeAny, unknown, infer I> ? (FormData extends I ? true : false) : false;

export type TZodFormDataInput<S extends z.ZodTypeAny> = TZodAcceptsFormData<S> extends true ? FormData | z.input<S> : z.input<S>;
