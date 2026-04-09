import type { Unit, Notations } from '../../src/core/index.ts';
import type { Language } from '../../src/core/index.ts';

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function buildRegex(language: Language): RegExp {
	const escapedNotations = Object.keys(language.dict)
		.sort((a, b) => b.length - a.length)
		.map(escapeRegex)
		.join('|');
	return RegExp(`(?<![.\\d])(?<value>\\d*\\.?\\d+) {0,3}(?<unit>${escapedNotations})(?!\\p{L})`, 'giu');
}

export function getNotation(notations: Notations, long: boolean, singular: boolean): string {
	if (long) {
		if (singular) return ` ${notations.singular}`;
		return ` ${notations.plural ?? notations.singular}`;
	}
	if (singular) return notations.shortSingular ?? notations.singular;
	return notations.shortPlural ?? notations.shortSingular ?? notations.plural ?? notations.singular;
}

export function getUnitNotation(language: Language, unit: Unit, long: boolean, singular: boolean): string {
	return getNotation(language.units[unit], long, singular);
}
