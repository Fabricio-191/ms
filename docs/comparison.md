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
| ops/sec — short | 4,329 | 129 | **3,266** |
| ops/sec — long | 3,967 | 122 | 2,460 |

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

| Approach | ops/sec | Note |
|---|---:|---|
| `format` | 129 | Flexible but slow — dict lookups, multi-unit logic |
| `buildFastFormat` v1 (separate short/long fns) | — | Better branch prediction for long-form |
| `buildFastFormat` v2 (inlined constants) | — | Marginal improvement over v1 |
| **`buildFastFormat` (current)** | **3,266** | **+1749% vs `format`** — inline thresholds, no dict |
