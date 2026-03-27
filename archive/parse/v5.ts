import type { Language } from '../../src/core/index.ts';
import type { ParseFunction } from '../../src/core/types.ts';

interface TrieNode {
	children: Map<string, TrieNode>;
	multiplier: number | null;
}

function buildTrieString(dict: Record<string, number>): TrieNode {
	const root: TrieNode = { children: new Map(), multiplier: null };
	for (const [ notation, multiplier ] of Object.entries(dict)) {
		let node = root;
		for (const char of notation) {
			const lowerChar = char.toLowerCase();
			if (!node.children.has(lowerChar))
				node.children.set(lowerChar, { children: new Map(), multiplier: null });
			node = node.children.get(lowerChar)!;
		}
		node.multiplier = multiplier;
	}
	return root;
}

function buildLetterCheckString(dict: Record<string, number>): string {
	const chars = new Set<string>();
	for (const notation of Object.keys(dict)) {
		for (const char of notation)
			chars.add(char.toLowerCase());
	}

	const sorted = [ ...chars ].sort();
	const ranges: Array<[string, string]> = [];
	let lo = sorted[0]!;
	let hi = lo;

	for (let j = 1; j < sorted.length; j++) {
		const c = sorted[j]!;
		if (c.charCodeAt(0) === hi.charCodeAt(0) + 1) {
			hi = c;
		}
		else {
			ranges.push([ lo, hi ]);
			lo = c;
			hi = c;
		}
	}
	ranges.push([ lo, hi ]);

	return ranges
		.map(([ start, end ]) => start === end ? `c === '${start}'` : `(c >= '${start}' && c <= '${end}')`)
		.join(' || ');
}

function generateTrieCodeString(node: TrieNode, indent: string): string {
	let code = '';

	if (node.multiplier !== null)
		code += `${indent}if (i >= len || !isNotationChar(s[i])) { value += parsedValue * ${node.multiplier}; matchCount++; break notationBlock; }\n`;

	if (node.children.size === 0) return code;

	code += `${indent}switch (s[i]) {\n`;
	for (const [ char, child ] of node.children) {
		code += `${indent}\tcase '${char}':\n`;
		code += `${indent}\t\ti++;\n`;
		code += generateTrieCodeString(child, `${indent}\t\t`);
		code += `${indent}\t\tbreak;\n`;
	}
	code += `${indent}}\n`;

	return code;
}

export function buildFastParse(language: Language): ParseFunction {
	const trie = buildTrieString(language.dict);
	const letterCheck = buildLetterCheckString(language.dict);
	const trieCode = generateTrieCodeString(trie, '\t\t\t\t\t\t');

	const source = `
		if (typeof str !== 'string' || str === '') return null;

		const s = str.toLowerCase();
		const len = s.length;
		const isNotationChar = (c) => ${letterCheck};
		let value = 0;
		let matchCount = 0;
		let i = 0;

		while (i < len) {
			const ch = s[i];

			if ((ch >= '0' && ch <= '9') || ch === '.') {
				const numStart = i;
				let hasDot = ch === '.';
				i++;
				while (i < len) {
					const c = s[i];
					if (c >= '0' && c <= '9') { i++; }
					else if (c === '.' && !hasDot) { hasDot = true; i++; }
					else { break; }
				}
				const parsedValue = parseFloat(s.slice(numStart, i));
				if (!Number.isNaN(parsedValue)) {
					let spaces = 0;
					while (i < len && s[i] === ' ' && spaces < 3) { i++; spaces++; }

					notationBlock: if (i < len) {
						const _c0 = s[i];
						if (_c0 === ' ' || (_c0 >= '0' && _c0 <= '9') || _c0 === '.') {
							// Skip all trailing digits and dots (invalid number like "1.2.3")
							while (i < len) {
								const c = s[i];
								if ((c >= '0' && c <= '9') || c === '.') { i++; }
								else { break; }
							}
							break notationBlock;
						}
${trieCode}                    }
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

	return Function('str', source) as ParseFunction;
}
