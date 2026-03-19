// Tests the CJS build (lib/cjs/index.cjs) using require syntax
const lib = require('../lib/cjs/index.cjs');
const vercelMS = require('ms');

require('./suite.cjs')(lib, vercelMS, { describe, it, expect });
