/**
 * Parse v25 — Lookup table with labeled block (like v18 but flatter ifs).
 *
 * Uses a flat list of if-else checks instead of nested trie ifs.
 * Still uses labeled blocks to allow early exit from matching.
 */
import type { Language } from '../../../core/index.ts';
import { collectCharRanges, buildBoundaryTable } from '../../../utils/_trie.ts';

export type FastParseFunction = (str: string) => number | null;

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
				code += `${indent}if(c0===${firstChar}){i+=1;v+=pv*${entry.multiplier};mc++;break match}\n`;
			}
			else {
				const checks = entry.chars.slice(1).map((c, idx) => {
					const upper = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					return c === upper ?
						`s.charCodeAt(i+${idx + 1})===${c}` :
						`(s.charCodeAt(i+${idx + 1})===${c}||s.charCodeAt(i+${idx + 1})===${upper})`;
				}).join('&&');
				code += `${indent}if(c0===${firstChar}&&i+${entry.chars.length}<=len&&${checks}){i+=${entry.chars.length};v+=pv*${entry.multiplier};mc++;break match}\n`;
			}
		}
	}
	return code;
}

function buildCore(language: Language): {
	fn(ROOT: Uint8Array, BOUND: Uint8Array, str: string): number | null;
	rootArr: Uint8Array;
	boundaryArr: Uint8Array;
} {
	const notations = extractNotations(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const boundaryArr = buildBoundaryTable(ranges);
	const rootArr = new Uint8Array(128);
	const lookupCode = generateLookupCode(notations, '\t\t\t\t\t');

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
${lookupCode}
}}}}
continue}
i++}
if(mc===0){var n=+str;return n!==n?null:n;}
return neg?-v:v;`;

	const fn = Function('ROOT', 'BOUND', 'str', source) as (ROOT: Uint8Array, BOUND: Uint8Array, str: string) => number | null;
	return { fn, rootArr, boundaryArr };
}

export function buildFastParse(language: Language): FastParseFunction {
	const { fn, rootArr, boundaryArr } = buildCore(language);
	return fn.bind(null, rootArr, boundaryArr) as FastParseFunction;
}

export function buildFastParseRaw(language: Language): {
	fn(ROOT: Uint8Array, BOUND: Uint8Array, str: string): number | null;
	rootArr: Uint8Array;
	boundaryArr: Uint8Array;
} {
	const { fn, rootArr, boundaryArr } = buildCore(language);
	return { fn: fn as (ROOT: Uint8Array, BOUND: Uint8Array, str: string) => number | null, rootArr, boundaryArr };
}
