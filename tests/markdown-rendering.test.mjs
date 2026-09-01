import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { marked } from 'marked';
import markedFootnote from 'marked-footnote';
import markedKatex from 'marked-katex-extension';

marked.use({ gfm: true, breaks: false });
marked.use(markedFootnote());
marked.use(markedKatex({ throwOnError: false, nonStandard: true }));

test('renders the complete Markdown feature fixture', async () => {
  const source = await readFile(new URL('./fixtures/full_markdown.md', import.meta.url), 'utf8');
  const html = marked.parse(source);

  for (const expected of [
    '<h1>',
    '<h4>',
    '<del>',
    '<a href=',
    '<img src=',
    '<blockquote>',
    '<ol>',
    '<ul>',
    'type="checkbox"',
    '<table>',
    '<hr>',
    'language-javascript',
    'class="katex"',
    'language-mermaid',
    'class="footnotes"',
    '<mark>',
  ]) {
    assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
