export {
	Language,
	Notations,
	TIMES,
	UNITS,
	type LanguageData,
	type NotationsData,
	type Unit,
} from './core/index.ts';
export { LANGUAGES, type LanguageKey } from './core/languages.ts';
export { parse, parse as parseTime } from './parse/normal.ts';
export { parseClock, parseClock as clock } from './clock.ts';
export { format, format as formatTime } from './format/normal.ts';
export { buildFastParse } from './parse/fast.ts';
export {
	buildFastParseV3_3 as buildFastParse3_3,
	buildFastParseV3_4 as buildFastParse3_4,
	buildFastParseV3_5 as buildFastParse3_5,
	buildFastParseV3_6 as buildFastParse3_6,
} from './old/experimental.ts';
export { buildFastFormat } from './format/fast.ts';

// https://github.com/vercel/ms/issues
// https://github.com/Fabricio-191/ms
// https://github.com/Fabricio-191/youtube/blob/main/docs/list.md

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
// https://nodejs.org/api/assert.html

// https://github.com/vercel/ms/issues/59
// https://github.com/sindresorhus/pretty-ms
// https://github.com/KartikeSingh/ms-prettify
// https://github.com/c0bra/text2num.js/blob/master/lib/text2num.js
// https://github.com/Raul-Tech-Support/simple-duration-converter/blob/main/src/simple-duration.js

// Add popular languages (chinese/mandarin, hindi, french, arabic, russian, portuguese, turkish, korean)

// https://docs.oracle.com/cd/E41183_01/DR/Time_Formats.html
// https://www.gnu.org/software/pspp/manual/html_node/Time-and-Date-Formats.html
// https://en.wikipedia.org/wiki/ISO_8601
// https://en.wikipedia.org/wiki/24-hour_clock
