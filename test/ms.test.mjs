// Tests the ESM build (lib/esm/index.js) using import syntax
import { describe, it, expect } from '@jest/globals';
import { createRequire } from 'module';
import * as lib from '../lib/esm/index.js';
import vercelMS from 'ms';

const require = createRequire(import.meta.url);

require('./suite.cjs')(lib, vercelMS, { describe, it, expect });
