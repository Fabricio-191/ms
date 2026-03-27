export type ParseFunction = (this: void, str: string) => number | null;
export type ParseWithCountFunction = (this: void, str: string) => [number | null, number];
