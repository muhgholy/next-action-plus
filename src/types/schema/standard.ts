// Standard Schema v1 (https://github.com/standard-schema/standard-schema)

export type TStandardSchemaV1<Input = unknown, Output = Input> = {
	readonly '~standard': {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (value: unknown) => TStandardSchemaV1Result<Output> | Promise<TStandardSchemaV1Result<Output>>;
		readonly types?:
			| {
					readonly input: Input;
					readonly output: Output;
			  }
			| undefined;
	};
};

export type TStandardSchemaV1PathSegment = {
	readonly key: PropertyKey;
};

export type TStandardSchemaV1Issue = {
	readonly message: string;
	readonly path?: ReadonlyArray<PropertyKey | TStandardSchemaV1PathSegment> | undefined;
};

export type TStandardSchemaV1Result<Output> =
	| {
			readonly value: Output;
			readonly issues?: undefined;
	  }
	| {
			readonly issues: ReadonlyArray<TStandardSchemaV1Issue>;
			readonly value?: undefined;
	  };

export type TStandardSchemaV1InferInput<S extends TStandardSchemaV1<any, any>> = S extends TStandardSchemaV1<infer Input, any> ? Input : unknown;

export type TStandardSchemaV1InferOutput<S extends TStandardSchemaV1<any, any>> = S extends TStandardSchemaV1<any, infer Output> ? Output : unknown;
