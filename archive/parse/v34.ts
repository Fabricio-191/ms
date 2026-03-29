/**
 * Parse v34 — v33 + single-char multiplier fast path.
 *
 * Adds a pre-check before the v33 grouped if-chains:
 *
 *   var m1 = MULT1[c0 < 128 ? c0|0x20 : 0];
 *   if(m1){ boundary check → match }
 *
 * MULT1[128] is a Float64Array where MULT1[charCode|0x20] = multiplier for
 * single-char ASCII notations (0 = none). For English: y, w, d, h, m, s.
 *
 * This handles the most common real-world notation inputs (s, m, h, etc.) with
 * a single array lookup + boundary check instead of scanning through all groups.
 *
 * Non-ASCII single-char notations (Japanese '年', etc.) bypass MULT1 (c0>=128
 * maps to index 0) and are handled by the generated lookup code below.
 *
 * Results (Node.js v24.11.1, tinybench 1s, p50):
 *   Single-unit valid:   2,098 ops/sec  (-3.9% vs v25)
 *   Single-unit invalid: 1,712 ops/sec  (-2.0% vs v25)
 *   JIT tier: Maglev
 *
 * Finding: The MULT1 array lookup + extra branch adds overhead even for the
 * ~16% single-char hit rate in the benchmark distribution. The overhead outweighs
 * the O(1) benefit — fast path is only worth it when single-char notations dominate.
 * Hypothesis disproved — discarded.
 */
import type { Language } from '../../src/core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../../src/utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../../src/utils/craft.ts';
import { extractNotations, generateOptimizedLookupCode, buildSingleCharTable } from '../../src/utils/notation.ts';

export type { ParseFunction };

export function buildFastParse(language: Language): ParseFunction {
	const notations = extractNotations(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const MULT1 = buildSingleCharTable(notations);

	// Generate lookup code for all notations NOT covered by MULT1:
	// - all multi-char notations
	// - single-char notations whose first char is non-ASCII (c >= 128 → not in MULT1 table)
	const notCoveredByMult1 = notations.filter(e => e.chars.length > 1 || e.chars[0]! >= 128);
	const lookupCode = generateOptimizedLookupCode(notCoveredByMult1, '\t\t\t\t\t');

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
var m1=MULT1[c0<128?c0|0x20:0];
if(m1){const _bci=i+1,_bc=s.charCodeAt(_bci);if(_bci>=len||_bc>=128||!BOUND[_bc]){i+=1;v+=pv*m1;mc++;break match}}
${lookupCode}}}}}
continue}
i++}
if(mc===0){var n=+str;return n!==n?null:n;}
return neg?-v:v;`;

	return craftFunction<ParseFunction>('fastParseV34', [ 'str' ], source, { BOUND, MULT1 });
}
