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
	 * @param time The time to format
	 * @param options The options to convert to string
	 * @returns The time in human-readable format
	 */
	function ms(time: number, options?: FormatOptions): string;
	/**
	 * Parse a string into the time in miliseconds
	 * @param string The string to parse
	 * @param languages The languages to use to try to parse in the string
	 * @returns The time in miliseconds
	 */
	function ms(string: string, languages?: language | language[]): number;

	export default ms;
}