const { Suite } = require('benchmark');
const assert = require('assert');
const {
	createClockArgs, TIMES,
} = require('../utils.js');

const testBatch = [];
for(let i = 0; i < 1000; i++){
	testBatch.push(createClockArgs());
}

const NEGATIVE_REGEX = /^\s*-/;

const REGEX1 = /(\d+)(?<sep>:|-)(?:(\d\d)\k<sep>)?(\d\d(?:\.\d+)?)( PM)?/;
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

const REGEX2 = /(\d+):(?:(\d\d):)?(\d\d(?:\.\d+)?)( PM)?/;
const REGEX23 = /(\d+)-(?:(\d\d)-)?(\d\d(?:\.\d+)?)( PM)?/;
function parseClock2(str, minutes = false){
	const match = str.match(REGEX2) || str.match(REGEX23);
	if(match === null) return;
	let value = 0;

	if(match[2]){
		value +=
			parseInt(match[1]) * TIMES.H +
			parseInt(match[2]) * TIMES.M +
			parseFloat(match[3]) * TIMES.S;
	}else if(minutes){
		value += parseInt(match[1]) * TIMES.M;
		value += parseFloat(match[3]) * TIMES.S;
	}else{
		value += parseInt(match[1]) * TIMES.H;
		value += parseFloat(match[3]) * TIMES.M;
	}

	if(match[4]) value += TIMES.H * 12;

	return NEGATIVE_REGEX.test(str) ? -value : value;
}

new Suite('Notation to time methods')
	.add('1', () => {
		for(const { args, result } of testBatch){
			assert(parseClock1(...args), result);
		}
	})
	.add('2', () => {
		for(const { args, result } of testBatch){
			assert(parseClock2(...args), result);
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