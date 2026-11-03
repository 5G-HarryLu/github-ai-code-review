import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Nodes } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { sanitize, sanitizeInline } from '../src/markdown.ts';

const ZWSP = '​';

/** Node types GitHub would see when rendering the output. */
function types(markdown: string): Set<string> {
  const found = new Set<string>();
  const walk = (n: Nodes) => {
    found.add(n.type);
    if ('children' in n) n.children.forEach(walk);
  };
  walk(fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }));
  return found;
}

test('stops mentions, cross-references, links, images and raw HTML', () => {
  const out = sanitize('ping @alice and dev@corp.example about #12 and o/r#3, see [here](https://evil.example) ![x](https://t.example/p.png) <img src=x> www.evil.example', 1000);
  for (const t of ['link', 'image', 'html']) assert.ok(!types(out).has(t), `${t} in ${out}`);
  assert.ok(out.includes(`@${ZWSP}alice`));
  assert.ok(out.includes(`@${ZWSP}corp`));
  assert.ok(out.includes(`#${ZWSP}12`) && out.includes(`#${ZWSP}3`));
  assert.ok(!out.includes('www.evil'));
});

test('drops reference-style images and their definitions', () => {
  const out = sanitize('![a][r]\n\n[r]: //t.example/p.png', 1000);
  assert.ok(!types(out).has('image') && !types(out).has('definition'));
  assert.ok(!out.includes('t.example'));
});

test('a code span cannot span paragraphs to shield the text between them', () => {
  const out = sanitize('a ` b\n\n@alice <img src=x>\n\nc ` d', 1000);
  assert.ok(out.includes(`@${ZWSP}alice`));
  assert.ok(!types(out).has('html'));
});

test('a stray fence marker inside a sentence does not swallow what follows', () => {
  const out = sanitize('fenced block 只接受行首的 ```。\n\n- 第二點', 1000);
  assert.ok(!types(out).has('code'));
  assert.ok(types(out).has('list'));
});

test('keeps code as written and closes an unterminated fence', () => {
  const out = sanitize('use `List<T>` and\n\n```go\nif a < b && c > d { @x mu.Lock() }', 1000);
  assert.ok(out.includes('`List<T>`'));
  assert.ok(out.includes('if a < b && c > d { @x mu.Lock() }'));
  assert.ok(out.trimEnd().endsWith('```'));
});

test('sanitizeInline returns one line', () => {
  const out = sanitizeInline('# title\n- with `code` and @bob', 200);
  assert.ok(!out.includes('\n'));
  assert.ok(out.includes('`code`'));
  assert.ok(out.includes(`@${ZWSP}bob`));
});
