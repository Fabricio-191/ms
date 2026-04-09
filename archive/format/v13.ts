/**
 * Format v13 — Merged function with threshold split
 *
 * Same merged signature as v6 but replaces the linear 8-unit scan with a
 * two-tier split at the H threshold (pivot = UNITS[mid] ≈ 3600000 ms):
 *
 *   if (a >= pivotT) { scan Y, Mo, W, D → guaranteed H }
 *   else             { scan M, S, Ms → '0ms' }
 *
 * Average comparisons per call (8 units, balanced samples):
 *   Linear scan:   (1+2+3+4+5+6+7+8)/8 = 4.5
 *   Threshold split: (2+3+4+5+5+2+3+4)/8 = 3.5  → ~22% fewer comparisons
 *
 * Common sub-day units benefit most:
 *   M: 2 comparisons vs 6  (−67%)
 *   S: 3 vs 7              (−57%)
 *   H: 5 vs 5              (no change)
 *   Y: 2 vs 1              (−1 extra for the split check)
 *
 * Uses Math.trunc (safe for non-negative a, avoids Math.floor call overhead)
 * and neg variable (v6 improvement).
 *
 * Expected JIT: still Optimized + Interpreted (raw=81) — merged body is the
 * same size as v6, so Maglev threshold is not crossed. Benefit is purely
 * fewer comparisons at runtime.
 */
import { getUnitNotation } from '../utils/language.ts';
import { TIMES, UNITS, type Language } from '../../src/core/index.ts';
import { craftFunction } from '../utils/craft.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;
type UnitKey = typeof UNITS[number];

function escapeString(value: string): string {
	return value.replace(/\\/gu, '\\\\').replace(/'/gu, '\\x27');
}

function branchCode(unit: UnitKey, language: Language, long: boolean, noCondition = false): string {
	const t = TIMES[unit];
	const sing = escapeString(getUnitNotation(language, unit, long, true));
	const plur = escapeString(getUnitNotation(language, unit, long, false));
	const expr = t === 1 ? 'Math.trunc(a)' : `Math.trunc(a/${t})`;
	if (noCondition) {
		if (sing === plur) return `return p+${expr}+'${sing}';`;
		return `{var v=${expr};return p+v+(v===1?'${sing}':'${plur}');}`;
	}
	if (sing === plur) return `if(a>=${t})return p+${expr}+'${sing}';`;
	return `if(a>=${t}){var v=${expr};return p+v+(v===1?'${sing}':'${plur}');}`;
}

function buildSplitBranches(language: Language, long: boolean): string {
	const allUnits = UNITS as ReadonlyArray<UnitKey>;
	const mid = allUnits.length >> 1; // 4 for standard 8-unit set → pivot = 'h'
	const pivotT = TIMES[allUnits[mid] as UnitKey];

	// Large tier: UNITS[0..mid] = Y, Mo, W, D, H
	// Last unit (H) is guaranteed to match inside this branch — no condition needed
	const largeUnits = allUnits.slice(0, mid + 1) as UnitKey[];
	const largeTier = largeUnits.slice(0, -1).map(u => branchCode(u, language, long)).join('')
		+ branchCode(largeUnits.at(-1) as UnitKey, language, long, true);

	// Small tier: UNITS[mid+1..] = M, S, Ms + zero return
	const smallUnits = allUnits.slice(mid + 1) as UnitKey[];
	const zeroNotation = escapeString(getUnitNotation(language, allUnits.at(-1) as UnitKey, long, false));
	const smallTier = smallUnits.map(u => branchCode(u, language, long)).join('')
		+ `return '0${zeroNotation}';`;

	return `if(a>=${pivotT}){${largeTier}}else{${smallTier}}`;
}

function buildMergedBody(language: Language): string {
	const shortBranches = buildSplitBranches(language, false);
	const longBranches = buildSplitBranches(language, true);
	return `if(typeof ms!=='number'||!Number.isFinite(ms))return null;var neg=ms<0;var a=neg?-ms:ms;var p=neg?'- ':'';if(!long){${shortBranches}}else{${longBranches}}`;
}

export function buildFastFormat(language: Language): FastFormatFunction {
	return craftFunction<FastFormatFunction>(
		'formatFn', ['ms', 'long'], buildMergedBody(language), {},
	);
}
