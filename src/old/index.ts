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
 * - v1 (regex): Uses regex.exec() - simple but slow
 * - v2 (isLetter): Char scan with /\p{L}/u Unicode test
 * - v3a (charCode boundary): Inline charCode ranges, still uses slice
 * - v3c (length dispatch): Groups by length, extra check overhead
 * 
 * Format versions:
 * - v2 (separate functions): Two functions for short/long
 * - v3 (inlined constants): Pre-computed threshold literals
 */

// Parse implementations
export { buildFastParse as buildFastParseV1 } from './parse/fast-v1.js';
export { buildFastParse as buildFastParseV2 } from './parse/fast-v2.js';
export { buildFastParse as buildFastParseV3a } from './parse/fast-v3a.js';
export { buildFastParse as buildFastParseV3c } from './parse/fast-v3c.js';

// Format implementations
export { buildFastFormat as buildFastFormatV2 } from './format/fast-v2.js';
export { buildFastFormat as buildFastFormatV3 } from './format/fast-v3.js';