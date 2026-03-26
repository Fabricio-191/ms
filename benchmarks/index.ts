import { Bench } from 'tinybench';
import vercelMs from 'ms';

import {
	LANGUAGES,
	format,
	parse,
} from '../lib/esm/index.js';
import { createArgs, check, INVALID_INPUTS, type FormatArgs } from './utils.ts';
import { buildFastParse as buildFastParseV0 } from '../src/parse/variants/single/v0.ts';
import { buildFastParse as buildFastParseV1 } from '../src/parse/variants/single/v1.ts';
import { buildFastParse as buildFastParseV2 } from '../src/parse/variants/single/v2.ts';
import { buildFastParse as buildFastParseV3 } from '../src/parse/variants/single/v3.ts';
import { buildFastParse as buildFastParseV4 } from '../src/parse/variants/single/v4.ts';
import { buildFastParse as buildFastParseV5 } from '../src/parse/variants/single/v5.ts';
import { buildFastParse as buildFastParseV6 } from '../src/parse/variants/single/v6.ts';
import { buildFastParse as buildFastParseV7 } from '../src/parse/variants/single/v7.ts';
import { buildFastParse as buildFastParseV8 } from '../src/parse/variants/single/v8.ts';
import { buildFastParse as buildFastParseV9 } from '../src/parse/variants/single/v9.ts';
import { buildFastParse as buildFastParseV12 } from '../src/parse/variants/single/v12.ts';
import { buildFastParse as buildFastParseV13 } from '../src/parse/variants/single/v13.ts';
import { buildFastParse as buildFastParseV18 } from '../src/parse/variants/single/v18.ts';
import { buildFastParse as buildFastParseV19 } from '../src/parse/variants/single/v19.ts';
import { buildFastParse as buildFastParseV20 } from '../src/parse/variants/single/v20.ts';
import { buildFastParse as buildFastParseV21 } from '../src/parse/variants/single/v21.ts';
import { buildFastParse as buildFastParseV22 } from '../src/parse/variants/single/v22.ts';
import { buildFastParse as buildFastParseV23 } from '../src/parse/variants/single/v23.ts';
import { buildFastParse as buildFastParseV25 } from '../src/parse/variants/single/v25.ts';
import { buildFastParse as buildFastParseV10 } from '../archive/parse/v10.ts';
import { buildFastParse as buildFastParseV11 } from '../archive/parse/v11.ts';
import { buildFastParse as buildFastParseV14 } from '../archive/parse/v14.ts';
import { buildFastParse as buildFastParseV15 } from '../archive/parse/v15.ts';
import { buildFastParse as buildFastParseV16 } from '../archive/parse/v16.ts';
import { buildFastParse as buildFastParseV17 } from '../archive/parse/v17.ts';
import { buildFastParseMulti } from '../src/parse/fast.ts';
import { createRequire } from 'module';

const parseVariants = {
	'vercel/ms': vercelMs,
	normal: (s: string): number | null => parse(s, LANGUAGES.en),
	v0: buildFastParseV0(LANGUAGES.en),
	v1: buildFastParseV1(LANGUAGES.en),
	v2: buildFastParseV2(LANGUAGES.en),
	v3: buildFastParseV3(LANGUAGES.en),
	v4: buildFastParseV4(LANGUAGES.en),
	v5: buildFastParseV5(LANGUAGES.en),
	v6: buildFastParseV6(LANGUAGES.en),
	v7: buildFastParseV7(LANGUAGES.en),
	v8: buildFastParseV8(LANGUAGES.en),
	v9: buildFastParseV9(LANGUAGES.en),
	v10: buildFastParseV10(LANGUAGES.en),
	v11: buildFastParseV11(LANGUAGES.en),
	v12: buildFastParseV12(LANGUAGES.en),
	v13: buildFastParseV13(LANGUAGES.en),
	v14: buildFastParseV14(LANGUAGES.en),
	v15: buildFastParseV15(LANGUAGES.en),
	v16: buildFastParseV16(LANGUAGES.en),
	v17: buildFastParseV17(LANGUAGES.en),
	v18: buildFastParseV18(LANGUAGES.en),
	v19: buildFastParseV19(LANGUAGES.en),
	v20: buildFastParseV20(LANGUAGES.en),
	v21: buildFastParseV21(LANGUAGES.en),
	v22: buildFastParseV22(LANGUAGES.en),
	v23: buildFastParseV23(LANGUAGES.en),
	v25: buildFastParseV25(LANGUAGES.en),
};

const N = 100;
// Expand to N samples by cycling — 17 raw inputs is below timer resolution on Windows
const INVALID_SAMPLES = Array.from({ length: N }, (_, i) => INVALID_INPUTS[i % INVALID_INPUTS.length]!);
const PARSE_SAMPLES_EN = Array.from({ length: N }, () => createArgs(true, true));
// Samples compatible with vercel/ms — input from format(), expected from what vercel actually parses
const PARSE_SAMPLES_VERCEL = Array.from({ length: N }, (): FormatArgs => {
	const args = createArgs(true, true);
	const input = format(args.expected, args.options) ?? '';
	const expected = vercelMs(input) ?? args.expected;
	return { ...args, input, expected };
});
const MULTI_PARSE_SAMPLES = Array.from({ length: N }, () => createArgs(true, false, LANGUAGES.en));

// ─── Parse single-unit — valid ────────────────────────────────────────────────

const parseSingleValidBench = new Bench({ time: 1_000 });

parseSingleValidBench
	.add('vercel/ms', benchParse(parseVariants['vercel/ms'], PARSE_SAMPLES_VERCEL))
	.add('parse', benchParse(parseVariants.normal, PARSE_SAMPLES_VERCEL))
	.add('v0 trie', benchParse(parseVariants.v0, PARSE_SAMPLES_VERCEL))
	.add('v1 regex switch', benchParse(parseVariants.v1, PARSE_SAMPLES_VERCEL))
	.add('v2 isLetter', benchParse(parseVariants.v2, PARSE_SAMPLES_VERCEL))
	.add('v3 charCode boundary', benchParse(parseVariants.v3, PARSE_SAMPLES_VERCEL))
	.add('v4 length dispatch', benchParse(parseVariants.v4, PARSE_SAMPLES_VERCEL))
	.add('v5 string switch', benchParse(parseVariants.v5, PARSE_SAMPLES_VERCEL))
	.add('v6 inline check', benchParse(parseVariants.v6, PARSE_SAMPLES_VERCEL))
	.add('v7 bitwise', benchParse(parseVariants.v7, PARSE_SAMPLES_VERCEL))
	.add('v8 case-insensitive', benchParse(parseVariants.v8, PARSE_SAMPLES_VERCEL))
	.add('v9 combined', benchParse(parseVariants.v9, PARSE_SAMPLES_VERCEL))
	.add('v10 bitwise OR', benchParse(parseVariants.v10, PARSE_SAMPLES_VERCEL))
	.add('v11 combined+opt', benchParse(parseVariants.v11, PARSE_SAMPLES_VERCEL))
	.add('v12 early-exit first-char', benchParse(parseVariants.v12, PARSE_SAMPLES_VERCEL))
	.add('v13 early-exit pre-scan', benchParse(parseVariants.v13, PARSE_SAMPLES_VERCEL))
	.add('v14 all opts', benchParse(parseVariants.v14, PARSE_SAMPLES_VERCEL))
	.add('v15 manual decimal', benchParse(parseVariants.v15, PARSE_SAMPLES_VERCEL))
	.add('v16 boundary table', benchParse(parseVariants.v16, PARSE_SAMPLES_VERCEL))
	.add('v17 decimal+boundary', benchParse(parseVariants.v17, PARSE_SAMPLES_VERCEL))
	.add('v18 single-pass', benchParse(parseVariants.v18, PARSE_SAMPLES_VERCEL))
	.add('v19 unroll', benchParse(parseVariants.v19, PARSE_SAMPLES_VERCEL))
	.add('v20 INT_TABLE', benchParse(parseVariants.v20, PARSE_SAMPLES_VERCEL))
	.add('v21 perfect-hash', benchParse(parseVariants.v21, PARSE_SAMPLES_VERCEL))
	.add('v22 branchless-digit', benchParse(parseVariants.v22, PARSE_SAMPLES_VERCEL))
	.add('v23 turbofan-opt', benchParse(parseVariants.v23, PARSE_SAMPLES_VERCEL))
	.add('v25 flat-lookup', benchParse(parseVariants.v25, PARSE_SAMPLES_VERCEL));

// ─── Parse single-unit — invalid ─────────────────────────────────────────────

const parseSingleInvalidBench = new Bench({ time: 1_000 });

parseSingleInvalidBench
	.add('parse', benchParseInvalid(parseVariants.normal, INVALID_SAMPLES))
	.add('v0 trie', benchParseInvalid(parseVariants.v0, INVALID_SAMPLES))
	.add('v1 regex switch', benchParseInvalid(parseVariants.v1, INVALID_SAMPLES))
	.add('v2 isLetter', benchParseInvalid(parseVariants.v2, INVALID_SAMPLES))
	.add('v3 charCode boundary', benchParseInvalid(parseVariants.v3, INVALID_SAMPLES))
	.add('v4 length dispatch', benchParseInvalid(parseVariants.v4, INVALID_SAMPLES))
	.add('v5 string switch', benchParseInvalid(parseVariants.v5, INVALID_SAMPLES))
	.add('v6 inline check', benchParseInvalid(parseVariants.v6, INVALID_SAMPLES))
	.add('v7 bitwise', benchParseInvalid(parseVariants.v7, INVALID_SAMPLES))
	.add('v8 case-insensitive', benchParseInvalid(parseVariants.v8, INVALID_SAMPLES))
	.add('v9 combined', benchParseInvalid(parseVariants.v9, INVALID_SAMPLES))
	.add('v10 bitwise OR', benchParseInvalid(parseVariants.v10, INVALID_SAMPLES))
	.add('v11 combined+opt', benchParseInvalid(parseVariants.v11, INVALID_SAMPLES))
	.add('v12 early-exit first-char', benchParseInvalid(parseVariants.v12, INVALID_SAMPLES))
	.add('v13 early-exit pre-scan', benchParseInvalid(parseVariants.v13, INVALID_SAMPLES))
	.add('v14 all opts', benchParseInvalid(parseVariants.v14, INVALID_SAMPLES))
	.add('v15 manual decimal', benchParseInvalid(parseVariants.v15, INVALID_SAMPLES))
	.add('v16 boundary table', benchParseInvalid(parseVariants.v16, INVALID_SAMPLES))
	.add('v17 decimal+boundary', benchParseInvalid(parseVariants.v17, INVALID_SAMPLES))
	.add('v18 single-pass', benchParseInvalid(parseVariants.v18, INVALID_SAMPLES))
	.add('v19 unroll', benchParseInvalid(parseVariants.v19, INVALID_SAMPLES))
	.add('v20 INT_TABLE', benchParseInvalid(parseVariants.v20, INVALID_SAMPLES))
	.add('v21 perfect-hash', benchParseInvalid(parseVariants.v21, INVALID_SAMPLES))
	.add('v22 branchless-digit', benchParseInvalid(parseVariants.v22, INVALID_SAMPLES))
	.add('v23 turbofan-opt', benchParseInvalid(parseVariants.v23, INVALID_SAMPLES))
	.add('v25 flat-lookup', benchParseInvalid(parseVariants.v25, INVALID_SAMPLES));

// ─── Parse multi-unit ─────────────────────────────────────────────────────────

const parseMultiBench = new Bench({ time: 1_000 });

parseMultiBench
	.add('parse', benchParse(parseVariants.normal, MULTI_PARSE_SAMPLES));

// ─── Multi-language overhead ──────────────────────────────────────────────────

const v18wmc = buildFastParseV18(LANGUAGES.en, true);

const multiLangVariants = {
	v18: buildFastParseV18(LANGUAGES.en),
	'v18 +count': (s: string): number => v18wmc(s)[0]!,
	'multi 2 (en+es)': buildFastParseMulti([ LANGUAGES.en, LANGUAGES.es ]),
	'multi 3 (en+es+ja)': buildFastParseMulti([ LANGUAGES.en, LANGUAGES.es, LANGUAGES.ja ]),
	'parse [3 langs]': (s: string): number => parse(s, [ LANGUAGES.en, LANGUAGES.es, LANGUAGES.ja ])!,
};

const parseMultiLangValidBench = new Bench({ time: 1_000 });

for (const [ name, fn ] of Object.entries(multiLangVariants))
	parseMultiLangValidBench.add(name, benchParse(fn, PARSE_SAMPLES_EN));

const parseMultiLangMultiBench = new Bench({ time: 1_000 });

const multiLangMultiVariants = {
	'multi 2 (en+es)': multiLangVariants['multi 2 (en+es)'],
	'multi 3 (en+es+ja)': multiLangVariants['multi 3 (en+es+ja)'],
	'parse [3 langs]': multiLangVariants['parse [3 langs]'],
};

for (const [ name, fn ] of Object.entries(multiLangMultiVariants))
	parseMultiLangMultiBench.add(name, benchParse(fn, MULTI_PARSE_SAMPLES));

// ─── Run ──────────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const localPkg = require('../package.json') as { version: string };
const vercelPkg = require('ms/package.json') as { version: string };

console.log(`Node.js: ${process.version} | @fabricio-191/ms: ${localPkg.version} | vercel/ms: ${vercelPkg.version}`);

await parseSingleValidBench.run();
printResults('Parse single-unit — valid', parseSingleValidBench);

await parseSingleInvalidBench.run();
printResults('Parse single-unit — invalid', parseSingleInvalidBench);

await parseMultiBench.run();
printResults('Parse multi-unit', parseMultiBench);

await parseMultiLangValidBench.run();
printResults('Multi-language — single-unit valid', parseMultiLangValidBench);

await parseMultiLangMultiBench.run();
printResults('Multi-language — multi-unit', parseMultiLangMultiBench);

console.log('\n=== Summary ===\n');
console.log(`Parse valid   fastest: ${fastest(parseSingleValidBench, [ 'parse' ])}`);
console.log(`Parse invalid fastest: ${fastest(parseSingleInvalidBench, [ 'parse' ])}`);
console.log(`Parse multi   fastest: ${fastest(parseMultiBench, [])}`);
console.log(`Multi-lang valid  fastest: ${fastest(parseMultiLangValidBench, [ 'parse [3 langs]' ])}`);
console.log(`Multi-lang multi  fastest: ${fastest(parseMultiLangMultiBench, [ 'parse [3 langs]' ])}`);

function printResults(title: string, bench: Bench): void {
	console.log(`\n=== ${title} ===\n`);

	const results = bench.tasks.map(task => {
		const latency = (task.result as { latency?: { p50?: number; rme?: number } } | undefined)?.latency;
		const p50 = latency?.p50 ?? 0;
		const rme = latency?.rme ?? 0;
		const ops = p50 > 0 ? Math.round(1_000 / p50) : 0;
		return { name: task.name, ops, rme };
	});

	results.sort((a, b) => b.ops - a.ops);

	console.log(`${'Method'.padEnd(26)} ${'ops/sec'.padStart(10)}  ±rme`);
	console.log('─'.repeat(48));
	for (const r of results)
		console.log(`${r.name.padEnd(26)} ${r.ops.toString().padStart(10)}  ±${r.rme.toFixed(1)}%`);
}

function fastest(bench: Bench, exclude: string[]): string {
	const tasks = bench.tasks.filter(t => !exclude.includes(t.name));
	if (tasks.length === 0) return 'N/A';
	const task = tasks.reduce((a, b) => {
		const aP50 = (a.result as { latency?: { p50?: number } } | undefined)?.latency?.p50 ?? Infinity;
		const bP50 = (b.result as { latency?: { p50?: number } } | undefined)?.latency?.p50 ?? Infinity;
		return aP50 < bP50 ? a : b;
	});
	const p50 = (task.result as { latency?: { p50?: number } } | undefined)?.latency?.p50 ?? 0;
	return `${task.name} (${p50 > 0 ? Math.round(1_000 / p50).toLocaleString() : '0'} ops/sec)`;
}

export function benchParse(fn: (input: string) => number | null, samples: FormatArgs[]): () => void {
	return () => {
		for (const s of samples) check(fn(s.input), s.expected);
	};
}

export function benchParseInvalid(fn: (input: string) => number | null, inputs: Array<{ input: string }>): () => void {
	return () => {
		for (const s of inputs) check(fn(s.input), null);
	};
}
