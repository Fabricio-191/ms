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

export function buildBoundaryTable(ranges: Array<[number, number]>): Uint8Array {
	const table = new Uint8Array(128);
	for (const [ lo, hi ] of ranges)
		for (let c = lo; c <= hi && c < 128; c++) table[c] = 1;
	return table;
}
