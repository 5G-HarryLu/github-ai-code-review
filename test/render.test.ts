import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ChangedFunction } from '../src/callgraph.ts';
import { selectFiles } from '../src/context.ts';
import { COMMENT_MARKER, type PullRequest } from '../src/github.ts';
import { render } from '../src/render.ts';
import type { ReviewOutput, ReviewResult } from '../src/review.ts';

const pr: PullRequest = { number: 7, title: 't', body: '', author: 'dev', baseRef: 'develop', headRef: 'feat', headSha: 'abcdef1234567', changedFiles: 1 };
const patch = ['@@ -1,3 +1,4 @@', ' func Pay(w *Wallet) {', '+\tbal := w.Balance', '+\tw.Balance = bal - 10', ' }'].join('\n');
const selection = selectFiles([{ filename: 'src/a.go', status: 'modified', additions: 2, deletions: 0, patch }], 1);
const repo = { owner: 'o', repo: 'r' };

const graph: ChangedFunction[] = [
  {
    fn: { name: 'Pay', file: 'src/a.go', line: 1 },
    callers: [
      {
        caller: { name: 'Handle', file: 'src/h.go', line: 10 },
        file: 'src/h.go',
        line: 12,
        snippet: { file: 'src/h.go', start: 10, lines: ['func Handle() {', '\tlog()', '\tPay(w)', '}'] },
      },
    ],
    callees: [],
  },
  { fn: { name: 'Other', file: 'src/a.go', line: 30 }, callers: [], callees: [] },
];

type Finding = ReviewOutput['findings'][number];
const finding = (f: Partial<Finding>): Finding => ({
  priority: 'must_fix',
  origin: 'introduced',
  aspect: 'concurrency',
  file: 'src/a.go',
  line: 2,
  end_line: 3,
  title: 'race on balance',
  explanation: '兩個請求同時扣款時餘額會算錯。',
  suggested_code: 'w.mu.Lock()\ndefer w.mu.Unlock()\nw.Balance -= 10',
  ...f,
});

const review = (findings: Finding[], not_judged: ReviewOutput['not_judged'] = []): ReviewResult => ({
  model: 'claude-opus-5-5',
  inputTokens: 1000,
  outputTokens: 200,
  output: {
    overview: '加了扣款，但沒有鎖。',
    call_stacks: [{ function: 'Pay', file: 'src/a.go', line: 1, review: '`Handle` 沒有處理扣款失敗。' }],
    findings,
    not_judged,
  },
});

test('puts the headline and findings before the call stack and scope', () => {
  const body = render(repo, pr, selection, graph, review([finding({ priority: 'suggestion', title: 'nit' }), finding({})]));
  assert.ok(body.startsWith(COMMENT_MARKER));
  const order = ['⛔ 必須改善 1 項 · 💡 建議改善 1 項', '### 1. ⛔ 必須改善｜race on balance', '### 2. 💡 建議改善｜nit', '## 🧭 Call stack', '審查範圍'];
  const positions = order.map(s => body.indexOf(s));
  assert.ok(positions.every(p => p >= 0), `missing: ${order.filter((_, i) => positions[i] < 0)}`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('quotes the cited lines next to the suggested code', () => {
  const body = render(repo, pr, selection, graph, review([finding({})]));
  assert.ok(body.includes('(https://github.com/o/r/blob/abcdef1234567/src/a.go#L2-L3)'));
  assert.ok(body.includes('**目前**\n\n```go\nbal := w.Balance\nw.Balance = bal - 10\n```'));
  assert.ok(body.includes('**改善後**（示意，未執行）\n\n```go\nw.mu.Lock()'));
});

test('can quote a caller from the call graph, not only the diff', () => {
  const body = render(repo, pr, selection, graph, review([finding({ file: 'src/h.go', line: 12, end_line: 12 })]));
  assert.ok(body.includes('src/h.go#L12)'));
  assert.ok(body.includes('```go\nPay(w)\n```'));
});

test('draws the call tree for reviewed functions and names the rest', () => {
  const body = render(repo, pr, selection, graph, review([]));
  assert.match(body, /呼叫端\n {2}Handle\(\) +src\/h\.go:12\n {8}↓\n★ Pay\(\) +src\/a\.go:1 {3}← 本次修改/);
  assert.ok(body.includes('`Handle` 沒有處理扣款失敗。'));
  assert.ok(body.includes('其他被修改的函式，呼叫關係沒有發現問題：`Other()`'));
  assert.ok(body.includes('✅ 這次的變更沒有發現需要改善的地方'));
});

test('a location outside what the action read gets no link and no quote', () => {
  const body = render(repo, pr, selection, graph, review([finding({ line: 99, end_line: 99 })]));
  assert.ok(!body.includes('#L99'));
  assert.ok(body.includes('`src/a.go:99`'));
  assert.ok(!body.includes('**目前**'));
});

test('drops suggestions first when the comment would exceed GitHub\'s limit', () => {
  const long = (i: number, priority: Finding['priority']) => finding({ priority, title: `finding ${i}`, explanation: 'x'.repeat(400), suggested_code: 'y'.repeat(1990) });
  const body = render(repo, pr, selection, graph, review([...Array.from({ length: 40 }, (_, i) => long(i + 1, 'suggestion')), long(0, 'must_fix')]));
  assert.ok(body.length <= 65_000);
  assert.ok(body.includes('finding 0'));
  assert.match(body, /另有 \d+ 則發現因為留言長度上限沒有列出/);
});

test('keeps pre-existing problems out of the verdict and in their own folded section', () => {
  const body = render(repo, pr, selection, graph, review([
    finding({ origin: 'pre_existing', title: 'old bug' }),
    finding({ origin: 'pre_existing', priority: 'suggestion', title: 'old nit' }),
    finding({ priority: 'suggestion', title: 'nit' }),
  ]));
  assert.ok(!body.includes('old nit'), 'pre-existing suggestions are not reported');
  assert.ok(body.includes('**✅ 沒有必須改善的項目 · 💡 建議改善 1 項（另有 📦 既有的必須改善 1 項，不是這次造成的，見下方）**'));
  const order = ['### 1. 💡 建議改善｜nit', '## 📦 既有問題', '<details><summary>1 項不是這次修改造成的', '### 2. ⛔ 必須改善｜old bug', '## 🧭 Call stack'];
  const positions = order.map(s => body.indexOf(s));
  assert.ok(positions.every(p => p >= 0), `missing: ${order.filter((_, i) => positions[i] < 0)}`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('lists what the model left unjudged in the scope section', () => {
  const extra = Array.from({ length: 6 }, (_, i) => ({ behavior: `行為 ${i}`, reason: '缺資料' }));
  const body = render(repo, pr, selection, graph, review([], [{ behavior: '扣款失敗後的重試。', reason: '重試設定在沒有送審的 config 裡' }, ...extra]));
  const scopeAt = body.indexOf('審查範圍');
  const listAt = body.indexOf('**沒有判斷的部分**');
  assert.ok(scopeAt >= 0 && listAt > scopeAt);
  assert.ok(body.includes('- 扣款失敗後的重試：重試設定在沒有送審的 config 裡'));
  assert.ok(body.includes('- 另有 2 則沒有列出'));
  assert.ok(!render(repo, pr, selection, graph, review([])).includes('沒有判斷的部分'));
});
