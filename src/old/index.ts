/**
 * Legacy implementations kept for benchmarking comparison.
 *
 * These implementations represent earlier optimization attempts that were superseded
 * by faster versions. They are kept here to:
 * 1. Allow performance regression testing
 * 2. Serve as reference for future optimizations
 * 3. Document what didn't work as well
 *
 * Parse versions:
 * - v0: trie with .toLowerCase() (original current)
 * - v1: regex + switch
 * - v2: isLetter scan with /\p{L}/u
 * - v3: charCode boundary (was v3a)
 * - v4: length dispatch (was v3c)
 * - v5: string switch
 * - v6: inline check
 * - v7: bitwise digit detection
 * - v8: case-insensitive without .toLowerCase()
 * - v9: combined all optimizations (CURRENT)
 *
 * Format versions:
 * - v1: separate functions for short/long (was v2)
 * - v2: inlined constants (was v3)
 */

// Parse implementations
export { buildFastParse as buildFastParseV0 } from './parse/v0.js';
export { buildFastParse as buildFastParseV1 } from './parse/v1.js';
export { buildFastParse as buildFastParseV2 } from './parse/v2.js';
export { buildFastParse as buildFastParseV3 } from './parse/v3.js';
export { buildFastParse as buildFastParseV4 } from './parse/v4.js';
export { buildFastParse as buildFastParseV5 } from './parse/v5.js';
export { buildFastParse as buildFastParseV6 } from './parse/v6.js';
export { buildFastParse as buildFastParseV7 } from './parse/v7.js';
export { buildFastParse as buildFastParseV8 } from './parse/v8.js';
export { buildFastParse as buildFastParseV9 } from './parse/v9.js';

// Format implementations
export { buildFastFormat as buildFastFormatV1 } from './format/v1.js';
export { buildFastFormat as buildFastFormatV2 } from './format/v2.js';
