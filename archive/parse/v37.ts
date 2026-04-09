/**
 * Parse v37 — Merged case groups + if/else dispatch (v25 baseline, hypothesis 1).
 *
 * Single change from v25: the code generator merges upper/lowercase variants of the
 * same first char into ONE outer block using `if(c0===lo||c0===up)`, then uses
 * an if/else if/else chain for the entries inside.
 *
 * Before (v25): 74 flat `if(c0===X)` checks — every entry re-checks c0.
 * After  (v37): ~12 grouped `if/else if(c0===lo||c0===up)` blocks — c0 checked once per group.
 *
 * Measured changes in generated code (English):
 *   c0=== comparisons: 74 → 12  (−84%)
 *   charCodeAt calls:  546 → 273 (−50%, if/else eliminates untaken branch reads)
 *   lines:             75  → 50
 *
 * Inner char checks UNCHANGED: `(s.charCodeAt(i+k)===lo||s.charCodeAt(i+k)===up)`.
 * Boundary check UNCHANGED:    `_bci>=len||_bc>=128||!BOUND[_bc]`.
 * c1 caching NOT applied (see v38 for that).
 *
 * Results (Node.js v24.11.1, tinybench 1s, p50):
 *   Single-unit valid:   2,217 ops/sec  (+0.3% vs v25)
 *   Single-unit invalid: 1,683 ops/sec  (−5.4% vs v25)
 *   JIT tier: Maglev (33793) ✓ — same as v25
 *
 * Hypothesis PARTIALLY confirmed: valid inputs improve slightly (+0.3%) but invalid
 * inputs regress significantly (−5.4%). Root cause: the `else if` chain creates a
 * SEQUENTIAL DEPENDENCY between outer checks — each branch waits for the previous.
 * V8's flat `if` structure allows the CPU to evaluate independent branches in parallel
 * (ILP — instruction-level parallelism). With `else if`, that parallelism is lost.
 * Invalid inputs traverse the entire outer chain and hit this dependency chain hardest.
 * Trade-off not favorable — discarded. v25 remains champion.
 */
import type { Language } from '../../src/core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../utils/craft.ts';
import { extractNotations, generateGroupedLookupCode } from '../utils/notation.ts';

export type { ParseFunction };

export function buildFastParse(language: Language): ParseFunction {
	const notations = extractNotations(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const boundaryArr = buildBoundaryTable(ranges);
	const lookupCode = generateGroupedLookupCode(notations, '\t\t\t\t\t');

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

	return craftFunction<ParseFunction>('fastParseV37', [ 'str' ], source, { BOUND: boundaryArr });
}
