import assert from 'node:assert/strict';
import { test } from 'node:test';
import { annotatePatch } from '../src/diff.ts';

test('numbers added and context lines with new-file line numbers', () => {
  const patch = ['@@ -10,4 +10,5 @@ func a() {', ' keep', '-old', '+new1', '+new2', ' tail', '\\ No newline at end of file'].join('\n');
  const { text, lines } = annotatePatch(patch);
  assert.deepEqual([...lines], [10, 11, 12, 13]);
  assert.match(text, /^\s+10  keep$/m);
  assert.match(text, /^\s+11 \+new1$/m);
  assert.match(text, /^\s+13  tail$/m);
  assert.match(text, /^\s+-old$/m);
});

test('restarts numbering at each hunk', () => {
  const patch = ['@@ -1,1 +1,1 @@', '+a', '@@ -50,2 +80,2 @@', ' b', '+c'].join('\n');
  assert.deepEqual([...annotatePatch(patch).lines], [1, 80, 81]);
});

test('does not count removed lines', () => {
  const patch = ['@@ -5,3 +5,1 @@', '-x', '-y', ' z'].join('\n');
  assert.deepEqual([...annotatePatch(patch).lines], [5]);
});
