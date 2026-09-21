import test from 'node:test';
import assert from 'node:assert/strict';
import { DataSanitizer } from '../src/core/sanitizer.js';

const base = [
  { t: 1700000000000, o: 100.25, h: 101.75, l: 99.5, c: 101.125, v: 12.5 },
  { t: 1700000060000, o: 101.125, h: 102.5, l: 100.75, c: 102.25, v: 13.75 },
  { t: 1700000120000, o: 102.25, h: 103.25, l: 101.5, c: 103.125, v: 14.25 }
];

test('preserves OHLC decimal precision', () => {
  const result = new DataSanitizer().sanitize(base);
  assert.deepEqual(result.data.map(({ o, h, l, c }) => ({ o, h, l, c })), [
    { o: 100.25, h: 101.75, l: 99.5, c: 101.125 },
    { o: 101.125, h: 102.5, l: 100.75, c: 102.25 },
    { o: 102.25, h: 103.25, l: 101.5, c: 103.125 }
  ]);
});

test('outlier repair is opt-in and disabled by default', () => {
  const raw = [
    { t: 1700000000000, o: 100, h: 101, l: 99, c: 100, v: 10 },
    { t: 1700000060000, o: 100, h: 1000, l: 99, c: 1000, v: 20 },
    { t: 1700000120000, o: 1000, h: 1001, l: 999, c: 100, v: 10 }
  ];

  const defaultResult = new DataSanitizer().sanitize(raw);
  assert.equal(defaultResult.stats.outliersDetected, 0);
  assert.equal(defaultResult.data[1].c, 1000);

  const optInResult = new DataSanitizer({ detectOutliers: true }).sanitize(raw);
  assert.equal(optInResult.stats.outliersDetected, 1);
  assert.equal(optInResult.data[1]._interpolated, true);
  assert.equal(optInResult.data[1].c, 100);
});