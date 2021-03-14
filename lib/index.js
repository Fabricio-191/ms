const TIMES = {
	MS: 1,
	SECOND: 1000,
	MINUTE: 1000 * 60,
	HOUR: 1000 * 60 * 60,
	DAY: 1000 * 60 * 60 * 24,
	WEEK: 1000 * 60 * 60 * 24 * 7,
	YEAR: 1000 * 60 * 60 * 24 * 365.25,
}

const NOTATIONS = {
	YEAR: ['years', 'year', 'yrs', 'yr', 'y', 'año', 'años'],
	WEEK: ['weeks', 'week', 'w', 'semanas', 'semana', 'sem'],
	DAY: ['days', 'day', 'd', 'dias', 'dia'],
	HOUR: ['hours', 'hour', 'hrs', 'hr', 'h', 'horas', 'hora'],
	MINUTE: ['minutes', 'minute', 'mins', 'min', 'm', 'minutos', 'minuto'],
	SECOND: [
		'seconds', 'second', 'secs', 'sec', 's', 
		'segundos', 'segundo', 'segs', 'seg'
	],
	MS: [
		'milliseconds', 'millisecond', 'msecs', 'msec', 'ms', 
		'milisegundos', 'milisegundo', 'msegs', 'mseg',
	]
}

const ALL_NOTATIONS = Object.values(NOTATIONS).reduce(
	(acc, notations) => [...acc, ...notations], []
);
const REGEX = new RegExp(`^(-?(?:\\d+)?\\.?\\d+) *(${ALL_NOTATIONS.join('?|')})?$`, 'i')

/**
  * Parse or format the given `val`.
  *
  * Options:
  *
  *  - `long` verbose formatting [false]
  *
  * @param {String|Number} value
  * @param {Object} [options]
  * @throws {Error} throw an error if val is not a non-empty string or a number
  * @return {String|Number}
  * @api public
  */
module.exports = function(value, options = {}){
	const type = typeof value;

	if(type === 'string' && value.length > 0){
	 	return parse(value);
	}else if(type === 'number' && isFinite(value)){
	 	return format(value, options.long);
	}
	throw new Error(
	 	'val is not a non-empty string or a valid number. val=' +
	   	JSON.stringify(value)
	);
};

function parse(str){
	const match = REGEX.exec(str);
	if(!match) return;

	const number = parseFloat(match[1]);
	const type = (match[2] || 'ms').toLowerCase();

	for(const key in NOTATIONS){
		if(NOTATIONS[key].includes(type)){
			return number * TIMES[key];
		}
	}

	return undefined;
}

function format(miliseconds, long){
	const isNegative = miliseconds < 0;
	miliseconds = Math.abs(miliseconds);

	for(let key of ['YEAR', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'MS']){
		if(miliseconds < TIMES[key]) continue;
		const value = Math.round(miliseconds / TIMES[key])
		
		let str = '';
		if(isNegative) str = '-';
		str += value;

		if(long){
			str += ` ${key}`;
			if(value !== 1 && key !== 'MS') str += 's';
		}else{
			str += key[0];
			if(key === 'MS') str += 's'
		}
			
		return str.toLowerCase();
	}

	return '';
}