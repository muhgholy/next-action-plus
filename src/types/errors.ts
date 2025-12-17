export type TActionPlusIssuePathSegment = string | number;

export type TActionPlusIssue = {
	path: TActionPlusIssuePathSegment[];
	message: string;
	raw?: unknown;
};

export type TActionPlusErrorCode = 'VALIDATION_ERROR' | 'MIDDLEWARE_ERROR' | 'HANDLER_ERROR' | 'ACTION_ERROR';

export type TActionPlusErrorPhase = 'validation' | 'middleware' | 'handler';

export type TActionPlusUnknownErrorContext = {
	phase: TActionPlusErrorPhase;
	error: unknown;
	input?: unknown;
	parsedInput?: unknown;
	ctx?: Record<string, unknown>;
};

export type TActionPlusValidationErrorContext = TActionPlusUnknownErrorContext & {
	message: string;
	issues: TActionPlusIssue[];
};

export type TActionPlusErrorContext = TActionPlusUnknownErrorContext | TActionPlusValidationErrorContext;

export type TActionPlusOptions = {
	/**
	 * Control logging when an action throws.
	 * - `false` disables logging.
	 * - Defaults to `console`.
	 */
	logger?: false | { error: (...args: unknown[]) => void };

	/**
	 * Hook called whenever an action throws (validation, middleware, or handler).
	 */
	onError?: (ctx: TActionPlusErrorContext) => void;

	/**
	 * Customize the thrown error when validation fails.
	 * The returned Error will be thrown.
	 */
	formatValidationError?: (ctx: TActionPlusValidationErrorContext) => Error;

	/**
	 * Customize the thrown error for non-validation failures.
	 * If omitted, the original error is re-thrown.
	 */
	formatError?: (ctx: TActionPlusUnknownErrorContext) => Error;

	/**
	 * When enabled, include `input`, `parsedInput`, and `ctx` in error details.
	 * Off by default because it can accidentally expose sensitive data.
	 */
	includeInputInErrorDetails?: boolean;
};

export class ActionPlusError extends Error {
	code: TActionPlusErrorCode;
	phase?: TActionPlusErrorPhase;
	data?: unknown;
	declare cause?: unknown;

	constructor(
		message: string,
		opts: {
			code: TActionPlusErrorCode;
			phase?: TActionPlusErrorPhase;
			cause?: unknown;
			data?: unknown;
		} = { code: 'ACTION_ERROR' },
	) {
		super(message, { cause: opts.cause });
		this.name = 'ActionPlusError';
		this.code = opts.code;
		this.phase = opts.phase;
		this.data = opts.data;
		this.cause = opts.cause;
	}
}

export class ActionPlusValidationError extends ActionPlusError {
	issues: TActionPlusIssue[];

	constructor(
		message: string,
		opts: {
			issues: TActionPlusIssue[];
			phase?: TActionPlusErrorPhase;
			cause?: unknown;
			data?: unknown;
		},
	) {
		super(message, { code: 'VALIDATION_ERROR', phase: opts.phase, cause: opts.cause, data: opts.data });
		this.name = 'ActionPlusValidationError';
		this.issues = opts.issues;
	}
}

export const isActionPlusError = (error: unknown): error is ActionPlusError => {
	if (typeof error !== 'object' || error === null) return false;
	if (!('code' in error)) return false;
	const name = (error as { name?: unknown }).name;
	return name === 'ActionPlusError' || name === 'ActionPlusValidationError';
};

export const isActionPlusValidationError = (error: unknown): error is ActionPlusValidationError => {
	return typeof error === 'object' && error !== null && 'issues' in error && (error as { name?: unknown }).name === 'ActionPlusValidationError';
};
