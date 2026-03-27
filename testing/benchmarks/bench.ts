import { Bench, type Task, type TaskResultCompleted } from 'tinybench';
import vercelMs from 'ms';

import { LANGUAGES, format, parse } from '@src/index.ts';
import { createArgs, check, type FormatArgs } from '../utils.ts';
import { buildFastParse as buildFastParseV11 } from '@archive/parse/v11.ts';
import { buildFastParse as buildFastParseV14 } from '@archive/parse/v14.ts';
import { buildFastParse as buildFastParseV15 } from '@archive/parse/v15.ts';
import { buildFastParse as buildFastParseV16 } from '@archive/parse/v16.ts';
import { buildFastParse as buildFastParseV17 } from '@archive/parse/v17.ts';
import { buildFastParse as buildFastParseV18 } from '@src/parse/variants/v18.ts';
import { buildFastParse as buildFastParseV19 } from '@src/parse/variants/v19.ts';
import { buildFastParse as buildFastParseV20 } from '@src/parse/variants/v20.ts';
import { buildFastParse as buildFastParseV21 } from '@src/parse/variants/v21.ts';
import { buildFastParse as buildFastParseV22 } from '@src/parse/variants/v22.ts';
import { buildFastParse as buildFastParseV23 } from '@src/parse/variants/v23.ts';
import { buildFastParse as buildFastParseV25 } from '@src/parse/variants/v25.ts';
import { createRequire } from 'module';

type CompletedTask = Task & { result: TaskResultCompleted };

const parseVariants = {
	'vercel/ms': (s: string): number | null => vercelMs(s),
	normal: (s: string): number | null => parse(s, LANGUAGES.en),
	v11: buildFastParseV11(LANGUAGES.en),
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

const N = 10000;
const INVALID_SAMPLES = Array.from({ length: N }, () => createArgs(false, true));
const PARSE_SAMPLES_VERCEL = Array.from({ length: N }, (): FormatArgs => {
	const args = createArgs(true, true);
	const input = format(args.expected, args.options) ?? '';
	const expected = vercelMs(input);
	return { ...args, input, expected };
});

// ─── Parse single-unit — valid ────────────────────────────────────────────────

const parseSingleValidBench = new Bench({ time: 1_000 });

parseSingleValidBench
	.add('vercel/ms', benchParse(parseVariants['vercel/ms'], PARSE_SAMPLES_VERCEL))
	.add('parse', benchParse(parseVariants.normal, PARSE_SAMPLES_VERCEL))
	.add('v11 combined+opt', benchParse(parseVariants.v11, PARSE_SAMPLES_VERCEL))
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
	.add('vercel/ms', benchParseInvalid(parseVariants['vercel/ms'], INVALID_SAMPLES))
	.add('parse', benchParseInvalid(parseVariants.normal, INVALID_SAMPLES))
	.add('v11 combined+opt', benchParseInvalid(parseVariants.v11, INVALID_SAMPLES))
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

// ─── Multi-language overhead ──────────────────────────────────────────────────

// ─── Run ──────────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const localPkg = require('../../package.json') as { version: string };
const vercelPkg = require('ms/package.json') as { version: string };

console.log();
console.log(`Node.js: ${process.version} | @fabricio-191/ms: ${localPkg.version} | vercel/ms: ${vercelPkg.version}`);

await parseSingleValidBench.run();
printResults('Parse single-unit — valid', parseSingleValidBench);

await parseSingleInvalidBench.run();
printResults('Parse single-unit — invalid', parseSingleInvalidBench);

console.log('\n=== Summary ===\n');
console.log(`Parse valid   fastest: ${fastestTaskFromBench(parseSingleValidBench)}`);
console.log(`Parse invalid fastest: ${fastestTaskFromBench(parseSingleInvalidBench)}`);

function printResults(title: string, bench: Bench): void {
	console.log(`\n=== ${title} ===\n`);

	const results = bench.tasks
		.map(task => {
			const { result } = task;

			if (result.state === 'completed') {
				return {
					name: task.name,
					ops: result.throughput.p50,
					rme: result.throughput.rme,
				};
			}

			return {
				name: task.name,
				ops: 0,
				rme: 0,
				error: result.state === 'errored' ? result.error : new Error(`Task ${result.state}`),
			};
		})
		.sort((a, b) => b.ops - a.ops);

	console.log(`${'Method'.padEnd(26)} ${'ops/sec'.padStart(10)}  ±rme`);
	console.log('─'.repeat(48));
	for (const r of results)
		console.log(`${r.name.padEnd(26)} ${r.ops.toFixed(2).padStart(10)}  ±${r.rme.toFixed(1)}%`);
}

function fastestTaskFromBench(bench: Bench): string {
	const tasks = bench.tasks.filter((t): t is CompletedTask => t.result.state === 'completed');
	if (tasks.length === 0) return 'N/A';

	const fastest = tasks.reduce((a, b) => a.result.throughput.p50 >= b.result.throughput.p50 ? a : b);

	return `${fastest.name} (${fastest.result.throughput.p50.toLocaleString()} ops/sec)`;
}

export function benchParse(fn: (input: string) => number | null, samples: FormatArgs[]): () => void {
	return () => {
		for (const s of samples) check(fn(s.input), s.expected);
	};
}

export function benchParseInvalid(fn: (input: string) => number | null, inputs: Array<{ input: string }>): () => void {
	return () => {
		for (const s of inputs) fn(s.input);
	};
}
