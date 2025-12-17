import type { TActionPlusOptions, TActionPlusErrorPhase, TActionPlusIssue, TFormDataCompatibleInput, TFormDataInput, TInfer, TPrettify, TSchema, TMiddlewareFn, TUnionToIntersection } from './types';
import { ActionPlusValidationError } from './types';

export { schemaAvailable } from './types';
export { ActionPlusError, ActionPlusValidationError, isActionPlusError, isActionPlusValidationError } from './types';
export type * from './types';

/**
 * Class that handles server actions with validation
 */
export class ActionPlus<Schemas extends TSchema[] = [], Ctx extends Record<string, unknown> = Record<string, never>, Middlewares extends readonly TMiddlewareFn<any, any>[] = []> {
	private schemas: Schemas;
	private middlewares: Middlewares;
	private ctx: Ctx;
	private options: TActionPlusOptions;

	constructor(
		options: {
			schemas?: Schemas;
			middlewares?: Middlewares;
			ctx?: Ctx;
			options?: TActionPlusOptions;
		} = {},
	) {
		this.schemas = (options.schemas || []) as unknown as Schemas;
		this.middlewares = (options.middlewares || []) as unknown as Middlewares;
		this.ctx = (options.ctx || {}) as Ctx;
		this.options = options.options ?? {};
	}

	/**
	 * Adds a validation schema
	 * @param schema Validation schema
	 */
	schema<S extends TSchema>(schema: S): ActionPlus<[...Schemas, S], Ctx, Middlewares> {
		return new ActionPlus({
			schemas: [...this.schemas, schema] as unknown as [...Schemas, S],
			middlewares: this.middlewares,
			ctx: this.ctx,
			options: this.options,
		});
	}

	/**
	 * Adds a middleware function
	 * @param middleware Middleware function
	 */
	use<NextCtx extends Record<string, unknown>>(middleware: TMiddlewareFn<Ctx, NextCtx>): ActionPlus<Schemas, Ctx & NextCtx, [...Middlewares, TMiddlewareFn<Ctx, NextCtx>]> {
		return new ActionPlus({
			schemas: this.schemas,
			middlewares: [...this.middlewares, middleware] as unknown as [...Middlewares, TMiddlewareFn<Ctx, NextCtx>],
			ctx: this.ctx as unknown as Ctx & NextCtx,
			options: this.options,
		});
	}

	/**
	 * Creates an action with validation and middleware
	 * @param handler Action handler function
	 */
	action<Output>(handler: (props: { parsedInput: Schemas extends (infer S extends TSchema)[] ? TPrettify<TUnionToIntersection<TInfer<S>>> : Record<string, never>; ctx: TPrettify<Ctx> }) => Promise<Output>): (input?: Schemas extends [infer S extends TSchema] ? TFormDataInput<S> : Schemas extends (infer _S extends TSchema)[] ? TFormDataCompatibleInput<Schemas> : unknown) => Promise<Output> {
		return async (input?: unknown): Promise<Output> => {
			let phase: TActionPlusErrorPhase = 'validation';
			let parsedInputForErrors: unknown = undefined;
			let ctxForErrors: unknown = undefined;

			try {
				// Validate input against all schemas
				type ParsedInput = Schemas extends (infer S extends TSchema)[] ? TPrettify<TUnionToIntersection<TInfer<S>>> : Record<string, never>;
				phase = 'validation';
				const parsedInput = (await this.validateInput(input)) as ParsedInput;
				parsedInputForErrors = parsedInput;

				// Run middleware chain
				phase = 'middleware';
				const ctx = await this.runMiddlewareChain(parsedInput);
				ctxForErrors = ctx;

				// Execute handler
				phase = 'handler';
				return await handler({ parsedInput, ctx });
			} catch (error: unknown) {
				const logger = this.options.logger === undefined ? console : this.options.logger;
				if (logger !== false) {
					logger.error('Action error:', error);
				}

				const includeInput = this.options.includeInputInErrorDetails === true;
				const baseContext = {
					phase,
					error,
					input: includeInput ? input : undefined,
					parsedInput: includeInput ? parsedInputForErrors : undefined,
					ctx: includeInput ? (ctxForErrors as Record<string, unknown> | undefined) : undefined,
				};

				// Handle validation errors
				if (this.isValidationError(error)) {
					const { message, issues } = this.formatValidationErrorParts(error);
					const validationContext = { ...baseContext, message, issues };
					this.options.onError?.(validationContext);

					const formatted =
						this.options.formatValidationError?.(validationContext) ??
						new ActionPlusValidationError(message, {
							issues,
							phase,
							cause: error,
							data: includeInput ? { input, parsedInput: parsedInputForErrors, ctx: ctxForErrors } : undefined,
						});

					throw formatted;
				}

				this.options.onError?.(baseContext);
				const maybeFormatted = this.options.formatError?.(baseContext);
				if (maybeFormatted) throw maybeFormatted;

				throw error;
			}
		};
	}

	private normalizeIssuePath(path: unknown): Array<string | number> {
		if (!Array.isArray(path)) return [];
		return path.map(seg => {
			if (typeof seg === 'string' || typeof seg === 'number') return seg;
			if (typeof seg === 'object' && seg !== null && 'key' in (seg as Record<string, unknown>)) {
				const key = (seg as { key: unknown }).key;
				if (typeof key === 'string' || typeof key === 'number') return key;
				return String(key);
			}
			return String(seg);
		});
	}

	private normalizeIssues(error: unknown): TActionPlusIssue[] {
		if (typeof error !== 'object' || error === null) return [];

		const maybe = error as {
			errors?: Array<{ path?: unknown; message?: unknown }>;
			issues?: Array<{ path?: unknown; message?: unknown }>;
		};

		const rawIssues = (maybe.errors ?? maybe.issues ?? []) as Array<{ path?: unknown; message?: unknown }>;
		return rawIssues.map(issue => ({
			path: this.normalizeIssuePath(issue.path),
			message: typeof issue.message === 'string' ? issue.message : String(issue.message ?? ''),
			raw: issue,
		}));
	}

	private formatValidationErrorParts(error: unknown): { message: string; issues: TActionPlusIssue[] } {
		const issues = this.normalizeIssues(error);
		const first = issues[0];
		if (!first) {
			return { message: `Validation error: ${String(error)}`, issues: [] };
		}

		const fieldPath = first.path.length ? first.path.join('.') : 'unknown';
		const message = first.message || String(error);
		return { message: `Input (${fieldPath}) is error: ${message}`, issues };
	}

	private async validateInput(input: unknown): Promise<unknown> {
		if (!this.schemas.length) return input;

		// zod-form-data uses `z.preprocess` and accepts FormData/URLSearchParams at runtime.
		// If the incoming input is FormData, try to find a single schema that can parse it into a
		// regular object first (regardless of ordering). Then validate *all* remaining schemas
		// against the same base input so schemas can validate different slices reliably.
		const schemasToRun = [...this.schemas];
		let baseInput: unknown = input;

		if (input instanceof FormData) {
			for (let i = 0; i < schemasToRun.length; i++) {
				const candidate = schemasToRun[i];
				const parsed = await this.tryParseSchema(candidate, input);
				if (!parsed.ok) continue;

				schemasToRun.splice(i, 1);
				baseInput = parsed.value;

				break;
			}
		}

		// If a FormData schema consumed the input and there are no schemas left,
		// the parsed base input is the validated result.
		if (schemasToRun.length === 0) {
			return baseInput;
		}

		// Single schema: return parsed value directly.
		if (schemasToRun.length === 1) {
			return await this.parseSchema(schemasToRun[0] as TSchema, baseInput);
		}

		let mergedObject: Record<string, unknown> | undefined;
		let lastNonObject: unknown = undefined;

		for (const schema of schemasToRun) {
			const parsed = await this.parseSchema(schema, baseInput);
			if (this.isPlainObject(parsed)) {
				mergedObject = { ...(mergedObject ?? {}), ...(parsed as Record<string, unknown>) };
			} else {
				lastNonObject = parsed;
			}
		}

		return mergedObject ?? lastNonObject;
	}

	private isPlainObject(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
	}

	private async parseSchema(schema: TSchema, input: unknown): Promise<unknown> {
		if (schema && typeof schema === 'object') {
			const maybeAsync = (schema as { parseAsync?: unknown }).parseAsync;
			if (typeof maybeAsync === 'function') {
				return await (schema as { parseAsync: (i: unknown) => Promise<unknown> }).parseAsync(input);
			}
			const maybeSync = (schema as { parse?: unknown }).parse;
			if (typeof maybeSync === 'function') {
				return (schema as { parse: (i: unknown) => unknown }).parse(input);
			}

			// Standard Schema v1 support.
			// Note: Zod v3+ exposes a `~standard` adapter too, but we prefer Zod's native parse/parseAsync
			// when available so validation failures produce a real `ZodError`.
			const maybeStandard = (schema as { '~standard'?: unknown })['~standard'];
			if (maybeStandard && typeof maybeStandard === 'object') {
				const validate = (maybeStandard as { validate?: unknown }).validate;
				if (typeof validate === 'function') {
					const result = await (validate as (v: unknown) => unknown)(input);
					if (result && typeof result === 'object' && 'issues' in result) {
						const err = new Error('Validation error');
						(err as unknown as { issues: unknown }).issues = (result as { issues: unknown }).issues;
						throw err;
					}
					if (result && typeof result === 'object' && 'value' in result) {
						return (result as { value: unknown }).value;
					}
				}
			}
		}

		throw new Error('Unsupported schema type');
	}

	private async tryParseSchema(schema: TSchema, input: unknown): Promise<{ ok: true; value: unknown } | { ok: false }> {
		try {
			if (schema && typeof schema === 'object') {
				const safeAsync = (schema as { safeParseAsync?: unknown }).safeParseAsync;
				if (typeof safeAsync === 'function') {
					const res = await (
						schema as {
							safeParseAsync: (i: unknown) => Promise<{ success: boolean; data?: unknown }>;
						}
					).safeParseAsync(input);
					return res.success ? { ok: true, value: res.data } : { ok: false };
				}

				const safeSync = (schema as { safeParse?: unknown }).safeParse;
				if (typeof safeSync === 'function') {
					const res = (schema as { safeParse: (i: unknown) => { success: boolean; data?: unknown } }).safeParse(input);
					return res.success ? { ok: true, value: res.data } : { ok: false };
				}

				// Standard Schema v1 support.
				const maybeStandard = (schema as { '~standard'?: unknown })['~standard'];
				if (maybeStandard && typeof maybeStandard === 'object') {
					const validate = (maybeStandard as { validate?: unknown }).validate;
					if (typeof validate === 'function') {
						const result = await (validate as (v: unknown) => unknown)(input);
						if (result && typeof result === 'object' && 'issues' in result) return { ok: false };
						if (result && typeof result === 'object' && 'value' in result) return { ok: true, value: (result as { value: unknown }).value };
					}
				}
			}

			// Fallback to throwing parse.
			return { ok: true, value: await this.parseSchema(schema, input) };
		} catch {
			return { ok: false };
		}
	}

	private async runMiddlewareChain(input: unknown): Promise<Ctx> {
		let ctx = { ...(this.ctx as Record<string, unknown>) } as Ctx;
		let currentIndex = 0;
		const middlewares = this.middlewares as unknown as readonly TMiddlewareFn<any, any>[];

		const runNext = async <NC extends Record<string, unknown> = Record<string, never>>(options?: { ctx?: NC }): Promise<Ctx & NC> => {
			if (options?.ctx) {
				ctx = { ...ctx, ...options.ctx } as Ctx;
			}

			if (currentIndex < middlewares.length) {
				const middleware = middlewares[currentIndex] as TMiddlewareFn<any, any>;
				currentIndex++;

				return (await middleware({
					input,
					ctx: Object.freeze({ ...ctx }),
					next: runNext,
				})) as Ctx & NC;
			}

			return ctx as Ctx & NC;
		};

		return await runNext();
	}

	private isValidationError(error: unknown): boolean {
		if (typeof error !== 'object' || error === null) return false;

		if ('name' in error) {
			const errName = (error as { name: string }).name;
			if (errName === 'ZodError' || errName.includes('ValidationError')) {
				return true;
			}
		}

		return 'errors' in error || 'issues' in error;
	}
}

/**
 * Creates an ActionPlus client that handles validation and execution of server actions
 */
export const createActionPlus = (options?: TActionPlusOptions) => {
	return new ActionPlus({ options });
};
