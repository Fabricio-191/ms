import type { Language } from '../../core/index.ts';

type FastParseFunction = (str: string) => number | null;

interface TrieNode {
	children: Map<number, TrieNode>;
	multiplier: number | null;
}

function buildTrieCaseInsensitive(dict: Record<string, number>): TrieNode {
	const root: TrieNode = { children: new Map(), multiplier: null };
	for (const [ notation, multiplier ] of Object.entries(dict)) {
		let node = root;
		for (const char of notation) {
			const lowerChar = char.toLowerCase();
			const cc = lowerChar.charCodeAt(0);
			if (!node.children.has(cc))
				node.children.set(cc, { children: new Map(), multiplier: null });
			node = node.children.get(cc)!;
		}
		node.multiplier = multiplier;
	}
	return root;
}

function collectCharRangesCaseInsensitive(dict: Record<string, number>): { letterCheck: string; ranges: Array<[number, number]> } {
	const codes = new Set<number>();
	for (const notation of Object.keys(dict)) {
		for (const char of notation) {
			const cc = char.charCodeAt(0);
			codes.add(cc);
			if (cc >= 97 && cc <= 122) codes.add(cc - 32);
		}
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

	const letterCheck = ranges
		.map(([ start, end ]) => start === end ? `c === ${start}` : `(c >= ${start} && c <= ${end})`)
		.join(' || ');

	return { letterCheck, ranges };
}

// v9: Combines all optimizations:
// - Case-insensitive without .toLowerCase() (from v8)
// - Inline boundary check (from v6)
// - Bitwise digit check (from v7)
function generateTrieCodeV9(node: TrieNode, indent: string, ranges: Array<[number, number]>): string {
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

	code += `${indent}switch (s.charCodeAt(i)) {\n`;
	for (const [ cc, child ] of node.children) {
		const char = String.fromCharCode(cc);
		const upperChar = char.toUpperCase();
		const upperCc = upperChar.charCodeAt(0);

		if (cc === upperCc) {
			code += `${indent}\tcase ${cc}: // '${char}'\n`;
		}
		else {
			code += `${indent}\tcase ${cc}: // '${char}'\n`;
			code += `${indent}\tcase ${upperCc}: // '${upperChar}'\n`;
		}
		code += `${indent}\t\ti++;\n`;
		code += generateTrieCodeV9(child, `${indent}\t\t`, ranges);
		code += `${indent}\t\tbreak;\n`;
	}
	code += `${indent}}\n`;

	return code;
}

export function buildFastParse(language: Language): FastParseFunction {
	const trie = buildTrieCaseInsensitive(language.dict);
	const { ranges } = collectCharRangesCaseInsensitive(language.dict);
	const trieCode = generateTrieCodeV9(trie, '\t\t\t\t\t\t', ranges);

	const source = `
		if (typeof str !== 'string' || str === '') return null;

		// v9: No .toLowerCase() - work directly with original string
		const s = str;
		const len = s.length;
		let value = 0;
		let matchCount = 0;
		let i = 0;

		while (i < len) {
			const cc = s.charCodeAt(i);

			// v9: Bitwise digit check + case-insensitive
			// Digits: 48-57, Dot: 46
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
						// Check for space, digit, or dot (case-insensitive for digits not needed)
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

		// Negative check is case-insensitive
		return str.trim().startsWith('-') ? -value : value;
	`;

	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	return Function('str', source) as FastParseFunction;
}
