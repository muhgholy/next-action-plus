// Middleware type definitions

export type TMiddlewareFn<Ctx extends Record<string, unknown> = Record<string, never>, NextCtx extends Record<string, unknown> = Record<string, never>> = (opts: {
	input: unknown;
	ctx: Readonly<Ctx>;
	next: {
		<NC extends Record<string, unknown> = Record<string, never>>(opts?: { ctx?: NC }): Promise<Ctx & NC>;
	};
}) => Promise<Ctx & NextCtx>;
