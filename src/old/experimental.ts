/**
 * Experimental parse implementations for benchmarking.
 * 
 * These are experimental optimizations being evaluated:
 * - v3.3: String switches instead of charCode
 * - v3.4: Inline boundary check (FASTEST for valid inputs)
 * - v3.5: Bitwise range checks for digit detection
 * - v3.6: Case-insensitive without .toLowerCase() (FASTEST for invalid inputs)
 */

export { buildFastParse as buildFastParseV3_3 } from './parse/fast3-3.js';
export { buildFastParse as buildFastParseV3_4 } from './parse/fast3-4.js';
export { buildFastParse as buildFastParseV3_5 } from './parse/fast3-5.js';
export { buildFastParse as buildFastParseV3_6 } from './parse/fast3-6.js';