// @ts-ignore
import { TIMES, LANGUAGES } from '../src/index';
import { Suite } from 'benchmark';
const LANGS = Object.keys(LANGUAGES);
export { TIMES, LANGS };

// #region format args
const MAXS = {
	Y: 100,
	Mo: 12,
	W: 4,
	D: 7,
	H: 24,
	M: 60,
	S: 60,
	Ms: 1000,
};

export function createFormatArgs(opts: {
	language?: string;
	length?: number;
} = {}){
	const format: Array<keyof typeof MAXS> = [];

	while(format.length === 0){
		for(const key in TIMES){
			if(random(1, 1) < 0.3) format.push(key as keyof typeof TIMES);
		}
	}

	const length = opts.length || random(8) + 1;

	let num = 0;
	for(let y = 0; y < length && y < format.length; y++){
		num += random(MAXS[format[y] as string] as number) * TIMES[format[y] as string];
	}

	const options = Object.assign({
		language: random(LANGS),
		long: random(true),
		format: format.join(''),
		length,
	}, opts);

	return { num, options };
}
// #endregion

// #region clock args
const separators = ['-', ':'];
const formats = [
	'hhsepmmsepss.sss',
	'hhsepmmsepss',
	'hhsepmm.mmm',
	'hhsepmm',
	'mmsepss.sss',
	'mmsepss',
];

export interface ClockArgs {
	args: [string, boolean];
	result: number;
}

export function createClockArgs(): ClockArgs {
	let result = 0;
	let format = random(formats)
		.replace(/sep/g, random(separators));

	const n = (max: number, digits: number, key: string, val: number) => {
		if(!format.includes(key)) return;

		let num = random(max).toString();

		// padStart polyfill
		while(num.length !== digits){
			num = '0' + num;
		}

		format = format.replace(key, num);
		result += parseFloat(num) * val;
	};

	const minutes = format.includes('ss') && !format.includes('hh');

	n(24, 2, 'hh', 3600000);
	n(1000, 3, 'mmm', 60);
	n(1000, 3, 'sss', 1);
	n(60, 2, 'mm', 60000);
	n(60, 2, 'ss', 1000);

	return { args: [format, minutes], result };
}
// #endregion

import { strictEqual } from 'assert';
export function expect(value: number, expectedValue: number){
	if(typeof expectedValue === 'number' && typeof value === 'number'){
		if(Math.abs(expectedValue - value) < 1) return;
	}

	strictEqual(value, expectedValue);
}

export function random(thing: true): boolean;
export function random(thing: number, fixed?: number): number;
export function random<T>(thing: T[]): T;

export function random(thing: number | unknown[] | true, fixed = 0){
	if(Array.isArray(thing)){
		return thing[Math.floor(Math.random() * thing.length)]; // random array element
	}
	if(typeof thing === 'object'){
		return random(Object.keys(thing)); // random key of the object
	}
	if(thing === true){
		return Math.random() > 0.5; // true or false
	}
	if(fixed !== 0){
		return parseFloat((Math.random() * thing).toFixed(fixed)); // 0 to thing (float)
	}
	return Math.floor(Math.random() * thing); // 0 to thing-1
}

export function createBench(name = ''){
	return new Suite(name)
		.on('start', () => {
			console.log(name);
		})
		.on('error', (event: { target: { error: Error } }) => {
			throw event.target.error;
		})
		.on('complete', function(){
			const benchs = [];
			
			// @ts-expect-error invalid this
			for(let i = 0; i < this.length; i++){
				// @ts-expect-error invalid this
				const hz = this[i].hz;
				const decimals = 
					hz > 100 ? 0 :  
					(hz > 1 ? 2 : 4)
				benchs.push({
					// @ts-expect-error invalid this
					name: this[i].name,
					hz: hz.toFixed(decimals),
					// @ts-expect-error invalid this
					runs: this[i].stats.sample.length,
					// @ts-expect-error invalid this
					tolerance: this[i].stats.rme,
				});
			}
	
			const namePad = benchs.reduce((acc, curr) => {
				if(curr.name.length > acc) return curr.name.length;
				return acc;
			}, 0);
			const hzPad = benchs.reduce((acc, curr) => {
				if(curr.hz.length > acc) return curr.hz.length;
				return acc;
			}, 0);
	
			for(const bench of benchs){
				console.log(
					`${bench.name.padEnd(namePad, ' ')} x ${
					bench.hz.padStart(hzPad, ' ')} ops/sec \xb1${
					bench.tolerance.toFixed(2)}% (${bench.runs} runs sampled)`
				);
			}
			console.log();
		});;
}