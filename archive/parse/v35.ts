/**
 * Parse v35 — Table-driven fixed-size notation matcher (TurboFan candidate).
 *
 * All variants so far (v18–v34) generate notation-matching code that grows with
 * the language dictionary → large bytecode → V8 caps at Maglev, not TurboFan.
 *
 * v35 uses a fixed-size loop over pre-built arrays instead of inline comparisons:
 *
 *   DISPATCH[128]   — DISPATCH[c0|0x20] = offset into ENTRIES (0 = no notation)
 *   ENTRIES         — packed Uint32Array: groups terminated by 0.
 *                     Each entry: [elen, char1, ..., charN-1, multIdx]
 *   MULT_F64        — Float64Array of unique multiplier values
 *   NA_FIRST_KEYS   — sorted non-ASCII first char codes
 *   NA_FIRST_VALS   — ENTRIES offsets for non-ASCII groups
 *
 * The generated function body is constant-size regardless of language → TurboFan.
 *
 * Results (Node.js v24.11.1, tinybench 1s, p50):
 *   Single-unit valid:   1,975 ops/sec  (-9.5% vs v25)
 *   Single-unit invalid: 1,694 ops/sec  (-3.0% vs v25)
 *   JIT tier: TurboFan (status 1073) ✓
 *
 * Finding: TurboFan + simpler data structure beats DFA-based TurboFan variants
 * (v29=1813, v31=1747 ops/sec valid) — confirmed hypothesis vs DFA. However,
 * array accesses `ENTRIES[gi+k]` have higher memory latency than compile-time
 * literal comparisons. The working set spread across ENTRIES hurts L1 cache
 * performance vs Maglev's inline constants in v25. TurboFan wins for DFA but
 * Maglev inline wins overall. Discarded — v25 remains champion.
 *
 * Key impl note: `packedData` starts as `[0]` (sentinel) so all valid group offsets
 * are >= 1 — prevents `if(gi)` from treating the first group as falsy when offset=0.
 */
import type { Language } from '../../src/core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../../src/utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../../src/utils/craft.ts';
import { extractNotations, buildPackedEntries } from '../../src/utils/notation.ts';

export type { ParseFunction };

const SOURCE = `if(typeof str!=='string'||str==='')return null;
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
if(c!==46){pv=c-48;i++;
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;pv=pv*10+d;i++;}
if(i<len&&s.charCodeAt(i)===46){i++;var fr=0,div=1;
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;fr=fr*10+d;div*=10;i++;}
if(div>1)pv+=fr/div;}
}else{i++;var fr=0,div=1;
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;fr=fr*10+d;div*=10;i++;}
pv=div===1?NaN:fr/div;}
if(pv===pv){var sp=0;while(i<len&&s.charCodeAt(i)===32&&sp<3){i++;sp++;}
if(i<len){var c0=s.charCodeAt(i);
if(c0===32||(c0-48>>>0)<10||c0===46){while(i<len){var _c=s.charCodeAt(i);if((_c-48>>>0)<10||_c===46)i++;else break;}}
else{match:{
var gi;
if(c0<128){gi=DISPATCH[c0|0x20];}
else{gi=0;var lo=0,hi=NA_FIRST_KEYS.length-1;
while(lo<=hi){var mid=(lo+hi)>>>1;
if(NA_FIRST_KEYS[mid]===c0){gi=NA_FIRST_VALS[mid];break;}
else if(NA_FIRST_KEYS[mid]<c0)lo=mid+1;else hi=mid-1;}}
if(gi){while(ENTRIES[gi]){
var elen=ENTRIES[gi],ok=1;
if(i+elen<=len){
for(var k=1;k<elen;k++){var ch=s.charCodeAt(i+k);if((ch<128?ch|0x20:ch)!==ENTRIES[gi+k]){ok=0;break}}
if(ok){var _bci=i+elen,_bc=s.charCodeAt(_bci);
if(_bci>=len||_bc>=128||!BOUND[_bc]){i+=elen;v+=pv*MULT_F64[ENTRIES[gi+elen]];mc++;break match}}}
gi+=elen+1;}}
}}}}
continue}
i++}
if(mc===0){var n=+str;return n!==n?null:n;}
return neg?-v:v;`;

export function buildFastParse(language: Language): ParseFunction {
	const notations = extractNotations(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const { DISPATCH, ENTRIES, MULT_F64, NA_FIRST_KEYS, NA_FIRST_VALS } = buildPackedEntries(notations);

	return craftFunction<ParseFunction>(
		'fastParseV35',
		[ 'str' ],
		SOURCE,
		{ DISPATCH, ENTRIES, MULT_F64, NA_FIRST_KEYS, NA_FIRST_VALS, BOUND },
	);
}
