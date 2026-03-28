/**
 * Parse v27 — DFA transition table.
 *
 * Hypothesis: encoding the trie as a precomputed Uint16Array transition table
 * produces a FIXED-SIZE generated function regardless of language/notation count.
 * A fixed-size body may fit under V8's TurboFan threshold where the trie-based
 * variants (v18–v25) stay at Maglev due to their large per-language bodies.
 *
 * Structure:
 * - buildDFA() converts the trie into TRANS[numStates*128] + MULTS[numStates]
 *   + NA_KEYS/NA_VALS for non-ASCII languages (e.g. Japanese).
 * - The generated function body is identical for every language instance.
 * - Language data lives entirely in the typed arrays passed as parameters.
 */
import type { Language } from '../../src/core/index.ts';
import { buildTrie, collectCharRanges, buildBoundaryTable } from '../../src/utils/trie.ts';
import { buildDFA } from './dfa.ts';
import type { ParseFunction } from '@src/core/types.ts';

export type { ParseFunction };

// ─── Fixed-size generated source ─────────────────────────────────────────────
// Identical for every language — no hardcoded char codes or per-notation branches.
// Parameters: TRANS (Uint16Array), MULTS (Float64Array), BOUND (Uint8Array),
//             NA_KEYS (Uint32Array), NA_VALS (Uint16Array), str (string).

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
if(pv===pv){
var sp=0;while(i<len&&s.charCodeAt(i)===32&&sp<3){i++;sp++;}
if(i<len){var c0=s.charCodeAt(i);
if(c0===32||(c0-48>>>0)<10||c0===46){while(i<len){var _c=s.charCodeAt(i);if((_c-48>>>0)<10||_c===46)i++;else break;}}
else{match:{
var st=1,nxt=0;
while(i<len){
var cc=s.charCodeAt(i);
if(cc<128){nxt=TRANS[st*128+cc];}
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

// ─── Types ────────────────────────────────────────────────────────────────────

type V27Fn = (
	this: void,
	TRANS: Uint16Array,
	MULTS: Float64Array,
	BOUND: Uint8Array,
	NA_KEYS: Uint32Array,
	NA_VALS: Uint16Array,
	str: string,
) => number | null;

export interface V27Core {
	fn: V27Fn;
	TRANS: Uint16Array;
	MULTS: Float64Array;
	BOUND: Uint8Array;
	NA_KEYS: Uint32Array;
	NA_VALS: Uint16Array;
}

// ─── Build ────────────────────────────────────────────────────────────────────

export function buildCore(language: Language): V27Core {
	const trie = buildTrie(language.dict);
	const { TRANS, MULTS, NA_KEYS, NA_VALS } = buildDFA(trie);
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);

	const fn = new Function('TRANS', 'MULTS', 'BOUND', 'NA_KEYS', 'NA_VALS', 'str', SOURCE) as V27Fn;
	Object.defineProperty(fn, 'name', { value: 'fastParseV27', configurable: true });

	return { fn, TRANS, MULTS, BOUND, NA_KEYS, NA_VALS };
}

export function buildFastParse(language: Language): ParseFunction {
	const { fn, TRANS, MULTS, BOUND, NA_KEYS, NA_VALS } = buildCore(language);
	return ((str: string) => fn(TRANS, MULTS, BOUND, NA_KEYS, NA_VALS, str)) as ParseFunction;
}
