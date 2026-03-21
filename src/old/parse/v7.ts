import type { Language } from '../../core/index.ts';

type FastParseFunction = (str: string) => number | null;

interface TrieNode {
	children: Map<number, TrieNode>;
	multiplier: number | null;
}

function buildTrie(dict: Record<string, number>): TrieNode {
	const root: TrieNode = { children: new Map(), multiplier: null };
	for (const [ notation, multiplier ] of Object.entries(dict)) {
		let node = root;
		for (let j = 0; j < notation.length; j++) {
			const cc = notation.charCodeAt(j);
			if (!node.children.has(cc))
				node.children.set(cc, { children: new Map(), multiplier: null });
			node = node.children.get(cc)!;
		}
		node.multiplier = multiplier;
	}
	return root;
}

function collectCharRanges(dict: Record<string, number>): Array<[number, number]> {
	const codes = new Set<number>();
	for (const notation of Object.keys(dict)) {
		for (let j = 0; j < notation.length; j++)
			codes.add(notation.charCodeAt(j));
	}

	const sorted = [ ...codes ].sort((a, b) => a - b);
	const ranges: Array<[number, number]> = [];
	let lo = sorted[0]!;
	let hi = lo;

	for (let j = 1; j < sorted.length; j++) {
		const c = sorted[j]!;
		if (c === hi + 1) {
			hi = c;
		}
		else {
			ranges.push([ lo, hi ]);
			lo = c;
			hi = c;
		}
	}
	ranges.push([ lo, hi ]);
	return ranges;
}

function buildLetterCheck(dict: Record<string, number>): string {
	const ranges = collectCharRanges(dict);
	return ranges
		.map(([ lo, hi ]) => lo === hi ? `c === ${lo}` : `(c >= ${lo} && c <= ${hi})`)
		.join(' || ');
}

function generateTrieCode(node: TrieNode, indent: string): string {
	let code = '';

	if (node.multiplier !== null)
		code += `${indent}if (i >= len || !isNotationChar(s.charCodeAt(i))) { value += parsedValue * ${node.multiplier}; matchCount++; break notationBlock; }\n`;

	if (node.children.size === 0) return code;

	code += `${indent}switch (s.charCodeAt(i)) {\n`;
	for (const [ cc, child ] of node.children) {
		const char = String.fromCharCode(cc);
		code += `${indent}\tcase ${cc}: // '${char}'\n`;
		code += `${indent}\t\ti++;\n`;
		code += generateTrieCode(child, `${indent}\t\t`);
		code += `${indent}\t\tbreak;\n`;
	}
	code += `${indent}}\n`;

	return code;
}

// v3.5: Uses bitwise operations for digit detection
// Theory: ((cc - 48) >>> 0) < 10 is equivalent to cc >= 48 && cc <= 57
// but might have different performance characteristics
export function buildFastParse(language: Language): FastParseFunction {
	const trie = buildTrie(language.dict);
	const letterCheck = buildLetterCheck(language.dict);
	const trieCode = generateTrieCode(trie, '\t\t\t\t\t\t');

	const source = `
		if (typeof str !== 'string' || str === '') return null;

		const s = str.toLowerCase();
		const len = s.length;
		const isNotationChar = (c) => ${letterCheck};
		let value = 0;
		let matchCount = 0;
		let i = 0;

		while (i < len) {
			const cc = s.charCodeAt(i);

			// v3.5: Bitwise digit check - ((cc - 48) >>> 0) < 10
			// For digits 0-9 (48-57): (cc - 48) gives 0-9, all < 10
			// For non-digits: (cc - 48) gives values outside 0-9 range
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
						if (_c0 === 32 || ((_c0 - 48) >>> 0) < 10 || _c0 === 46) break notationBlock;
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

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	return Function('str', source) as FastParseFunction;
}
