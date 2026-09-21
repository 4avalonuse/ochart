import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'https://oraculum-data-api.4avalonuse.workers.dev';

async function json(path, options) {
  const response = await fetch(BASE + path, {
    ...options,
    headers: { Accept:'application/json', ...(options?.headers || {}) },
    cache:'no-store'
  });
  const body = await response.json();
  return { response, body };
}

test('Data API health contract', async () => {
  const { response, body } = await json('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'oraculum-data-api');
  assert.equal(body.database, 'd1');
});

test('Data API catalog contract', async () => {
  const { response, body } = await json('/api/datasets');
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);

  for (const dataset of body.data) {
    for (const field of ['id','name','provider','symbol','kind','interval','currency']) {
      assert.ok(dataset[field], `missing dataset field: ${field}`);
    }
  }
});

test('representative dataset contract', async () => {
  const { response, body } = await json('/api/datasets/btc-usd-yahoo-1d');
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.meta.datasetId, 'btc-usd-yahoo-1d');
  assert.equal(body.meta.provider, 'yahoo');
  assert.equal(body.meta.interval, '1d');
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);

  const row = body.data[body.data.length - 1];
  for (const field of ['t','o','h','l','c','v']) {
    assert.equal(typeof row[field], 'number');
  }
});

test('unknown dataset returns the public 404 contract', async () => {
  const { response, body } = await json('/api/datasets/__does_not_exist__');
  assert.equal(response.status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'dataset_not_found');
});
