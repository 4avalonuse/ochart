import test from 'node:test';
import assert from 'node:assert/strict';
import {
  intervalToTf,
  tfToInterval,
  findSiblingDataset
} from '../src/core/dataset-utils.js';

const catalog = [
  { id:'btc-usd-yahoo-1d', provider:'yahoo', symbol:'BTC-USD', kind:'ohlcv', currency:'USD', interval:'1d' },
  { id:'btc-usd-yahoo-1h', provider:'yahoo', symbol:'BTC-USD', kind:'ohlcv', currency:'USD', interval:'1h' },
  { id:'btc-usd-binance-us-1d', provider:'binance-us', symbol:'BTCUSD', kind:'ohlcv', currency:'USD', interval:'1d' }
];

test('maps monthly interval between API and UI notation', () => {
  assert.equal(intervalToTf('1M'), '1mo');
  assert.equal(tfToInterval('1mo'), '1M');
  assert.equal(intervalToTf('1d'), '1d');
});

test('finds sibling by catalog metadata, not by id suffix', () => {
  const current = catalog[0];
  assert.equal(findSiblingDataset(catalog, current, '1h')?.id, 'btc-usd-yahoo-1h');
  assert.equal(findSiblingDataset(catalog, current, '1d'), null);
});

test('does not cross provider or symbol boundaries', () => {
  const current = catalog[0];
  assert.equal(findSiblingDataset(catalog, current, '1d'), null);
  assert.equal(findSiblingDataset(catalog, catalog[2], '1h'), null);
});
