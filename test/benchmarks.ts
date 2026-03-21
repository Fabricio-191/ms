import { createRequire } from 'node:module';

import { Bench } from 'tinybench';
import vercelMS from 'ms';

import { buildFastParse, buildFastParse3_3, buildFastParse3_4, buildFastParse3_5, buildFastParse3_6, buildFastFormat, format, LANGUAGES, parse } from '../lib/esm/index.js';
import { BENCH_PARSE_SAMPLES, BENCH_PARSE_FAILURES, BENCH_FORMAT_SAMPLES, BENCH_FORMAT_FAILURES } from './generators.ts';

const require = createRequire(import.meta.url);

const localPkg = require('../package.json') as { version: string };
const vercelPkg = require('ms/package.json') as { version: string };

console.log();
console.log(`Node.js version: ${process.version}`);
console.log(`@fabricio-191/ms: ${localPkg.version}`);
console.log(`vercel/ms: ${vercelPkg.version}`);
console.log();

// Parse benchmark - valid inputs
const fastParseEn = buildFastParse(LANGUAGES.en);
const fastParse33 = buildFastParse3_3(LANGUAGES.en);
const fastParse34 = buildFastParse3_4(LANGUAGES.en);
const fastParse35 = buildFastParse3_5(LANGUAGES.en);
const fastParse36 = buildFastParse3_6(LANGUAGES.en);

const parseBench = new Bench({ time: 5_000, iterations: 10 });

parseBench
	.add('vercel/ms (valid inputs)', () => {
		for (const sample of BENCH_PARSE_SAMPLES)
			vercelMS(sample);
	})
	.add('@fabricio-191/ms parse (valid inputs)', () => {
		for (const sample of BENCH_PARSE_SAMPLES)
			parse(sample, LANGUAGES.en);
	})
	.add('@fabricio-191/ms buildFastParse v3.1 trie (valid inputs)', () => {
		for (const sample of BENCH_PARSE_SAMPLES)
			fastParseEn(sample);
	})
	.add('@fabricio-191/ms buildFastParse v3.3 string switch (valid inputs)', () => {
		for (const sample of BENCH_PARSE_SAMPLES)
			fastParse33(sample);
	})
	.add('@fabricio-191/ms buildFastParse v3.4 inline check (valid inputs)', () => {
		for (const sample of BENCH_PARSE_SAMPLES)
			fastParse34(sample);
	})
	.add('@fabricio-191/ms buildFastParse v3.5 bitwise (valid inputs)', () => {
		for (const sample of BENCH_PARSE_SAMPLES)
			fastParse35(sample);
	})
	.add('@fabricio-191/ms buildFastParse v3.6 case-insensitive (valid inputs)', () => {
		for (const sample of BENCH_PARSE_SAMPLES)
			fastParse36(sample);
	});

const parseFailureBench = new Bench({ time: 3_000, iterations: 10 });

parseFailureBench
	.add('vercel/ms (invalid inputs)', () => {
		for (const sample of BENCH_PARSE_FAILURES)
			vercelMS(sample);
	})
	.add('@fabricio-191/ms parse (invalid inputs)', () => {
		for (const sample of BENCH_PARSE_FAILURES)
			parse(sample, LANGUAGES.en);
	})
	.add('@fabricio-191/ms buildFastParse v3.1 trie (invalid inputs)', () => {
		for (const sample of BENCH_PARSE_FAILURES)
			fastParseEn(sample);
	})
	.add('@fabricio-191/ms buildFastParse v3.6 case-insensitive (invalid inputs)', () => {
		for (const sample of BENCH_PARSE_FAILURES)
			fastParse36(sample);
	});

// Format benchmark - valid inputs
const fastFormatEn = buildFastFormat(LANGUAGES.en);

const formatBench = new Bench({ time: 5_000, iterations: 10 });

formatBench
	.add('vercel/ms short (valid inputs)', () => {
		for (const value of BENCH_FORMAT_SAMPLES)
			vercelMS(value);
	})
	.add('@fabricio-191/ms format short (valid inputs)', () => {
		for (const value of BENCH_FORMAT_SAMPLES)
			format(value, { language: LANGUAGES.en, length: 1 });
	})
	.add('@fabricio-191/ms buildFastFormat short (valid inputs)', () => {
		for (const value of BENCH_FORMAT_SAMPLES)
			fastFormatEn(value);
	})
	.add('vercel/ms long (valid inputs)', () => {
		for (const value of BENCH_FORMAT_SAMPLES)
			vercelMS(value, { long: true });
	})
	.add('@fabricio-191/ms format long (valid inputs)', () => {
		for (const value of BENCH_FORMAT_SAMPLES)
			format(value, { language: LANGUAGES.en, length: 1, long: true });
	})
	.add('@fabricio-191/ms buildFastFormat long (valid inputs)', () => {
		for (const value of BENCH_FORMAT_SAMPLES)
			fastFormatEn(value, true);
	});

const formatFailureBench = new Bench({ time: 3_000, iterations: 10 });

formatFailureBench
	.add('@fabricio-191/ms format short (invalid inputs)', () => {
		for (const value of BENCH_FORMAT_FAILURES)
			format(value as number, { language: LANGUAGES.en, length: 1 });
	})
	.add('@fabricio-191/ms buildFastFormat short (invalid inputs)', () => {
		for (const value of BENCH_FORMAT_FAILURES)
			fastFormatEn(value as number);
	});

// Run benchmarks
console.log('=== Parse Benchmark (valid inputs) ===\n');

await parseBench.run();

console.table(parseBench.table());

console.log('\n=== Parse Benchmark (invalid inputs) ===\n');

await parseFailureBench.run();

console.table(parseFailureBench.table());

console.log('\n=== Format Benchmark (valid inputs) ===\n');

await formatBench.run();

console.table(formatBench.table());

console.log('\n=== Format Benchmark (invalid inputs) ===\n');

await formatFailureBench.run();

console.table(formatFailureBench.table());

// Summary
console.log('\n=== Summary ===\n');

const parseTasks = parseBench.tasks;
const fastestParse = parseTasks.reduce((a, b) => {
	const aMean = (a.result as { latency?: { mean?: number } })?.latency?.mean ?? Infinity;
	const bMean = (b.result as { latency?: { mean?: number } })?.latency?.mean ?? Infinity;
	return aMean < bMean ? a : b;
});

console.log(`Fastest parse (valid inputs): ${fastestParse.name}`);
const meanMs = (fastestParse.result as { latency?: { mean?: number } })?.latency?.mean ?? 0;
console.log(`  Mean: ${meanMs.toFixed(4)}ms`);
console.log(`  Ops/sec: ${(1 / meanMs * 1000).toFixed(0)}`);