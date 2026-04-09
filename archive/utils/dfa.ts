import type { TrieNode } from './trie.ts';

export interface DFA {
	TRANS: Uint16Array;
	MULTS: Float64Array;
	NA_KEYS: Uint32Array;
	NA_VALS: Uint16Array;
	numStates: number;
}

export function buildDFA(root: TrieNode): DFA {
	const stateMap = new Map<TrieNode, number>();
	stateMap.set(root, 1);
	const nodes: TrieNode[] = [ root ];
	let nextId = 2;

	for (const node of nodes) {
		for (const [ , child ] of node.children) {
			if (!stateMap.has(child)) {
				stateMap.set(child, nextId++);
				nodes.push(child);
			}
		}
	}

	const numStates = nextId;
	const TRANS = new Uint16Array(numStates * 128);
	const MULTS = new Float64Array(numStates);
	const naEntries: Array<[number, number]> = [];

	for (const [ node, stateId ] of stateMap) {
		if (node.multiplier !== null) MULTS[stateId] = node.multiplier;

		for (const [ cc, child ] of node.children) {
			const toState = stateMap.get(child)!;
			if (cc < 128) {
				TRANS[stateId * 128 + cc] = toState;
				const upper = String.fromCharCode(cc).toUpperCase().charCodeAt(0);
				if (upper !== cc && upper < 128) TRANS[stateId * 128 + upper] = toState;
			}
			else {
				naEntries.push([ (stateId << 16) | cc, toState ]);
			}
		}
	}

	naEntries.sort((a, b) => a[0] - b[0]);
	const NA_KEYS = new Uint32Array(naEntries.map(e => e[0]));
	const NA_VALS = new Uint16Array(naEntries.map(e => e[1]));

	return { TRANS, MULTS, NA_KEYS, NA_VALS, numStates };
}
