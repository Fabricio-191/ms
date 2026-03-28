import type { TrieNode } from '../../src/utils/trie.ts';

export interface DFA {
	TRANS: Uint16Array; // [numStates * 128] — ASCII transitions (0 = dead state)
	MULTS: Float64Array; // [numStates] — multiplier for accepting states (0 = not accepting)
	NA_KEYS: Uint32Array; // sorted packed keys: (fromState << 16) | charCode, for non-ASCII
	NA_VALS: Uint16Array; // toState for each NA_KEYS entry
	numStates: number;
}

/**
 * Converts a trie into a DFA transition table.
 *
 * State 0 = dead (no outgoing transitions lead to state 0).
 * State 1 = initial / root.
 * States 2..N = trie nodes in BFS order.
 *
 * ASCII transitions: TRANS[state * 128 + charCode] = nextState (0 = dead).
 * Both lowercase and uppercase map to the same child state.
 *
 * Non-ASCII transitions: binary search in NA_KEYS/NA_VALS.
 * Key = (fromState << 16) | charCode; sorted ascending.
 *
 * Accepting states: MULTS[state] !== 0.
 */
export function buildDFA(root: TrieNode): DFA {
	// BFS to assign state IDs (root = 1).
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
		if (node.multiplier !== null)
			MULTS[stateId] = node.multiplier;

		for (const [ cc, child ] of node.children) {
			const toState = stateMap.get(child)!;
			if (cc < 128) {
				TRANS[stateId * 128 + cc] = toState;
				const upperCc = String.fromCharCode(cc).toUpperCase().charCodeAt(0);
				if (upperCc !== cc && upperCc < 128)
					TRANS[stateId * 128 + upperCc] = toState;
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
