/**
 * Parse v31 — Compressed DFA via craftFunction() closure.
 *
 * Originally written with eval() to test whether an eval closure whose body
 * is a compressed-alphabet DFA (small, fixed-size) could reach TurboFan.
 * The experiment confirmed it could (status 1073 = TurboFan + Maglev).
 *
 * Now migrated to craftFunction() — same zero arg-overhead, same TurboFan
 * eligibility, no direct eval().
 */
import type { Language } from '../../core/index.ts';
import { buildTrie, collectCharRanges, buildBoundaryTable } from '../../utils/trie.ts';
import type { ParseFunction } from '../../core/types.ts';
import { buildDFA } from '../../utils/dfa.ts';
import { craftFunction } from '../../utils/craft.ts';

export type { ParseFunction };

// ─── Compressed-alphabet builder (same as v29) ───────────────────────────────

function buildCompressed(TRANS_full: Uint16Array, numStates: number): {
	CHAR_MAP: Uint8Array;
	TRANS_C: Uint16Array;
	ALPHA: number;
} {
	const usedChars = new Set<number>();
	for (let s = 1; s < numStates; s++) {
		for (let c = 0; c < 128; c++)
			if (TRANS_full[s * 128 + c] !== 0) usedChars.add(c);
	}

	const sortedChars = [ ...usedChars ].sort((a, b) => a - b);
	const K = sortedChars.length;
	const ALPHA = K + 1;

	const CHAR_MAP = new Uint8Array(128);
	for (let i = 0; i < K; i++) CHAR_MAP[sortedChars[i]!] = i + 1;

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

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildFastParse(language: Language): ParseFunction {
	const trie = buildTrie(language.dict);
	const { TRANS: TRANS_full, MULTS, NA_KEYS, NA_VALS, numStates } = buildDFA(trie);
	const { CHAR_MAP, TRANS_C: TRANS, ALPHA } = buildCompressed(TRANS_full, numStates);
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);

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

	return craftFunction<ParseFunction>(
		'fastParseV31',
		[ 'str' ],
		source,
		{ CHAR_MAP, TRANS, MULTS, BOUND, NA_KEYS, NA_VALS },
	);
}
