/**
 * Parse v28 — Split generated functions.
 *
 * Hypothesis: splitting the single large generated function into three smaller
 * new Function() objects (parseNum, matchDFA, main) may allow each piece to
 * individually reach TurboFan, since each body is well below the size threshold
 * that keeps v18–v26 at Maglev.
 *
 * Structure:
 * - parseNum(s, i, len, iSlot)    — pure number parsing, language-independent.
 * - matchDFA(TRANS, MULTS, BOUND, NA_KEYS, NA_VALS, s, i, len, iSlot)
 *                                  — fixed-size DFA runner (same body as v27).
 * - main(parseNum, matchDFA, iSlot, str) — orchestrator; calls the two above.
 *
 * parseNum and main are module-level singletons (language-independent).
 * matchDFA is also a singleton; a per-language bound closure is passed to main.
 * iSlot (Uint32Array[1]) is a per-language mutable slot for returning new `i`.
 */
import type { Language } from '../../src/core/index.ts';
import { buildTrie, collectCharRanges, buildBoundaryTable } from '../../src/utils/trie.ts';
import { buildDFA } from './dfa.ts';
import type { ParseFunction } from '@src/core/types.ts';

export type { ParseFunction };

// ─── parseNum ─────────────────────────────────────────────────────────────────
// Parses the numeric value at position i. Returns pv (NaN on bare dot with no
// digits). Writes new i to iSlot[0]. Language-independent singleton.

const PARSE_NUM_SOURCE = `var c=s.charCodeAt(i);
var pv=0;
if(c!==46){pv=c-48;i++;
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;pv=pv*10+d;i++;}
if(i<len&&s.charCodeAt(i)===46){i++;var fr=0,div=1;
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;fr=fr*10+d;div*=10;i++;}
if(div>1)pv+=fr/div;}
}else{i++;var fr=0,div=1;
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;fr=fr*10+d;div*=10;i++;}
pv=div===1?NaN:fr/div;}
iSlot[0]=i;
return pv;`;

type ParseNumFn = (s: string, i: number, len: number, iSlot: Uint32Array) => number;

const parseNumFn = new Function('s', 'i', 'len', 'iSlot', PARSE_NUM_SOURCE) as ParseNumFn;
Object.defineProperty(parseNumFn, 'name', { value: 'parseNum', configurable: true });

// ─── matchDFA ─────────────────────────────────────────────────────────────────
// Runs the DFA from position i. Returns the matched multiplier (0 = no match).
// On match, writes the new i (past the notation chars) to iSlot[0].
// Fixed-size body — identical to v27's inner DFA loop. Language-independent singleton.

const MATCH_DFA_SOURCE = `var st=1,nxt=0;
while(i<len){
var cc=s.charCodeAt(i);
if(cc<128){nxt=TRANS[st*128+cc];}
else{var lo=0,hi=NA_KEYS.length-1,key=(st<<16)|cc;nxt=0;
while(lo<=hi){var mid=(lo+hi)>>>1;if(NA_KEYS[mid]===key){nxt=NA_VALS[mid];break;}else if(NA_KEYS[mid]<key)lo=mid+1;else hi=mid-1;}}
if(!nxt)break;
st=nxt;i++;
var m=MULTS[st];
if(m){var bc=s.charCodeAt(i);if(i>=len||bc>=128||!BOUND[bc]){iSlot[0]=i;return m;}}
}
return 0;`;

type MatchDFAFn = (
	TRANS: Uint16Array,
	MULTS: Float64Array,
	BOUND: Uint8Array,
	NA_KEYS: Uint32Array,
	NA_VALS: Uint16Array,
	s: string,
	i: number,
	len: number,
	iSlot: Uint32Array,
) => number;

const matchDFAFn = new Function(
	'TRANS',
	'MULTS',
	'BOUND',
	'NA_KEYS',
	'NA_VALS',
	's',
	'i',
	'len',
	'iSlot',
	MATCH_DFA_SOURCE,
) as MatchDFAFn;
Object.defineProperty(matchDFAFn, 'name', { value: 'matchDFA', configurable: true });

// ─── main ─────────────────────────────────────────────────────────────────────
// Orchestrator: outer parse loop calling parseNum and matchDFA.
// parseNum and matchDFA are received as parameters to avoid closure overhead.
// iSlot is a shared Uint32Array(1) used to pass new `i` out of sub-calls.
// Language-independent singleton.

type BoundMatchDFAFn = (s: string, i: number, len: number, iSlot: Uint32Array) => number;
type MainFn = (parseNum: ParseNumFn, matchDFA: BoundMatchDFAFn, iSlot: Uint32Array, str: string) => number | null;

const MAIN_SOURCE = `if(typeof str!=='string'||str==='')return null;
var s=str,len=s.length;
var si=0;while(si<len&&s.charCodeAt(si)===32)si++;
var neg=s.charCodeAt(si)===45;
if(neg){si++;while(si<len&&s.charCodeAt(si)===32)si++;}
var fc=s.charCodeAt(si);
if(fc!==45&&(fc-48>>>0)>=10&&fc!==46){var n=+str;return n!==n?null:n;}
var v=0,mc=0,i=si;
while(i<len){var c=s.charCodeAt(i);
if((c-48>>>0)<10||c===46){
var pv=parseNum(s,i,len,iSlot);i=iSlot[0];
if(pv===pv){
var sp=0;while(i<len&&s.charCodeAt(i)===32&&sp<3){i++;sp++;}
if(i<len){var c0=s.charCodeAt(i);
if(c0===32||(c0-48>>>0)<10||c0===46){while(i<len){var _c=s.charCodeAt(i);if((_c-48>>>0)<10||_c===46)i++;else break;}}
else{var mult=matchDFA(s,i,len,iSlot);if(mult){i=iSlot[0];v+=pv*mult;mc++;}}
}}
continue}
i++}
if(mc===0){var n=+str;return n!==n?null:n;}
return neg?-v:v;`;

const mainFn = new Function('parseNum', 'matchDFA', 'iSlot', 'str', MAIN_SOURCE) as MainFn;
Object.defineProperty(mainFn, 'name', { value: 'main', configurable: true });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V28Core {
	parseNumFn: ParseNumFn;
	matchDFAFn: MatchDFAFn;
	mainFn: MainFn;
	boundMatchDFA: BoundMatchDFAFn;
	iSlot: Uint32Array;
	TRANS: Uint16Array;
	MULTS: Float64Array;
	BOUND: Uint8Array;
	NA_KEYS: Uint32Array;
	NA_VALS: Uint16Array;
}

// ─── Build ────────────────────────────────────────────────────────────────────

export function buildCore(language: Language): V28Core {
	const trie = buildTrie(language.dict);
	const { TRANS, MULTS, NA_KEYS, NA_VALS } = buildDFA(trie);
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const iSlot = new Uint32Array(1);

	// Bound closure: captures TRANS/MULTS/BOUND/NA_KEYS/NA_VALS from this language.
	const boundMatchDFA: BoundMatchDFAFn = (s, i, len, is) =>
		matchDFAFn(TRANS, MULTS, BOUND, NA_KEYS, NA_VALS, s, i, len, is);

	return { parseNumFn, matchDFAFn, mainFn, boundMatchDFA, iSlot, TRANS, MULTS, BOUND, NA_KEYS, NA_VALS };
}

export function buildFastParse(language: Language): ParseFunction {
	const { boundMatchDFA, iSlot } = buildCore(language);
	return ((str: string) => mainFn(parseNumFn, boundMatchDFA, iSlot, str)) as ParseFunction;
}
