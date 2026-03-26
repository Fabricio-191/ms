export interface TrieNode {
	children: Map<number, TrieNode>;
	multiplier: number | null;
}

/**
 * Builds a trie from a language dict.
 * Assumes all notation strings are already lowercase, as language dicts define them.
 */
export function buildTrie(dict: Record<string, number>): TrieNode {
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

/**
 * Collects all character codes used in any notation and compacts them into ranges.
 * Pass `bothCases = true` to also include uppercase counterparts — needed for
 * case-insensitive boundary checks when the input is not pre-lowercased.
 */
export function collectCharRanges(dict: Record<string, number>, bothCases = false): Array<[number, number]> {
	const codes = new Set<number>();
	for (const notation of Object.keys(dict)) {
		for (let j = 0; j < notation.length; j++) {
			const cc = notation.charCodeAt(j);
			codes.add(cc);
			if (bothCases && cc >= 97 && cc <= 122) codes.add(cc - 32);
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

	return ranges;
}

/**
 * Generates a JS boolean expression that is true when `c` is a valid notation char.
 * Used both as the body of an `isNotationChar` arrow function and as an inline check.
 */
export function buildBoundaryExpr(ranges: Array<[number, number]>): string {
	return ranges
		.map(([ lo, hi ]) => lo === hi ? `c === ${lo}` : `(c >= ${lo} && c <= ${hi})`)
		.join(' || ');
}

/**
 * Builds a Uint8Array[128] lookup table where table[c] = 1 means c is a valid
 * notation character (boundary check). Single array access replaces the inline
 * range expression at every trie terminal node.
 *
 * Characters >= 128 (non-ASCII) are not covered and must fall back to a different
 * check — for Latin-script languages all notation chars are < 128.
 */
export function buildBoundaryTable(ranges: Array<[number, number]>): Uint8Array {
	const table = new Uint8Array(128);
	for (const [ lo, hi ] of ranges)
		for (let c = lo; c <= hi && c < 128; c++) table[c] = 1;
	return table;
}
