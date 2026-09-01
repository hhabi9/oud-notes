import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = resolve(projectDir, 'node_modules');
const vendorDir = resolve(projectDir, 'static', 'vendor');

const files = [
  ['marked/lib/marked.umd.js', 'marked.umd.js'],
  ['marked-footnote/dist/index.umd.js', 'marked-footnote.umd.js'],
  ['marked-katex-extension/lib/index.umd.js', 'marked-katex.umd.js'],
  ['dompurify/dist/purify.min.js', 'purify.min.js'],
  ['@highlightjs/cdn-assets/highlight.min.js', 'highlight.min.js'],
  ['@highlightjs/cdn-assets/styles/github.min.css', 'github.min.css'],
  ['@highlightjs/cdn-assets/styles/github-dark.min.css', 'github-dark.min.css'],
  ['katex/dist/katex.min.js', 'katex.min.js'],
  ['katex/dist/katex.min.css', 'katex.min.css'],
  ['mermaid/dist/mermaid.min.js', 'mermaid.min.js'],
  ['marked/LICENSE', 'licenses/marked.txt'],
  ['marked-footnote/package.json', 'licenses/marked-footnote-package.json'],
  ['marked-katex-extension/LICENSE', 'licenses/marked-katex-extension.txt'],
  ['dompurify/LICENSE', 'licenses/dompurify.txt'],
  ['@highlightjs/cdn-assets/LICENSE', 'licenses/highlightjs.txt'],
  ['katex/LICENSE', 'licenses/katex.txt'],
  ['mermaid/LICENSE', 'licenses/mermaid.txt']
];

await mkdir(resolve(vendorDir, 'licenses'), { recursive: true });
for (const [source, destination] of files) {
  await cp(resolve(modulesDir, source), resolve(vendorDir, destination));
}
await cp(
  resolve(modulesDir, 'katex', 'dist', 'fonts'),
  resolve(vendorDir, 'fonts'),
  { recursive: true }
);

console.log(`Vendored Markdown assets into ${vendorDir}`);
