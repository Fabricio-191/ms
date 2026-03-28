# AGENTS.md

Agentic coding guide for `@fabricio-191/ms` — a TypeScript library for parsing and formatting millisecond durations with multilingual support.

## Project Overview

- **Type**: Node.js npm library (TypeScript, ESM-first)
- **Node**: >= 18.0.0
- **Build output**: `lib/esm/` (ESM) and `lib/cjs/` (CJS), auto-generated on `npm install` via `prepare`

## Commands

### Build Pipeline

```bash
npm run build        # lint + check:types + transpile (full pipeline)
npm run transpile    # tsup build (ESM + CJS + declarations → lib/)
```

### Type Checking & Linting

```bash
npm run lint         # ESLint with auto-fix (eslint ./ --fix)
npm run check:types  # tsc --noEmit (strict type checking)
```

### Testing

```bash
npm test             # transpile + jest (--experimental-vm-modules)
npm run bench        # transpile + tsx benchmarks/index.ts
```

**Run a single test file:**

```bash
npm run transpile && node --experimental-vm-modules node_modules/jest/bin/jest.js tests/en.test.ts
```

**Run a single test by name:**

```bash
npm run transpile && node --experimental-vm-modules node_modules/jest/bin/jest.js --testNamePattern="parses simple numbers"
```

## Code Style

### General

- **Indentation**: Tabs
- **Semicolons**: Always required
- **Quotes**: Single quotes preferred; double quotes allowed when required
- **Curly braces**: Multi-line or nest, consistent (`curly: ['error', 'multi-or-nest', 'consistent']`)
- **No `++` operators** except in loop afterthoughts (`no-plusplus`)
- **Function style**: Declaration preferred; arrow functions allowed
- **Padded blocks**: Never (`@stylistic/padded-blocks: 'error', 'never'`)

### Spacing

- **Array brackets**: Space inside `[ 1, 2, 3 ]` not `[1, 2, 3]`
- **Object braces**: Space inside `{ a: 1 }` not `{a: 1}`
- **Arrow function params**: No parens for single param `(x => x)` not `((x) => x)`
- **Function paren newlines**: Multiline arguments mode—break when args span multiple lines

### Operators

- **Operator linebreak**: After the operand (`a +\n  b` not `a\n  + b`)
- **Multiline ternary**: Always multiline with operands on separate lines, operators at end

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Classes | PascalCase | `Language`, `Notations` |
| Exported constants | SCREAMING_SNAKE_CASE | `TIMES`, `LANGUAGES`, `NEGATIVE_REGEX` |
| Functions/variables | camelCase | `buildFastParse`, `isPlainObject` |
| Types/interfaces | PascalCase | `LanguageData`, `Unit`, `Options` |
| Files | kebab-case | `fast-parse.ts` |
| Private/readonly class properties | Standard camelCase, use `readonly` modifier | `public readonly name` |

### Imports

- Use explicit `.ts` extensions in source imports: `import { X } from '../core/index.ts'`
- Use `import type` for type-only imports where appropriate
- Import test files from compiled `lib/esm/`, not source `src/`
- Node built-ins: Use `node:` prefix (`import { strictEqual } from 'node:assert'`)

### TypeScript

- **Strict mode is fully enabled** — no implicit `any`, no unsafe nulls
- `noUncheckedIndexedAccess: true` — array/index access may be undefined
- `exactOptionalPropertyTypes: true` — distinguish `T` from `T | undefined`
- `noImplicitOverride: true` — always use `override` keyword
- `noUnusedLocals: true` / `noUnusedParameters: true`
- Prefer interfaces over type aliases for object shapes
- Use `readonly` for immutable class properties
- Catch variables: `} catch (err: unknown) {`
- Use non-null assertion `!` only when certain; avoid it otherwise

### Error Handling

- Return `null` for invalid parse/format inputs (never throw)
- Throw `Error` for invalid options/arguments (use `new Error()`)
- Validate at function entry, not deep inside

```typescript
if (typeof str !== 'string' || str === '') return null;

if (typeof options !== 'object' || Array.isArray(options))
    throw new Error('Options should be an object');
```

### Control Flow

- Use explicit `switch` with `break`/`return` (no fallthrough)
- Prefer early returns over deep nesting
- Avoid nested ternaries; use `if/else` instead

### Comments & ESLint Disables

- `// #region name` and `// #endregion` for organizing large files
- `// eslint-disable-next-line rule-name` for line-specific disables
- Use `// @ts-expect-error -- explanation` when intentionally bypassing TS
- No requirement for capitalized first letter in comments

## API Conventions

- `format()` returns `string | null`
- All public APIs accept optional options objects with defaults
- Language abstraction via `Language` class; do not hardcode language strings
- Export types alongside values: `export { X, type XType }`

## Testing Conventions

- Test files: `tests/*.test.ts`, import from `../lib/esm/index.js`
- Use `describe`/`it` blocks from `@jest/globals`
- Helper utilities in `testing/benchmarks/utils.ts` (exported: `createArgs`, `check`, bench helpers)
- Use `check()` helper for approximate numeric equality
- Include edge cases: empty strings, negative numbers, whitespace, uppercase, plural forms, overflow
- All variants tested across all languages in `tests/all.test.ts`
- ASCII-only variants (v10, v11, v14-v17) skipped for Japanese tests (cannot parse non-ASCII)

## Project Structure

```
src/
  index.ts              # Public API exports: parse, format, buildFastParse (v25), buildFastFormat
  core/
    index.ts            # Language class, TIMES constants, Notations
    languages.ts        # Built-in Language definitions (en, es, ja)
    types.ts            # Type definitions
  parse/
    normal.ts           # Standard parse() — regex-based, multi-language
    fast.ts             # buildFastParseMulti() — multi-language fast parse
    variants/
      single/           # Active variants (v0-v9, v12-v13, v18-v25)
        v18.ts          # Single-pass scan (buildCore exported for JIT testing)
        v25.ts          # Flat-lookup variant (default buildFastParse)
      multi/            # Multi-language variants
  format/
    normal.ts           # Standard format() — multi-unit output
    variants/           # Format variants (v1, v2)
  utils/
    _trie.ts            # Trie infrastructure (buildTrie, collectCharRanges, buildBoundaryTable)
archive/                # ASCII-only variants (cannot parse Japanese/Chinese)
  v10.ts, v11.ts, v14-v17.ts  # Use bitwise | 0x20 or Uint8Array(128)
testing/
  benchmarks/
    jit.ts              # V8 JIT optimization status checker
    utils.ts             # createArgs(), check() utilities
tests/
  en.test.ts            # English parse/format + all buildFastParse/buildFastFormat consistency tests
  es.test.ts            # Spanish parse consistency tests
  ja.test.ts            # Japanese parse consistency tests
  format.test.ts        # format() unit tests
  all.test.ts           # All variants across all languages (ASCII-only skipped for Japanese)
lib/                    # Build output (gitignored)
```

## What to Avoid

- Do not use `any` — use `unknown` and narrow
- Do not add `// @ts-ignore` or `// @ts-expect-error` without good reason
- Do not use CommonJS `require()` in source files
- Do not modify `lib/` — it is auto-generated
- Do not use magic numbers; extract to named constants
- Do not use `for...in` loops on arrays (use `for...of` or indexed loops)
- Do not import from `src/` in test files—use `lib/esm/`

## JIT Optimization Notes

### V8 Optimization Status

All generated parse functions use `new Function()` to create code at runtime. V8's optimizer handles these as follows:

| Component | JIT Status | Notes |
|-----------|------------|-------|
| Wrapper `(str) => fn(arr, arr, str)` | TurboFan ✓ | Trivial function, fully optimized |
| Generated function `fn(arr, arr, str)` | Maglev only ✗ | Complex control flow (~150+ nesting levels) |

### Key Findings

- **Creation method doesn't matter**: `new Function()` vs `eval()` produces same results
- **Closure vs parameters doesn't matter**: Both approaches stay at Maglev
- **Code complexity is the bottleneck**: V8 TurboFan rejects functions with complex CFG

### Benchmark Commands

```bash
npm run bench              # Performance benchmarks (all variants)
node --allow-natives-syntax --import tsx/esm testing/benchmarks/jit.ts  # JIT status check
```

### Testing JIT Status

```bash
node --allow-natives-syntax --import tsx/esm testing/benchmarks/jit.ts
```

Uses `%GetOptimizationStatus(fn)` to check if functions reach TurboFan or stay at Maglev.

### Variant Exports

Active variants export `buildCore` for JIT testing:
```typescript
import { buildCore } from './parse/variants/v18.ts';
// Returns { fn, rootArr, boundaryArr } for direct function access
```

## Import Pattern

Direct imports from variant files (no barrel exports):

```typescript
// Main API from index
import { parse, format, buildFastParse } from '@src/index.ts';

// Specific variants (direct import)
import { buildFastParseV25 } from '@src/parse/variants/v25.ts';
import { buildCore } from '@src/parse/variants/v18.ts';

// Archive variants (ASCII-only, cannot parse Japanese)
import { buildFastParseV10 } from '../../archive/v10.ts';
```