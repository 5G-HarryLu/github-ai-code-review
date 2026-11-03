import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectFiles } from '../src/context.ts';
import { COMMENT_MARKER, type PullRequest } from '../src/github.ts';
import { render, sanitize } from '../src/render.ts';
import type { ReviewResult } from '../src/review.ts';

const ZWSP = '​';

test('sanitize stops mentions, links, images and raw HTML outside code', () => {
  const out = sanitize('ping @alice see [here](https://evil.example) ![x](https://t.example/p.png) <img src=x> www.evil.example', 1000);
  assert.ok(!out.includes('@alice'));
  assert.ok(out.includes(`@${ZWSP}alice`));
  assert.ok(!/\]\(/.test(out));
  assert.ok(!out.includes('https://'));
  assert.ok(!out.includes('<img'));
  assert.ok(!out.includes('www.evil'));
});

test('sanitize leaves code spans and fences as written', () => {
  const src = 'use `List<T>` and\n```go\nif a < b && c > d { mu.Lock() }\n```\nnot @team';
  const out = sanitize(src, 1000);
  assert.ok(out.includes('`List<T>`'));
  assert.ok(out.includes('if a < b && c > d { mu.Lock() }'));
  assert.ok(out.includes(`@${ZWSP}team`));
});

test('sanitize truncates and closes an open fence', () => {
  const out = sanitize(`\`\`\`go\n${'x'.repeat(50)}\n\`\`\``, 20);
  assert.equal((out.match(/```/g) ?? []).length % 2, 0);
  assert.ok(out.includes('已截斷'));
});

test('keeps only findings that cite a line in the diff', () => {
  const pr: PullRequest = { number: 7, title: 't', body: '', author: 'dev', baseRef: 'develop', headRef: 'feat', headSha: 'abcdef1234567', changedFiles: 1 };
  const selection = selectFiles([{ filename: 'src/a.go', status: 'modified', additions: 1, deletions: 0, patch: '@@ -1,1 +1,2 @@\n a\n+b' }], 1);
  const review: ReviewResult = {
    model: 'claude-opus-5-5',
    inputTokens: 1000,
    outputTokens: 200,
    output: {
      summary: 'one race',
      findings: [
        { file: 'src/a.go', line: 2, severity: 'critical', title: 'race on balance', detail: 'lock it' },
        { file: 'src/a.go', line: 99, severity: 'major', title: 'line not in diff', detail: '' },
        { file: 'other.go', line: 1, severity: 'minor', title: 'file not reviewed', detail: '' },
      ],
    },
  };
  const body = render({ owner: 'o', repo: 'r' }, pr, selection, review);
  assert.ok(body.startsWith(COMMENT_MARKER));
  assert.ok(body.includes('race on balance'));
  assert.ok(body.includes('https://github.com/o/r/blob/abcdef1234567/src/a.go#L2'));
  assert.ok(!body.includes('line not in diff'));
  assert.ok(!body.includes('file not reviewed'));
  assert.ok(body.includes('2 則發現指向 diff 以外的行'));
});
