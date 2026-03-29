/**
 * Parse v33 — Optimized flat lookup with `|0x20` case folding.
 *
 * Same algorithm as v25 (flat if-chains) but the code generator is improved:
 *
 * 1. Merged case groups: instead of separate 'y' / 'Y' blocks with duplicate entries,
 *    one block per logical first char: `if((c0|0x20)===121)`. Halves the number of
 *    top-level groups for ASCII-letter languages (~20 vs ~40 for English).
 *
 * 2. Single comparison per char: `(s.charCodeAt(i+k)|0x20)===lo` replaces
 *    `(s.charCodeAt(i+k)===lo||s.charCodeAt(i+k)===up)`. One operation instead of two.
 *
 * 3. Grouped if/else chain: entries within a first-char group use if/else if/else,
 *    avoiding redundant c0 re-checks and skipping impossible shorter-entry checks
 *    when a longer entry's length+char conditions are met.
 *
 * Results (Node.js v24.11.1, tinybench 1s, p50):
 *   Single-unit valid:   2,157 ops/sec  (-1.3% vs v25)
 *   Single-unit invalid: 1,688 ops/sec  (-3.4% vs v25)
 *   JIT tier: Maglev (same as v25 — code size unchanged)
 *
 * Finding: V8's branch predictor handles flat ifs with literal constants very well.
 * The `|0x20` operation adds overhead that negates the savings from halved groups.
 * Inline literal comparisons (`c===97`) are cheaper than `(c|0x20)===97`.
 * Hypothesis disproved — discarded.
 */
import type { Language } from '../../src/core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../../src/utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../../src/utils/craft.ts';
import { extractNotations, generateOptimizedLookupCode } from '../../src/utils/notation.ts';

export type { ParseFunction };

export function buildFastParse(language: Language): ParseFunction {
	const notations = extractNotations(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const boundaryArr = buildBoundaryTable(ranges);
	const lookupCode = generateOptimizedLookupCode(notations, '\t\t\t\t\t');

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

	return craftFunction<ParseFunction>('fastParseV33', [ 'str' ], source, { BOUND: boundaryArr });
}
