# Project Summary (`@fabricio-191/ms`)

## What this project does

This project is a TypeScript/Node.js library to convert human-readable durations to milliseconds and back, with multilingual support (`en`, `es`, `ja`) and a set of generated fast paths.

---

## File-by-file overview

### Root configuration and metadata

- `.claude/settings.local.json`  
  Local Claude/Coding-agent permissions for this repo.

- `.github/workflows/tests.yml`  
  CI workflow definition (currently legacy and partially outdated against current scripts).

- `.gitignore`  
  Git ignore rules (`node_modules`, `lib`).

- `.npmignore`  
  npm package publish ignore rules.

- `LICENSE`  
  Apache 2.0 license text.

- `README.md`  
  Public usage docs and examples (some examples are older than current API contracts).

- `package.json`  
  Package metadata, exports map, scripts (`lint`, `check:types`, `transpile`, `test`, `bench`, `build`), dev dependencies.

- `package-lock.json`  
  npm lockfile with exact dependency tree versions.

- `tsconfig.json`  
  TypeScript compiler config with strict options and NodeNext module settings.

- `tsup.config.ts`  
  Build config to emit ESM and CJS bundles plus declaration files.

- `eslint.config.ts`  
  Lint/style configuration (ESLint + TypeScript + stylistic rules).

- `jest.config.js`  
  Jest config for CJS and ESM test files in `test/`.

- `project-summary.md`  
  This file: current architecture and recent changes summary.

### Documentation

- `docs/AddLanguage.md`  
  Guide for adding languages dynamically (currently references older APIs like `addLanguage`/`checkLanguage`).

### Source code (`src/`)

- `src/index.ts`  
  Main public entrypoint exports: core classes/constants, parse/format/clock, and fast APIs.

- `src/parse.ts`  
  Main duration parser. Supports one or multiple `Language` instances and merged parsing across those languages.

- `src/format.ts`  
  Main formatter from ms to human-readable duration using options like `long`, `length`, `format`, and `language`.

- `src/clock.ts`  
  Clock-like notation parser (`hh:mm:ss`, `mm:ss`, `-` separators, optional PM handling).

#### Fast path modules (`src/fast/`)

- `src/fast/parse.ts`  
  Generated parser factory using `Function(...)` and hardcoded switch bodies derived from language notations.

- `src/fast/format.ts`  
  Generated formatter factory using `Function(...)` and hardcoded unit branches, returning first non-zero unit.

#### Language modules (`src/languages/`)

- `src/languages/core.ts`  
  Core model:
  - `TIMES` constants
  - `Notations` class with constructor-level validation
  - `Language` class with constructor-level validation and regex dictionary parser

- `src/languages/languages.ts`  
  Built-in language registry (`LANGUAGES`) with `en`, `es`, and `ja` initialized as `Language` instances.

### Tests (`test/`)

- `test/ms.test.cjs`  
  CJS entry test that runs shared suite against CJS bundle.

- `test/ms.test.mjs`  
  ESM entry test that runs shared suite against ESM bundle.

- `test/suite.cjs`  
  Shared functional test suite for parse/format/clock/fast paths and language behavior.

### Benchmarks (`test/bench/`)

- `test/bench/index.js`  
  Benchmark runner entrypoint and version reporting.

- `test/bench/bench-utils.js`  
  Benchmark helper utilities and common suite runner.

- `test/bench/benchs/notation-to-time.js`  
  Parse benchmark versus `vercel/ms` (`parse` and `fastParse`).

- `test/bench/benchs/simple-format.js`  
  Format benchmark versus `vercel/ms` (`format` and `fastFormat`).

### Build outputs (`lib/`)

- `lib/esm/index.js`  
  Generated ESM bundle.

- `lib/esm/index.d.ts`  
  Generated ESM TypeScript declarations.

- `lib/cjs/index.cjs`  
  Generated CJS bundle.

- `lib/cjs/index.d.cts`  
  Generated CJS TypeScript declarations.

---

## Latest changes made (recent sessions)

1. **Validation moved into constructors**
   - Robust checks are now in `Notations` and `Language` constructors (`src/languages/core.ts`).

2. **Language management API simplified**
   - Removed `checkLanguage` and `addLanguage` helpers.
   - Languages are now expected to be created/managed directly with `new Language(...)` and `LANGUAGES` assignment.

3. **`parse` contract tightened**
   - `parse` now accepts only `Language` instances (`Language | Language[]`) as second argument.
   - String language names and `'all'` token were removed from the contract.

4. **`format` contract tightened (latest)**
   - `format` now accepts only `Language` instances in options (`language?: Language`).
   - String language names are no longer accepted.

5. **Fast modules reworked to hardcoded generation**
   - `src/fast/parse.ts` and `src/fast/format.ts` now generate specialized functions via `Function(...)` with hardcoded bodies per language.

6. **Benchmark location normalized**
   - Benchmarks were moved from `temp/` to `test/bench/` and scripts updated accordingly.

7. **Tests and benches updated for new API contracts**
   - Test/bench callers were migrated to pass `Language` instances where required.

---

## Current note

- Some docs/CI files still reference older APIs or script names and may need a documentation/CI cleanup pass to match the current implementation contracts.
