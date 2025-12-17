export type TSafeActionIssuePathSegment = string | number;

export type TSafeActionIssue = {
	path: TSafeActionIssuePathSegment[];
	message: string;
	raw?: unknown;
};

export type TSafeActionErrorCode = 'VALIDATION_ERROR' | 'MIDDLEWARE_ERROR' | 'HANDLER_ERROR' | 'ACTION_ERROR';

export type TSafeActionErrorPhase = 'validation' | 'middleware' | 'handler';

export type TSafeActionUnknownErrorContext = {
	phase: TSafeActionErrorPhase;
	error: unknown;
	input?: unknown;
	parsedInput?: unknown;
	ctx?: Record<string, unknown>;
};

export type TSafeActionValidationErrorContext = TSafeActionUnknownErrorContext & {
	message: string;
	issues: TSafeActionIssue[];
};

export type TSafeActionErrorContext = TSafeActionUnknownErrorContext | TSafeActionValidationErrorContext;

export type TSafeActionClientOptions = {
	/**
	 * Control logging when an action throws.
	 * - `false` disables logging.
	 * - Defaults to `console`.
	 */
	logger?: false | { error: (...args: unknown[]) => void };

	/**
	 * Hook called whenever an action throws (validation, middleware, or handler).
	 */
	onError?: (ctx: TSafeActionErrorContext) => void;

	/**
	 * Customize the thrown error when validation fails.
	 * The returned Error will be thrown.
	 */
	formatValidationError?: (ctx: TSafeActionValidationErrorContext) => Error;

	/**
	 * Customize the thrown error for non-validation failures.
	 * If omitted, the original error is re-thrown.
	 */
	formatError?: (ctx: TSafeActionUnknownErrorContext) => Error;

	/**
	 * When enabled, include `input`, `parsedInput`, and `ctx` in error details.
	 * Off by default because it can accidentally expose sensitive data.
	 */
	includeInputInErrorDetails?: boolean;
};

export class SafeActionError extends Error {
	code: TSafeActionErrorCode;
	phase?: TSafeActionErrorPhase;
	data?: unknown;
	declare cause?: unknown;

	constructor(
		message: string,
		opts: {
			code: TSafeActionErrorCode;
			phase?: TSafeActionErrorPhase;
			cause?: unknown;
			data?: unknown;
		} = { code: 'ACTION_ERROR' },
	) {
		super(message, { cause: opts.cause });
		this.name = 'SafeActionError';
		this.code = opts.code;
		this.phase = opts.phase;
		this.data = opts.data;
		this.cause = opts.cause;
	}
}

export class SafeActionValidationError extends SafeActionError {
	issues: TSafeActionIssue[];

	constructor(
		message: string,
		opts: {
			issues: TSafeActionIssue[];
			phase?: TSafeActionErrorPhase;
			cause?: unknown;
			data?: unknown;
		},
	) {
		super(message, { code: 'VALIDATION_ERROR', phase: opts.phase, cause: opts.cause, data: opts.data });
		this.name = 'SafeActionValidationError';
		this.issues = opts.issues;
	}
}

export const isSafeActionError = (error: unknown): error is SafeActionError => {
	if (typeof error !== 'object' || error === null) return false;
	if (!('code' in error)) return false;
	const name = (error as { name?: unknown }).name;
	return name === 'SafeActionError' || name === 'SafeActionValidationError';
};

export const isSafeActionValidationError = (error: unknown): error is SafeActionValidationError => {
	return typeof error === 'object' && error !== null && 'issues' in error && (error as { name?: unknown }).name === 'SafeActionValidationError';
};
