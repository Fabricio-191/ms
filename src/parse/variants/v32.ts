/**
 * Parse v32 — v26-style inline trie, but built with craftFunction() instead of eval().
 *
 * v26 uses eval() which:
 *   1. Triggers bundler warnings (esbuild, rollup: "direct eval not recommended")
 *   2. May prevent TurboFan — V8 treats eval() closures with extra caution
 *      due to dynamic scope concerns, regardless of body size.
 *
 * craftFunction() builds:
 *   new Function('ctx', `
 *     var BOUND = ctx['BOUND'];
 *     function fastParseV32(str) { <same body as v26> }
 *     return fastParseV32;
 *   `)({ BOUND })
 *
 * The outer new Function is called once and discarded. The inner named function
 * captures BOUND as a closure local — zero arg-passing overhead, no eval.
 *
 * Hypothesis: V8 may TurboFan the inner function independently of the outer
 * wrapper, since it is not tainted by direct eval scope. If so, v32 should
 * outperform v26 (Maglev) despite identical algorithm and body size.
 */
import type { Language } from '../../core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../../utils/trie.ts';
import type { ParseFunction } from '../../core/types.ts';
import { craftFunction } from '../../utils/craft.ts';

export type { ParseFunction };

// ─── Notation extraction (same as v26) ────────────────────────────────────────

interface NotationEntry {
	chars: number[];
	multiplier: number;
}

function extractNotations(dict: Record<string, number>): NotationEntry[] {
	return Object.entries(dict).map(([ notation, multiplier ]) => ({
		chars: Array.from(notation, c => c.toLowerCase().charCodeAt(0)),
		multiplier,
	}));
}

// ─── Inline trie code generator (same as v26) ─────────────────────────────────

function generateLookupCode(entries: NotationEntry[], indent: string): string {
	const byFirstChar = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirstChar.has(first)) byFirstChar.set(first, []);
		byFirstChar.get(first)!.push(entry);
	}

	const expanded = new Map<number, NotationEntry[]>();
	for (const [ first, list ] of byFirstChar) {
		const upper = String.fromCharCode(first).toUpperCase().charCodeAt(0);
		if (!expanded.has(first)) expanded.set(first, []);
		if (!expanded.has(upper)) expanded.set(upper, []);
		for (const entry of list) {
			expanded.get(first)!.push(entry);
			expanded.get(upper)!.push(entry);
		}
	}

	let code = '';
	for (const [ firstChar, list ] of expanded) {
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);
		for (const entry of sorted) {
			if (entry.chars.length === 1) {
				code += `${indent}if(c0===${firstChar}){{const _bci=i+1,_bc=s.charCodeAt(_bci);if(_bci>=len||_bc>=128||!BOUND[_bc]){i+=1;v+=pv*${entry.multiplier};mc++;break match}}}\n`;
			}
			else {
				const checks = entry.chars.slice(1).map((c, idx) => {
					const upper = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					return c === upper ?
						`s.charCodeAt(i+${idx + 1})===${c}` :
						`(s.charCodeAt(i+${idx + 1})===${c}||s.charCodeAt(i+${idx + 1})===${upper})`;
				}).join('&&');
				const len = entry.chars.length;
				code += `${indent}if(c0===${firstChar}&&i+${len}<=len&&${checks}){{const _bci=i+${len},_bc=s.charCodeAt(_bci);if(_bci>=len||_bc>=128||!BOUND[_bc]){i+=${len};v+=pv*${entry.multiplier};mc++;break match}}}\n`;
			}
		}
	}
	return code;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildFastParse(language: Language): ParseFunction {
	const ranges = collectCharRanges(language.dict, true);
	const BOUND = buildBoundaryTable(ranges);
	const entries = extractNotations(language.dict);
	const lookupCode = generateLookupCode(entries, '\t\t\t\t\t');

	const body = `if(typeof str!=='string'||str==='')return null;
var s=str,len=s.length;
var si=0;while(si<len&&s.charCodeAt(si)===32)si++;
var neg=false;if(s.charCodeAt(si)===45){neg=true;si++;while(si<len&&s.charCodeAt(si)===32)si++;}
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

	return craftFunction<ParseFunction>('fastParseV32', [ 'str' ], body, { BOUND });
}
