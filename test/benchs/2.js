/* eslint-disable switch-colon-spacing */
/* eslint-disable default-case */
// @ts-ignore
const { Suite } = require('benchmark');
const { initializeBench } = require('../utils.js');
const assert = require('assert');

const TIMES = {
	Y:  1000 * 60 * 60 * 24 * 365.25, // 365.2425
	Mo: 1000 * 60 * 60 * 24 * 30,
	W:  1000 * 60 * 60 * 24 * 7,
	D:  1000 * 60 * 60 * 24,
	H:  1000 * 60 * 60,
	M:  1000 * 60,
	S:  1000,
	Ms: 1,
};

const language = {
	first: {
		Y: ['y'],
		W: ['w'],
		D: ['d'],
		H: ['h'],
		S: ['s'],
		Mo: ['mo', 'mt'],
		Ms: ['ms', 'mil'],
		M: ['m'],
	},
	determine(str){
		if(str[0] === 'y') return 'Y';
		if(str[0] === 'w') return 'W';
		if(str[0] === 'd') return 'D';
		if(str[0] === 'h') return 'H';
		if(str[0] === 's') return 'S';
		if(str[0] === 'm'){
			if(str[1] === 'o') return 'Mo';
			if(str[1] === 's') return 'Ms';
			if(str[1] === 't') return 'Mo';
			if(str[1] === 'i' && str[2] === 'l') return 'Ms';

			return 'M';
		}
	},
	determine2(str){
		switch(str[0]){
			case 'y': return 'Y';
			case 'w': return 'W';
			case 'd': return 'D';
			case 'h': return 'H';
			case 's': return 'S';
			case 'm':{
				switch(str[1]){
					case 't':
					case 'o':
						return 'Mo';
					case 's': return 'Ms';
					case 'i':
						if(str[2] === 'l') return 'Ms';
				}
				return 'M';
			}
		}
	},
	determine3(str){
		switch(str){
			case 'years':
			case 'year':
			case 'yrs':
			case 'yr':
			case 'y':
				return 'Y';
			case 'months':
			case 'month':
			case 'mth':
			case 'mo':
				return 'Mo';
			case 'weeks':
			case 'week':
			case 'w':
				return 'W';
			case 'days':
			case 'day':
			case 'd':
				return 'D';
			case 'hours':
			case 'hour':
			case 'hrs':
			case 'hr':
			case 'h':
				return 'H';
			case 'minutes':
			case 'minute':
			case 'mins':
			case 'min':
			case 'm':
				return 'M';
			case 'seconds':
			case 'second':
			case 'secs':
			case 'sec':
			case 's':
				return 'S';
			case 'milliseconds':
			case 'millisecond':
			case 'mseconds':
			case 'msecond':
			case 'msecs':
			case 'msec':
			case 'ms':
				return 'Ms';
		}
	},
	firstLetter: {
		y: 'Y',
		w: 'W',
		d: 'D',
		h: 'H',
		s: 'S',
	},
	dict: {},
	dict2: {},
	dict3: new Map(),
	Y: {
		all: [
			'years',
			'year',
			'yrs',
			'yr',
			'y',
		],
		plural: 'years',
		singular: 'year',
		shortSingular: 'y',
	},
	Mo: {
		all: [
			'months',
			'month',
			'mth',
			'mo',
		],
		plural: 'months',
		singular: 'month',
		shortSingular: 'mo',
	},
	W: {
		all: [
			'weeks',
			'week',
			'w',
		],
		plural: 'weeks',
		singular: 'week',
		shortSingular: 'w',
	},
	D: {
		all: [
			'days',
			'day',
			'd',
		],
		plural: 'days',
		singular: 'day',
		shortSingular: 'd',
	},
	H: {
		all: [
			'hours',
			'hour',
			'hrs',
			'hr',
			'h',
		],
		plural: 'hours',
		singular: 'hour',
		shortSingular: 'h',
	},
	M: {
		all: [
			'minutes',
			'minute',
			'mins',
			'min',
			'm',
		],
		plural: 'minutes',
		singular: 'minute',
		shortSingular: 'm',
	},
	S: {
		all: [
			'seconds',
			'second',
			'secs',
			'sec',
			's',
		],
		plural: 'seconds',
		singular: 'second',
		shortSingular: 's',
	},
	Ms: {
		all: [
			'milliseconds',
			'millisecond',
			'mseconds',
			'msecond',
			'msecs',
			'msec',
			'ms',
		],
		plural: 'milliseconds',
		singular: 'millisecond',
		shortSingular: 'ms',
	},
};

for(const key in TIMES){
	for(const notation of language[key].all){
		language.dict[notation] = key;
		language.dict2[notation] = TIMES[key];
		language.dict3.set(notation, TIMES[key]);
	}
}

const allNotations = [];

for(const key in TIMES){
	const notations = language[key];

	for(const notation of notations.all){
		allNotations.push({
			notation,
			value: TIMES[key],
		});
	}
}

new Suite('Notation to time methods')
	.add('1 (actual method)', () => {
		for(const { notation, value } of allNotations){
			assert.equal(value, language.dict2[notation]);
		}
	})
	.add('2', () => {
		for(const { notation, value } of allNotations){
			assert.equal(value, language.dict3.get(notation));
		}
	})
	.add('3 (hardcoded) (vercel/ms method)', () => {
		for(const { notation, value } of allNotations){
			assert.equal(value, TIMES[language.determine3(notation)]);
		}
	})
	.add('4', () => {
		for(const { notation, value } of allNotations){
			assert.equal(value, TIMES[language.dict[notation]]);
		}
	})
	.add('5 (hardcoded)', () => {
		for(const { notation, value } of allNotations){
			assert.equal(value, TIMES[
				language.determine2(notation)
			]);
		}
	})
	.add('6 (hardcoded)', () => {
		for(const { notation, value } of allNotations){
			assert.equal(value, TIMES[
				language.determine(notation)
			]);
		}
	})
	.add('7', () => {
		for(const { notation, value } of allNotations){
			if('firstLetter' in language && notation[0] in language.firstLetter){
				assert.equal(value, TIMES[language.firstLetter[notation[0]]]);
			}else for(const key in TIMES){
				if(language[key].all.includes(notation)){
					assert.equal(value, TIMES[key]);
					break;
				}
			}
		}
	})
	.add('8', () => {
		for(const { notation, value } of allNotations){
			for(const key in language.first){
				if(language.first[key].some(x => notation.startsWith(x))){
					assert.equal(value, TIMES[key]);
					break;
				}
			}
		}
	})
	.add('9 (previous method)', () => {
		for(const { notation, value } of allNotations){
			for(const key in TIMES){
				if(language[key].all.includes(notation)){
					assert.equal(value, TIMES[key]);
					break;
				}
			}
		}
	})
	.on('start', initializeBench)
	.run();