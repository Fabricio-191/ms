declare module '@fabricio-191/ms' {
	type language = 'en' | 'es';
	type ParseOptions = {
		/** Language to use in the operation */
		language?: language | 'all';
		languages?: never;
	} | {
		/** Language to use in the operation */
		languages?: language[] | 'all';
		language?: never;
	};

	interface FormatOptions {
		/** Language to use in the operation */
		language?: language;
		/** Whenether to use weeks or months when formatting */
		useWeeks?: boolean;
		/** Whenether to long notations when formatting */
		long?: boolean;
		/**
		 * Max notations that the result can have
		 * @deprecated use 'length'
		*/
		quantity?: number;
		/** Max notations that the result can have */
		length?: number;
	}

	/**
	 * Convert time in ms into a human-readable format
	 * @param value The time
	 * @param options The options to convert to string
	 * @returns The time in human-readable format
	 */
	function ms(value: number, options?: FormatOptions): string;
	/**
	 * Parse a string into the time in miliseconds
	 * @param value The string to parse
	 * @param options The options to parse string
	 * @returns The time in miliseconds
	 */
	function ms(value: string, options?: ParseOptions): number;

	export = ms;
}