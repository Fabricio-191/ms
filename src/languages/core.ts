export const TIMES = {
	Y: 1000 * 60 * 60 * 24 * 365.25, // 365.2425
	Mo: 1000 * 60 * 60 * 24 * 30,
	W: 1000 * 60 * 60 * 24 * 7,
	D: 1000 * 60 * 60 * 24,
	H: 1000 * 60 * 60,
	M: 1000 * 60,
	S: 1000,
	Ms: 1,
} as const;

export type Unit = keyof typeof TIMES;

export const UNIT_KEYS = Object.keys(TIMES) as Unit[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export interface NotationsData {
	all: string[];
	singular: string;
	shortSingular?: string;
	plural?: string;
	shortPlural?: string;
}

export interface LanguageData {
	dialect?: string;
	Y: NotationsData;
	Mo: NotationsData;
	W: NotationsData;
	D: NotationsData;
	H: NotationsData;
	M: NotationsData;
	S: NotationsData;
	Ms: NotationsData;
}

export class Notations {
	public all: string[];
	public singular: string;
	public shortSingular?: string;
	public plural?: string;
	public shortPlural?: string;

	public constructor(data: NotationsData, unit = 'unknown') {
		if (!isPlainObject(data))
			throw new Error(`'${unit}' notations should be an object`);

		if (!Array.isArray(data.all))
			throw new Error(`'${unit}'.all should be an array`);

		if (data.all.length === 0)
			throw new Error(`'${unit}'.all should contain at least one notation`);

		for (const notation of data.all) {
			if (typeof notation !== 'string' || notation === '')
				throw new Error(`'${unit}'.all should only contain non-empty strings`);
		}

		if (typeof data.singular !== 'string' || data.singular === '')
			throw new Error(`'${unit}'.singular should be a non-empty string`);

		const allNotations = new Set(data.all.map(item => item.toLowerCase()));
		if (allNotations.size !== data.all.length)
			throw new Error(`'${unit}'.all contains repeated notations`);

		if (!allNotations.has(data.singular.toLowerCase()))
			throw new Error(`'${unit}'.singular should be included in '${unit}'.all`);

		for (const key of [ 'plural', 'shortPlural', 'shortSingular' ]) {
			const value = data[key];
			if (value === undefined) continue;

			if (typeof value !== 'string' || value === '')
				throw new Error(`'${unit}'.${key} should be a non-empty string`);

			if (!allNotations.has(value.toLowerCase()))
				throw new Error(`'${unit}'.${key} should be included in '${unit}'.all`);
		}

		this.all = data.all;
		this.singular = data.singular;
		if (data.shortSingular !== undefined) this.shortSingular = data.shortSingular;
		if (data.plural !== undefined) this.plural = data.plural;
		if (data.shortPlural !== undefined) this.shortPlural = data.shortPlural;
	}

	public getNotation(long: boolean, singular: boolean): string {
		if (long) {
			if (singular) return ` ${this.singular}`;

			return ` ${this.plural ?? this.singular}`;
		}
		if (singular) return this.shortSingular ?? this.singular;

		return this.shortPlural ?? this.shortSingular ?? this.plural ?? this.singular;
	}
}

export class Language {
	public readonly name: string;
	public readonly dialect: string;

	public readonly units: {
		Y: Notations;
		Mo: Notations;
		W: Notations;
		D: Notations;
		H: Notations;
		M: Notations;
		S: Notations;
		Ms: Notations;
	};

	public readonly dict: Record<string, number> = {};
	public readonly REGEX: RegExp;

	public constructor(name: string, data: LanguageData) {
		if (typeof name !== 'string' || name === '')
			throw new Error('language name should be a non-empty string');

		if (!isPlainObject(data))
			throw new Error('language should be a non-null object');

		const rawData = data as Record<string, unknown>;

		if ('dialect' in rawData && rawData['dialect'] !== undefined && typeof rawData['dialect'] !== 'string')
			throw new Error('language dialect should be a string when provided');

		this.name = name;
		this.dialect = data.dialect ?? 'a-z';

		for (const key of UNIT_KEYS) {
			if (!(key in data))
				throw new Error(`language does not contain '${key}' notations`);
		}

		this.units = {
			Y: new Notations(data.Y, 'Y'),
			Mo: new Notations(data.Mo, 'Mo'),
			W: new Notations(data.W, 'W'),
			D: new Notations(data.D, 'D'),
			H: new Notations(data.H, 'H'),
			M: new Notations(data.M, 'M'),
			S: new Notations(data.S, 'S'),
			Ms: new Notations(data.Ms, 'Ms'),
		};

		for (const key of UNIT_KEYS) {
			for (const notation of this.units[key].all) {
				const normalizedNotation = notation.toLowerCase();

				if (normalizedNotation in this.dict)
					throw new Error(`notation '${notation}' repeated in language '${name}'`);

				this.dict[normalizedNotation] = TIMES[key];
			}
		}

		const escapedNotations = Object.keys(this.dict)
			.sort((a, b) => b.length - a.length)
			.map(escapeRegex)
			.join('|');

		this.REGEX = RegExp(`(\\d*\\.?\\d+) {0,3}(${escapedNotations})(?![${this.dialect}])`, 'giu');
	}

	public parse(str: string): { value: number; matches_qty: number } {
		let final_value = 0;
		let matches_qty = 0;

		this.REGEX.lastIndex = 0;

		for (let match = this.REGEX.exec(str); match !== null; match = this.REGEX.exec(str)) {
			const value = match[1]!;
			const unit = match[2]!.toLowerCase();

			final_value += parseFloat(value) * this.dict[unit]!;
			matches_qty += 1;
		}

		return {
			matches_qty,
			value: final_value,
		};
	}

	public getNotation(unit: Unit, long: boolean, singular: boolean): string {
		return this.units[unit].getNotation(long, singular);
	}
}
