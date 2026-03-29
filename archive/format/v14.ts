/**
 * Format v14 — Loop-based table dispatch (fixed bytecode body)
 *
 * Replaces the generated if-chain with a fixed-size while loop over a
 * prebuilt Float64Array of thresholds. The function body is the same
 * string regardless of language — only the closure data changes.
 *
 * Generated body (language-independent):
 *   var i=0; while(i<N&&a<T[i]) i++;
 *   var v=Math.trunc(a/T[i]);
 *   var nt=long?(v===1?LS[i]:LP[i]):(v===1?SS[i]:SP[i]);
 *   return v===0?'0'+nt:p+v+nt;
 *
 * Where:
 *   T  — Float64Array of TIMES values, largest→smallest
 *   SS — string[] short singular notations (indexed by unit position)
 *   SP — string[] short plural notations
 *   LS — string[] long singular notations
 *   LP — string[] long plural notations
 *   N  — UNITS.length - 1 (loop bound; last unit always matches)
 *
 * Advantages:
 * - Fixed bytecode size → TurboFan promotion guaranteed after warmup
 * - Notation strings live in closures, not inlined in the bytecode — saves
 *   constant pool entries
 *
 * Disadvantages:
 * - Each iteration: array bounds check + typed array load (vs static threshold
 *   in the if-chain). May not overcome the overhead for small unit sets.
 * - Loop overhead vs branch predictor-friendly inline chain
 *
 * The loop stops at i = N-1 (last unit index) regardless of a, so the last
 * unit always "matches". For a=0 or sub-unit values, Math.trunc(a/1) = 0 and
 * the v===0 guard returns '0ms' (or equivalent).
 */
import { TIMES, UNITS, type Language } from '../../core/index.ts';
import { craftFunction } from '../../utils/craft.ts';

type FastFormatFunction = (miliseconds: number, long?: boolean) => string | null;
type UnitKey = typeof UNITS[number];

export function buildFastFormat(language: Language): FastFormatFunction {
	const allUnits = UNITS as ReadonlyArray<UnitKey>;

	// Prebuilt typed array for thresholds (ordered largest → smallest)
	const T = new Float64Array(allUnits.map(u => TIMES[u]));
	const n = T.length;

	// Notation arrays — actual string values (not escaped for source injection)
	const SS = allUnits.map(u => language.getNotation(u, false, true));
	const SP = allUnits.map(u => language.getNotation(u, false, false));
	const LS = allUnits.map(u => language.getNotation(u, true, true));
	const LP = allUnits.map(u => language.getNotation(u, true, false));

	// Fixed body — references T, SS, SP, LS, LP from closures
	// Loop scans forward until a >= T[i]; stops at index n-1 (last unit)
	const body =
		`if(typeof ms!=='number'||!Number.isFinite(ms))return null;` +
		`var neg=ms<0,a=neg?-ms:ms,p=neg?'- ':'';` +
		`var i=0;while(i<${n - 1}&&a<T[i])i++;` +
		`var v=Math.trunc(a/T[i]);` +
		`var nt=long?(v===1?LS[i]:LP[i]):(v===1?SS[i]:SP[i]);` +
		`return v===0?'0'+nt:p+v+nt;`;

	return craftFunction<FastFormatFunction>(
		'formatFn', ['ms', 'long'], body,
		{ T, SS, SP, LS, LP },
	);
}
