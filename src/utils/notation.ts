export interface NotationEntry {
	chars: number[];
	multiplier: number;
}

export function extractNotations(dict: Record<string, number>): NotationEntry[] {
	return Object.entries(dict).map(([ notation, multiplier ]) => ({
		chars: Array.from(notation, c => c.toLowerCase().charCodeAt(0)),
		multiplier,
	}));
}

// ─── Formatting helpers (for generated-code comments) ────────────────────────

/** '`y`'(121) */
function charLabel(c: number): string {
	return `'${String.fromCharCode(c)}'(${c})`;
}

/** '`e`'(101)/'`E`'(69)  — or just charLabel if lo===hi */
function charPairLabel(lo: number, hi: number): string {
	if (lo === hi) return charLabel(lo);
	return `'${String.fromCharCode(lo)}'(${lo})/'${String.fromCharCode(hi)}'(${hi})`;
}

/** 31557600000 → "31,557,600,000" */
function fmtNum(n: number): string {
	return n.toLocaleString('en-US');
}

// ─── Boundary block helpers ───────────────────────────────────────────────────

/**
 * Emits the two-line boundary-check block (already indented by `i1 = indent+'\t'`).
 * `simpleBoundary` = true skips the end-of-string guard (used by v39).
 */
function emitBoundaryLines(i1: string, elen: number, mult: number, simpleBoundary: boolean): string {
	if (simpleBoundary) {
		return `${i1}const _bc = s.charCodeAt(i+${elen});\n` +
			`${i1}if (_bc >= 128 || !BOUND[_bc])\n` +
			`${i1}    { i += ${elen}; v += pv * ${mult}; mc++; break match; }\n`;
	}
	return `${i1}const _bci = i+${elen}, _bc = s.charCodeAt(_bci);\n` +
		`${i1}if (_bci >= len || _bc >= 128 || !BOUND[_bc])  // end | non-ASCII | not a boundary char\n` +
		`${i1}    { i += ${elen}; v += pv * ${mult}; mc++; break match; }\n`;
}

// ─── Code generators ──────────────────────────────────────────────────────────

/**
 * Generates flat if-chains for notation matching (v25 / v32 baseline).
 *
 * For each first char (both lo and hi case are emitted as separate blocks), emits
 * one `if` per notation sorted longest-first. Each condition checks:
 *   1. `c0 === firstChar`          — dispatch on the first char already read
 *   2. `i+N <= len`                — bounds guard before further charCodeAt calls
 *   3. `charCodeAt(i+k) === lo || charCodeAt(i+k) === hi`  — per remaining char
 *
 * Each passing entry falls through to a word-boundary check; on match it advances `i`,
 * accumulates `v += pv * multiplier`, increments `mc`, and breaks the enclosing label.
 *
 * @param entries   - notation entries from `extractNotations`
 * @param indent    - whitespace prefix for every top-level line
 * @param simpleBoundary - when true, omits the `_bci>=len` guard (faster but
 *   unsafe at end-of-string; only safe when callers guarantee trailing space)
 * @param availVar - when set (e.g. `'_avail'`), emits `_avail >= N` instead of
 *   `i+N <= len` for the length guard. The caller must declare `const _avail = len - i`
 *   before the generated block. Allows V8 to reason about a single variable across
 *   all length checks instead of recomputing `i+N` per entry.
 * @param singleCharFirst - controls single-char promotion within groups:
 *   - `false` (default): longest-first order throughout (v25/v32/v42 baseline).
 *   - `true`: single-char entry first, then multi-char longest-first — valid for any
 *     dict where all disambiguation chars are in BOUND (see v46).
 *   - `'smart'`: single-char first only for groups where ALL entries share the same
 *     multiplier (e.g. h/s/d/w/y in English). For groups with multiple multipliers
 *     (e.g. m=60000 and ms=1), falls back to longest-first. This avoids the extra
 *     boundary check cost for "30ms" while still benefiting "2h", "5s", etc. (v47).
 */
export function generateLookupCode(entries: NotationEntry[], indent: string, simpleBoundary = false, availVar?: string, singleCharFirst: boolean | 'smart' = false): string {
	// Build a map from lowercase first char → entries
	const byFirstChar = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirstChar.has(first)) byFirstChar.set(first, []);
		byFirstChar.get(first)!.push(entry);
	}

	// Expand: both the lowercase and uppercase variant of the first char get their own block
	const expanded = new Map<number, NotationEntry[]>();
	for (const [ first, list ] of byFirstChar) {
		const upper = String.fromCharCode(first).toUpperCase().charCodeAt(0);
		if (!expanded.has(first)) expanded.set(first, []);
		if (!expanded.has(upper)) expanded.set(upper, []);
		for (const entry of list) {
			expanded.get(first)!.push(entry);
			expanded.get(upper)!.push(entry);
		}
	}

	const i1 = `${indent}\t`;

	let code = '';
	for (const [ firstChar, list ] of expanded) {
		// Determine sort order for this group:
		// 'smart' = promote single-char only when every entry shares the same multiplier
		// (meaning no correctness risk from early boundary-match — all entries are equivalent)
		const promoteSingleChar = singleCharFirst === true ||
		  (singleCharFirst === 'smart' && list.every(e => e.multiplier === list[0]!.multiplier));
		const sorted = [ ...list ].sort((a, b) => {
			if (promoteSingleChar) {
				if (a.chars.length === 1 && b.chars.length > 1) return -1;
				if (a.chars.length > 1 && b.chars.length === 1) return 1;
			}
			return b.chars.length - a.chars.length;
		});

		for (const entry of sorted) {
			const elen = entry.chars.length;
			// Reconstruct the notation string as it will appear in this branch
			// (first char may be the uppercase variant)
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));

			code += `${indent}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;

			if (elen === 1) {
				// Single-char notation: c0 check + immediate boundary guard
				code += `${indent}if (c0 === ${firstChar}) {  // ${charLabel(firstChar)}\n`;
				code += emitBoundaryLines(i1, 1, entry.multiplier, simpleBoundary);
				code += `${indent}}\n`;
			}
			else {
				// Multi-char notation: c0 + length guard + per-remaining-char checks
				const remaining = entry.chars.slice(1);

				// Build the per-char condition segments and their labels
				const segments = remaining.map((c, idx) => {
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					const pos = idx + 1;
					const comment = `// [${pos}] ${charPairLabel(c, up)}`;
					const check = c === up ?
						`s.charCodeAt(i+${pos}) === ${c}` :
						`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
					return { check, comment };
				});

				// First line: c0 guard
				code += `${indent}if (c0 === ${firstChar}  // ${charLabel(firstChar)}\n`;
				// Length guard: either avail-based (one subtraction, many comparisons) or direct
				const lenGuard = availVar ? `${availVar} >= ${elen}` : `i+${elen} <= len`;
				code += `${indent} && ${lenGuard}  // needs ${elen} chars\n`;
				// Per-char guards — last one closes the outer if-paren
				for (let k = 0; k < segments.length; k++) {
					const { check, comment } = segments[k]!;
					const isLast = k === segments.length - 1;
					code += `${indent} && ${check}${isLast ? ')' : ''}  ${comment}\n`;
				}
				code += `${indent}{\n`;
				code += emitBoundaryLines(i1, elen, entry.multiplier, simpleBoundary);
				code += `${indent}}\n`;
			}
		}
	}
	return code;
}

/**
 * Generates lookup code with merged upper/lower case groups and if/else chains (v37).
 *
 * Differences from `generateLookupCode`:
 *   1. **Merged outer block**: `if (c0 === 121 || c0 === 89)` instead of two separate
 *      blocks — halves the number of top-level c0 comparisons.
 *   2. **Inner if/else if chain**: entries within a group use `if / else if / else`
 *      instead of independent flat `if`s — once a length/char check fails, V8 skips
 *      all remaining branches of that group rather than re-evaluating each in turn.
 *
 * Unchanged: per-char `(charCodeAt===lo||charCodeAt===hi)` comparisons, 3-condition
 * boundary check, no c1 caching.
 *
 * Observation (v37): ILP benefit of flat `if` (CPU pipelines independent branches)
 * outweighs the reduced comparison count of `else if` for invalid inputs, making v37
 * slightly worse overall despite fewer operations on valid inputs.
 */
export function generateGroupedLookupCode(entries: NotationEntry[], indent: string): string {
	// Group by lowercase first char only (no case expansion — outer if handles both)
	const byFirst = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirst.has(first)) byFirst.set(first, []);
		byFirst.get(first)!.push(entry);
	}

	const i1 = `${indent}\t`;
	const i2 = `${indent}\t\t`;

	let code = '';
	let firstGroup = true;

	for (const [ firstChar, list ] of byFirst) {
		const upper = String.fromCharCode(firstChar).toUpperCase().charCodeAt(0);
		const hasCase = upper !== firstChar;
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);

		// Outer dispatch: one block per logical first char (both cases in one condition)
		const outerKw = firstGroup ? 'if' : 'else if';
		firstGroup = false;
		const firstLabel = hasCase ?
			`${charLabel(firstChar)}/${charLabel(upper)}` :
			charLabel(firstChar);
		const cond = hasCase ?
			`c0 === ${firstChar} || c0 === ${upper}` :
			`c0 === ${firstChar}`;
		code += `${indent}// Group: ${firstLabel}\n`;
		code += `${indent}${outerKw} (${cond}) {\n`;

		let innerFirst = true;
		for (const entry of sorted) {
			const elen = entry.chars.length;
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));

			if (elen === 1) {
				// Single-char: no extra condition, just boundary check
				const kw = innerFirst ? '' : 'else ';
				code += `${i1}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;
				code += `${i1}${kw}{\n`;
				code += emitBoundaryLines(i2, 1, entry.multiplier, false);
				code += `${i1}}\n`;
			}
			else {
				const innerKw = innerFirst ? 'if' : 'else if';
				innerFirst = false;
				const remaining = entry.chars.slice(1);

				const segments = remaining.map((c, idx) => {
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					const pos = idx + 1;
					const comment = `// [${pos}] ${charPairLabel(c, up)}`;
					const check = c === up ?
						`s.charCodeAt(i+${pos}) === ${c}` :
						`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
					return { check, comment };
				});

				code += `${i1}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;
				code += `${i1}${innerKw} (i+${elen} <= len  // needs ${elen} chars\n`;
				for (let k = 0; k < segments.length; k++) {
					const { check, comment } = segments[k]!;
					const isLast = k === segments.length - 1;
					code += `${i1}  && ${check}${isLast ? ')' : ''}  ${comment}\n`;
				}
				code += `${i1}{\n`;
				code += emitBoundaryLines(i2, elen, entry.multiplier, false);
				code += `${i1}}\n`;
			}
		}

		code += `${indent}}\n`;
	}
	return code;
}

/**
 * Generates lookup code that caches `s.charCodeAt(i+1)` into `c1` per group (v38).
 *
 * Differences from `generateLookupCode`:
 *   1. Each first-char block is wrapped: `if (c0 === X) { var c1 = s.charCodeAt(i+1); ... }`
 *      `c1` is declared once per group and reused for all entries' position-1 check.
 *   2. Per-entry checks at position i+1 use `c1` instead of `s.charCodeAt(i+1)`,
 *      eliminating the duplicate call for each entry within the group.
 *
 * Unchanged: flat if structure (not if/else), separate lo/up groups, 3-condition boundary.
 *
 * Observation (v38): The `var c1` declaration is hoisted and computed unconditionally,
 * even when the length check `i+elen<=len` would fail. The mandatory call costs more
 * than the saved redundant calls. Additionally the larger function body (111 vs 75 lines)
 * prevents V8 from reaching Maglev — JIT status 32769.
 */
export function generateC1CachedLookupCode(entries: NotationEntry[], indent: string): string {
	// Build map from lowercase first char → entries, then expand to upper case
	const byFirstChar = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirstChar.has(first)) byFirstChar.set(first, []);
		byFirstChar.get(first)!.push(entry);
	}

	const expanded = new Map<number, NotationEntry[]>();
	for (const [ first, list ] of byFirstChar) {
		const upper = String.fromCharCode(first).toUpperCase().charCodeAt(0);
		if (!expanded.has(first)) expanded.set(first, []);
		if (!expanded.has(upper)) expanded.set(upper, []);
		for (const entry of list) {
			expanded.get(first)!.push(entry);
			expanded.get(upper)!.push(entry);
		}
	}

	const i1 = `${indent}\t`;
	const i2 = `${indent}\t\t`;

	let code = '';
	for (const [ firstChar, list ] of expanded) {
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);
		const hasMultiChar = sorted.some(e => e.chars.length > 1);

		code += `${indent}// ${charLabel(firstChar)} group\n`;
		code += `${indent}if (c0 === ${firstChar}) {\n`;
		if (hasMultiChar) {
			// Pre-read and cache the second char for all multi-char entries in this group
			code += `${i1}var c1 = s.charCodeAt(i+1);  // cache [1] for all entries below\n`;
		}

		for (const entry of sorted) {
			const elen = entry.chars.length;
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));

			code += `${i1}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;

			if (elen === 1) {
				// Single-char: no char checks, just boundary
				code += `${i1}{\n`;
				code += emitBoundaryLines(i2, 1, entry.multiplier, false);
				code += `${i1}}\n`;
			}
			else {
				const remaining = entry.chars.slice(1);
				const segments = remaining.map((c, idx) => {
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					const pos = idx + 1;
					const comment = `// [${pos}] ${charPairLabel(c, up)}`;
					let check: string;
					if (idx === 0) {
						// Use cached c1 for position i+1
						check = c === up ? `c1 === ${c}` : `(c1 === ${c} || c1 === ${up})`;
					}
					else {
						check = c === up ?
							`s.charCodeAt(i+${pos}) === ${c}` :
							`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
					}
					return { check, comment };
				});

				code += `${i1}if (i+${elen} <= len  // needs ${elen} chars\n`;
				for (let k = 0; k < segments.length; k++) {
					const { check, comment } = segments[k]!;
					const isLast = k === segments.length - 1;
					code += `${i1} && ${check}${isLast ? ')' : ''}  ${comment}\n`;
				}
				code += `${i1}{\n`;
				code += emitBoundaryLines(i2, elen, entry.multiplier, false);
				code += `${i1}}\n`;
			}
		}

		code += `${indent}}\n`;
	}
	return code;
}

/**
 * Generates lookup code using `switch(c0)` dispatch (v40).
 *
 * Differences from `generateLookupCode`:
 *   1. **`switch(c0)` outer dispatch**: one `case lo: case hi:` block per logical first
 *      char, instead of separate `if (c0===lo)` and `if (c0===hi)` blocks.
 *      Halves the number of dispatch groups and eliminates redundant c0 checks inside.
 *   2. **No inner c0 check**: entries within a case block omit the `c0 === X` test —
 *      the switch already guarantees the first char.
 *   3. V8 compiles sparse `switch` with a binary-search jump table, which may be
 *      faster than chained independent `if (c0===X)` checks for large dictionaries.
 *
 * Unchanged: flat `if` structure within groups (not if/else), per-char two-constant
 * comparisons, 3-condition boundary check, `i+N<=len` length guard.
 *
 * @param entries   - notation entries from `extractNotations`
 * @param indent    - whitespace prefix for every top-level line
 * @param availVar  - when set (e.g. `'_avail'`), emits `_avail >= N` instead of
 *   `i+N <= len` for the length guard. Same semantics as in `generateLookupCode`.
 */
export function generateSwitchLookupCode(entries: NotationEntry[], indent: string, availVar?: string): string {
	// Group by lowercase first char only; case expansion is done via `case lo: case hi:`
	const byFirstChar = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirstChar.has(first)) byFirstChar.set(first, []);
		byFirstChar.get(first)!.push(entry);
	}

	const i1 = `${indent}\t`; // inside switch block
	const i2 = `${indent}\t\t`; // inside case block
	const i3 = `${indent}\t\t\t`; // inside entry if-block

	let code = `${indent}switch (c0) {\n`;

	for (const [ firstChar, list ] of byFirstChar) {
		const upper = String.fromCharCode(firstChar).toUpperCase().charCodeAt(0);
		const hasCase = upper !== firstChar;
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);

		// Emit case labels — two labels when lo ≠ hi, one otherwise
		if (hasCase)
			code += `${i1}case ${firstChar}: case ${upper}: {  // ${charPairLabel(firstChar, upper)}\n`;

		else
			code += `${i1}case ${firstChar}: {  // ${charLabel(firstChar)}\n`;

		for (const entry of sorted) {
			const elen = entry.chars.length;
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));

			code += `${i2}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;

			if (elen === 1) {
				// Single-char: just boundary check (c0 guaranteed by switch)
				const innerIndent = i2;
				code += emitBoundaryLines(innerIndent, 1, entry.multiplier, false);
			}
			else {
				// Multi-char: length guard + per-remaining-char checks (no c0 check)
				const remaining = entry.chars.slice(1);
				const segments = remaining.map((c, idx) => {
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					const pos = idx + 1;
					const comment = `// [${pos}] ${charPairLabel(c, up)}`;
					const check = c === up ?
						`s.charCodeAt(i+${pos}) === ${c}` :
						`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
					return { check, comment };
				});

				const lenGuard = availVar ? `${availVar} >= ${elen}` : `i+${elen} <= len`;
				code += `${i2}if (${lenGuard}  // needs ${elen} chars\n`;
				for (let k = 0; k < segments.length; k++) {
					const { check, comment } = segments[k]!;
					const isLast = k === segments.length - 1;
					code += `${i2} && ${check}${isLast ? ')' : ''}  ${comment}\n`;
				}
				code += `${i2}{\n`;
				code += emitBoundaryLines(i3, elen, entry.multiplier, false);
				code += `${i2}}\n`;
			}
		}

		code += `${i2}break;  // no match in this group — do not fall through to next case\n`;
		code += `${i1}}\n`; // end case block
	}

	code += `${indent}}\n`; // end switch
	return code;
}

/**
 * Generates lookup code that caches `s.charCodeAt(i+1)` into `const c1` per group (v41).
 *
 * Identical to `generateC1CachedLookupCode` except the cache variable uses `const`
 * instead of `var`. The difference is scoping:
 *   - `var c1` is hoisted to function scope — V8 sees one mutable slot shared across
 *     all groups, making type inference harder.
 *   - `const c1` is block-scoped to the enclosing `if (c0===X)` block — each group
 *     has a distinct variable, allowing V8 to infer a stable `Smi` type per group.
 *
 * Hypothesis: block-scoped `const` may allow V8 to eliminate the redundant
 * `s.charCodeAt(i+1)` calls more aggressively than `var`.
 *
 * Observation (v41): both `var c1` (v38) and `const c1` (v41) produced identical
 * JIT tier results — the function body size is still the binding constraint.
 *
 * @param entries  - notation entries from `extractNotations`
 * @param indent   - whitespace prefix for every top-level line
 */
export function generateConstC1LookupCode(entries: NotationEntry[], indent: string): string {
	// Build map from lowercase first char → entries, then expand to upper case
	const byFirstChar = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirstChar.has(first)) byFirstChar.set(first, []);
		byFirstChar.get(first)!.push(entry);
	}

	const expanded = new Map<number, NotationEntry[]>();
	for (const [ first, list ] of byFirstChar) {
		const upper = String.fromCharCode(first).toUpperCase().charCodeAt(0);
		if (!expanded.has(first)) expanded.set(first, []);
		if (!expanded.has(upper)) expanded.set(upper, []);
		for (const entry of list) {
			expanded.get(first)!.push(entry);
			expanded.get(upper)!.push(entry);
		}
	}

	const i1 = `${indent}\t`;
	const i2 = `${indent}\t\t`;

	let code = '';
	for (const [ firstChar, list ] of expanded) {
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);
		const hasMultiChar = sorted.some(e => e.chars.length > 1);

		code += `${indent}// ${charLabel(firstChar)} group\n`;
		code += `${indent}if (c0 === ${firstChar}) {\n`;
		if (hasMultiChar) {
			// Block-scoped const: each group's c1 is a separate typed variable
			code += `${i1}const c1 = s.charCodeAt(i+1);  // cache [1] — block-scoped const per group\n`;
		}

		for (const entry of sorted) {
			const elen = entry.chars.length;
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));

			code += `${i1}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;

			if (elen === 1) {
				code += `${i1}{\n`;
				code += emitBoundaryLines(i2, 1, entry.multiplier, false);
				code += `${i1}}\n`;
			}
			else {
				const remaining = entry.chars.slice(1);
				const segments = remaining.map((c, idx) => {
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					const pos = idx + 1;
					const comment = `// [${pos}] ${charPairLabel(c, up)}`;
					let check: string;
					if (idx === 0) {
						// Use cached const c1 for position i+1
						check = c === up ? `c1 === ${c}` : `(c1 === ${c} || c1 === ${up})`;
					}
					else {
						check = c === up ?
							`s.charCodeAt(i+${pos}) === ${c}` :
							`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
					}
					return { check, comment };
				});

				code += `${i1}if (i+${elen} <= len  // needs ${elen} chars\n`;
				for (let k = 0; k < segments.length; k++) {
					const { check, comment } = segments[k]!;
					const isLast = k === segments.length - 1;
					code += `${i1} && ${check}${isLast ? ')' : ''}  ${comment}\n`;
				}
				code += `${i1}{\n`;
				code += emitBoundaryLines(i2, elen, entry.multiplier, false);
				code += `${i1}}\n`;
			}
		}

		code += `${indent}}\n`;
	}
	return code;
}

// ─── Optimized generators (v33+) ─────────────────────────────────────────────

/**
 * Generates optimized lookup code with `|0x20` case folding (v33 / v34).
 *
 * Improvements over `generateLookupCode`:
 *   1. **Merged case groups**: one outer block per lowercase first char using
 *      `(c0|0x20) === x` instead of separate `c0===x` and `c0===X` blocks.
 *      Non-ASCII first chars fall back to `c0 === x` (exact match).
 *   2. **Single comparison per ASCII char**: `(charCodeAt(i+k)|0x20) === lo`
 *      instead of `(charCodeAt(i+k)===lo || charCodeAt(i+k)===hi)` — one
 *      operation per position instead of two.
 *   3. **Grouped if/else chain**: entries within a first-char group use
 *      `if / else if / else` to avoid re-checking failed conditions.
 *
 * The `|0x20` trick works because:
 *   - For uppercase A–Z (65–90): x|0x20 maps to lowercase (97–122) ✓
 *   - For lowercase a–z (97–122): x|0x20 = x (unchanged) ✓
 *   - Dict keys are already lowercase, so expected values are always in 97–122.
 *
 * Observation (v33): `|0x20` adds net overhead vs two-constant flat `if`s.
 * V8's branch predictor handles literal-constant comparisons so well that the
 * extra bitwise operation costs more than it saves.
 */
export function generateOptimizedLookupCode(entries: NotationEntry[], indent: string): string {
	// Group by lowercase first char only (|0x20 handles case at runtime)
	const byFirst = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirst.has(first)) byFirst.set(first, []);
		byFirst.get(first)!.push(entry);
	}

	const i1 = `${indent}\t`;
	const i2 = `${indent}\t\t`;

	let code = '';
	let firstGroup = true;

	for (const [ firstChar, list ] of byFirst) {
		const isAsciiLetter = firstChar >= 97 && firstChar <= 122;
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);
		const multiChars = sorted.filter(e => e.chars.length > 1);
		const singleChar = sorted.find(e => e.chars.length === 1);

		const outerKw = firstGroup ? 'if' : 'else if';
		firstGroup = false;

		// For ASCII letters, use |0x20 to match both cases in one check
		const firstCheck = isAsciiLetter ?
			`(c0|0x20) === ${firstChar}` :
			`c0 === ${firstChar}`;
		const groupNote = isAsciiLetter ?
			`// matches ${charPairLabel(firstChar, firstChar - 32)} via |0x20` :
			`// ${charLabel(firstChar)}`;

		code += `${indent}${outerKw} (${firstCheck}) {  ${groupNote}\n`;

		let innerFirst = true;
		for (const entry of multiChars) {
			const elen = entry.chars.length;
			const notation = String.fromCharCode(firstChar, ...entry.chars.slice(1));
			const innerKw = innerFirst ? 'if' : 'else if';
			innerFirst = false;

			const remaining = entry.chars.slice(1);
			const segments = remaining.map((c, idx) => {
				const pos = idx + 1;
				let check: string;
				let comment: string;
				if (c >= 97 && c <= 122) {
					// ASCII letter: single |0x20 comparison
					check = `(s.charCodeAt(i+${pos})|0x20) === ${c}`;
					const up = c - 32;
					comment = `// [${pos}] ${charPairLabel(c, up)} via |0x20`;
				}
				else {
					// Non-ASCII or non-letter: two-way or exact comparison
					const up = String.fromCharCode(c).toUpperCase().charCodeAt(0);
					comment = `// [${pos}] ${charPairLabel(c, up)}`;
					check = c === up ?
						`s.charCodeAt(i+${pos}) === ${c}` :
						`(s.charCodeAt(i+${pos}) === ${c} || s.charCodeAt(i+${pos}) === ${up})`;
				}
				return { check, comment };
			});

			code += `${i1}// "${notation}" → ${fmtNum(entry.multiplier)} ms\n`;
			code += `${i1}${innerKw} (i+${elen} <= len  // needs ${elen} chars\n`;
			for (let k = 0; k < segments.length; k++) {
				const { check, comment } = segments[k]!;
				const isLast = k === segments.length - 1;
				code += `${i1}  && ${check}${isLast ? ')' : ''}  ${comment}\n`;
			}
			code += `${i1}{\n`;
			code += emitBoundaryLines(i2, elen, entry.multiplier, false);
			code += `${i1}}\n`;
		}

		if (singleChar) {
			const notation = String.fromCharCode(firstChar);
			const kw = innerFirst ? '' : 'else ';
			code += `${i1}// "${notation}" → ${fmtNum(singleChar.multiplier)} ms\n`;
			code += `${i1}${kw}{\n`;
			code += emitBoundaryLines(i2, 1, singleChar.multiplier, false);
			code += `${i1}}\n`;
		}

		code += `${indent}}\n`;
	}
	return code;
}

// ─── Data-structure builders ─────────────────────────────────────────────────

/**
 * Builds a Uint8Array[128] quick-rejection bitset (v45).
 *
 * STARTS[c] = 1 if any notation in the language starts with char code `c`
 * (both lowercase and uppercase). STARTS[c] = 0 otherwise.
 *
 * Used as a pre-check before the full notation dispatch:
 *   `if (c0 >= 128 || !STARTS[c0]) break match;`
 *
 * This single array lookup + branch immediately rejects first chars that don't
 * begin any notation — eliminating the entire if-chain scan for such inputs.
 * For English, only ~12 char codes (h/H, m/M, s/S, d/D, w/W, y/Y + ms/min/sec
 * first chars) have STARTS=1; all others are rejected in O(1).
 *
 * On the match path (STARTS[c0]=1), the overhead is one extra array lookup.
 */
export function buildStartsTable(entries: NotationEntry[]): Uint8Array {
	const table = new Uint8Array(128);
	for (const entry of entries) {
		const lo = entry.chars[0]!;
		if (lo >= 128) continue;
		table[lo] = 1;
		const hi = lo - 32; // uppercase: a-z (97-122) → A-Z (65-90)
		if (hi >= 65 && hi <= 90) table[hi] = 1;
	}
	return table;
}

/**
 * Builds a Float64Array[128] for the single-char notation fast path (v44 / v45).
 *
 * Stores both lowercase AND uppercase first-char codes so the generated code can
 * do a direct `MULT1[c0]` lookup without case-folding at runtime.
 *
 * table[lo] = table[hi] = multiplier  for each single-char notation.
 * table[k]  = 0                       if no single-char notation starts with k.
 *
 * Unlike `buildSingleCharTable` (which only stores lowercase), this version allows
 * the fast path to use `c0 < 128 ? MULT1[c0] : 0` without normalization.
 */
export function buildBothCaseSingleCharTable(entries: NotationEntry[]): Float64Array {
	const table = new Float64Array(128);
	for (const entry of entries) {
		if (entry.chars.length !== 1) continue;
		const lo = entry.chars[0]!;
		if (lo >= 128) continue;
		table[lo] = entry.multiplier;
		const hi = lo - 32; // uppercase: a-z (97-122) → A-Z (65-90)
		if (hi >= 65 && hi <= 90) table[hi] = entry.multiplier;
	}
	return table;
}

/**
 * Builds a Float64Array[128] where table[charCode|0x20] = multiplier for
 * single-char ASCII notations (0 = no single-char notation for this char).
 *
 * Used by v34 to fast-path the most common real-world cases (s, m, h, d, w, y)
 * with a single array lookup + boundary check instead of scanning if-chains.
 */
export function buildSingleCharTable(entries: NotationEntry[]): Float64Array {
	const table = new Float64Array(128);
	for (const entry of entries) {
		if (entry.chars.length !== 1) continue;
		const c = entry.chars[0]!;
		if (c < 128) table[c] = entry.multiplier; // c is already lowercase (97-122 range)
	}
	return table;
}

/**
 * Builds packed arrays for the table-driven fixed-size notation matcher (v35).
 *
 * Returns:
 *   DISPATCH[128]   — DISPATCH[charCode|0x20] = offset into ENTRIES for that group (0 = none)
 *   ENTRIES         — packed Uint32Array: each group is a sequence of entries terminated by 0.
 *                     Each entry: [elen, char1, char2, ..., charElen-1, multIdx]
 *                     where elen = total notation length, charK = lowercase/exact char code,
 *                     multIdx = index into MULT_F64.
 *   MULT_F64        — Float64Array of unique multiplier values
 *   NA_FIRST_KEYS   — sorted non-ASCII first char codes (for non-ASCII dispatch)
 *   NA_FIRST_VALS   — ENTRIES offsets for non-ASCII first-char groups
 *
 * The generated function body is fixed-size regardless of language, enabling TurboFan.
 */
export function buildPackedEntries(entries: NotationEntry[]): {
	DISPATCH: Uint32Array;
	ENTRIES: Uint32Array;
	MULT_F64: Float64Array;
	NA_FIRST_KEYS: Uint32Array;
	NA_FIRST_VALS: Uint32Array;
} {
	// Build unique multiplier index
	const multSet = new Set<number>(entries.map(e => e.multiplier));
	const multArr = [ ...multSet ];
	const multIdx = new Map(multArr.map((m, i) => [ m, i ]));
	const MULT_F64 = new Float64Array(multArr);

	// Group by first char (dict is already lowercase)
	const byFirst = new Map<number, NotationEntry[]>();
	for (const entry of entries) {
		const first = entry.chars[0]!;
		if (!byFirst.has(first)) byFirst.set(first, []);
		byFirst.get(first)!.push(entry);
	}

	// Pack groups into a flat array; record offsets.
	// Index 0 is reserved as the "no group" sentinel (DISPATCH defaults to 0 = no match).
	// All real groups start at offset >= 1 so `if(gi)` correctly distinguishes them.
	const packedData: number[] = [ 0 ];
	const DISPATCH = new Uint32Array(128);
	const naEntries: Array<[ number, number ]> = [];

	for (const [ firstChar, list ] of byFirst) {
		const sorted = [ ...list ].sort((a, b) => b.chars.length - a.chars.length);
		const offset = packedData.length;

		if (firstChar < 128)
			DISPATCH[firstChar] = offset; // DISPATCH[lowercase] = offset; input uses |0x20 to normalize
		else
			naEntries.push([ firstChar, offset ]);

		for (const entry of sorted) {
			const elen = entry.chars.length;
			packedData.push(elen);
			for (let k = 1; k < elen; k++) packedData.push(entry.chars[k]!);
			packedData.push(multIdx.get(entry.multiplier)!);
		}
		packedData.push(0); // group terminator
	}

	naEntries.sort((a, b) => a[0] - b[0]);
	return {
		DISPATCH,
		ENTRIES: new Uint32Array(packedData),
		MULT_F64,
		NA_FIRST_KEYS: new Uint32Array(naEntries.map(e => e[0])),
		NA_FIRST_VALS: new Uint32Array(naEntries.map(e => e[1])),
	};
}

/**
 * Builds a hash table for the dual-hash fixed-size notation matcher (v36).
 *
 * Both hashes are polynomial rolling hashes over the case-folded notation chars
 * (using `c < 128 ? c | 0x20 : c` — same as the generated matcher does at runtime):
 *   h1 = fold(sum(char[k] * 31^k)) & (HSIZE-1)  — table index
 *   h2 = fold(sum(char[k] * 37^k)) & 0x7fffffff  — verification fingerprint
 *
 * HTAB[HSIZE] (Uint32Array, always 512) maps h1 → 1-based index into HH2/HLEN/HMULT.
 * 0 = no entry. Collisions are detected at build time and throw.
 *
 * The generated function body is constant-size (scan loop + single hash lookup) → TurboFan.
 */
export function buildHashTable(entries: NotationEntry[]): {
	HTAB: Uint32Array;
	HH2: Uint32Array;
	HLEN: Uint32Array;
	HMULT: Float64Array;
} {
	const HSIZE = 512;
	const HTAB = new Uint32Array(HSIZE);
	const HH2 = new Uint32Array(entries.length);
	const HLEN = new Uint32Array(entries.length);
	const mults: number[] = [];

	for (let idx = 0; idx < entries.length; idx++) {
		const entry = entries[idx]!;
		let h1 = 0, h2 = 0;
		for (const c of entry.chars) {
			const lc = c < 128 ? c | 0x20 : c;
			h1 = (h1 * 31 + lc) & 0x7fffffff;
			h2 = (h2 * 37 + lc) & 0x7fffffff;
		}
		const slot = h1 & (HSIZE - 1);
		if (HTAB[slot] !== 0)
			throw new Error(`buildHashTable: collision at slot ${slot} between notations`);
		HTAB[slot] = idx + 1;
		HH2[idx] = h2;
		HLEN[idx] = entry.chars.length;
		mults.push(entry.multiplier);
	}

	return { HTAB, HH2, HLEN, HMULT: new Float64Array(mults) };
}
