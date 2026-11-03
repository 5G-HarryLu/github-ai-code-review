import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectFiles } from '../src/context.ts';
import { COMMENT_MARKER, type PullRequest } from '../src/github.ts';
import { render } from '../src/render.ts';
import type { ReviewOutput, ReviewResult } from '../src/review.ts';

const pr: PullRequest = { number: 7, title: 't', body: '', author: 'dev', baseRef: 'develop', headRef: 'feat', headSha: 'abcdef1234567', changedFiles: 1 };
const patch = ['@@ -1,3 +1,4 @@', ' func Pay(w *Wallet) {', '+\tbal := w.Balance', '+\tw.Balance = bal - 10', ' }'].join('\n');
const selection = selectFiles([{ filename: 'src/a.go', status: 'modified', additions: 2, deletions: 0, patch }], 1);

type Finding = ReviewOutput['findings'][number];
const finding = (f: Partial<Finding>): Finding => ({
  aspect: 'concurrency',
  file: 'src/a.go',
  line: 2,
  end_line: 3,
  severity: 'critical',
  title: 'race on balance',
  explanation: '兩個請求同時扣款時餘額會算錯。',
  suggested_code: 'w.mu.Lock()\ndefer w.mu.Unlock()\nw.Balance -= 10',
  ...f,
});

const review = (findings: Finding[]): ReviewResult => ({
  model: 'claude-opus-5-5',
  inputTokens: 1000,
  outputTokens: 200,
  output: {
    overview: '整體可以，有一個 race。',
    aspects: {
      design: { rating: 'good', comment: '設計評語' },
      correctness: { rating: 'fair', comment: '正確性評語' },
      concurrency: { rating: 'poor', comment: '並行評語 | 含直線' },
      security: { rating: 'na', comment: '沒有安全相關的變更' },
      performance: { rating: 'good', comment: '效能評語' },
      style: { rating: 'good', comment: '風格評語' },
    },
    flows: [
      {
        entry: '扣款 API',
        steps: [
          { file: 'src/a.go', line: 1, action: '進入 Pay', risk: '' },
          { file: 'src/a.go', line: 3, action: '寫回餘額', risk: '兩個請求同時寫會互相覆蓋' },
        ],
      },
    ],
    findings,
    verdict: { decision: 'request_changes', comment: '先修 race。' },
  },
});

const repo = { owner: 'o', repo: 'r' };

test('lays out overview, aspect table, flow, findings and verdict in order', () => {
  const body = render(repo, pr, selection, review([finding({})]));
  assert.ok(body.startsWith(COMMENT_MARKER));
  const order = ['總體評價', '| 面向', '並行評語 \\| 含直線', '流程走查', '① 扣款 API', '⚠️ 兩個請求同時寫會互相覆蓋', '發現的問題', '最終評語'];
  const positions = order.map(s => body.indexOf(s));
  assert.ok(positions.every(p => p >= 0), `missing: ${order.filter((_, i) => positions[i] < 0)}`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('quotes the cited lines from the diff, dedented, next to the suggested code', () => {
  const body = render(repo, pr, selection, review([finding({})]));
  assert.ok(body.includes('(https://github.com/o/r/blob/abcdef1234567/src/a.go#L2-L3)'));
  assert.ok(body.includes('**目前的程式碼**\n\n```go\nbal := w.Balance\nw.Balance = bal - 10\n```'));
  assert.ok(body.includes('**建議改法**\n\n```go\nw.mu.Lock()'));
});

test('a location outside the diff is shown without a link or quoted code', () => {
  const body = render(repo, pr, selection, review([finding({ line: 99, end_line: 99, severity: 'major' })]));
  assert.ok(!body.includes('#L99'));
  assert.ok(body.includes('`src/a.go:99`'));
  assert.ok(body.includes('無法引用程式碼'));
});

test('folds minor findings into a collapsed section', () => {
  const body = render(repo, pr, selection, review([finding({}), finding({ severity: 'minor', title: 'naming nit', aspect: 'style' })]));
  const fold = body.indexOf('<details><summary>💡 建議（1 則');
  assert.ok(fold > body.indexOf('race on balance'));
  assert.ok(body.indexOf('naming nit') > fold);
});

test('drops the least important findings when the comment would exceed GitHub\'s limit', () => {
  const long = (i: number, severity: Finding['severity']) => finding({ severity, title: `finding ${i}`, explanation: 'x'.repeat(900), suggested_code: 'y'.repeat(2900) });
  const findings = [long(0, 'critical'), ...Array.from({ length: 30 }, (_, i) => long(i + 1, 'minor'))];
  const body = render(repo, pr, selection, review(findings));
  assert.ok(body.length <= 65_000);
  assert.ok(body.includes('finding 0'));
  assert.match(body, /另有 \d+ 則較輕微的發現因為留言長度上限沒有列出/);
});
