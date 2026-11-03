// Turns the model's JSON into the PR comment. Every piece of model text goes
// through markdown.ts. Quoted code and call trees come from the diff and the
// checked-out source, never from the model, and links are built only for
// locations the action itself read.
import type { ChangedFunction } from './callgraph.ts';
import type { Selection, SkippedFile } from './context.ts';
import { COMMENT_MARKER, type PullRequest, type Repo } from './github.ts';
import { codeBlock, sanitize, sanitizeInline } from './markdown.ts';
import { type Aspect, ORIGINS, PRIORITIES, type Priority, type ReviewOutput, type ReviewResult } from './review.ts';

/** GitHub rejects comments longer than 65,536 characters; keep headroom. */
const MAX_BODY = 65_000;
const MAX_QUOTED_LINES = 12;
const MAX_SKIPPED_LISTED = 100;
const MAX_OVERVIEW = 400;
const MAX_TITLE = 80;
const MAX_TEXT = 500;
const MAX_SUGGESTED_CODE = 2000;
const MAX_NOT_JUDGED = 5;
const MAX_NOT_JUDGED_TEXT = 200;

const ASPECT_LABEL: Record<Aspect, string> = {
  design: '🏗️ 程式設計',
  correctness: '🎯 意圖與正確性',
  concurrency: '🔀 並行與交易一致性',
  security: '🔒 安全性',
  performance: '⚡ 時間與空間複雜度',
  style: '🎨 Coding style',
};
const PRIORITY_LABEL: Record<Priority, string> = { must_fix: '⛔ 必須改善', suggestion: '💡 建議改善' };

type Finding = ReviewOutput['findings'][number];
type NotJudged = ReviewOutput['not_judged'];
/** Lines the action read, by file: the diff plus every call-graph snippet. */
type Sources = Map<string, Map<number, string>>;

function collectSources(selection: Selection, graph: ChangedFunction[]): Sources {
  const sources: Sources = new Map(selection.files.map(f => [f.filename, new Map(f.lines)]));
  const snippets = graph.flatMap(g => [...g.callers.map(c => c.snippet), ...g.callees.map(c => c.snippet)]);
  for (const s of snippets) {
    const lines = sources.get(s.file) ?? new Map<number, string>();
    s.lines.forEach((text, i) => {
      if (text !== null) lines.set(s.start + i, text);
    });
    sources.set(s.file, lines);
  }
  return sources;
}

/** Inline code for values we did not write (file paths, names). */
function code(value: string): string {
  return `\`${value.replace(/[`\r\n]/g, '')}\``;
}

/** Fence language from the file extension; GitHub accepts most extensions as aliases. */
function languageOf(file: string): string {
  return /\.([A-Za-z0-9+#-]+)$/.exec(file)?.[1].toLowerCase() ?? '';
}

function location(repo: Repo, sha: string, sources: Sources, file: string, start: number, end = start): string {
  const label = code(end > start ? `${file}:${start}-${end}` : `${file}:${start}`);
  if (!sources.get(file)?.has(start)) return label;
  const path = file.split('/').map(encodeURIComponent).join('/');
  const anchor = end > start ? `#L${start}-L${end}` : `#L${start}`;
  return `[${label}](https://github.com/${repo.owner}/${repo.repo}/blob/${sha}/${path}${anchor})`;
}

/** The cited lines as the action read them, dedented, with gaps marked. */
function quote(lines: Map<number, string> | undefined, start: number, end: number): string {
  if (!lines?.has(start)) return '';
  const out: string[] = [];
  for (let n = start; n <= end; n++) {
    const text = lines.get(n);
    if (text !== undefined) out.push(text);
    else if (out.at(-1) !== '…') out.push('…');
  }
  const indent = Math.min(...out.filter(l => l.trim() && l !== '…').map(l => /^\s*/.exec(l)![0].length));
  return out.map(l => (l === '…' ? l : l.slice(indent))).join('\n');
}

/** The verdict counts only what this PR introduced; pre-existing problems are mentioned, not counted. */
function headline(findings: Finding[]): string {
  const introduced = findings.filter(f => f.origin === 'introduced');
  const count = (p: Priority) => introduced.filter(f => f.priority === p).length;
  const must = count('must_fix');
  const suggest = count('suggestion');
  const preExisting = findings.length - introduced.length;
  const extra = preExisting > 0 ? `（另有 📦 既有的必須改善 ${preExisting} 項，不是這次造成的）` : '';
  if (must > 0) return `**${PRIORITY_LABEL.must_fix} ${must} 項 · ${PRIORITY_LABEL.suggestion} ${suggest} 項${extra}**`;
  if (suggest > 0) return `**✅ 沒有必須改善的項目 · ${PRIORITY_LABEL.suggestion} ${suggest} 項${extra}**`;
  return `**✅ 這次的變更沒有發現需要改善的地方${extra}**`;
}

function renderFinding(repo: Repo, sha: string, sources: Sources, f: Finding, index: number): string {
  const end = Math.min(Math.max(f.end_line, f.line), f.line + MAX_QUOTED_LINES - 1);
  const lang = languageOf(f.file);
  const parts = [
    `### ${index}. ${PRIORITY_LABEL[f.priority]}｜${sanitizeInline(f.title, MAX_TITLE)}`,
    `📍 ${location(repo, sha, sources, f.file, f.line, end)}　·　${ASPECT_LABEL[f.aspect]}`,
    sanitize(f.explanation, MAX_TEXT),
  ];
  const current = quote(sources.get(f.file), f.line, end);
  if (current) parts.push('**目前**', codeBlock(current, lang));
  const suggested = f.suggested_code.trim();
  if (suggested) parts.push('**改善後**（示意，未執行）', codeBlock(suggested.slice(0, MAX_SUGGESTED_CODE), lang));
  return parts.join('\n\n');
}

/** Callers → changed function → callees, as a plain-text tree. */
function callTree(g: ChangedFunction): string {
  const rows: Array<[string, string]> = [];
  if (g.callers.length > 0) {
    rows.push(['呼叫端', '']);
    for (const c of g.callers) rows.push([`  ${c.caller.name}()`, `${c.file}:${c.line}`]);
    rows.push(['        ↓', '']);
  }
  rows.push([`★ ${g.fn.name}()`, `${g.fn.file}:${g.fn.line}   ← 本次修改`]);
  if (g.callees.length > 0) {
    rows.push(['        ↓ 呼叫', '']);
    for (const c of g.callees) rows.push([`  ${c.definition.name}()`, `${c.definition.file}:${c.definition.line}`]);
  }
  const width = Math.max(...rows.filter(([, loc]) => loc).map(([name]) => name.length)) + 3;
  return rows.map(([name, loc]) => (loc ? name.padEnd(width) + loc : name)).join('\n');
}

function renderCallStacks(repo: Repo, sha: string, sources: Sources, graph: ChangedFunction[], notes: ReviewOutput['call_stacks']): string[] {
  if (graph.length === 0) return [];
  const parts = ['## 🧭 Call stack'];
  const reviewed = new Set<ChangedFunction>();
  for (const note of notes) {
    const g = graph.find(x => x.fn.file === note.file && x.fn.line === note.line) ?? graph.find(x => x.fn.name === note.function);
    if (!g || reviewed.has(g)) continue;
    reviewed.add(g);
    parts.push(
      `### ★ ${code(`${g.fn.name}()`)}　${location(repo, sha, sources, g.fn.file, g.fn.line)}`,
      codeBlock(callTree(g), ''),
      sanitize(note.review, MAX_TEXT),
    );
  }
  const others = graph.filter(g => !reviewed.has(g));
  if (others.length > 0) {
    const names = others.map(g => code(`${g.fn.name}()`)).join('、');
    parts.push(reviewed.size > 0 ? `其他被修改的函式，呼叫關係沒有發現問題：${names}` : `被修改的函式的呼叫關係都沒有發現問題：${names}`);
  }
  return parts;
}

function notJudgedList(items: NotJudged): string {
  const behavior = (text: string) => sanitizeInline(text, MAX_NOT_JUDGED_TEXT).replace(/[。.．]+$/, '');
  const lines = items.slice(0, MAX_NOT_JUDGED).map(n => `- ${behavior(n.behavior)}：${sanitizeInline(n.reason, MAX_NOT_JUDGED_TEXT)}`);
  if (items.length > MAX_NOT_JUDGED) lines.push(`- 另有 ${items.length - MAX_NOT_JUDGED} 則沒有列出`);
  return `**沒有判斷的部分**（AI 考慮過，但沒有下結論）\n\n${lines.join('\n')}`;
}

function scope(selection: Selection, graph: ChangedFunction[], notJudged: NotJudged): string {
  const skipped = selection.skipped.length + selection.unlisted;
  const reasons = new Map<string, number>();
  for (const s of selection.skipped) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
  if (selection.unlisted > 0) reasons.set('GitHub API 沒有列出', selection.unlisted);
  const summary = [...reasons].map(([reason, n]) => `${reason} ${n}`).join('、');
  const line = `審查範圍：送審 ${selection.files.length} 個檔案、追蹤 ${graph.length} 個被修改的函式${skipped > 0 ? `；未送審 ${skipped} 個（${summary}）` : ''}。只依程式碼判讀，沒有執行程式或測試。`;
  const parts = [line];
  if (notJudged.length > 0) parts.push(notJudgedList(notJudged));
  if (skipped > 0) parts.push(skippedList(selection.skipped));
  return parts.join('\n\n');
}

function skippedList(skipped: SkippedFile[]): string {
  const items = skipped.slice(0, MAX_SKIPPED_LISTED).map(s => `- ${code(s.filename)}：${s.reason}`);
  if (skipped.length > MAX_SKIPPED_LISTED) items.push(`- 另有 ${skipped.length - MAX_SKIPPED_LISTED} 個沒有列出`);
  return `<details><summary>未送審的檔案</summary>\n\n${items.join('\n')}\n\n</details>`;
}

export function render(repo: Repo, pr: PullRequest, selection: Selection, graph: ChangedFunction[], review: ReviewResult): string {
  // Pre-existing problems are reported only when they cause wrong results; enforce it here, not only in the prompt.
  const findings = review.output.findings.filter(f => f.origin === 'introduced' || f.priority === 'must_fix');
  const reported: ReviewResult = { ...review, output: { ...review.output, findings } };

  // This PR's problems before pre-existing ones, must-fix before suggestions within each.
  const rank = (f: Finding) => ORIGINS.indexOf(f.origin) * PRIORITIES.length + PRIORITIES.indexOf(f.priority);
  const sorted = [...findings].sort((a, b) => rank(a) - rank(b));

  // Drop findings from the end (pre-existing, then suggestions) until the comment fits.
  for (let shown = sorted.length; ; shown--) {
    const body = compose(repo, pr, selection, graph, reported, sorted.slice(0, shown));
    if (body.length <= MAX_BODY || shown === 0) return body;
  }
}

function compose(repo: Repo, pr: PullRequest, selection: Selection, graph: ChangedFunction[], review: ReviewResult, shown: Finding[]): string {
  const { overview, call_stacks, findings, not_judged } = review.output;
  const sources = collectSources(selection, graph);
  const sha = pr.headSha;

  const parts = [COMMENT_MARKER, '## 🤖 AI Code Review', headline(findings), sanitize(overview, MAX_OVERVIEW)];
  const introduced = shown.filter(f => f.origin === 'introduced');
  const preExisting = shown.filter(f => f.origin === 'pre_existing');
  introduced.forEach((f, i) => parts.push(renderFinding(repo, sha, sources, f, i + 1)));
  if (preExisting.length > 0) {
    const items = preExisting.map((f, i) => renderFinding(repo, sha, sources, f, introduced.length + i + 1));
    parts.push(
      '## 📦 既有問題',
      `<details><summary>${preExisting.length} 項不是這次修改造成的，不列入上面的結論，建議另開 PR 處理</summary>\n\n${items.join('\n\n')}\n\n</details>`,
    );
  }
  if (findings.length > shown.length) parts.push(`另有 ${findings.length - shown.length} 則發現因為留言長度上限沒有列出。`);
  parts.push(...renderCallStacks(repo, sha, sources, graph, call_stacks));
  parts.push('---', scope(selection, graph, not_judged));
  parts.push(`<sub>commit ${code(sha.slice(0, 7))} · 模型 ${code(review.model)} · AI review 只供參考，不能取代人工 review</sub>`);
  return parts.join('\n\n');
}

export function renderNothingToReview(pr: PullRequest, selection: Selection): string {
  const parts = [COMMENT_MARKER, '## 🤖 AI Code Review', '這次的變更沒有可以送審的程式碼。', '---', scope(selection, [], [])];
  parts.push(`<sub>commit ${code(pr.headSha.slice(0, 7))}</sub>`);
  return parts.join('\n\n');
}
