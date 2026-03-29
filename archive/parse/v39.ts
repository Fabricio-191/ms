/**
 * Parse v39 — Simplified boundary check (v25 baseline, hypothesis 3).
 *
 * Single change from v25: the boundary check is simplified from 3 conditions to 2.
 *
 * Before (v25): `const _bci=i+elen,_bc=s.charCodeAt(_bci);if(_bci>=len||_bc>=128||!BOUND[_bc])`
 * After  (v39): `const _bc=s.charCodeAt(i+elen);if(_bc>=128||!BOUND[_bc])`
 *
 * Rationale: `_bci>=len` seemed redundant — when `_bci===len`, `s.charCodeAt(len)`
 * returns NaN, and `!BOUND[NaN]` should return true (NaN coerces to index 0, BOUND[0]=0).
 * So the 3rd condition alone was expected to handle the end-of-string case.
 *
 * Measured changes: identical structure to v25, just shorter boundary expressions.
 *   _bci>= checks: 74 → 0 (removed)
 *
 * Results (Node.js v24.11.1, tinybench 1s, p50):
 *   Single-unit valid:   1,705 ops/sec  (−22.8% vs v25)
 *   Single-unit invalid: 1,671 ops/sec  (−6.0% vs v25)
 *   JIT tier: unknown(32769) ✗ — NOT reaching Maglev
 *
 * Hypothesis BADLY DISPROVED. The `_bci>=len` check is NOT merely a logical guard —
 * it is a critical JIT guard. Without it:
 *   1. `s.charCodeAt(i+elen)` is called with i+elen===len for end-of-string notations
 *      (e.g. "5s" → elen=1, i+1=len=2 → charCodeAt(2) returns NaN).
 *   2. The `BOUND[NaN]` typed array access with NaN index is unusual — V8's Maglev/
 *      TurboFan may not compile functions that access typed arrays with non-integer
 *      indices, marking them as "cannot optimize" (status 32769 = unknown).
 *   3. The resulting JIT degradation affects the ENTIRE function, not just the NaN path.
 *
 * Key lesson: `_bci>=len` is semantically redundant but OPERATIONALLY necessary as a
 * guard that prevents NaN from reaching the BOUND typed array lookup. Never remove it.
 * Discarded — v25 remains champion.
 */
import type { Language } from '../../src/core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../../src/utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../../src/utils/craft.ts';
import { extractNotations, generateLookupCode } from '../../src/utils/notation.ts';

export type { ParseFunction };

export function buildFastParse(language: Language): ParseFunction {
	const notations = extractNotations(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const boundaryArr = buildBoundaryTable(ranges);
	const lookupCode = generateLookupCode(notations, '\t\t\t\t\t', true);

	const source = `if(typeof str!=='string'||str==='')return null;
var s=str,len=s.length;
var si=0;while(si<len&&s.charCodeAt(si)===32)si++;
var neg=s.charCodeAt(si)===45;
if(neg){si++;while(si<len&&s.charCodeAt(si)===32)si++;}
var fc=s.charCodeAt(si);
if(fc!==45&&(fc-48>>>0)>=10&&fc!==46){var n=+str;return n!==n?null:n;}
var v=0,mc=0,i=si;
while(i<len){var c=s.charCodeAt(i);
if((c-48>>>0)<10||c===46){
var pv=0;
if(c!==46){
pv=c-48;i++;
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;pv=pv*10+d;i++;}
if(i<len&&s.charCodeAt(i)===46){i++;
var fr=0,div=1;
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;fr=fr*10+d;div*=10;i++;};
if(div>1)pv+=fr/div;}
}else{i++;
var fr=0,div=1;
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;fr=fr*10+d;div*=10;i++;}
pv=div===1?NaN:fr/div;}
if(pv===pv){
var sp=0;while(i<len&&s.charCodeAt(i)===32&&sp<3){i++;sp++;}
if(i<len){var c0=s.charCodeAt(i);
if(c0===32||(c0-48>>>0)<10||c0===46){while(i<len){var _c=s.charCodeAt(i);if((_c-48>>>0)<10||_c===46)i++;else break;}}
else{match:{
${lookupCode}}}}}
continue}
i++}
if(mc===0){var n=+str;return n!==n?null:n;}
return neg?-v:v;`;

	return craftFunction<ParseFunction>('fastParseV39', [ 'str' ], source, { BOUND: boundaryArr });
}
