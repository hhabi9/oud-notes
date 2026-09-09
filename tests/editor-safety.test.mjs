import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../static/app.js', import.meta.url), 'utf8');
function harness(storage = new Map()) {
  const nodes = new Map();
  const downloads = [];
  const node = () => ({
    value: '', textContent: '', lastChild: { textContent: '' },
    classList: { add() {}, remove() {}, toggle() {} },
    listeners: {}, addEventListener(event, handler) { this.listeners[event] = handler; },
    click() { downloads.push(this.href); },
    get innerHTML() { return this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    set innerHTML(value) { this.html = value; },
  });
  const context = vm.createContext({
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: {
      createElement: node, documentElement: { dataset: {} }, addEventListener() {},
      querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); },
    },
    marked: { use() {} }, markedFootnote() {}, markedKatex() {}, mermaid: { initialize() {} },
    setTimeout() { return 1; }, clearTimeout() {},
    fetch: () => new Promise(() => {}), URLSearchParams,
  });
  vm.runInContext(source, context);
  const run = (code) => vm.runInContext(code, context);
  run('renderNotes = () => {}; renderFolders = () => {};');
  return { run, storage, nodes, downloads };
}

test('folder attribute values escape quotes and markup', () => {
  const { run } = harness();
  assert.equal(run(`escapeHtml('" onclick="alert(1)')`), '&quot; onclick=&quot;alert(1)');
  assert.equal(run(`escapeHtml("<&'")`), '&lt;&amp;&#39;');
});

test('edits survive closing before the debounce timer fires', () => {
  const { run, storage } = harness();
  run(`state.selectedId = 1; elements.content.value = 'latest draft'; scheduleSave();`);
  const reopened = harness(storage);
  assert.equal(reopened.run('drafts[1].content'), 'latest draft');
  reopened.run(`api = async (path, options) => options ? {id: 1, ...JSON.parse(options.body)} : [];`);
  return reopened.run('flushSaves()').then(() => {
    assert.equal(storage.get('oud-pending-edits'), '{}');
  });
});

test('failed saves retain the recovery draft and block flushing', async () => {
  const { run, storage } = harness();
  run(`state.selectedId = 1; elements.content.value = 'keep me'; scheduleSave(); api = async () => { throw new Error('offline'); };`);
  await assert.rejects(run('flushSaves()'), /offline/);
  assert.equal(JSON.parse(storage.get('oud-pending-edits'))[1].content, 'keep me');
});

test('saves are serialized and an old response does not clear a newer draft', async () => {
  const { run, storage } = harness();
  run(`globalThis.writes = []; globalThis.release = null;
    api = async (path, options) => {
      if (!options) return [];
      const payload = JSON.parse(options.body); writes.push(payload.content);
      if (writes.length === 1) await new Promise(resolve => { release = resolve; });
      return {id: 1, ...payload};
    };
    state.selectedId = 1; elements.content.value = 'old'; scheduleSave();
    globalThis.first = queueSave(1, drafts[1], 1);`);
  await new Promise(setImmediate);
  run(`elements.content.value = 'new'; scheduleSave(); globalThis.second = queueSave(1, drafts[1], 2);`);
  assert.equal(run('writes.length'), 1);
  run('release()');
  await run('first');
  await run('second');
  assert.equal(run('writes.join(",")'), 'old,new');
  assert.equal(storage.get('oud-pending-edits'), '{}');
});

test('switching back to a note displays its pending draft', () => {
  const { run } = harness();
  run(`state.selectedId = 1; elements.content.value = 'new'; elements.tags.value = 'one, two'; scheduleSave();
    fillEditor({id: 1, title: 'note', content: 'old', tags: [], folder: '', updated_at: new Date().toISOString()});`);
  assert.equal(run('elements.content.value'), 'new');
  assert.equal(run('elements.tags.value'), 'one, two');
});

test('export waits for the latest edit to reach the server', async () => {
  const { run, nodes, downloads } = harness();
  run(`state.selectedId = 1; elements.content.value = 'export this'; scheduleSave();
    api = async (path, options) => {
      if (!options) return [];
      await new Promise(resolve => { globalThis.finishSave = resolve; });
      globalThis.savedContent = JSON.parse(options.body).content;
      return {id: 1, ...JSON.parse(options.body)};
    };`);
  const exporting = nodes.get('#export-note').listeners.click();
  await new Promise(setImmediate);
  assert.deepEqual(downloads, []);
  run('finishSave()');
  await exporting;
  assert.equal(run('savedContent'), 'export this');
  assert.deepEqual(downloads, ['/api/notes/1/export']);
});
