// Generic schema type definitions (sync + async)

export type TGenericSchema = {
	parse: (input: unknown) => unknown;
	safeParse?: (input: unknown) => { success: boolean; data?: unknown; error?: unknown };
};

export type TGenericSchemaAsync = {
	parseAsync: (input: unknown) => Promise<unknown>;
	safeParseAsync?: (input: unknown) => Promise<{ success: boolean; data?: unknown; error?: unknown }>;
};
