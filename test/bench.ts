// @ts-ignore
import ms from '../src/index';
import * as vercelMS from 'ms';
import { createFormatArgs, createClockArgs, createBench } from './utils.js';

const testBatchForVercel: {
	formatted: string;
	num: number;
}[] = [];
while(testBatchForVercel.length !== 5000){
	const { num, options } = createFormatArgs({
		language: 'en',
		length: 1,
	});
	const formatted = ms.format(num, options);
	// eslint-disable-next-line no-undefined
	if(vercelMS(formatted) === undefined) continue;

	testBatchForVercel.push({ formatted, num });
}

const testBatch: {
	formatted: string;
	num: number;
	opts: unknown;
}[] = [];
for(let i = 0; i < 5000; i++){
	const { num, options } = createFormatArgs();
	const formatted = ms.format(num, options);

	testBatch.push({ formatted, num, opts: options });
}

const clocks: Array<string | boolean>[] = [];
for(let i = 0; i < 5000; i++){
	clocks.push(createClockArgs().args);
}

console.log(`Node.js version: ${process.version}\n`);

createBench(`vercel/ms        ${require('ms/package.json').version}`)
	.add('parsing', () => {
		for(const { formatted } of testBatchForVercel){
			vercelMS(formatted);
		}
	})
	.add('formatting', () => {
		for(const { num } of testBatchForVercel){
			vercelMS(num);
		}
	})
	.add('formatting long', () => {
		for(const { num } of testBatchForVercel){
			vercelMS(num, { long: true });
		}
	})
	.run();

createBench(`@fabricio-191/ms ${require('../../package.json').version}`)
	.add('parsing', () => {
		for(const { formatted } of testBatchForVercel){
			ms.parse(formatted);
		}
	})
	.add('simple formatting', () => {
		for(const { num } of testBatchForVercel){
			ms.format.simple(num);
		}
	})
	.add('formatting', () => {
		for(const { num } of testBatchForVercel){
			ms.format(num, { length: 1, language: 'en' });
		}
	})
	.add('formatting long', () => {
		for(const { num } of testBatchForVercel){
			ms.format(num, { length: 1, language: 'en', long: true });
		}
	})
	.add('full parsing', () => {
		for(const { formatted } of testBatch){
			ms.parse(formatted);
		}
	})
	.add('full formatting', () => {
		for(const { num, opts } of testBatch){
			ms.format(num, opts);
		}
	})
	.add('clock', () => {
		for(const args of clocks){
			ms.parse.clock(...args);
		}
	})
	.run();