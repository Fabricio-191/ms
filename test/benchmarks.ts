import { createRequire } from 'node:module';

import { Bench } from 'tinybench';
import vercelMS from 'ms';

import {
	buildFastParse,
	buildFastParseV0,
	buildFastParseV1,
	buildFastParseV2,
	buildFastParseV3,
	buildFastParseV4,
	buildFastParseV5,
	buildFastParseV6,
	buildFastParseV7,
	buildFastParseV8,
	buildFastFormat,
	buildFastFormatV1,
	buildFastFormatV2,
	format,
	LANGUAGES,
	parse,
} from '../lib/esm/index.js';
import { BENCH_PARSE_SAMPLES, BENCH_PARSE_FAILURES, BENCH_FORMAT_SAMPLES } from './generators.ts';

const require = createRequire(import.meta.url);

const localPkg = require('../package.json') as { version: string };
const vercelPkg = require('ms/package.json') as { version: string };

console.log(`Node.js: ${process.version} | @fabricio-191/ms: ${localPkg.version} | vercel/ms: ${vercelPkg.version}\n`);

// Build all parse variants
const parseVariants = {
	current: buildFastParse(LANGUAGES.en),
	v0: buildFastParseV0(LANGUAGES.en),
	v1: buildFastParseV1(LANGUAGES.en),
	v2: buildFastParseV2(LANGUAGES.en),
	v3: buildFastParseV3(LANGUAGES.en),
	v4: buildFastParseV4(LANGUAGES.en),
	v5: buildFastParseV5(LANGUAGES.en),
	v6: buildFastParseV6(LANGUAGES.en),
	v7: buildFastParseV7(LANGUAGES.en),
	v8: buildFastParseV8(LANGUAGES.en),
};

// Build all format variants
const formatVariants = {
	current: buildFastFormat(LANGUAGES.en),
	v1: buildFastFormatV1(LANGUAGES.en),
	v2: buildFastFormatV2(LANGUAGES.en),
};

// Parse benchmark - valid inputs
const parseValidBench = new Bench({ time: 5_000, iterations: 10 });

parseValidBench
	.add('vercel/ms', () => { for (const s of BENCH_PARSE_SAMPLES) vercelMS(s); })
	.add('parse', () => { for (const s of BENCH_PARSE_SAMPLES) parse(s, LANGUAGES.en); })
	.add('current (v9 combined)', () => { for (const s of BENCH_PARSE_SAMPLES) parseVariants.current(s); })
	.add('v0 trie toLowerCase', () => { for (const s of BENCH_PARSE_SAMPLES) parseVariants.v0(s); })
	.add('v1 regex', () => { for (const s of BENCH_PARSE_SAMPLES) parseVariants.v1(s); })
	.add('v2 isLetter', () => { for (const s of BENCH_PARSE_SAMPLES) parseVariants.v2(s); })
	.add('v3 charCode', () => { for (const s of BENCH_PARSE_SAMPLES) parseVariants.v3(s); })
	.add('v4 length', () => { for (const s of BENCH_PARSE_SAMPLES) parseVariants.v4(s); })
	.add('v5 string switch', () => { for (const s of BENCH_PARSE_SAMPLES) parseVariants.v5(s); })
	.add('v6 inline check', () => { for (const s of BENCH_PARSE_SAMPLES) parseVariants.v6(s); })
	.add('v7 bitwise', () => { for (const s of BENCH_PARSE_SAMPLES) parseVariants.v7(s); })
	.add('v8 case-insensitive', () => { for (const s of BENCH_PARSE_SAMPLES) parseVariants.v8(s); });

// Parse benchmark - invalid inputs
const parseInvalidBench = new Bench({ time: 3_000, iterations: 10 });

parseInvalidBench
	.add('parse', () => { for (const s of BENCH_PARSE_FAILURES) parse(s, LANGUAGES.en); })
	.add('current (v9 combined)', () => { for (const s of BENCH_PARSE_FAILURES) parseVariants.current(s); })
	.add('v0 trie toLowerCase', () => { for (const s of BENCH_PARSE_FAILURES) parseVariants.v0(s); })
	.add('v8 case-insensitive', () => { for (const s of BENCH_PARSE_FAILURES) parseVariants.v8(s); });

// Format benchmark
const formatValidBench = new Bench({ time: 5_000, iterations: 10 });

formatValidBench
	.add('vercel/ms short', () => { for (const v of BENCH_FORMAT_SAMPLES) vercelMS(v); })
	.add('vercel/ms long', () => { for (const v of BENCH_FORMAT_SAMPLES) vercelMS(v, { long: true }); })
	.add('format short', () => { for (const v of BENCH_FORMAT_SAMPLES) format(v, { language: LANGUAGES.en, length: 1 }); })
	.add('format long', () => { for (const v of BENCH_FORMAT_SAMPLES) format(v, { language: LANGUAGES.en, length: 1, long: true }); })
	.add('current short', () => { for (const v of BENCH_FORMAT_SAMPLES) formatVariants.current(v); })
	.add('current long', () => { for (const v of BENCH_FORMAT_SAMPLES) formatVariants.current(v, true); })
	.add('v1 short', () => { for (const v of BENCH_FORMAT_SAMPLES) formatVariants.v1(v); })
	.add('v2 short', () => { for (const v of BENCH_FORMAT_SAMPLES) formatVariants.v2(v); });

function printResults(title: string, bench: Bench): void {
	console.log(`\n=== ${title} ===\n`);

	const results = bench.tasks.map(task => {
		const result = task.result as { latency?: { mean?: number } } | undefined;
		const mean = result?.latency?.mean ?? 0;
		const ops = mean > 0 ? Math.round(1 / mean * 1000) : 0;
		return { name: task.name, mean, ops };
	});

	const fastest = results.reduce((a, b) => a.mean > 0 && (b.mean === 0 || a.mean < b.mean) ? a : b);

	console.log(`${'Method'.padEnd(24)} ${'ops/sec'.padStart(10)} ${'vs fastest'.padStart(12)}`);
	console.log('─'.repeat(48));
	for (const r of results) {
		const vs = r.mean > 0 && fastest.mean > 0 ?
			`${((fastest.ops / r.ops - 1) * 100).toFixed(0)}%` :
			'—';
		console.log(`${r.name.padEnd(24)} ${r.ops.toString().padStart(10)} ${vs.padStart(12)}`);
	}
}

// Run benchmarks
await parseValidBench.run();
printResults('Parse (valid inputs)', parseValidBench);

await parseInvalidBench.run();
printResults('Parse (invalid inputs)', parseInvalidBench);

await formatValidBench.run();
printResults('Format', formatValidBench);

// Summary
console.log('\n=== Summary ===\n');

const parseValidTasks = parseValidBench.tasks;
const fastestParse = parseValidTasks
	.filter(t => t.name.startsWith('v') || t.name === 'current (v9 combined)')
	.reduce((a, b) => {
		const aMean = (a.result as { latency: { mean?: number } }).latency.mean ?? Infinity;
		const bMean = (b.result as { latency: { mean?: number } }).latency.mean ?? Infinity;
		return aMean < bMean ? a : b;
	});

const fastestMean = (fastestParse.result as { latency: { mean?: number } }).latency.mean ?? 0;
console.log(`Fastest parse: ${fastestParse.name} at ${(1 / fastestMean * 1000).toFixed(0)} ops/sec`);
