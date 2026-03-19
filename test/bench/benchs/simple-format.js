import { ok } from 'node:assert';

import vercelMS from 'ms';

import { buildFastFormat, format, LANGUAGES } from '../../../lib/esm/index.js';
import { runSuite } from '../bench-utils.js';
import generators from '../../generators.cjs';

const samples = generators.createBenchFormatSamples(10_000);
const fastFormatEn = buildFastFormat(LANGUAGES.en);

for (const value of samples) {
	ok(vercelMS(value) !== undefined);
	ok(format(value, { language: LANGUAGES.en, length: 1 }) !== null);
	ok(format(value, {
		language: LANGUAGES.en,
		length: 1,
		long: true,
	}) !== null);
	ok(fastFormatEn(value) !== null);
	ok(fastFormatEn(value, true) !== null);
}

export async function runSimpleFormatBenchmark() {
	await runSuite('simple formatting (length = 1)', suite => {
		suite
			.add('vercel/ms short', () => {
				for (const value of samples)
					vercelMS(value);
			})
			.add('@fabricio-191/ms short (lib/esm)', () => {
				for (const value of samples)
					format(value, { language: LANGUAGES.en, length: 1 });
			})
			.add('@fabricio-191/ms fastFormat (lib/esm)', () => {
				for (const value of samples)
					fastFormatEn(value);
			})
			.add('vercel/ms long', () => {
				for (const value of samples)
					vercelMS(value, { long: true });
			})
			.add('@fabricio-191/ms long (lib/esm)', () => {
				for (const value of samples) {
					format(value, {
						language: LANGUAGES.en,
						length: 1,
						long: true,
					});
				}
			})
			.add('@fabricio-191/ms fastFormat long (lib/esm)', () => {
				for (const value of samples)
					fastFormatEn(value, true);
			});
	});
}
