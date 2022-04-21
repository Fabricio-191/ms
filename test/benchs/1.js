// @ts-ignore
const ms = require('../../'), vercelMS = require('ms');
const { Suite } = require('benchmark');
const { createFormatArgs, createClockArgs, initializeBench } = require('../utils.js');

const testBatchForVercel = [];
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

const testBatch = [];
for(let i = 0; i < 5000; i++){
	const { num, options } = createFormatArgs();
	const formatted = ms.format(num, options);

	testBatch.push({ formatted, num, options });
}

const clocks = [];
for(let i = 0; i < 5000; i++){
	clocks.push(createClockArgs().args);
}

console.log(`Node.js version: ${process.version}\n`);

new Suite(`vercel/ms        ${require('ms/package.json').version}`)
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
	.on('start', initializeBench)
	.run();

new Suite(`@fabricio-191/ms ${require('../../package.json').version}`)
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
	.on('start', initializeBench)
	.run();