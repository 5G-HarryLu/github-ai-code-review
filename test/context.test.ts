import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectFiles } from '../src/context.ts';
import type { ChangedFile } from '../src/github.ts';

const file = (filename: string, patch?: string, status = 'modified'): ChangedFile => ({ filename, status, additions: 1, deletions: 0, patch });
const PATCH = '@@ -1,1 +1,2 @@\n a\n+b';

test('reports every file it leaves out, with a reason', () => {
  const sel = selectFiles(
    [
      file('src/app.go', PATCH),
      file('package-lock.json', PATCH),
      file('web/dist/app.js', PATCH),
      file('img/logo.png'),
      file('old.go', '@@ -1,1 +0,0 @@\n-a', 'removed'),
    ],
    5,
  );
  assert.deepEqual(sel.files.map(f => f.filename), ['src/app.go']);
  assert.deepEqual(
    sel.skipped.map(s => s.filename),
    ['package-lock.json', 'web/dist/app.js', 'img/logo.png', 'old.go'],
  );
  assert.ok(sel.skipped.every(s => s.reason.length > 0));
  assert.equal(sel.unlisted, 0);
});

test('skips files beyond the size budget instead of truncating them', () => {
  const big = `@@ -1,1 +1,100 @@\n${'+x\n'.repeat(100)}`;
  const sel = selectFiles([file('a.go', big), file('b.go', big), file('c.go', PATCH)], 3, 1500);
  assert.deepEqual(sel.files.map(f => f.filename), ['a.go', 'c.go']);
  assert.deepEqual(sel.skipped, [{ filename: 'b.go', reason: '超過單次審查的大小上限' }]);
});

test('counts files the API did not list', () => {
  assert.equal(selectFiles([file('a.go', PATCH)], 3005).unlisted, 3004);
});
