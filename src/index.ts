export {
	Language,
	Notations,
	TIMES,
	type LanguageData,
	type NotationsData,
	type Unit,
} from './languages/core.ts';
export { LANGUAGES } from './languages/languages.ts';
export { parse, parse as parseTime } from './parse.ts';
export { parseClock, parseClock as clock } from './clock.ts';
export { format, format as formatTime } from './format.ts';
export { buildFastParse } from './fast/parse.ts';
export { buildFastFormat } from './fast/format.ts';

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
