/**
 * Parse v36 — Dual-hash fixed-size notation matcher (TurboFan candidate).
 *
 * All inline variants (v18–v34) generate notation-matching code proportional to
 * the dictionary size → large bytecode → Maglev only.
 * Table-driven v35 reaches TurboFan but loses to v25 due to array memory latency.
 *
 * v36 replaces per-entry char comparisons with a scan-then-hash approach:
 *
 *   1. Scan forward from position i, accumulating two rolling polynomial hashes:
 *        h1 = (h1 * 31 + lc) & 0x7fffffff   (table index)
 *        h2 = (h2 * 37 + lc) & 0x7fffffff   (verification fingerprint)
 *      where lc = c < 128 ? c | 0x20 : c   (case folding, same as build time)
 *
 *   2. Boundary check is performed INSIDE the scan loop after each char:
 *        if(j>=len || _nbc>=128 || !BOUND[_nbc]) → try lookup
 *      On miss, scanning continues. This correctly handles multi-char and non-ASCII
 *      notations while stopping at notation/number boundaries:
 *        - "hour," → matches "h" (BOUND['o']=0 → boundary after 'h')
 *        - "時間xyz" → matches "時間" (boundary after '時' = miss; boundary after '時間' = match)
 *
 *   3. Hash table lookup: HTAB[h1 & 511] → 1-based index. Verify length + h2.
 *      False-positive probability: ~1/2^62 (two independent 31-bit hashes).
 *
 * Correctness assumption: all aliases of the same time unit share the same multiplier
 * (e.g. "h" and "hour" both = 3600000). v36 always matches the shortest notation at
 * each valid boundary — same result as any longer alias.
 *
 * Data arrays (built once per language, constant-size code body):
 *   HTAB[512]  — Uint32Array, h1 → 1-based slot index (0 = miss)
 *   HH2[N]    — Uint32Array, second-hash fingerprint per notation
 *   HLEN[N]   — Uint32Array, notation length per slot
 *   HMULT[N]  — Float64Array, multiplier per slot
 *
 * Results (Node.js v24.11.1, tinybench 1s, p50):
 *   Single-unit valid:   1,751 ops/sec  (-18.7% vs v25)
 *   Single-unit invalid: 1,633 ops/sec  (-4.8% vs v25)
 *   JIT tier: TurboFan (status 1073) ✓
 *
 * Hypothesis DISPROVED: TurboFan dual-hash (v36=1751) < TurboFan packed-entries (v35=1975).
 * The incremental boundary check triggers multiple HTAB lookups per scan (not one).
 * Each lookup = 3 typed-array reads (HTAB + HLEN + HH2) + the hash multiply per char.
 * v35's single linear scan with one char-compare pass is cheaper despite the nested loop.
 * Both TurboFan variants lose to Maglev inline v25 (2153) — same conclusion as v35.
 * The bottleneck is not the comparison strategy, it's the per-char work budget.
 * Discarded — v25 remains champion.
 */
import type { Language } from '../../src/core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../utils/craft.ts';
import { extractNotations, buildHashTable } from '../utils/notation.ts';

export type { ParseFunction };

// Fixed source — identical for every language.
// Max scan length 15 covers the longest notation in any supported language ("milliseconds" = 12).
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
var hx=0,hy=0,nlen=0,j=i;
while(j<len&&nlen<15){var nc=s.charCodeAt(j);
if((nc-48>>>0)<10||nc===46||nc===32)break;
var lc=nc<128?nc|0x20:nc;
hx=(hx*31+lc)&0x7fffffff;hy=(hy*37+lc)&0x7fffffff;
nlen++;j++;
var _nbc=s.charCodeAt(j);
if(j>=len||_nbc>=128||!BOUND[_nbc]){
var hi=HTAB[hx&511];
if(hi&&HLEN[hi-1]===nlen&&HH2[hi-1]===hy){i=j;v+=pv*HMULT[hi-1];mc++;break match;}}}
}}}}
continue}
i++}
if(mc===0){var n=+str;return n!==n?null:n;}
return neg?-v:v;`;

export function buildFastParse(language: Language): ParseFunction {
	const notations = extractNotations(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const { HTAB, HH2, HLEN, HMULT } = buildHashTable(notations);

	return craftFunction<ParseFunction>(
		'fastParseV36',
		[ 'str' ],
		SOURCE,
		{ BOUND, HTAB, HH2, HLEN, HMULT },
	);
}
