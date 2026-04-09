/**
 * Format v3 — Clean generated code
 *
 * Fixes several issues in v2's generated code:
 * 1. Removes the redundant `&& value !== 0` check — always true when `remaining >= threshold > 0`
 * 2. Moves Math.floor() into the branch body (no assignment-in-condition)
 * 3. Uses `var` throughout — avoids TDZ overhead in early JIT tiers
 * 4. Uses `-ms` instead of `Math.abs(ms)` — no function call for abs
 * 5. Skips the `/1` division for the Ms unit (threshold=1) — uses `Math.floor(a)` directly
 * 6. Uses `craftFunction` for named inner functions — better JIT identity tracking vs anonymous
 *
 * Same two-function split as v2 (short + long) with same wrapper pattern.
 *
 * Hypothesis: pure savings from removing dead/redundant work.
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
		// Ms unit has threshold=1, skip the /1 division
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
	return (ms: number, long = false): string | null => long ? formatLong(ms) : formatShort(ms);
}

/** Exposes the inner craftFunction instances for JIT tier inspection. */
export function buildFastFormatParts(language: Language): {
	short: (ms: number) => string | null;
	long: (ms: number) => string | null;
} {
	return {
		short: craftFunction<(ms: number) => string | null>('formatShort', ['ms'], buildBody(language, false), {}),
		long: craftFunction<(ms: number) => string | null>('formatLong', ['ms'], buildBody(language, true), {}),
	};
}
