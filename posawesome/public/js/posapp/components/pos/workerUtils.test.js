import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeWorker } from './workerUtils.js';

test('initializeWorker creates worker only once and emits no warnings', () => {
  let constructionCount = 0;
  const originalWorker = global.Worker;
  const originalWarn = console.warn;
  let warnCount = 0;

  global.Worker = class {
    constructor(url, opts) {
      constructionCount++;
      this.url = url;
      this.opts = opts;
    }
    terminate() {}
  };

  console.warn = () => {
    warnCount++;
  };

  let worker = initializeWorker(null);
  worker = initializeWorker(worker);

  assert.equal(constructionCount, 1);
  assert.equal(warnCount, 0);

  console.warn = originalWarn;
  global.Worker = originalWorker;
});
