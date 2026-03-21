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
    fast.ts                   # Current: v9 combined optimizations
  format/
    normal.ts                 # Baseline format (multi-unit output)
    fast.ts                   # Current: inlined branches
  old/                        # Legacy implementations for benchmarking
    index.ts                  # Exports all legacy versions
    parse/
      v0.ts                   # trie with .toLowerCase()
      v1.ts                   # regex + switch
      v2.ts                   # isLetter scan with /\p{L}/u
      v3.ts                   # charCode boundary
      v4.ts                   # length dispatch
      v5.ts                   # string switch
      v6.ts                   # inline check
      v7.ts                   # bitwise digit detection
      v8.ts                   # case-insensitive without .toLowerCase()
      v9.ts                   # combined all (same as current)
    format/
      v1.ts                   # separate functions for short/long
      v2.ts                   # inlined constants
```

---

## Current Benchmark Results

Measured with [tinybench](https://github.com/tinylibs/tinybench) on Node.js v24.11.1.
Each benchmark runs for 5 seconds with at least 10 iterations.

### Parse — valid inputs

| Method | ops/sec | vs vercel/ms |
|---|---:|---:|
| `vercel/ms` | 522 | baseline |
| `parse` | 141 | −73% |
| **`buildFastParse` (current/v9)** | **890** | **+70%** |
| `buildFastParseV0` (trie toLowerCase) | 879 | +68% |
| `buildFastParseV1` (regex) | 359 | −31% |
| `buildFastParseV2` (isLetter) | 477 | −9% |
| `buildFastParseV3` (charCode) | 767 | +47% |
| `buildFastParseV4` (length) | 835 | +60% |
| `buildFastParseV5` (string switch) | 733 | +40% |
| `buildFastParseV6` (inline check) | 893 | +71% |
| `buildFastParseV7` (bitwise) | 914 | +75% |
| **`buildFastParseV8` (case-insensitive)** | **934** | **+79%** |

### Parse — invalid inputs

| Method | ops/sec |
|---|---:|
| `parse` | 90,087 |
| `buildFastParse` (current/v9) | 761,701 |
| `buildFastParseV0` (trie toLowerCase) | 729,007 |
| **`buildFastParseV8` (case-insensitive)** | **802,770** |

### Format — valid inputs

| Method | ops/sec | vs vercel/ms |
|---|---:|---:|
| `vercel/ms` short | 4,329 | baseline |
| `vercel/ms` long | 3,967 | baseline |
| `format` short | 129 | −97% |
| `format` long | 122 | −97% |
| `buildFastFormat` (current) short | 3,266 | −25% |
| `buildFastFormat` (current) long | 2,460 | −38% |

---

## Parse Implementation History

### v0: Trie with .toLowerCase() (original current)

**Strategy**: Trie traversal with `.toLowerCase()` preprocessing.

**How it works**:
1. Builds a trie from all notations in lowercase
2. Generates nested `switch` on charCode
3. Pre-processes input with `.toLowerCase()`

**Result**: Good performance but `.toLowerCase()` adds O(n) overhead.

---

### v1: Pre-built regex + switch

**Strategy**: Pre-build regex and switch at build time.

**Benchmark**: ~359 ops/sec

**Limitation**: Still uses regex engine for matching.

---

### v2: Char-by-char scan + Unicode property test

**Strategy**: Eliminate regex, use `/\p{L}/u` for notation boundary.

**Benchmark**: ~477 ops/sec

**Limitation**: Unicode property test has function call overhead.

---

### v3: CharCode ranges for notation boundary

**Strategy**: Pre-computed charCode ranges instead of Unicode test.

**Benchmark**: ~767 ops/sec

**Improvement**: +61% over v2

---

### v4: Length-based dispatch

**Strategy**: Group notations by length, dispatch by length first.

**Benchmark**: ~835 ops/sec

**Limitation**: Extra length check adds overhead.

---

### v5: String switches instead of charCode

**Strategy**: Use `s[i]` instead of `s.charCodeAt(i)`.

**Benchmark**: ~733 ops/sec

**Result**: Slower than charCode switches.

---

### v6: Inline boundary check

**Strategy**: Inline `isNotationChar` check instead of function call.

**Benchmark**: ~893 ops/sec

**Result**: Similar to v0, JIT already inlines well.

---

### v7: Bitwise range checks

**Strategy**: Use `(cc - 48) >>> 0 < 10` for digit detection.

**Benchmark**: ~914 ops/sec

**Result**: Good, but not significantly faster than comparisons.

---

### v8: Case-insensitive without .toLowerCase()

**Strategy**: Handle both uppercase and lowercase in the trie switch, avoiding `.toLowerCase()` entirely.

**Benchmark**: ~934 ops/sec (valid), ~802K ops/sec (invalid)

**Why fastest**: Avoids the O(n) `.toLowerCase()` overhead. For invalid inputs, this is a big win since parsing fails early.

---

### v9: Combined all optimizations (current)

**Strategy**: Combines all optimizations:
- Case-insensitive without `.toLowerCase()` (from v8)
- Inline boundary check (from v6)
- Bitwise digit detection (from v7)

**Benchmark**: ~890 ops/sec (valid), ~761K ops/sec (invalid)

**Result**: Slightly slower than v8 alone! The combined complexity doesn't help as much as the single biggest optimization (avoiding `.toLowerCase()`).

---

## Summary

### Parse Optimizations

| Approach | Result | Notes |
|----------|--------|-------|
| Pre-built regex + switch | +155% | Eliminates dictionary lookups |
| Char-by-char scan | +33% more | Eliminates regex engine |
| CharCode ranges | +52% more | Eliminates Unicode test |
| Trie traversal | +87% | Eliminates string allocation |
| Case-insensitive (v8) | **Best overall** | Avoids `.toLowerCase()` |

**Key insight**: The biggest win comes from avoiding `.toLowerCase()`. Combining all optimizations doesn't help as much as the single most impactful one.

### Format Optimizations

| Approach | Result | Notes |
|----------|--------|-------|
| Inline thresholds + notations | +1749% | Eliminates dictionary lookups |
| Separate short/long functions | Better for long | Eliminates branch prediction |