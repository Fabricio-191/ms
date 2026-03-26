# JIT Optimization Status

Analysis of how V8 compiles the functions in this library, measured with `%GetOptimizationStatus`
on Node.js v24.11.1 (V8 13.x) after 20,000 warmup calls per function.

Run with:

```
npm run bench:jit
```

## Results

| Function | What is inspected | V8 Status | Raw | Tier |
|---|---|---|---|---|
| `parse` | the function itself | Optimized + Interpreted | 81 | Maglev |
| `buildFastParse` — wrapper | thin closure over the bound fn | Optimized + TurboFan | 49 | TurboFan |
| `buildFastParse` — raw fn | the generated fn before `.bind()` | Maglev | 33793 | Maglev |
| `buildFastParseV23` — wrapper | early-return variant | Optimized + TurboFan | 49 | TurboFan |
| `buildFastParseV23` — raw fn | the generated fn before `.bind()` | Maglev | 33793 | Maglev |
| `buildFastParseMulti` | the function itself | Optimized + Interpreted | 81 | Maglev |
| `format` | the function itself | Optimized + Interpreted | 81 | Maglev |
| `buildFastFormat` | the function itself | Optimized + TurboFan | 49 | TurboFan |

**The wrapper and the generated function are compiled independently.** The wrapper reaches TurboFan;
the generated `fn` inside `buildFastParse` stays at Maglev. They are separate compilation units in V8.

## What the tiers mean

In Node.js v24, V8 has a three-tier compilation pipeline:

```
Interpreter → Maglev (tier 2) → TurboFan (tier 3)
```

- **Interpreter**: bytecode, no JIT. Used for cold or rarely-called code.
- **Maglev**: fast JIT compiler. Optimizes most hot functions. Keeps bytecode as fallback for deoptimization.
- **TurboFan**: the highest optimization tier. Fully compiled, no bytecode fallback. Reserved for functions with perfectly stable shapes and types.

The raw status values are bitmasks from `%GetOptimizationStatus`:

| Bit | Value | Meaning |
|---|---|---|
| `kOptimized` | 16 | Compiled by an optimizing JIT |
| `kTurboFanned` | 32 | Specifically compiled by TurboFan |
| `kInterpreted` | 64 | Still has interpreter bytecode (Maglev coexists with it) |

`parse` / `format` / `buildFastParseMulti` return status `81` (16 + 64 + 1) — Maglev with bytecode backup.
`buildFastParse` / `buildFastFormat` return status `49` (16 + 32 + 1) — full TurboFan.

## Why the fast variants reach TurboFan (and which part actually does)

`buildFastFormat` returns a plain closure — V8 compiles it directly to TurboFan.

`buildFastParse` is more nuanced. It returns `fn.bind(null, rootArr, boundaryArr)`, and the benchmark
exposes both the wrapper and the raw `fn` separately:

- **Wrapper** → TurboFan (status 49): V8 sees the wrapper as a simple, monomorphic hot function and promotes it to TurboFan.
- **Raw `fn`** → Maglev (status 33793): the generated function itself stays at Maglev. V8 treats them as independent compilation units.

This means TurboFan status on the wrapper does **not** imply TurboFan on the generated function. V8
may inline `fn` into the wrapper's TurboFan code, but `fn` as a standalone compilation unit stays at Maglev.

The generated functions have favorable properties for optimization:

- **Fixed types**: always receive `string`, always return `number | null`. No polymorphism.
- **Stable shapes**: operate on primitives and pre-closed `Uint8Array` references only.
- **No deopt triggers**: no `arguments`, no `try/catch` in hot paths, no type-changing branches.

The regular functions (`parse`, `format`) are more generic — they accept `Language` objects, dispatch
through regex or object methods, and handle varied input — so Maglev is the stable tier for them.

## Notes on `%GetOptimizationStatus` in Node.js v24

### Bound functions crash

`buildFastParse` internally returns `fn.bind(null, rootArr, boundaryArr)`, which creates a
`JSBoundFunction` in V8's type system (distinct from `JSFunction`). Calling
`%GetOptimizationStatus` on a bound function in Node.js v24+ triggers a fatal error:

```
# Fatal error in , line 0
# Check failed: v8_flags.fuzzing.
```

The V8 source uses `CHECK_UNLESS_FUZZING(IsJSFunction(*fn))` — when the function is not a
`JSFunction` and fuzzing mode is off, it falls through to `CHECK(v8_flags.fuzzing)` which fails.

The benchmark works around this by wrapping the bound function in a thin closure:

```ts
const fastParseBound = buildFastParse(LANGUAGES.en);
const fastParseWrap  = (s: string): number | null => fastParseBound(s);
// getOptStatus(fastParseWrap) — NOT the generated fn inside
```

**What this actually checks**: the optimization status of `fastParseWrap` (the wrapper), not the
generated function created by `new Function(source)` inside `buildFastParse`. The generated
function is not accessible from outside `buildFastParse`.

The call chain is:
```
fastParseWrap(s)             ← inspected: TurboFan
  → fastParseBound(s)        ← JSBoundFunction, cannot be inspected
    → fn(rootArr, BOUND, s)  ← generated JSFunction, also not accessible
```

The TurboFan status on the wrapper means V8 optimized the call path that invokes `buildFastParse`'s
output. Whether V8 also inlined `fn` into the wrapper depends on its inlining heuristics — it likely
does after 20,000 warmup calls, but this benchmark does not verify that directly.

### `%OptimizeFunctionOnNextCall` is restricted in Node.js v24

In Node.js v24 (V8 13.x), calling `%OptimizeFunctionOnNextCall` outside of fuzzing mode crashes
with the same fatal error. It was moved behind the `--fuzzing` flag. The benchmark relies solely
on natural warmup (20,000 calls) which is sufficient for V8 to identify and JIT-compile hot functions.

## Experiment: v23 TurboFan-Optimized Variant

v23 was created to test if removing labeled statements and using early returns would help V8
reach TurboFan for the generated function. The hypothesis was that labeled statements (`notationBlock:`
with `break`) might prevent TurboFan optimization.

### Changes in v23

1. **No labeled statements** — replaced `break notationBlock` with `return neg ? -v : v`
2. **No inline comments** — removed all comments from generated code for cleaner parsing
3. **Compact variable names** — `v` instead of `value`, `mc` instead of `matchCount`, etc.
4. **`var` instead of `const/let`** — simpler for V8's scope analysis

### Results

| Variant | Raw fn Status | Validops/sec | Invalid ops/sec |
|---------|---------------|-------------- | -----------------|
| v18     | Maglev (33793)| 208,333      | 178,571          |
| v23     | Maglev (33793)| **222,222**      | 175,439          |

**Key findings:**

1. **Labeled statements do NOT block TurboFan** — both v18 and v23 reach the same Maglev status
2. **Both variants reach Maglev, not TurboFan** — the limiting factor is likely:
   - Function size (generated code is large due to trie switches)
   - `new Function()` creation (V8 may treat dynamic functions more conservatively)
   - Cyclomatic complexity (many branches in the trie matching)
3. **v23 is ~6.7% faster on valid inputs** despite identical JIT status
4. **Performance difference comes from code compactness**, not JIT tier

### Conclusion

The generated function's Maglev status is likely the ceiling for this pattern. The code size and
complexity from the language-specific trie prevent TurboFan from being worthwhile for V8's heuristics.
However, Maglev is already highly optimized — v23 achieves 222K ops/sec, making it the fastest
single-unit parser variant tested.
