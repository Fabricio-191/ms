export const TIMES = Object.freeze({
	Y: 1000 * 60 * 60 * 24 * 365.25, // 365.2425
	Mo: 1000 * 60 * 60 * 24 * 30,
	W: 1000 * 60 * 60 * 24 * 7,
	D: 1000 * 60 * 60 * 24,
	H: 1000 * 60 * 60,
	M: 1000 * 60,
	S: 1000,
	Ms: 1,
});

export type Unit = keyof typeof TIMES;

export const UNITS = Object.keys(TIMES) as Unit[];

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
		this.name = name;

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

		for (const key of UNITS) {
			for (const notation of this.units[key].all)
				this.dict[notation.toLowerCase()] = TIMES[key];
		}

		const escapedNotations = Object.keys(this.dict)
			.sort((a, b) => b.length - a.length)
			.map(escapeRegex)
			.join('|');

		this.REGEX = RegExp(`(?<value>\\d*\\.?\\d+) {0,3}(?<unit>${escapedNotations})(?!\\p{L})`, 'giu');
	}

	public parse(str: string): { value: number; matches_qty: number } {
		let final_value = 0;
		let matches_qty = 0;

		const matches = str.matchAll(this.REGEX);

		for (const match of matches) {
			const { value, unit } = match.groups as { value: string; unit: string };

			final_value += parseFloat(value) * this.dict[unit.toLowerCase()]!;
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

export const NEGATIVE_REGEX = /^\s*-/u;
