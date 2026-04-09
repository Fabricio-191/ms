/**
 * Format v9 — craftFunction dispatcher capturing inner fns as context
 *
 * v3 pattern:
 *   formatShort = craftFunction(...)   ← named inner fn
 *   formatLong  = craftFunction(...)   ← named inner fn
 *   return (ms, long) => long ? formatLong(ms) : formatShort(ms)  ← static arrow wrapper
 *
 * v9 pattern:
 *   formatShort = craftFunction(...)   ← same
 *   formatLong  = craftFunction(...)   ← same
 *   return craftFunction('dispatch', ['ms','long'],
 *     'return long ? formatLong(ms) : formatShort(ms)',
 *     { formatShort, formatLong }
 *   )  ← dispatcher is also a named craftFunction, capturing fns as closure locals
 *
 * Hypothesis: the dispatcher body is tiny (one ternary). If TurboFan can inline
 * a craftFunction dispatcher from an external caller, it may also transitively
 * inline formatShort/formatLong — getting the same inlining benefit as v3's
 * arrow wrapper, but without the static-function requirement.
 */
import { getUnitNotation } from '../utils/language.ts';
import { TIMES, UNITS, type Language } from '../../src/core/index.ts';
import { craftFunction } from '../utils/craft.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function buildBranches(language: Language, long: boolean): string {
	let body = '';

	for (const unit of UNITS) {
		const t = TIMES[unit];
		const sing = escapeString(getUnitNotation(language, unit, long, true));
		const plur = escapeString(getUnitNotation(language, unit, long, false));
		const expr = t === 1 ? 'Math.floor(a)' : `Math.floor(a/${t})`;

		if (sing === plur) {
			body += `if(a>=${t})return p+${expr}+'${sing}';`;
		} else {
			body += `if(a>=${t}){var v=${expr};return p+v+(v===1?'${sing}':'${plur}');}`;
		}
	}

	const zero = escapeString(getUnitNotation(language, UNITS.at(-1)!, long, false));
	body += `return '0${zero}';`;
	return body;
}

function buildBody(language: Language, long: boolean): string {
	return `if(typeof ms!=='number'||!Number.isFinite(ms))return null;var a=ms<0?-ms:ms;var p=ms<0?'- ':'';${buildBranches(language, long)}`;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	const formatShort = craftFunction<(ms: number) => string | null>(
		'formatShort', ['ms'], buildBody(language, false), {},
	);
	const formatLong = craftFunction<(ms: number) => string | null>(
		'formatLong', ['ms'], buildBody(language, true), {},
	);

	return craftFunction<FastFormatFunction>(
		'formatDispatch', ['ms', 'long'],
		'return long ? formatLong(ms) : formatShort(ms);',
		{ formatShort, formatLong },
	);
}
