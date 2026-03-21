# Method Comparison

Comparison of all parse/format methods available in `@fabricio-191/ms` vs `vercel/ms`.

## Parse features

| Feature | `vercel/ms` | `parse` | `parseClock` | `buildFastParse` |
|---|:---:|:---:|:---:|:---:|
| Multiple languages | ❌ | ✅ | ❌ | ⚠️ one per instance |
| Multi-unit input (`2h 30m`) | ❌ | ✅ | — | ✅ |
| Decimal numbers (`2.5h`) | ✅ | ✅ | ✅ | ✅ |
| Negative numbers (`-2h`) | ❌ | ✅ | ❌ | ✅ |
| Number-only input (`"100"`) | ✅ | ✅ | ❌ | ✅ |
| Clock notation (`1:30:00`) | ❌ | ❌ | ✅ | ❌ |
| Requires one-time build | ❌ | ❌ | ❌ | ✅ |

## Format features

| Feature | `vercel/ms` | `format` | `buildFastFormat` |
|---|:---:|:---:|:---:|
| Multiple languages | ❌ | ✅ | ⚠️ one per instance |
| Multi-unit output (`2h 30m 15s`) | ❌ | ✅ | ❌ |
| Configurable output length | ❌ | ✅ (1–8 units) | ❌ |
| Long form (`2 hours`) | ✅ | ✅ | ✅ |
| Negative numbers | ❌ | ✅ | ✅ |
| Requires one-time build | ❌ | ❌ | ✅ |

> `—` = not applicable. `⚠️` = supported but with a constraint.

### Notes

- **`buildFastParse` / `buildFastFormat`** require calling the builder once per language and storing the result. This overhead is paid upfront, enabling faster calls at runtime.
- **`parseClock`** parses clock-style strings (`1:30`, `1:30:00`, `1:30:00.000`) optionally in minutes mode.
- **`parse`** accepts a single `Language`, an array of `Language[]`, or defaults to `LANGUAGES.en`.

---

## Project Structure

```
src/
  index.ts                    # Public API exports
  parse/
    normal.ts                 # Baseline parse (uses Language.REGEX)
    fast.ts                   # Current: v3.1 trie (CHARDEST)
  format/
    normal.ts                 # Baseline format (multi-unit output)
    fast.ts                   # Current: v1 inlined branches
  old/                        # Legacy implementations for benchmarking
    parse/
      fast-v1.ts              # v1: regex + switch
      fast-v2.ts              # v2: isLetter scan
      fast-v3a.ts             # v3a: charCode boundary
      fast-v3c.ts             # v3c: length dispatch
      fast3-3.ts              # v3.3: string switch
      fast3-4.ts              # v3.4: inline check
      fast3-5.ts              # v3.5: bitwise
      fast3-6.ts              # v3.6: case-insensitive
    format/
      fast-v2.ts              # v2: separate functions
      fast-v3.ts              # v3: inlined constants
    experimental.ts           # Re-exports experimental versions
```

---

## Current Benchmark Results

Measured with [tinybench](https://github.com/tinylibs/tinybench) on Node.js v24.11.1.
Each benchmark runs for 5 seconds with at least 10 iterations.

### Parse — valid inputs

| Method | Latency (ns) | ops/sec | vs vercel/ms |
|---|---:|---:|---:|
| `vercel/ms` | 1,941,094 | 524 | baseline |
| `parse` | 7,235,421 | 139 | −73% |
| **`buildFastParse` v3.1 (trie)** | **1,034,316** | **978** | **+87%** |
| `buildFastParse` v3.3 (string switch) | 1,299,846 | 775 | +48% |
| `buildFastParse` v3.4 (inline check) | 1,047,342 | 960 | +83% |
| `buildFastParse` v3.5 (bitwise) | 1,112,599 | 905 | +73% |
| `buildFastParse` v3.6 (case-insensitive) | 1,047,909 | 960 | +83% |

### Parse — invalid inputs

| Method | Latency (ns) | ops/sec |
|---|---:|---:|
| `parse` | 10,450 | 98,036 |
| `buildFastParse` v3.1 (trie) | 1,337 | 768,568 |
| **`buildFastParse` v3.6 (case-insensitive)** | **1,261** | **810,053** |

### Format — valid inputs

| Method | Latency (ns) | ops/sec | vs vercel/ms |
|---|---:|---:|---:|
| `vercel/ms` short | 227,034 | 4,473 | baseline |
| `vercel/ms` long | 252,814 | 4,022 | baseline |
| `format` short | 7,762,238 | 129 | −97% |
| `format` long | 8,368,826 | 120 | −97% |
| `buildFastFormat` short | 292,250 | 3,473 | −22% |
| `buildFastFormat` long | 322,202 | 3,144 | −22% |

### Format — invalid inputs

| Method | Latency (ns) | ops/sec |
|---|---:|---:|
| `format` short | 71.53 | 11,287,574 |
| `buildFastFormat` short | 58.92 | 12,951,143 |

---

## Parse Implementation History

This section documents all parse optimizations attempted. Each version builds on the previous one.

### Baseline: `parse`

**Strategy**: Uses the `Language.REGEX` pattern to find all notation matches, then sums the values.

**How it works**:
1. Runs `str.matchAll(language.REGEX)` to find all `number + notation` pairs
2. For each match, looks up the notation in `language.dict` for the multiplier
3. Sums all matched values
4. Returns negative if string starts with `-`

**Benchmark**: ~168 ops/sec (−74% vs vercel/ms)

**Why slower**: The regex engine has overhead for each match, dictionary lookups, and multi-language support adds complexity.

---

### Version 1: Pre-built regex + switch

**Strategy**: Pre-build a regex and switch statement at build time, eliminating runtime dictionary lookups.

**How it works**:
1. At build time, creates a RegExp from `language.REGEX.source`
2. Generates a `switch` statement with all notation → multiplier mappings
3. Uses `regex.exec()` in a loop to find matches
4. Switch on the matched notation string to add the correct multiplier

```javascript
// Generated switch example
switch (match[2].toLowerCase()) {
    case 'ms': value += parsedValue * 1; break;
    case 's': case 'sec': case 'secs': value += parsedValue * 1000; break;
    // ... all notations
}
```

**Benchmark**: ~429 ops/sec (−34% vs vercel/ms)

**Improvement**: +155% over baseline

**Limitation**: Still uses regex engine for matching

---

### Version 2: Char-by-char scan + Unicode property test

**Strategy**: Eliminate regex entirely by scanning character-by-character. Use Unicode property test for notation boundary.

**How it works**:
1. Manual character scanning loop with charCode checks for digits/decimal
2. Uses `/\p{L}/u` regex to detect when we've finished reading letters
3. Slice the notation string and use generated switch for multiplier lookup

**Key insight**: Numbers are detected with `cc >= 48 && cc <= 57` (digit charCodes) and `cc === 46` (decimal point). Notation ends when `/\p{L}/u.test(char)` becomes false.

**Benchmark**: ~571 ops/sec (−12% vs vercel/ms)

**Improvement**: +33% over v1

**Limitation**: The `/\p{L}/u` test on each character has function call overhead

---

### Version 3: CharCode ranges for notation boundary

**Strategy**: Replace Unicode property test with pre-computed charCode ranges for notation detection.

**How it works**:
1. At build time, collects all character codes used in any notation of the language
2. Compacts into ranges (e.g., `a-z` becomes single range check)
3. Generates inline charCode boundary check

```javascript
// For English: letters are a, c-e, h-i, k-o, r-u, w, y
// Generated: c === 97 || (c >= 99 && c <= 101) || ...
const isNotationChar = (c) => c === 97 || (c >= 99 && c <= 101) || ...;
```

**Benchmark**: ~870 ops/sec (+34% vs vercel/ms)

**Improvement**: +52% over v2

**Limitation**: Still uses `s.slice(_w0, i)` to extract notation strings, then switch on the string

---

### Version 3.1: Trie traversal + nested switch

**Strategy**: Trie-based traversal with nested `switch` on charCode. No string slicing or comparison.

**How it works**:
1. Builds a trie from all notations in the language dictionary
2. Generates nested `switch` statements that traverse the trie by charCode
3. Checks for terminal node BEFORE descending (handles prefixes like `mo` vs `month`)
4. Uses pre-computed charCode ranges for notation boundary detection (from v3)

```javascript
// Generated nested switch example
switch (s.charCodeAt(i)) {
    case 121: // 'y'
        i++;
        if (i >= len || !isNotationChar(s.charCodeAt(i))) {
            value += parsedValue * 31557600000;
            matchCount++;
            break notationBlock;
        }
        switch (s.charCodeAt(i)) {
            case 101: // 'e' -> 'ye...'
                i++;
                // ... continues for 'year', 'years'
                break;
            case 114: // 'r' -> 'yr'
                // ...
        }
        break;
    // ... all other starting characters
}
```

**Benchmark**: ~1,042 ops/sec (+60% vs vercel/ms)

**Improvement**: +20% over v3

**Why fastest**: 
- No string allocation (no `slice`)
- No string comparison
- Pure numeric operations (charCode comparisons)
- Inline boundary check eliminates function calls

---

### Version 3.2: Length-based dispatch

**Strategy**: Check notation length first, then dispatch to appropriate handler.

**How it works**:
1. Group notations by their length at build time
2. First check the notation length, then dispatch:
   - **Length 1**: Direct charCode switch (no slice needed)
   - **Length 2**: Check first char, then second char (no slice needed)
   - **Length 3+**: Use `slice` + `switch` (acceptable overhead for longer strings)

**Rationale**: Most common notations are short (`s`, `m`, `h`, `d`, `w`, `y`, `ms`). Avoiding `slice` for these should improve performance.

**Benchmark**: ~969 ops/sec (+49% vs vercel/ms)

**Result**: Slower than v3.1! The extra check for length adds overhead that negates the benefit.

---

### Version 3.3: String switches instead of charCode

**Strategy**: Use string comparison in switch statements instead of numeric charCode.

**How it works**:
```javascript
// v3.1: numeric switch
switch (s.charCodeAt(i)) {
    case 121: // 'y'
        ...
}

// v3.3: string switch
switch (s[i]) {
    case 'y':
        ...
}
```

**Rationale**: V8 might optimize string switches differently, and string comparison could be faster than calling `charCodeAt()`.

**Benchmark**: ~908 ops/sec (+49% vs vercel/ms)

**Result**: Slower than v3.1 (−6%). String switches have additional overhead compared to numeric switches, and `s[i]` creates a single-character string.

---

### Version 3.4: Inline boundary check

**Strategy**: Inline the `isNotationChar` check directly instead of calling a function.

**How it works**:
```javascript
// v3.1: function call
if (i >= len || !isNotationChar(s.charCodeAt(i))) { ... }

// v3.4: inlined
if (i >= len || !(c >= 97 && c <= 122 || c >= 48 && c <= 57)) { ... }
```

**Rationale**: Function calls have overhead. Inlining should eliminate this.

**Benchmark**: ~934 ops/sec (+53% vs vercel/ms)

**Result**: Slower than v3.1 (−3%). V8's JIT already inlines small functions well. The expanded code might affect instruction cache.

---

### Version 3.5: Bitwise range checks

**Strategy**: Use bitwise operations for digit detection.

**How it works**:
```javascript
// v3.1: two comparisons
cc >= 48 && cc <= 57

// v3.5: one subtraction + comparison
(cc - 48) >>> 0 < 10
```

**Rationale**: `(cc - 48) >>> 0 < 10` is one subtraction and one comparison vs two comparisons. The `>>> 0` converts to unsigned 32-bit, making negative numbers large (failing the `< 10` check).

**Benchmark**: ~975 ops/sec (+60% vs vercel/ms)

**Result**: Similar to v3.1 (+1%). The bitwise approach is not significantly faster than the two comparisons for this use case.

---

### Version 3.6: Case-insensitive without `.toLowerCase()` — **FASTEST**

**Strategy**: Avoid `.toLowerCase()` by handling both cases in the trie switch.

**How it works**:
```javascript
// v3.1: creates new string
const s = str.toLowerCase();

// v3.6: work directly with original
const s = str;  // No .toLowerCase()!
switch (s.charCodeAt(i)) {
    case 121:  // 'y'
    case 89:   // 'Y'
        // handle both cases
}
```

**Rationale**: `.toLowerCase()` creates a new string and iterates over all characters. By handling both uppercase and lowercase in the switch, we avoid this allocation entirely.

**Benchmark**: ~1,061 ops/sec (+74% vs vercel/ms)

**Result**: **+10% faster than v3.1!** This is the fastest version.

**Why it works**:
- `.toLowerCase()` has O(n) overhead where n is string length
- The trie only adds a few extra `case` statements for uppercase letters
- No string allocation for the lowercase conversion
- The boundary check also handles both cases

---

## Current Benchmark Results

**Change**: Replaced `/^\s*-/u.test(str)` with `str.trim().startsWith('-')`

**Rationale**: The regex was called at the end of every parse. String methods are faster than regex for simple prefix checks.

**Impact**:
| Version | Before | After | Improvement |
|--------|--------|-------|-------------|
| v1 | 419 | 429 | +2% |
| v2 | 528 | 571 | +8% |
| v3 | 759 | 870 | +15% |
| v3.1 | 850 | 1,042 | +23% |
| v3.2 | 743 | 969 | +30% |

The improvement is more pronounced for faster implementations because the relative cost of the final check is higher when everything else is optimized.

---

## Format Implementation History

### Baseline: `format`

**Strategy**: Loop through units in order, dividing remaining time by each unit's value.

**How it works**:
1. Takes remaining milliseconds and iterates through units (year → month → ... → millisecond)
2. For each unit, divides and gets the value
3. Looks up notation string from language dictionary
4. Concatenates result

**Benchmark**: ~252 ops/sec (−96% vs vercel/ms)

**Why slow**: Multiple divisions, dictionary lookups for notation strings, multi-unit output overhead

---

### Version 1: Code-gen with inlined branches

**Strategy**: Generate a function with all branches inlined, notation strings as literals.

**How it works**:
1. At build time, generates a function with all unit thresholds inlined
2. Each check: `if (remaining >= UNIT_VALUE) return prefix + value + notation`
3. All notation strings inlined as string literals
4. Single function with runtime `long` parameter check

```javascript
// Generated function example
if (remaining >= 3600000) {
    const value = Math.floor(remaining / 3600000);
    return negativePrefix + value + (long ? ' hours' : 'h');
}
```

**Benchmark**: ~4,662 ops/sec short, ~3,876 ops/sec long

**Improvement**: +1,749% over baseline for short format

---

### Version 2: Separate functions for short/long

**Strategy**: Generate separate functions for short and long, eliminating runtime branching.

**How it works**:
- Two generated functions: `formatShort` and `formatLong`
- Wrapper returns `long ? formatLong(ms) : formatShort(ms)`
- No `if (long)` check inside the hot path

**Benchmark**: ~4,634 ops/sec short, ~4,233 ops/sec long

**Result**: Marginal improvement for short (+0.6%), significant improvement for long

**Analysis**: The separate functions eliminate the branch prediction overhead. For long format, this matters more because the singular/plural check is also eliminated.

---

### Version 3: Fully inlined constants

**Strategy**: Fully inline all thresholds as numeric literals, eliminate `TIMES` object lookup.

**How it works**:
1. Pre-compute all threshold constants at module load time
2. Generate code with numeric literals instead of `TIMES[unit]`
3. Separate functions for short/long
4. Inline singular/plural check in generated code

**Benchmark**: ~4,692 ops/sec short, ~3,827 ops/sec long

**Result**: Best for short format, similar to v1 for long

**Analysis**: V8's JIT already inlines constant object property access. The explicit inlining provides minimal benefit for short, but the singular/plural inline logic helps long format.

---

## Summary: What Worked and What Didn't

### Parse Optimizations

| Approach | Result | Why |
|----------|--------|-----|
| Pre-built regex + switch | Good (+155%) | Eliminates dictionary lookups |
| Char-by-char scan | Better (+33% more) | Eliminates regex engine overhead |
| CharCode ranges | Even better (+52% more) | Eliminates Unicode property test |
| Trie traversal (v3.1) | Great (+72% vs vercel) | Eliminates string allocation |
| Length dispatch (v3.2) | Worse | Extra check overhead |
| String switches (v3.3) | Neutral (+73%) | Similar to charCode switches |
| Inline check (v3.4) | **Best for valid (+86%)** | V8 JIT handles inlined code well |
| Bitwise ranges (v3.5) | Neutral (+73%) | Not faster than two comparisons |
| Case-insensitive (v3.6) | Best for invalid | Eliminates `.toLowerCase()` allocation |

**Key insights**:
- V8's JIT handles small inline functions well (v3.4)
- For valid inputs, v3.4 (inline check) is fastest
- For invalid inputs, v3.6 (case-insensitive) is fastest
- `.toLowerCase()` has significant overhead
- Pure numeric operations on charCodes remain essential

### Format Optimizations

| Approach | Result | Why |
|----------|--------|-----|
| Inline thresholds + notations | Great (+1749%) | Eliminates dictionary lookups |
| Separate short/long functions | Better for long | Eliminates branch prediction |
| Inlined numeric constants | Marginal | JIT already optimizes this |

**Key insight**: The main win comes from eliminating dictionary lookups and generating code at build time. Further optimizations are marginal.