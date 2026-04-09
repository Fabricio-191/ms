export interface TrieNode {
	children: Map<number, TrieNode>;
	multiplier: number | null;
}

export { collectCharRanges, buildBoundaryTable } from '../../src/utils/trie.ts';

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

export function buildBoundaryExpr(ranges: Array<[number, number]>): string {
	return ranges
		.map(([ lo, hi ]) => lo === hi ? `c === ${lo}` : `(c >= ${lo} && c <= ${hi})`)
		.join(' || ');
}

export interface RootDispatch {
	arr: Uint8Array;
	branches: Map<number, TrieNode>;
	nonAscii: Map<number, TrieNode>;
}

export function buildRootDispatch(root: TrieNode): RootDispatch {
	const arr = new Uint8Array(128);
	const branches = new Map<number, TrieNode>();
	const nonAscii = new Map<number, TrieNode>();
	let nextId = 1;

	for (const [ cc, child ] of root.children) {
		if (cc < 128) {
			const id = nextId++;
			branches.set(id, child);
			arr[cc] = id;
			const upperCc = String.fromCharCode(cc).toUpperCase().charCodeAt(0);
			if (upperCc !== cc && upperCc < 128) arr[upperCc] = id;
		}
		else {
			nonAscii.set(cc, child);
		}
	}

	return { arr, branches, nonAscii };
}
