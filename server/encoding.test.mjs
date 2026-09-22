import assert from 'node:assert/strict';
import test from 'node:test';
import { contentEncodings } from './encoding.mjs';

test('static content negotiation honors browser preferences and exclusions', () => {
  assert.deepEqual(contentEncodings(), ['identity']);
  assert.deepEqual(contentEncodings('gzip, deflate, br, zstd'), [
    'br',
    'gzip',
    'identity',
  ]);
  assert.deepEqual(contentEncodings('gzip;q=0.8, br;q=0.3'), [
    'gzip',
    'br',
    'identity',
  ]);
  assert.deepEqual(contentEncodings('br;q=0,gzip;q=0'), ['identity']);
  assert.deepEqual(contentEncodings('*;q=0'), []);
  assert.deepEqual(contentEncodings('br;q=0,*;q=0.5'), ['gzip', 'identity']);
  assert.deepEqual(contentEncodings('gzip;q=0.5,identity;q=1'), [
    'identity',
    'gzip',
  ]);
  assert.deepEqual(contentEncodings('gzip;q=broken,br;q=1.1'), ['identity']);
});
