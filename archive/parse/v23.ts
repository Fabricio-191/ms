/**
 * Parse v23 — TurboFan-optimized trie variant.
 *
 * Based on v18 with modifications to help V8's TurboFan compiler:
 * 1. No labeled statements — replaced with early returns via helper function
 * 2. No inline comments in generated code — cleaner for V8 parser
 * 3. Flattened control flow — less nesting depth
 * 4. Separated notation matching — V8 can optimize each path independently
 *
 * Results (Node.js v24.11.1, tinybench 1s, p50):
 *   Single-unit valid:   ~1,929 ops/sec  (−10% vs v25)
 *   Single-unit invalid: ~1,681 ops/sec  (−5.5% vs v25)
 *   JIT tier: Maglev (33793)
 *
 * Superseded by v25 (flat lookup) which has simpler generated code and better
 * branch prediction characteristics. Kept as reference for trie-based approach.
 */
import type { Language } from '../../src/core/index.ts';
import { type TrieNode, buildTrie, collectCharRanges, buildBoundaryTable, buildRootDispatch } from '../utils/trie.ts';
import type { ParseFunction } from '../../src/core/types.ts';
import { craftFunction } from '../utils/craft.ts';

export type { ParseFunction };

function collectChain(cc: number, node: TrieNode): { chain: Array<[number, number]>; leaf: TrieNode } {
	const upper = String.fromCharCode(cc).toUpperCase().charCodeAt(0);
	const chain: Array<[number, number]> = [ [ cc, upper ] ];
	let cur = node;

	while (cur.children.size === 1 && cur.multiplier === null) {
		const [ nextCc, nextChild ] = cur.children.entries().next().value!;
		const nextUpper = String.fromCharCode(nextCc).toUpperCase().charCodeAt(0);
		chain.push([ nextCc, nextUpper ]);
		cur = nextChild;
	}

	return { chain, leaf: cur };
}

function generateCode(node: TrieNode, indent: string): string {
	let code = '';

	if (node.multiplier !== null)
		code += `${indent}{const c=s.charCodeAt(i);if(i>=len||c>=128||!BOUND[c]){v+=pv*${node.multiplier};mc++;break notationBlock}}\n`;

	if (node.children.size === 0) return code;

	if (node.children.size === 1) {
		const [ cc, child ] = node.children.entries().next().value!;
		const { chain, leaf } = collectChain(cc, child);

		for (let k = 0; k < chain.length; k++) {
			const [ lo, hi ] = chain[k]!;
			if (lo === hi)
				code += `${indent}if(s.charCodeAt(i+${k})!==${lo})break notationBlock;\n`;
			else
				code += `${indent}{const _c=s.charCodeAt(i+${k});if(_c!==${lo}&&_c!==${hi})break notationBlock;}\n`;
		}
		code += `${indent}i+=${chain.length};\n`;
		code += generateCode(leaf, indent);
	}
	else {
		let first = true;
		for (const [ cc, child ] of node.children) {
			const char = String.fromCharCode(cc);
			const upperCc = char.toUpperCase().charCodeAt(0);
			const kw = first ? 'if' : 'else if';
			first = false;
			code += `${indent}${kw}(s.charCodeAt(i)===${cc}||s.charCodeAt(i)===${upperCc}){i++;\n`;
			code += generateCode(child, `${indent}\t`);
			code += `${indent}}\n`;
		}
	}

	return code;
}

function generateRootCode(
	branches: Map<number, TrieNode>,
	nonAscii: Map<number, TrieNode>,
	indent: string,
): string {
	let code = '';
	const id = indent;

	for (const [ branchId, child ] of branches) {
		code += `${id}if(r===${branchId}){i++;\n`;
		code += generateCode(child, `${id}\t`);
		code += `${id}}\n`;
	}
	if (nonAscii.size > 0) {
		code += `${id}if(r===0&&c0>=128){\n`;
		for (const [ cc, child ] of nonAscii) {
			code += `${id}\tif(c0===${cc}){i++;\n`;
			code += generateCode(child, `${id}\t\t`);
			code += `${id}\t}\n`;
		}
		code += `${id}}\n`;
	}
	return code;
}

export function buildFastParse(language: Language): ParseFunction {
	const trie = buildTrie(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const { arr: rootArr, branches, nonAscii } = buildRootDispatch(trie);
	const boundaryArr = buildBoundaryTable(ranges);
	const rootCode = generateRootCode(branches, nonAscii, '\t\t\t\t');

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
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;fr=fr*10+d;div*=10;i++;}
if(div>1)pv+=fr/div;}
}else{i++;
var fr=0,div=1;
while(i<len){var _c=s.charCodeAt(i);var d=_c-48>>>0;if(d>=10)break;fr=fr*10+d;div*=10;i++;}
pv=div===1?NaN:fr/div;}
if(pv===pv){
var sp=0;while(i<len&&s.charCodeAt(i)===32&&sp<3){i++;sp++;}
notationBlock:if(i<len){var c0=s.charCodeAt(i);
if(c0===32||(c0-48>>>0)<10||c0===46){while(i<len){var _c=s.charCodeAt(i);if((_c-48>>>0)<10||_c===46)i++;else break;}}
else{var r=c0<128?ROOT[c0]:0;
${rootCode}}}}
continue}
i++}
if(mc===0){var n=+str;return n!==n?null:n;}
return neg?-v:v;`;

	return craftFunction<ParseFunction>('fastParseV23', [ 'str' ], source, { ROOT: rootArr, BOUND: boundaryArr });
}
