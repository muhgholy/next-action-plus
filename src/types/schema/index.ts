import type { z } from 'zod';

import type { TIfInstalled, TPrettify, TUnionToIntersection } from '../utils';
import type { TGenericSchema, TGenericSchemaAsync } from './generic';
import type { TStandardSchemaV1, TStandardSchemaV1InferInput, TStandardSchemaV1InferOutput } from './standard';
import type { TZodAcceptsFormData, TZodFormDataInput } from './zod';

export const schemaAvailable = ['zod', 'generic', 'genericAsync', 'standard'] as const;
export type TSchemaAvailable = (typeof schemaAvailable)[number];

export type TSchema = TIfInstalled<z.ZodTypeAny> | TIfInstalled<TGenericSchema> | TIfInstalled<TGenericSchemaAsync> | TStandardSchemaV1<any, any>;

export type TInfer<S extends TSchema> = S extends TIfInstalled<z.ZodTypeAny> ? z.infer<S> : S extends TIfInstalled<TGenericSchema> ? ReturnType<S['parse']> : S extends TIfInstalled<TGenericSchemaAsync> ? Awaited<ReturnType<S['parseAsync']>> : S extends TStandardSchemaV1<any, any> ? TStandardSchemaV1InferOutput<S> : never;

export type TInferIn<S extends TSchema> = S extends TIfInstalled<z.ZodTypeAny> ? z.input<S> : S extends TIfInstalled<TGenericSchema> ? Parameters<S['parse']>[0] : S extends TIfInstalled<TGenericSchemaAsync> ? Parameters<S['parseAsync']>[0] : S extends TStandardSchemaV1<any, any> ? TStandardSchemaV1InferInput<S> : never;

export type TInferArray<S extends readonly TSchema[]> = S extends readonly [infer First extends TSchema, ...infer Rest extends TSchema[]] ? [TInfer<First>, ...TInferArray<Rest>] : [];

export type TInferInArray<S extends readonly TSchema[]> = S extends readonly [infer First extends TSchema, ...infer Rest extends TSchema[]] ? [TInferIn<First>, ...TInferInArray<Rest>] : [];

export type TIsFormData<S extends TSchema> = S extends z.ZodTypeAny ? TZodAcceptsFormData<S> : S extends TStandardSchemaV1<infer Input, any> ? (FormData extends Input ? true : false) : false;

export type TFormDataInput<S extends TSchema> = S extends z.ZodTypeAny ? TZodFormDataInput<S> : S extends TStandardSchemaV1<infer Input, any> ? (FormData extends Input ? FormData | TInferIn<S> : TInferIn<S>) : TInferIn<S>;

export type TFormDataCompatibleInput<S extends readonly TSchema[]> = S extends readonly [infer First extends TSchema, ...infer Rest extends TSchema[]] ? (TIsFormData<First> extends true ? FormData : never) | TPrettify<TUnionToIntersection<TInferIn<First>>> | (Rest['length'] extends 0 ? never : TFormDataCompatibleInput<Rest>) : Record<string, never>;
