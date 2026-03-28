/**
 * Parse v29 — Compressed-alphabet DFA.
 *
 * Evolution of v27: same fixed-size function body (→ TurboFan) but the
 * transition table is ~7× smaller thanks to alphabet compression.
 *
 * v27 problem: TRANS[numStates × 128] ≈ 15 KB for English — poor L1 cache
 * fit when the benchmark cycles through many different notation strings.
 *
 * Solution:
 *   CHAR_MAP[128]   — maps each ASCII char to a compressed index 1..K.
 *                     0 = "not a notation char" (always transitions to dead state).
 *   TRANS[numStates × (K+1)]  — K = number of distinct ASCII notation chars.
 *
 * For English: K ≈ 17 → TRANS ≈ 60 × 18 × 2 bytes ≈ 2 KB.
 * CHAR_MAP itself is 128 bytes, permanently hot in L1.
 * Total working set: ~2.5 KB (vs ~15 KB for v27).
 *
 * The generated source is still fully language-independent (ALPHA is baked in
 * as a numeric literal). Function body size ≈ v27 → TurboFan expected.
 *
 * Non-ASCII languages (Japanese): all notation chars are non-ASCII, so K = 0
 * and ALPHA = 1. All transitions go through the NA_KEYS/NA_VALS binary search,
 * same as v27.
 */
import type { Language } from '../../core/index.ts';
import { buildTrie, collectCharRanges, buildBoundaryTable } from '../../utils/trie.ts';
import type { ParseFunction } from '../../core/types.ts';
import { buildDFA } from '../../utils/dfa.ts';
import { craftFunction } from '../../utils/craft.ts';

export type { ParseFunction };

// ─── Compressed-alphabet DFA builder ─────────────────────────────────────────

/**
 * Builds the compressed alphabet mapping and a compressed TRANS table from a
 * full 128-wide DFA transition table.
 *
 * Returns:
 *   CHAR_MAP[128]   — char code → compressed index (1-based; 0 = not in alphabet)
 *   TRANS_C[numStates × ALPHA]  — compressed table (ALPHA = K + 1, K distinct chars)
 *   ALPHA           — number of columns in TRANS_C
 */
function buildCompressed(TRANS_full: Uint16Array, numStates: number): {
	CHAR_MAP: Uint8Array;
	TRANS_C: Uint16Array;
	ALPHA: number;
} {
	// Collect all ASCII chars that appear as non-zero transitions anywhere.
	const usedChars = new Set<number>();
	for (let s = 1; s < numStates; s++) {
		for (let c = 0; c < 128; c++)
			if (TRANS_full[s * 128 + c] !== 0) usedChars.add(c);
	}

	// Sort for determinism; assign compressed indices 1..K.
	const sortedChars = [ ...usedChars ].sort((a, b) => a - b);
	const K = sortedChars.length;
	const ALPHA = K + 1; // column 0 = "not in alphabet" (always dead)

	const CHAR_MAP = new Uint8Array(128); // default 0 = not in alphabet
	for (let i = 0; i < K; i++) CHAR_MAP[sortedChars[i]!] = i + 1;

	// Build compressed table.
	const TRANS_C = new Uint16Array(numStates * ALPHA);
	for (let s = 1; s < numStates; s++) {
		for (let c = 0; c < 128; c++) {
			const toState = TRANS_full[s * 128 + c];
			if (!toState) continue;
			const ai = CHAR_MAP[c]!; // always > 0 here since TRANS[s*128+c] != 0
			TRANS_C[s * ALPHA + ai] = toState;
		}
	}

	return { CHAR_MAP, TRANS_C, ALPHA };
}

/**
 * Generates a fixed-size parse source string parameterised only by the ALPHA
 * constant. The body structure is identical to v27's SOURCE; the only
 * difference is the inner DFA step:
 *
 *   v27: nxt = TRANS[st * 128 + cc]
 *   v29: nxt = TRANS[st * ALPHA + (cc < 128 ? CHAR_MAP[cc] : 0)]
 *
 * Since ALPHA is baked as a literal and the structure is otherwise unchanged,
 * the bytecode size is essentially the same as v27 → TurboFan expected.
 */
function makeSource(ALPHA: number): string {
	return `if(typeof str!=='string'||str==='')return null;
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
if(pv===pv){
var sp=0;while(i<len&&s.charCodeAt(i)===32&&sp<3){i++;sp++;}
if(i<len){var c0=s.charCodeAt(i);
if(c0===32||(c0-48>>>0)<10||c0===46){while(i<len){var _c=s.charCodeAt(i);if((_c-48>>>0)<10||_c===46)i++;else break;}}
else{match:{
var st=1,nxt=0;
while(i<len){
var cc=s.charCodeAt(i);
if(cc<128){nxt=TRANS[st*${ALPHA}+(CHAR_MAP[cc]|0)];}
else{var lo=0,hi=NA_KEYS.length-1,key=(st<<16)|cc;nxt=0;
while(lo<=hi){var mid=(lo+hi)>>>1;if(NA_KEYS[mid]===key){nxt=NA_VALS[mid];break;}else if(NA_KEYS[mid]<key)lo=mid+1;else hi=mid-1;}}
if(!nxt)break;
st=nxt;i++;
var m=MULTS[st];
if(m){var bc=s.charCodeAt(i);if(i>=len||bc>=128||!BOUND[bc]){v+=pv*m;mc++;break match;}}
}}}}}
continue}
i++}
if(mc===0){var n=+str;return n!==n?null:n;}
return neg?-v:v;`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildFastParse(language: Language): ParseFunction {
	const trie = buildTrie(language.dict);
	const { TRANS: TRANS_full, MULTS, NA_KEYS, NA_VALS, numStates } = buildDFA(trie);
	const { CHAR_MAP, TRANS_C: TRANS, ALPHA } = buildCompressed(TRANS_full, numStates);
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);

	const source = makeSource(ALPHA);
	return craftFunction<ParseFunction>(
		'fastParseV29',
		[ 'str' ],
		source,
		{ CHAR_MAP, TRANS, MULTS, BOUND, NA_KEYS, NA_VALS },
	);
}
