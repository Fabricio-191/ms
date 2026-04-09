/**
 * Parse v38 — c1 cache per first-char group (v25 baseline, hypothesis 2).
 *
 * Single change from v25: within each first-char block, `s.charCodeAt(i+1)` is
 * computed once into `var c1` and reused by all entries that check position i+1.
 *
 * Before (v25): each entry calls `s.charCodeAt(i+1)` twice (lo and up comparison).
 *   Group 'm' has 16 entries → up to 32 charCodeAt(i+1) calls before a match or miss.
 * After  (v38): `var c1=s.charCodeAt(i+1)` once per group → `c1===lo||c1===up`.
 *
 * Measured changes in generated code (English):
 *   c0=== comparisons: 74 → 12  (wrapping in if blocks merges lo/up implicitly)
 *   charCodeAt calls:  546 → 434 (−20%)
 *   lines:             75  → 111 (+48%, wrapper if blocks add overhead)
 *   var c1:            0   → 12  (one per first-char group)
 *
 * Structure UNCHANGED from v25: separate lo and up groups, flat ifs (NOT if/else).
 * Boundary check UNCHANGED: `_bci>=len||_bc>=128||!BOUND[_bc]`.
 * Group merging (lo||up) NOT applied (see v37 for that).
 *
 * Results (Node.js v24.11.1, tinybench 1s, p50):
 *   Single-unit valid:   2,089 ops/sec  (−5.5% vs v25)
 *   Single-unit invalid: 1,691 ops/sec  (−4.9% vs v25)
 *   JIT tier: unknown(32769) ✗ — NOT reaching Maglev
 *
 * Hypothesis DISPROVED: caching c1 hurts on two fronts:
 *   1. The `var c1=s.charCodeAt(i+1)` is UNCONDITIONAL on group entry. In v25, if the
 *      length check `i+elen<=len` fails first, charCodeAt(i+1) is never called.
 *      v38 calls it even when no entry will succeed.
 *   2. The `var c1` declaration + wrapping if-blocks expand the function body to 111
 *      lines (vs 75 for v25), and the pattern prevents V8 from reaching Maglev.
 *      JIT status 32769 is unknown — function stays unoptimized.
 * Discarded — v25 remains champion.
 */
import type { Language } from '../../src/core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../utils/craft.ts';
import { extractNotations, generateC1CachedLookupCode } from '../utils/notation.ts';

export type { ParseFunction };

export function buildFastParse(language: Language): ParseFunction {
	const notations = extractNotations(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const boundaryArr = buildBoundaryTable(ranges);
	const lookupCode = generateC1CachedLookupCode(notations, '\t\t\t\t\t');

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

	return craftFunction<ParseFunction>('fastParseV38', [ 'str' ], source, { BOUND: boundaryArr });
}
