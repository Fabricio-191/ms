# Method Comparison

Comparison of all parse/format methods available in `@fabricio-191/ms` vs `vercel/ms`.

> Benchmarks measured with [tinybench](https://github.com/tinylibs/tinybench) on Node.js v24.11.1.  
> Each benchmark runs for 1 second (p50 median latency), over 100 random samples.

---

## Quick Comparison

### Parse

| Feature | `vercel/ms` | `buildParse` |
|---|---|:---:|
| Multiple languages | ❌ | ✅ |
| Multi-unit input (`2h 30m`) | ❌ | ✅ |
| Decimal numbers (`2.5h`) | ✅ | ✅ |
| Negative numbers (`-2h`) | ✅ | ✅ |
| Number-only input (`"100"`) | ✅ | ✅ |
| Requires one-time build | ❌ | ✅ |
| **ops/sec — single-unit** | **~727** | **~3,199** (4.4× faster) |
| **ops/sec — multi-unit** | ❌ | **~61K** |
| **ops/sec — invalid** | **Error** | **~1,643** |

### Format

| Feature | `vercel/ms` | `buildFormat` |
|---|---|:---:|
| Multiple languages | ❌ | ✅ |
| Multi-unit output (`2h 30m 15s`) | ❌ | ✅ |
| Configurable output length | ❌ | ✅ (1–8 units) |
| Custom unit selection (`format: 'HMS'`) | ❌ | ✅ |
| Long form (`2 hours`) | ✅ | ✅ |
| Negative values | ❌ | ✅ |
| Requires one-time build | ❌ | ✅ |
| **ops/sec — short** | **~2,661** | **~3,750** (l=1) / **~1,707** (l=3) |
| **ops/sec — long** | **~2,009** | **~3,605** (l=1) / **~1,287** (l=3) |

> `buildParse` / `buildFormat` require calling the builder once per language/options combination.

### Benchmark Results vs `vercel/ms`

Measured on Node.js v24.11.1 with [tinybench](https://github.com/tinylibs/tinybench) (1s runs, p50 median).

**Parse — single-unit valid:**
| Method | ops/sec | vs vercel/ms |
|---|---|---:|
| `vercel/ms` | ~727 | baseline |
| `buildParse` (v42) | ~3,199 | **4.4× faster** |

**Parse — invalid input:**
| Method | ops/sec | Notes |
|---|---|---|
| `vercel/ms` | Error | Throws on empty/invalid input |
| `buildParse` (v42) | ~1,643 | Returns `null` gracefully |

**Format — short (single-unit):**
| Method | ops/sec | vs vercel/ms |
|---|---|---:|
| `vercel/ms` | ~2,661 | baseline |
| `buildFormat` (v16, l=1) | ~3,750 | **1.4× faster** |
| `buildFormat` (v16, l=3) | ~1,707 | −36% (more output) |

**Format — long (single-unit):**
| Method | ops/sec | vs vercel/ms |
|---|---|---:|
| `vercel/ms` | ~2,009 | baseline |
| `buildFormat` (v16, l=1) | ~3,605 | **1.8× faster** |
| `buildFormat` (v16, l=3) | ~1,287 | −36% (more output) |

---

## API Usage

### `vercel/ms`

```js
const ms = require('ms');
ms('2 hours');      // 7200000
ms(7200000);        // '2h'
ms(7200000, true);  // '2 hours'
```

### `@fabricio-191/ms`

```js
import { buildParse, buildFormat, LANGUAGES } from '@fabricio-191/ms';

// Parse — build once, use many times
const parse = buildParse(LANGUAGES.en);
parse('2 hours');   // 7200000

// Format — build once, use many times  
const format = buildFormat({ long: true });
format(7200000);    // '2 hours'
```

---

## Parse Implementation History

Evolution of the parse function from regex-based to the current code-generated approach.

### Phase 1: Early Variants (v5–v19)

Establishing the baseline. v9 is the reference point for comparisons.

| Version | Strategy | Single-unit | Multi-unit | Invalid | vs v9 |
|---|---|---:|---:|---:|---:|
| v5 | String switch (`s[i]`) | 100K | 26K | 141K | −12% |
| v6 | Inline boundary check | 98K | 32K | 147K | −14% |
| v7 | Bitwise digit detection | 127K | 35K | 156K | +11% |
| v8 | Case-insensitive trie (no `.toLowerCase()`) | 111K | 29K | 156K | −2% |
| **v9** | **Combined v6+v7+v8 (baseline)** | **114K** | **31K** | **161K** | baseline |
| v10 | `\| 0x20` inline normalization | 120K | 32K | 164K | +6% |
| v11 | +int accumulation, sign scan, root dispatch, path compression | 143K | 49K | 156K | +26% |
| v12 | +early exit on first non-digit char | 109K | 30K | 152K | −4% |
| v13 | +pre-scan for any digit | 111K | 30K | 154K | −2% |
| v14 | v11 + early exit (5 opts) | 143K | 48K | 156K | +26% |
| v15 | +manual decimal accumulation | 182K | 48K | 167K | +60% |
| v16 | +boundary lookup table at terminals | 141K | 58K | 161K | +24% |
| v17 | All 7 opts | 192K | 57K | 172K | +69% |
| **v18** | **+single-pass scan+accumulate** | **213K** | **61K** | **175K** | **+87%** |
| v19 | +unrolled digit fast path | 200K | 61K | 169K | +76% |

**Key insights from Phase 1:**
- **v8 (no `.toLowerCase()`)**: Biggest single win — eliminates one O(n) string allocation per call.
- **v11 (path compression)**: Long notations like `"milliseconds"` become consecutive `charCodeAt` checks.
- **v15 (manual decimal) + v16 (boundary table)**: Each ~25–60% gain; combined in v17 they compound.
- **v18 (single-pass accumulation)**: Separates integer and decimal paths so the hot loop has exactly one condition per digit. First variant to win all three categories simultaneously.
- **v19 (unrolling) hurts**: V8 TurboFan already unrolls short loops — explicit unrolling increases code size.

### Phase 2: Notation Matching (v20–v36)

After v18, the bottleneck shifted to **notation matching**. All variants share the same number-parsing code.

| Version | Strategy | JIT tier | Valid ops/sec | vs v25 |
|---|---|:---:|---:|---:|
| v20 | Trie with path compression | Maglev | ~1,800K | −18% |
| v21 | Trie + boundary table | Maglev | ~1,900K | −13% |
| v22 | Flat if-chains (manual) | Maglev | ~2,050K | −6% |
| v23 | craftFunction, trie | Maglev | ~2,100K | −4% |
| **v25** | **Flat if-chains via code gen** | **Maglev** | **~2,182K** | **baseline** |
| v26 | Flat lookup variant | Maglev | ~2,150K | −1% |
| v27 | DFA transition table | **TurboFan** | ~1,800K | −18% |
| v28 | DFA + compressed transition table | **TurboFan** | ~1,820K | −17% |
| v29 | craftFunction, compressed DFA | **TurboFan** | ~1,813K | −17% |
| v31 | eval closure, compressed DFA | **TurboFan** | ~1,813K | −17% |
| v32 | craftFunction, trie (v23 rewrite) | Maglev | ~2,100K | −4% |
| v33 | `\|0x20` merged case groups | Maglev | ~2,157K | −1.3% |
| v34 | v33 + Float64Array MULT1 fast path | Maglev | ~2,098K | −3.9% |
| v35 | Table-driven packed ENTRIES | **TurboFan** | ~1,975K | −9.5% |
| v36 | Dual-hash scan loop | **TurboFan** | ~1,751K | −18.7% |

**Key insights from Phase 2:**
- **Maglev inline beats TurboFan table** (v25 vs v35): Flat if-chains with compile-time literals stay in L1 cache. Table-driven approaches add memory latency.
- **`|0x20` case folding hurts** (v33): Merging `'y'`/`'Y'` blocks is slower than two separate `if` checks. V8's branch predictor handles literal-constant flat ifs so well that the bitwise operation adds overhead.
- **Single-char fast path hurts** (v34): The O(1) path adds an extra array lookup + branch. For ~50% multi-char inputs, miss cost exceeds hit savings.
- **TurboFan ceiling**: All TurboFan attempts landed 10–20% below v25's Maglev performance. The code size and complexity from trie matching prevent TurboFan from being worthwhile.

### Phase 3: Fine-Tuning (v40–v47)

Targeted experiments on v25 to find any single change that could improve it.

| Version | Change | Valid ops/sec | vs v25 |
|---|---|---:|---:|
| **v25** | **Baseline (flat if-chains, longest-first)** | **~2,055** | baseline |
| v40 | `switch(c0)` outer dispatch | ~2,121 | +0.8% |
| v41 | `const c1` per-group cache | ~1,840 | −4.3% |
| v42 | `_avail = len - i` length guard | ~1,935 | −3.2% |
| v43 | switch + `_avail` combined | ~2,106 | +0.8% |
| v44 | MULT1 single-char O(1) fast path | ~1,920 | −1.9% |
| v45 | STARTS[128] quick-rejection bitset | ~1,904 | −3.3% |
| v46 | Single-char entries first (all groups) | ~1,851 | −3.7% |
| v47 | Single-char first (uniform-mult groups only) | ~1,770 | −6.3% |

**Key insights from Phase 3:**
- **`switch(c0)` (v40) is the most consistent winner** (+4.8% valid CV, stable across rounds). V8 compiles sparse switch with binary-search dispatch.
- **Combinations are not additive** (v43 ≤ v40): switch dispatch and `_avail` optimize the same pipeline stage.
- **Single-char-first ordering always loses** (v46/v47): BOUND contains every char that appears *anywhere* in any notation. For the 50/50 short/long distribution, this trade-off is negative.
- **v25 and v42 are statistically indistinguishable** — the difference is within measurement noise. Both remain active variants.

### Phase 4: Micro-Optimizations (v37–v39)

Isolated experiments changing exactly ONE thing from v25.

| Version | Change | Valid ops/sec | vs v25 |
|---|---|---:|---:|
| v37 | Merged case groups + outer if/else | ~2,217 | +0.3% |
| v38 | c1 cache (`var c1=charCodeAt(i+1)` per group) | ~2,089 | −5.5% |
| v39 | Simplified boundary (2 conditions) | ~1,705 | −22.8% |

**Key insights from Phase 4:**
- **Flat `if` beats `else if` for ILP** (v37): `else if` creates sequential dependency chains that prevent CPU instruction-level parallelism.
- **Unconditional c1 cache hurts** (v38): Computing `charCodeAt(i+1)` on every group entry costs more than it saves.
- **`_bci>=len` is load-bearing** (v39): Removing the length check causes `NaN` typed array access, preventing V8 from optimizing the function.

---

## Format Implementation History

| Version | Strategy | JIT tier | Short ops/sec | Long ops/sec | vs v2 |
|---|---|:---:|---:|---:|---:|
| v1 | `new Function`, 2 fns, short/long split | Interpreted | ~3,133 | ~2,958 | baseline |
| **v2** | **+inlined TIMES constants** | **Interpreted** | **~2,860** | **~2,660** | **baseline** |
| v3 | `craftFunction`, `var`, clean branches | Interpreted | **~3,600** | ~3,090 | **+26%** |
| v4 | +pos/neg path split | Interpreted | ~3,410 | ~3,210 | +19% |
| v5 | Merged short+long into one fn | Interpreted | ~3,540 | ~3,280 | +24% |
| v6 | v5 + `if(!long)` first | Interpreted | ~3,550 | **~3,300** | +24% |
| v7 | v6 + arrow wrapper (inlining test) | Interpreted | ~3,290 | ~3,115 | +15% |
| v8 | v6 + context variables | Interpreted | ~3,515 | ~3,283 | +23% |
| v9 | v3 inner fns + `craftFunction` dispatcher | Interpreted | **~3,634** | ~2,969 | **+24%** |
| **v16** | **Fully parametric (current)** | **TurboFan** | **~3,600** | **~3,300** | **+26%** |

**Key insights:**
- **`new Function` inner functions never reach Maglev or TurboFan** by themselves — regardless of call count or function size.
- **v3 wins via TurboFan inlining**: The static arrow wrapper reaches TurboFan and inlines the small `new Function` inner functions.
- **v16 (fully parametric)** generates a single function with all options baked in at build time — no runtime branching, reaches TurboFan directly.

---

## Archived Parse Variants (v1–v4)

| Version | Strategy | ops/sec | Why discarded |
|---|---|---:|---|
| v1 | Pre-built regex + switch | ~359 | Regex engine overhead even when pre-compiled |
| v2 | Char-by-char + `/\p{L}/u.test()` | ~477 | Unicode property test per char is slow |
| v3 | Inline charCode ranges + `slice`+switch | ~767 | `slice` allocation per match |
| v4 | Length-based dispatch | ~835 | Extra outer switch negates savings |
# Method Comparison

Comparison of all parse/format methods available in `@fabricio-191/ms` vs `vercel/ms`.

> Benchmarks measured with [tinybench](https://github.com/tinylibs/tinybench) on Node.js v24.11.1.
> Each benchmark runs for 1 second (p50 median latency), over 100 random samples.

## Parse

| Feature | `vercel/ms` | `parse` | `buildFastParse` |
|---|:---:|:---:|:---:|
| Multiple languages | ❌ | ✅ | ⚠️ one per instance |
| Multi-unit input (`2h 30m`) | ❌ | ✅ | ✅ |
| Decimal numbers (`2.5h`) | ✅ | ✅ | ✅ |
| Negative numbers (`-2h`) | ❌ | ✅ | ✅ |
| Number-only input (`"100"`) | ✅ | ✅ | ✅ |
| Requires one-time build | ❌ | ❌ | ✅ |
| ops/sec — single-unit | — | 17K | **213K** |
| ops/sec — multi-unit | — | 8K | **61K** |
| ops/sec — invalid | — | 25K | **175K** |

## Format

| Feature | `vercel/ms` | `format` | `buildFastFormat` |
|---|:---:|:---:|:---:|
| Multiple languages | ❌ | ✅ | ⚠️ one per instance |
| Multi-unit output (`2h 30m 15s`) | ❌ | ✅ | ❌ |
| Configurable output length | ❌ | ✅ (1–8 units) | ❌ |
| Custom unit selection (`format: 'HMS'`) | ❌ | ✅ | ❌ |
| Long form (`2 hours`) | ✅ | ✅ | ✅ |
| Negative values | ❌ | ✅ | ✅ |
| Requires one-time build | ❌ | ❌ | ✅ |
| ops/sec — short | 2,721 | 129 | **3,600** |
| ops/sec — long | 2,025 | 122 | **3,300** |

> `⚠️` = supported but with a constraint.
> `buildFastParse` / `buildFastFormat` require calling the builder once per language.
> `parse` accepts a `Language`, `Language[]`, or defaults to `LANGUAGES.en`.

---

## Parse Implementation History

Active bench: v5 onwards (v1–v4 archived). All ops/sec are approximate (1s runs, p50).

| Version | Strategy | Single-unit | Multi-unit | Invalid | vs v9 (single) |
|---|---|---:|---:|---:|---:|
| `parse` | Regex-based, multi-language | 17K | 8K | 25K | — |
| v5 | String switch (`s[i]`) | 100K | 26K | 141K | −12% |
| v6 | Inline boundary check | 98K | 32K | 147K | −14% |
| v7 | Bitwise digit detection | 127K | 35K | 156K | +11% |
| v8 | Case-insensitive trie (no `.toLowerCase()`) | 111K | 29K | 156K | −2% |
| **v9** | **Combined v6+v7+v8 (baseline)** | **114K** | **31K** | **161K** | baseline |
| v10 | `\| 0x20` inline normalization | 120K | 32K | 164K | +6% |
| v11 | +int accumulation, sign scan, root dispatch, path compression | 143K | 49K | 156K | +26% |
| v12 | +early exit on first non-digit char | 109K | 30K | 152K | −4% |
| v13 | +pre-scan for any digit | 111K | 30K | 154K | −2% |
| v14 | v11 + early exit (5 opts) | 143K | 48K | 156K | +26% |
| v15 | +manual decimal accumulation | 182K | 48K | 167K | +60% |
| v16 | +boundary lookup table at terminals | 141K | 58K | 161K | +24% |
| v17 | All 7 opts | 192K | 57K | 172K | +69% |
| **v18** | **+single-pass scan+accumulate (current)** | **213K** | **61K** | **175K** | **+87%** |
| v19 | +unrolled digit fast path | 200K | 61K | 169K | +76% |

**Key insights**:
- **No `.toLowerCase()` (v8)**: biggest single win — eliminates one O(n) string allocation per call.
- **Path compression (v11)**: long notation strings like `"milliseconds"` become consecutive `charCodeAt` checks; dominates on multi-unit inputs.
- **Early exit (v12, v13) hurts valid inputs** — checks that never trigger are still overhead. v14 integrates it cleanly into the existing sign scan.
- **Manual decimal (v15) + boundary table (v16)**: each ~25–60% gain; combined in v17 they compound.
- **Single-pass accumulation (v18)**: separates integer and decimal paths so the hot loop has exactly one condition per digit. First variant to win all three bench categories simultaneously (+87% single, +99% multi, +9% invalid vs v9).
- **Manual unrolling (v19) hurts**: V8 Turbofan already unrolls short loops — explicit unrolling increases code size and stresses JIT.

## Parse Optimization Experiments (v20–v35)

After v18 (single-pass accumulate), the focus shifted to **notation matching** — the only remaining bottleneck, since all variants share identical number-parsing code.

All experiments below use `craftFunction` and are benchmarked against v25 as baseline.

| Version | Strategy | JIT tier | Single-unit valid | Single-unit invalid | vs v25 (valid) |
|---|---|:---:|---:|---:|---:|
| v20 | Trie with path compression | Maglev | ~1,800K | — | −18% |
| v21 | Trie + boundary table | Maglev | ~1,900K | — | −13% |
| v22 | Flat if-chains (manual) | Maglev | ~2,050K | — | −6% |
| v23 | craftFunction, trie | Maglev | ~2,100K | ~1,700K | −4% |
| **v25** | **Flat if-chains via code gen (baseline)** | **Maglev** | **2,182** | **1,747** | **baseline** |
| v26 | Flat lookup variant | Maglev | ~2,150K | — | −1% |
| v27 | DFA transition table (first TurboFan attempt) | TurboFan | ~1,800K | — | −18% |
| v28 | DFA + compressed transition table | TurboFan | ~1,820K | — | −17% |
| v29 | craftFunction, compressed DFA | TurboFan | ~1,813 | — | −17% |
| v31 | eval closure, compressed DFA | TurboFan | ~1,813 | ~1,747 | −17% |
| v32 | craftFunction, trie (v23 rewrite) | Maglev | ~2,100K | — | −4% |
| v33 | `\|0x20` merged case groups + grouped if/else | Maglev | 2,157 | 1,688 | −1.3% |
| v34 | v33 + Float64Array MULT1 single-char fast path | Maglev | 2,098 | 1,712 | −3.9% |
| v35 | Table-driven packed ENTRIES (fixed-size body) | **TurboFan** | 1,975 | 1,694 | −9.5% |
| v36 | Dual-hash scan loop (fixed-size body) | **TurboFan** | 1,751 | 1,633 | −18.7% |

**Key findings from v20–v36**:

- **Maglev inline beats TurboFan table** (v25 vs v35, v29): Flat if-chains with compile-time literal constants benefit from V8's branch predictor and stay in L1 cache. Table-driven approaches spread the working set across typed arrays, adding memory latency that outweighs TurboFan's better codegen.
- **`|0x20` case folding hurts** (v33 < v25): Merging `'y'`/`'Y'` blocks from 40→20 groups with `(c0|0x20)===121` is *slower* than two separate `if(c0===121)` / `if(c0===89)` blocks. V8's branch predictor handles literal-constant flat ifs so well that the bitwise operation adds net overhead.
- **Single-char fast path hurts** (v34 < v25): The MULT1 array lookup + extra branch costs more than it saves at ~16% single-char hit rate in the benchmark distribution.
- **TurboFan table beats TurboFan DFA** (v35 > v29): Simpler data structure (linear group scan vs DFA state machine) — one indirection instead of two per char.
- **TurboFan dual-hash loses to TurboFan table** (v36=1751 < v35=1975): The incremental boundary check inside the scan loop triggers multiple HTAB lookups per notation (one per valid boundary point). Each lookup = 3 typed-array reads + the hash multiply per char. v35's single linear scan with one char-compare pass per entry is cheaper despite the nested loop.
- **The ceiling for notation-matching inline code** is v25 at ~2,153 ops/sec under Maglev. To go further would require reducing code size enough to reach TurboFan *and* keeping working sets small enough to match inline cache performance. All TurboFan attempts have landed 10–20% below that ceiling.

## Parse Fine-Tuning (v40–v47)

After establishing v25 as the ceiling for flat-lookup Maglev dispatch, eight targeted experiments explored whether any single-variable change could improve on it. All variants share the same number-parsing engine — only the notation dispatch differs.

Benchmarked with the definitive multi-round bench (6 rounds × 3s/task, interleaved order, sequential mode), reported as mean ops/sec across rounds.

| Version | Change | Valid | Invalid | CV% (valid) | vs v25 (combined) |
|---|---|---:|---:|:---:|---:|
| **v25** | **Baseline (flat if-chains, longest-first)** | **2,055** | **1,592** | 13.8% | baseline |
| **v42** | **`_avail = len - i` length guard** | **1,935** | **1,518** | 19.3% | −3.2% |
| v40 | `switch(c0)` outer dispatch | 2,121 | 1,583 | 4.8% | +0.8% |
| v43 | switch + `_avail` combined | 2,106 | 1,582 | 4.2% | +0.8% |
| v44 | MULT1 single-char O(1) fast path | 1,920 | 1,576 | 9.7% | −1.9% |
| v45 | STARTS[128] quick-rejection bitset | 1,904 | 1,546 | 16.1% | −3.3% |
| v41 | `const c1` per-group cache | 1,840 | 1,545 | 14.5% | −4.3% |
| v46 | Single-char entries first (all groups) | 1,851 | 1,553 | 17.3% | −3.7% |
| v47 | Single-char first (uniform-mult groups only) | 1,770 | 1,545 | 21.7% | −6.3% |

> Note: the high CV% on v25 and v42 in sequential mode reflects natural round-to-round variance in a 6-round quick run. The `'bench'` concurrency mode (all tasks concurrent) showed CV% <2% for all variants and placed v25 and v42 within 0.5% of each other.

**Key findings from v40–v47**:

- **`switch(c0)` alone (v40) is the most consistent winner** (+4.8% valid CV, stable across rounds). V8 compiles sparse switch with binary-search dispatch, eliminating the linear c0 scan. But it adds `break;` per case group, slightly increasing code size, so it doesn't reduce bytecode enough to reach TurboFan.

- **`_avail = len - i` (v42)** was hypothesized to reduce arithmetic pressure. The quick-bench numbers show inconsistent results (high CV). The definitive conclusion is that v25 and v42 are **statistically indistinguishable** — the difference is within measurement noise.

- **Combinations are not additive** (v43 ≤ v40): switch dispatch and `_avail` optimize the same pipeline stage. Combining them doesn't stack the gains.

- **MULT1 fast path hurts** (v44 −1.9%): The O(1) single-char path adds an extra array lookup + branch on every dispatch entry. For the bench distribution (~50% multi-char inputs), the miss cost exceeds the hit savings.

- **STARTS bitset hurts valid** (v45 −10% valid in quick run): `c0 < 128 && !STARTS[c0]` is an extra branch before every dispatch. For valid inputs where `STARTS[c0]=1`, it's pure overhead.

- **Single-char-first ordering always loses** (v46/v47): BOUND contains every char that appears *anywhere* in any notation — including 'o' (from "hour"), 'i' (from "minute"), etc. Single-char boundary checks fail for any multi-char notation input, adding a wasted check + branch misprediction. The 50/50 short/long format distribution in the bench makes this trade-off negative.

- **Non-ASCII bug in switch (v40/v43)**: The original `switch(c0)` implementation was missing `break;` at the end of each case block, causing fall-through to the next group for inputs where no notation matched (e.g., "1ys", "1añom"). Fixed by emitting `break;` before every case closing brace.

- **Non-ASCII bug in v44/v45**: `MULT1` and `STARTS` are ASCII-only arrays. v44 originally excluded all single-char entries from Phase 2 (breaking Japanese single-char notations). v45 originally rejected `c0 >= 128` before dispatch (breaking all non-ASCII notations). Both fixed.

**Final status**: v25 and v42 remain the active variants. They are within noise of each other and represent the practical ceiling for flat-lookup Maglev parse dispatch.

## Parse Micro-Optimizations (v37–v39)

Three isolated experiments targeting specific inefficiencies in v25's generated code.
Each variant changes exactly ONE thing from v25 to isolate its effect.

| Version | Change | Valid | Invalid | JIT | vs v25 (valid) |
|---|---|---:|---:|:---:|---:|
| v37 | Merged case groups + outer if/else | 2,217 | 1,683 | Maglev | +0.3% |
| v38 | c1 cache (`var c1=charCodeAt(i+1)` per group) | 2,089 | 1,691 | **unknown** | −5.5% |
| v39 | Simplified boundary (2 conditions) | 1,705 | 1,671 | **unknown** | −22.8% |

**Key findings from v37–v39**:

- **Flat `if` beats `else if` for ILP** (v37): Merging lo/up groups reduces c0 comparisons from 74→12 and charCodeAt calls from 546→273. Valid inputs improve slightly (+0.3%) but invalid inputs regress (−5.4%). Root cause: `else if` creates a sequential dependency chain that prevents CPU instruction-level parallelism. V8's flat `if` structure allows the CPU to pipeline independent branches simultaneously. The trade-off is unfavorable overall.

- **Unconditional c1 cache hurts** (v38 −5.5%, JIT degraded): `var c1=s.charCodeAt(i+1)` computed on group entry is called even when the length check `i+elen<=len` would fail first. The mandatory call costs more than the redundant calls it saves. Additionally, the larger function body (111 vs 75 lines) prevents V8 from reaching Maglev — JIT status 32769 (unknown) indicates the function is not being optimized.

- **`_bci>=len` is a JIT guard, not just a semantic check** (v39 −22.8%, JIT degraded): Removing the length check causes `s.charCodeAt(len)` → NaN → `BOUND[NaN]` typed array access with non-integer index. V8 cannot optimize functions with unpredictable typed array index types, leaving them unoptimized (status 32769). The `_bci>=len` condition prevents NaN from ever reaching the typed array and is essential for Maglev compilation. **Never remove it.**

- **v25's apparent redundancies are load-bearing** for JIT optimization. The flat if structure, the length guard before the typed array access, and the unconditional per-entry charCodeAt calls all contribute to a pattern that V8 Maglev compiles optimally. Removing any of them degrades either performance or JIT tier.

---

## Archived Parse Variants (v0–v4)

| Version | Strategy | Benchmark | Why discarded |
|---|---|---:|---|
| v1 | Pre-built regex + switch | ~359 ops/sec | Slowest — regex engine overhead even when pre-compiled |
| v2 | Char-by-char + `/\p{L}/u.test()` | ~477 ops/sec | Unicode property test per char is slow |
| v3 | Inline charCode ranges + `slice`+switch | ~767 ops/sec | `slice` allocation per match |
| v4 | Length-based dispatch | ~835 ops/sec | Extra outer switch negates savings |

---

## Format Implementation History

All ops/sec are approximate (1s runs, p50, 10K samples per iteration). Short = `long=false`, Long = `long=true`.

| Version | Strategy | JIT (inner fn) | Short | Long | vs v2 (short) |
|---|---|:---:|---:|---:|---:|
| `format` | Flexible, dict lookups, multi-unit | — | 129 | 122 | — |
| v1 | `new Function`, 2 fns, short/long split | Interpreted | ~3,133 | ~2,958 | baseline |
| **v2** | **+inlined TIMES constants** | **Interpreted** | **~2,860** | **~2,660** | **baseline** |
| v3 | `craftFunction`, `var`, `-ms`, clean branches | Interpreted | **~3,600** | ~3,090 | **+26%** |
| v4 | +pos/neg path split (eliminate empty-string concat) | Interpreted | ~3,410 | ~3,210 | +19% |
| v5 | Merged short+long into one fn (no wrapper) | Interpreted | ~3,540 | ~3,280 | +24% |
| v6 | v5 + `if(!long)` first + `neg` variable | Interpreted | ~3,550 | **~3,300** | +24% |
| v7 | v6 merged + arrow wrapper (inlining test) | Interpreted | ~3,290 | ~3,115 | +15% |
| v8 | v6 merged + context variables (bytecode size test) | Interpreted | ~3,515 | ~3,283 | +23% |
| v9 | v3 inner fns + `craftFunction` dispatcher | Interpreted | **~3,634** | ~2,969 | **+24%** |

**Key findings**:

- **`new Function` inner functions never reach Maglev or TurboFan** — regardless of call count (confirmed at 1M calls), function size, or whether data is inline vs context variables. V8 treats dynamically-generated functions differently from statically-defined ones.
- **v3 wins short via TurboFan inlining**: The static arrow wrapper `(ms, long) => long ? formatLong(ms) : formatShort(ms)` reaches TurboFan (status 49). TurboFan inlines the small `new Function` inner functions (8 branches each) into the wrapper — effective execution is TurboFan quality despite the inner functions reporting `Optimized + Interpreted`.
- **v4 loses despite sound theory**: Splitting positive/negative paths eliminates the empty-string prefix concat (`'' + value + 'y'` → `value + 'y'`), saving one string concat per positive call. But the outer `if(ms>=0)/else` branch adds a mandatory dependency on the critical path before any threshold check. The overhead exceeds the concat saving.
- **v6 wins long**: No wrapper overhead, no inline cache specialization for `long=false` that would penalize `long=true` calls. Consistent performance for both paths.
- **v7 proves the inlining threshold**: Adding an arrow wrapper to the merged function gives it a TurboFan caller, but the merged body (16 branches) exceeds TurboFan's inlining budget. The wrapper adds a call overhead with no inlining benefit — slower than both v3 (no inlining) and v6 (no wrapper).
- **v8 proves the threshold is instruction-count based**: Moving all literals to context variables changes `LdaConstant` (constant pool) to `LdaCurrentContextSlot` (closure slot) — both are single bytecode instructions. The inner function's bytecode instruction count is identical, TurboFan's inlining decision is unchanged. Performance matches v5/v6.
- **v9 confirms craftFunction dispatchers inline just like static arrows (short)**: Replacing the static arrow wrapper with a `craftFunction` dispatcher (`return long ? formatLong(ms) : formatShort(ms)`) that captures `formatShort`/`formatLong` as context locals produces identical short performance to v3 (~3,634 vs ~3,636). TurboFan inlines through `craftFunction` closures just as readily as through static arrow functions, as long as the callee is small enough. Long regresses (~2,969) because the dispatcher is a `new Function` — its inline cache for `long=true` is warmed separately from `long=false`, and the indirect call site has worse specialization than v6's single merged body.
- **Current ceiling**: short ~3,636 (v3/v9, TurboFan inlining); long ~3,300 (v6, Optimized + Interpreted). No single approach wins both simultaneously.

## Format Optimization Experiments (v10–v15)

After establishing the v5/v6 ceiling, six variants explored whether `Math.trunc`, specialized functions, threshold splits, or loop-based dispatch could improve performance.

All results below use 1s runs, p50, 10K samples per iteration. JIT status via `--allow-natives-syntax`.

| Version | Strategy | JIT | Short | Long | vs v6 (short) |
|---|---|:---:|---:|---:|---:|
| **v6** | **Merged, short-first, neg var (baseline)** | Interpreted | 3,524 | 3,145 | baseline |
| v10 | `Math.trunc` instead of `Math.floor` | Interpreted | 3,489 | **3,112** | −1% |
| **v11** | **Two specialized craftFns (short + long), arrow dispatch** | **TurboFan (wrapper)** | **3,577** | 3,003 | **+1.5%** |
| v12 | v11 + `craftFunction` dispatcher (not arrow) | TurboFan (dispatcher) | 3,565 | 3,021 | +1.2% |
| v13 | Merged + threshold split at H (pivot=3600000) | Interpreted | 3,471 | 2,933 | −1.5% |
| v14 | Loop over Float64Array thresholds (fixed body) | Interpreted | 3,080 | 2,962 | −12.9% |
| **v15s** | **Specialized short fn + threshold split** | **Interpreted** | **3,541** | 3,092 | +0.5% |
| **v15l** | **Specialized long fn + threshold split** | **Interpreted** | 3,302 | **3,155** | −6.3% |

**Key findings**:

- **`Math.trunc` is neutral** (v10): For `long=false` (short path), `Math.trunc` is marginally slower than `Math.floor` (−1%). For `long=true` (long path), also neutral. V8 Maglev already handles `Math.floor` efficiently for non-negative operands — the bytecode difference doesn't affect JIT tier or throughput measurably.

- **Two specialized functions reach TurboFan** (v11/v12): Splitting the merged body into `formatShort` + `formatLong` makes each function small enough for TurboFan promotion. Critically: it's the **tiny dispatch wrapper** (`(ms, long) => long ? longFn : shortFn`) that V8 marks as TurboFan, not the inner functions. TurboFan inlines the inner functions through the wrapper — the same mechanism observed in v3/v9.

- **TurboFan wins short but loses long** (v11): For `long=false`, the TurboFan-inlined short path is ~1.5% faster. For `long=true`, the dispatcher must redirect to `longFn` — the call still goes through the wrapper's TurboFan-compiled body, but the target is different from the warmup profile, slightly degrading long performance vs v6's single monolithic function.

- **`craftFunction` dispatcher = arrow dispatcher** (v12 ≈ v11): v9 already confirmed this. `craftFunction` closures inline through TurboFan exactly like static arrows when the callee is small enough.

- **Threshold split hurts on uniform samples** (v13 < v6): Splitting at H=3600000 (median threshold) creates a 50/50 branch that is maximally unpredictable for uniform random samples. Branch mispredictions cost more than the saved comparisons. For real-world workloads dominated by sub-second values (S/M/Ms), the split would be a net win. In bench, it's −1.5%.

- **Loop over threshold table is always slower** (v14 −12.9%): Despite the fixed bytecode body, `T[i]` typed array access inside a loop has higher latency than a static literal in an if-chain. The branch predictor handles sequential `if(a>=T)` checks with literal constants far better than loop-carried array index accesses. TurboFan alone cannot overcome this memory pattern penalty.

- **Specialized + split (v15s/v15l)**: Eliminating `if(!long)` saves one branch per call. v15s gains +0.5% over v6 for short — less than v11's TurboFan gain (+1.5%). v15l is the best variant for the long path (+0.3% over v6), combining the split with the eliminated dispatch branch, though the threshold split penalty partially offsets this.

**Final status**: **v11 is fastest for short output** (most common case, +1.5% over v6, TurboFan). **v15l is fastest for dedicated long output** (+0.3% over v6). **v6 remains the best single function for mixed short/long workloads**. Archived: v13 (threshold split, uniform-sample penalty), v14 (loop table, memory latency dominates).
