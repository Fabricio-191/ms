declare module '@fabricio-191/ms' {
	type language = 'en' | 'es';

	interface FormatOptions {
		/** Language to use in the operation */
		language?: language;
		/** Whenether to use weeks or months when formatting */
		format?: string;
		/** Whenether to long notations when formatting */
		long?: boolean;
		/** Max notations that the result can have */
		length?: number;
	}

	/**
	 * Convert time in miliseconds into a human-readable format
	 * @param value The time
	 * @param options The options to convert to string
	 * @returns The time in human-readable format
	 */
	function ms(value: number, options?: FormatOptions): string;
	/**
	 * Parse a string into the time in miliseconds
	 * @param value The string to parse
	 * @param options The languages to use to try to parse in the string
	 * @returns The time in miliseconds
	 */
	function ms(value: string, languages?: language | language[]): number;

	export default ms;
}