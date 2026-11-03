import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectFiles } from '../src/context.ts';
import { COMMENT_MARKER, type PullRequest } from '../src/github.ts';
import { render } from '../src/render.ts';
import type { ReviewResult } from '../src/review.ts';

const pr: PullRequest = { number: 7, title: 't', body: '', author: 'dev', baseRef: 'develop', headRef: 'feat', headSha: 'abcdef1234567', changedFiles: 1 };
const selection = selectFiles([{ filename: 'src/a.go', status: 'modified', additions: 1, deletions: 0, patch: '@@ -1,1 +1,2 @@\n a\n+b' }], 1);

const assessment = (comment: string) => ({ rating: 'good' as const, comment });
const review: ReviewResult = {
  model: 'claude-opus-5-5',
  inputTokens: 1000,
  outputTokens: 200,
  output: {
    overview: '整體可以，有一個 race。',
    aspects: {
      design: assessment('設計評語'),
      correctness: { rating: 'fair', comment: '正確性評語' },
      concurrency: { rating: 'poor', comment: '並行評語' },
      security: { rating: 'na', comment: '沒有安全相關的變更' },
      performance: assessment('效能評語'),
      style: assessment('風格評語'),
    },
    findings: [
      { aspect: 'concurrency', file: 'src/a.go', line: 2, severity: 'critical', title: 'race on balance', detail: 'lock it' },
      { aspect: 'correctness', file: 'src/a.go', line: 99, severity: 'major', title: 'line not in diff', detail: 'still shown' },
    ],
    verdict: { decision: 'request_changes', comment: '先修 race。' },
  },
};

test('renders overview, aspect table, aspect sections and the final verdict in order', () => {
  const body = render({ owner: 'o', repo: 'r' }, pr, selection, review);
  assert.ok(body.startsWith(COMMENT_MARKER));
  const order = ['總體評價', '| 面向 |', '程式設計　🟢 良好', '意圖與正確性　🟡 可改善', '並行與交易一致性　🔴 有問題', '最終評語', '先修 race。'];
  const positions = order.map(s => body.indexOf(s));
  assert.ok(positions.every(p => p >= 0), `missing: ${order.filter((_, i) => positions[i] < 0)}`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('hides not-applicable aspects without findings, but keeps them in the table', () => {
  const body = render({ owner: 'o', repo: 'r' }, pr, selection, review);
  assert.ok(body.includes('| 🔒 安全性 | ⚪ 不適用 |'));
  assert.ok(!body.includes('### 🔒 安全性'));
});

test('links findings on diff lines and keeps the others without a link', () => {
  const body = render({ owner: 'o', repo: 'r' }, pr, selection, review);
  assert.ok(body.includes('(https://github.com/o/r/blob/abcdef1234567/src/a.go#L2)'));
  assert.ok(body.includes('line not in diff'));
  assert.ok(!body.includes('src/a.go#L99'));
  assert.ok(body.includes('不在這次 diff 的行號內'));
});
