/* eslint-disable no-unused-expressions */
/* eslint-disable default-case */
const { Suite } = require('benchmark');

new Suite('')
	.add('1', () => {
		
	})
	.add('2', () => {
		
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