const { Suite } = require('benchmark');
const assert = require('assert');
const {
	createClockArgs, TIMES,
	initializeBench,
} = require('../utils.js');

const testBatch = [];
for(let i = 0; i < 1000; i++){
	testBatch.push(createClockArgs());
}

const NEGATIVE_REGEX = /^\s*-/;

const REGEX1 = /(\d+)(?<sep>:|-)(?:(\d{2})\k<sep>)?(\d{2}(?:\.\d+)?)( PM)?/;
function parseClock1(str, minutes = false){
	const match = str.match(REGEX1);
	if(match === null) return;
	let value = 0;

	if(match[3]){
		value +=
			parseInt(match[1]) * TIMES.H +
			parseInt(match[3]) * TIMES.M +
			parseFloat(match[4]) * TIMES.S;
	}else if(minutes){
		value += parseInt(match[1]) * TIMES.M;
		value += parseFloat(match[4]) * TIMES.S;
	}else{
		value += parseInt(match[1]) * TIMES.H;
		value += parseFloat(match[4]) * TIMES.M;
	}

	if(match[5]) value += TIMES.H * 12;

	return NEGATIVE_REGEX.test(str) ? -value : value;
}

const REGEX2 = /(\d+):(?:(\d{2}):)?(\d{2}(?:\.\d+)?)( PM)?/;
const REGEX23 = /(\d+)-(?:(\d{2})-)?(\d{2}(?:\.\d+)?)( PM)?/;
function parseClock2(str, minutes = false){
	const match = str.match(REGEX2) || str.match(REGEX23);
	if(match === null) return;
	let value = 0;

	if(match[2]){
		value += parseInt(match[1]) * TIMES.H +
				 parseInt(match[2]) * TIMES.M +
			   parseFloat(match[3]) * TIMES.S;
	}else if(minutes){
		value += parseInt(match[1]) * TIMES.M +
			   parseFloat(match[3]) * TIMES.S;
	}else{
		value += parseInt(match[1]) * TIMES.H +
			   parseFloat(match[3]) * TIMES.M;
	}

	if(match[4]) value += TIMES.H * 12;

	return NEGATIVE_REGEX.test(str) ? -value : value;
}

function parseClock3(str, minutes = false){
	const match = str.match(REGEX2) || str.match(REGEX23);
	if(match === null) return;
	let value = 0;

	if(match[2]){
		value += parseInt(match[1]) * TIMES.H +
				 parseInt(match[2]) * TIMES.M +
			   parseFloat(match[3]) * TIMES.S;
	}else if(minutes){
		value += parseInt(match[1]) * TIMES.M +
			   parseFloat(match[3]) * TIMES.S;
	}else{
		value += parseInt(match[1]) * TIMES.H +
			   parseFloat(match[3]) * TIMES.M;
	}

	if(match[4]) value += TIMES.H * 12;

	return NEGATIVE_REGEX.test(str) ? -value : value;
}

new Suite('parseClock')
	.add('1', () => {
		for(const { args, result } of testBatch){
			assert.equal(parseClock1(...args), result);
		}
	})
	.add('2', () => {
		for(const { args, result } of testBatch){
			assert.equal(parseClock2(...args), result);
		}
	})
	.add('3', () => {
		for(const { args, result } of testBatch){
			assert.equal(parseClock3(...args), result);
		}
	})
	.on('start', initializeBench)
	.run();