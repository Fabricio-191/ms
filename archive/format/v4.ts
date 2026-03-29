/**
 * Format v4 — Positive/negative path split
 *
 * Splits each generated function into two code paths based on the sign of `ms`:
 * - Positive path (`ms >= 0`): uses `ms` directly, returns `value + notation` (ONE concat)
 * - Negative path (`ms < 0`): uses `a = -ms`, returns `'- ' + value + notation` (two concats)
 *
 * In v3, both paths do `p + value + notation` where `p = ''` for positive inputs.
 * That empty-string prefix is a wasted concat: `'' + value` forces type coercion +
 * allocation before the real concat. Eliminating it for the common positive case
 * reduces string operations from 2 to 1.
 *
 * Trade-off: code size roughly doubles vs v3 (two branches instead of one),
 * but should remain within V8 Maglev's compilation threshold.
 *
 * Same two-function split as v3 (short + long) with same wrapper pattern.
 */
import { TIMES, UNITS, type Language } from '../../core/index.ts';
import { craftFunction } from '../../utils/craft.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function buildSplitBody(language: Language, long: boolean): string {
	let posBranches = '';
	let negBranches = '';

	for (const unit of UNITS) {
		const t = TIMES[unit];
		const sing = escapeString(language.getNotation(unit, long, true));
		const plur = escapeString(language.getNotation(unit, long, false));
		// Positive path uses `ms` directly (ms >= 0 in this branch)
		// Negative path uses `a = -ms`
		const posExpr = t === 1 ? 'Math.floor(ms)' : `Math.floor(ms/${t})`;
		const negExpr = t === 1 ? 'Math.floor(a)' : `Math.floor(a/${t})`;

		if (sing === plur) {
			posBranches += `if(ms>=${t})return ${posExpr}+'${sing}';`;
			negBranches += `if(a>=${t})return '- '+${negExpr}+'${sing}';`;
		} else {
			posBranches += `if(ms>=${t}){var v=${posExpr};return v+(v===1?'${sing}':'${plur}');}`;
			negBranches += `if(a>=${t}){var v=${negExpr};return '- '+v+(v===1?'${sing}':'${plur}');}`;
		}
	}

	const zero = escapeString(language.getNotation(UNITS.at(-1)!, long, false));
	// Both paths fall through to '0X' for values too small to represent (e.g. 0.5ms)
	// Negative near-zero (e.g. -0.5ms) also returns '0ms' without prefix — matches v2/v3 behavior
	posBranches += `return '0${zero}';`;
	negBranches += `return '0${zero}';`;

	return `if(typeof ms!=='number'||!Number.isFinite(ms))return null;if(ms>=0){${posBranches}}else{var a=-ms;${negBranches}}`;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	const formatShort = craftFunction<(ms: number) => string | null>(
		'formatShort', ['ms'], buildSplitBody(language, false), {},
	);
	const formatLong = craftFunction<(ms: number) => string | null>(
		'formatLong', ['ms'], buildSplitBody(language, true), {},
	);
	return (ms: number, long = false): string | null => long ? formatLong(ms) : formatShort(ms);
}
