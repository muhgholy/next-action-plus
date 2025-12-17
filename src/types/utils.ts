// Shared type utilities

export type TIsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Makes a type disappear if it relies on a missing optional dependency.
 *
 * In practice this is used with `zod` as a peer dependency.
 */
export type TIfInstalled<T> = TIsAny<T> extends true ? never : T;

// Takes an object type and makes it more readable.
export type TPrettify<T> = {
	[K in keyof T]: T[K];
} & {};

// Turns a union into an intersection.
export type TUnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
