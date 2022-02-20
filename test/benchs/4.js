/* eslint-disable no-unused-expressions */
/* eslint-disable default-case */
const { Suite } = require('benchmark');
const testBatch = [];

function abc(obj1, obj2){
	// con un array
	const keys = Object.keys(obj1);

	for(const key in obj2){
		if(keys.includes(key)){
			keys.splice(keys.indexOf(key), 1);
		}else{
			keys.push(key);
		}
	}

	return keys;
}

function abc1(obj1, obj2){
	// con un set
	const keys = new Set(Object.keys(obj1));

	for(const key in obj2){
		if(keys.has(key)){
			keys.delete(key);
		}else{
			keys.add(key);
		}
	}

	return Array.from(keys);
}

new Suite('')
	.add('1', () => {
		abc({ a: 1, b: 2 }, { a: 1, c: 3 });
	})
	.add('2', () => {
		abc1({ a: 1, b: 2 }, { a: 1, c: 3 });
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