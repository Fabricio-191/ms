/* eslint-disable no-invalid-this */
/* eslint-disable no-console */
// @ts-ignore
const ms = require('../../'), vercelMS = require('ms');
const { Suite } = require('benchmark');
const { createFormatArgs, createClockArgs } = require('../utils.js');

const testBatchForVercel = [];
while(testBatchForVercel.length !== 5000){
	const { num, options } = createFormatArgs({
		language: 'en',
		length: 1,
	});
	const formatted = ms(num, options);
	// eslint-disable-next-line no-undefined
	if(vercelMS(formatted) === undefined) continue;

	testBatchForVercel.push({ formatted, num });
}

const testBatch = [];
for(let i = 0; i < 5000; i++){
	const { num, options } = createFormatArgs();
	const formatted = ms(num, options);

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
	.on('start', initialize)
	.run();

new Suite(`@fabricio-191/ms ${require('../../package.json').version}`)
	.add('parsing', () => {
		for(const { formatted } of testBatchForVercel){
			ms(formatted);
		}
	})
	.add('formatting', () => {
		for(const { num } of testBatchForVercel){
			ms(num, { length: 1, language: 'en' });
		}
	})
	.add('formatting long', () => {
		for(const { num } of testBatchForVercel){
			ms(num, { length: 1, language: 'en', long: true });
		}
	})
	.add('full parsing', () => {
		for(const { formatted } of testBatch){
			ms(formatted);
		}
	})
	.add('full formatting', () => {
		for(const { num, opts } of testBatch){
			ms(num, opts);
		}
	})
	.add('clock', () => {
		for(const args of clocks){
			ms.clock(...args);
		}
	})
	.on('start', initialize)
	.run();

function initialize(){
	console.log(this.name);

	this.on('error', event => {
		throw event.target.error;
	});
	this.on('complete', function(){
		const benchs = [];

		for(let i = 0; i < this.length; i++){
			benchs.push({
				name: this[i].name,
				hz: this[i].hz.toFixed(this[i].hz < 100 ? 2 : 0),
				runs: this[i].stats.sample.length,
				tolerance: this[i].stats.rme,
			});
		}

		function getPad(arr, key){
			return arr.reduce((acc, curr) => {
				if(curr[key].length > acc) return curr[key].length;
				return acc;
			}, 0);
		}

		const namePad = getPad(benchs, 'name');
		const hzPad = getPad(benchs, 'hz');

		for(const bench of benchs){
			console.log(
				bench.name.padEnd(namePad, ' ') +
					' x ' + bench.hz.padStart(hzPad, ' ') +
					' ops/sec \xb1' + bench.tolerance.toFixed(2) +
					'% (' + bench.runs + ' runs sampled)'
			);
		}
		console.log();
	});
}
