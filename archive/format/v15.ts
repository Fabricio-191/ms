/**
 * Format v15 — Two dedicated functions with threshold split
 *
 * Combines the key findings from v11 and v13:
 *
 *   v11: two specialized craftFunctions (no merged body) → TurboFan
 *   v13: threshold split (pivot at H) → ~22% fewer comparisons
 *
 * `buildFastFormatShort` returns a function that ONLY handles short format.
 * `buildFastFormatLong`  returns a function that ONLY handles long format.
 *
 * Neither function has a `long` branch or `if(!long)` check. Each function's
 * bytecode contains only the path it needs. The `long` param is declared in
 * the signature (for compatibility with FastFormatFunction) but unused in the
 * generated body.
 *
 * The caller decides which function to hold at construction time:
 *   const short = buildFastFormatShort(LANGUAGES.en);
 *   const long  = buildFastFormatLong(LANGUAGES.en);
 *
 * vs the v11 pattern where a runtime arrow dispatch `long ? longFn : shortFn`
 * is evaluated on every call.
 *
 * Expected JIT: TurboFan on both (same body size as v11's inner functions) +
 * fewer comparisons per call than v11 (threshold split).
 *
 * Uses Math.trunc throughout (v10 improvement).
 */
import { TIMES, UNITS, type Language } from '../../core/index.ts';
import { craftFunction } from '../../utils/craft.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;
type UnitKey = typeof UNITS[number];

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function branchCode(unit: UnitKey, language: Language, long: boolean, noCondition = false): string {
	const t = TIMES[unit];
	const sing = escapeString(language.getNotation(unit, long, true));
	const plur = escapeString(language.getNotation(unit, long, false));
	const expr = t === 1 ? 'Math.trunc(a)' : `Math.trunc(a/${t})`;
	if (noCondition) {
		if (sing === plur) return `return p+${expr}+'${sing}';`;
		return `{var v=${expr};return p+v+(v===1?'${sing}':'${plur}');}`;
	}
	if (sing === plur) return `if(a>=${t})return p+${expr}+'${sing}';`;
	return `if(a>=${t}){var v=${expr};return p+v+(v===1?'${sing}':'${plur}');}`;
}

function buildSpecializedBody(language: Language, long: boolean): string {
	const allUnits = UNITS as readonly UnitKey[];
	const mid = allUnits.length >> 1;
	const pivotT = TIMES[allUnits[mid]!];

	const largeUnits = allUnits.slice(0, mid + 1);
	const largeTier = largeUnits.slice(0, -1).map(u => branchCode(u, language, long)).join('') +
	  branchCode(largeUnits.at(-1)!, language, long, true);

	const smallUnits = allUnits.slice(mid + 1);
	const zeroNotation = escapeString(language.getNotation(allUnits.at(-1)!, long, false));
	const smallTier = `${smallUnits.map(u => branchCode(u, language, long)).join('')
	}return '0${zeroNotation}';`;

	// No `if(!long)` branch — body is specialized for one path only
	return `if(typeof ms!=='number'||!Number.isFinite(ms))return null;var neg=ms<0;var a=neg?-ms:ms;var p=neg?'- ':'';if(a>=${pivotT}){${largeTier}}else{${smallTier}}`;
}

export function buildFastFormatShort(language: Language): FastFormatFunction {
	return craftFunction<FastFormatFunction>('formatShort', [ 'ms', 'long' ], buildSpecializedBody(language, false), {});
}

export function buildFastFormatLong(language: Language): FastFormatFunction {
	return craftFunction<FastFormatFunction>('formatLong', [ 'ms', 'long' ], buildSpecializedBody(language, true), {});
}
