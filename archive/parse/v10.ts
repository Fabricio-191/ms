import type { Language } from '../../src/core/index.ts';
import { type TrieNode, buildTrie, collectCharRanges } from '../../src/utils/_trie.ts';

type FastParseFunction = (str: string) => number | null;

// v10: single case per char — applies `| 0x20` inline in the switch expression
// instead of emitting two cases (lower + upper) like v9.
function generateTrieCodeV10(node: TrieNode, indent: string, ranges: Array<[number, number]>): string {
	let code = '';

	if (node.multiplier !== null) {
		let check = 'i >= len';
		if (ranges.length > 0) {
			const parts = ranges.map(([ lo, hi ]) =>
				lo === hi ? `c === ${lo}` : `(c >= ${lo} && c <= ${hi})`);
			check = `i >= len || !(${parts.join(' || ')})`;
		}
		code += `${indent}{ const c = s.charCodeAt(i); if (${check}) { value += parsedValue * ${node.multiplier}; matchCount++; break notationBlock; } }\n`;
	}

	if (node.children.size === 0) return code;

	code += `${indent}switch (s.charCodeAt(i) | 0x20) {\n`;
	for (const [ cc, child ] of node.children) {
		const char = String.fromCharCode(cc);
		code += `${indent}\tcase ${cc}: // '${char}'\n`;
		code += `${indent}\t\ti++;\n`;
		code += generateTrieCodeV10(child, `${indent}\t\t`, ranges);
		code += `${indent}\t\tbreak;\n`;
	}
	code += `${indent}}\n`;

	return code;
}

export function buildFastParse(language: Language): FastParseFunction {
	const trie = buildTrie(language.dict);
	const ranges = collectCharRanges(language.dict, true);
	const trieCode = generateTrieCodeV10(trie, '\t\t\t\t\t\t', ranges);

	const source = `
		if (typeof str !== 'string' || str === '') return null;

		const s = str;
		const len = s.length;
		let value = 0;
		let matchCount = 0;
		let i = 0;

		while (i < len) {
			const cc = s.charCodeAt(i);

			if (((cc - 48) >>> 0) < 10 || cc === 46) {
				const numStart = i;
				let hasDot = cc === 46;
				i++;
				while (i < len) {
					const c = s.charCodeAt(i);
					if (((c - 48) >>> 0) < 10) { i++; }
					else if (c === 46 && !hasDot) { hasDot = true; i++; }
					else { break; }
				}
				const parsedValue = parseFloat(s.slice(numStart, i));
				if (!Number.isNaN(parsedValue)) {
					let spaces = 0;
					while (i < len && s.charCodeAt(i) === 32 && spaces < 3) { i++; spaces++; }

					notationBlock: if (i < len) {
						const _c0 = s.charCodeAt(i);
						if (_c0 === 32 || ((_c0 - 48) >>> 0) < 10 || _c0 === 46) {
							while (i < len) {
								const c = s.charCodeAt(i);
								if (((c - 48) >>> 0) < 10 || c === 46) { i++; }
								else { break; }
							}
							break notationBlock;
						}
${trieCode}					}
			}
				continue;
			}

			i++;
		}

		if (matchCount === 0) {
			const num = Number(str);
			if (Number.isNaN(num)) return null;
			return num;
		}

		return str.trim().startsWith('-') ? -value : value;
	`;

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	return Function('str', source) as FastParseFunction;
}
