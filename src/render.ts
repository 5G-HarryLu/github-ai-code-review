// Turns the model's JSON into the PR comment. Every piece of model text goes
// through markdown.ts. Quoted code comes from the diff itself, never from the
// model, and locations are linked only when they exist in the reviewed diff.
import type { Selection, SkippedFile } from './context.ts';
import { COMMENT_MARKER, type PullRequest, type Repo } from './github.ts';
import { codeBlock, sanitize, sanitizeInline, table } from './markdown.ts';
import {
  ASPECTS,
  type Aspect,
  type Rating,
  type ReviewOutput,
  type ReviewResult,
  SEVERITIES,
  type Severity,
  type Verdict,
} from './review.ts';

/** GitHub rejects comments longer than 65,536 characters; keep headroom. */
const MAX_BODY = 65_000;
const MAX_FLOWS = 3;
const MAX_STEPS = 10;
const MAX_QUOTED_LINES = 15;
const MAX_OVERVIEW = 1500;
const MAX_COMMENT = 500;
const MAX_SENTENCE = 300;
const MAX_TITLE = 200;
const MAX_EXPLANATION = 1000;
const MAX_SUGGESTED_CODE = 3000;

const ASPECT_LABEL: Record<Aspect, string> = {
  design: '🏗️ 程式設計',
  correctness: '🎯 意圖與正確性',
  concurrency: '🔀 並行與交易一致性',
  security: '🔒 安全性',
  performance: '⚡ 時間與空間複雜度',
  style: '🎨 Coding style 一致性',
};
const RATING_LABEL: Record<Rating, string> = { good: '🟢 良好', fair: '🟡 可改善', poor: '🔴 有問題', na: '⚪ 不適用' };
const SEVERITY_LABEL: Record<Severity, string> = { critical: '🚨 嚴重', major: '⚠️ 重要', minor: '💡 建議' };
const VERDICT_LABEL: Record<Verdict, string> = {
  approve: '✅ 可以合併',
  approve_with_suggestions: '💬 可以合併，建議之後改善',
  request_changes: '⛔ 需要修改後再合併',
};
const STEP_NUMBERS = ['①', '②', '③'];

type Finding = ReviewOutput['findings'][number];
type Lines = Map<string, Map<number, string>>;

/** Inline code for values we did not write (file paths, model ids). */
function code(value: string): string {
  return `\`${value.replace(/[`\r\n]/g, '')}\``;
}

/** Fence language from the file extension; GitHub accepts most extensions as aliases. */
function languageOf(file: string): string {
  return /\.([A-Za-z0-9+#-]+)$/.exec(file)?.[1].toLowerCase() ?? '';
}

/** A link to the line range when it exists in the diff, otherwise the plain location. */
function location(repo: Repo, sha: string, lines: Lines, file: string, start: number, end = start): string {
  const label = code(end > start ? `${file}:${start}-${end}` : `${file}:${start}`);
  if (!lines.get(file)?.has(start)) return label;
  const path = file.split('/').map(encodeURIComponent).join('/');
  const anchor = end > start ? `#L${start}-L${end}` : `#L${start}`;
  return `[${label}](https://github.com/${repo.owner}/${repo.repo}/blob/${sha}/${path}${anchor})`;
}

/** The cited lines as they appear in the diff, dedented, with gaps marked. */
function quote(fileLines: Map<number, string> | undefined, start: number, end: number): string {
  if (!fileLines?.has(start)) return '';
  const out: string[] = [];
  let gap = false;
  for (let n = start; n <= end; n++) {
    const text = fileLines.get(n);
    if (text === undefined) {
      gap = true;
      continue;
    }
    if (gap) out.push('…');
    gap = false;
    out.push(text);
  }
  const indent = Math.min(...out.filter(l => l.trim() && l !== '…').map(l => /^\s*/.exec(l)![0].length));
  return out.map(l => (l === '…' ? l : l.slice(indent))).join('\n');
}

function severityCounts(severities: Severity[]): string {
  return SEVERITIES.map(s => `${SEVERITY_LABEL[s]} ${severities.filter(x => x === s).length}`).join(' · ');
}

function renderFlows(repo: Repo, sha: string, lines: Lines, flows: ReviewOutput['flows']): string[] {
  if (flows.length === 0) return [];
  const parts = ['### 🧭 流程走查（進入點 → 出口）'];
  flows.slice(0, MAX_FLOWS).forEach((flow, i) => {
    parts.push(`**${STEP_NUMBERS[i]} ${sanitizeInline(flow.entry, MAX_TITLE)}**`);
    const steps = flow.steps.slice(0, MAX_STEPS).map((s, j) => {
      const step = `${j + 1}. ${location(repo, sha, lines, s.file, s.line)} ${sanitizeInline(s.action, MAX_SENTENCE)}`;
      return s.risk.trim() ? `${step}\n   ⚠️ ${sanitizeInline(s.risk, MAX_SENTENCE)}` : step;
    });
    parts.push(steps.join('\n'));
  });
  return parts;
}

function renderFinding(repo: Repo, sha: string, lines: Lines, f: Finding): string {
  const end = Math.min(Math.max(f.end_line, f.line), f.line + MAX_QUOTED_LINES - 1);
  const lang = languageOf(f.file);
  const parts = [
    `#### ${SEVERITY_LABEL[f.severity]}｜${sanitizeInline(f.title, MAX_TITLE)}`,
    `📍 ${location(repo, sha, lines, f.file, f.line, end)}　·　${ASPECT_LABEL[f.aspect]}`,
    sanitize(f.explanation, MAX_EXPLANATION),
  ];
  const current = quote(lines.get(f.file), f.line, end);
  if (current) parts.push('**目前的程式碼**', codeBlock(current, lang));
  else parts.push('（這個位置不在這次 diff 的行號內，無法引用程式碼）');
  const suggested = f.suggested_code.trim();
  if (suggested) parts.push('**建議改法**', codeBlock(suggested.slice(0, MAX_SUGGESTED_CODE), lang));
  return parts.join('\n\n');
}

function skippedSection(skipped: SkippedFile[], unlisted: number): string {
  if (skipped.length === 0 && unlisted === 0) return '';
  const items = skipped.map(s => `- ${code(s.filename)}：${s.reason}`);
  if (unlisted > 0) items.push(`- 另有 ${unlisted} 個檔案 GitHub API 沒有列出`);
  const count = skipped.length + unlisted;
  return `<details><summary>沒有送審的檔案（${count}）</summary>\n\n${items.join('\n')}\n\n</details>`;
}

export function render(repo: Repo, pr: PullRequest, selection: Selection, review: ReviewResult): string {
  const rank = (f: Finding) => SEVERITIES.indexOf(f.severity) * ASPECTS.length + ASPECTS.indexOf(f.aspect);
  const sorted = [...review.output.findings].sort((a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file) || a.line - b.line);

  // Drop the least important findings until the comment fits.
  for (let shown = sorted.length; ; shown--) {
    const body = compose(repo, pr, selection, review, sorted.slice(0, shown));
    if (body.length <= MAX_BODY || shown === 0) return body;
  }
}

function compose(repo: Repo, pr: PullRequest, selection: Selection, review: ReviewResult, shown: Finding[]): string {
  const { overview, aspects, flows, findings, verdict } = review.output;
  const lines: Lines = new Map(selection.files.map(f => [f.filename, f.lines]));
  const sha = pr.headSha;
  const major = shown.filter(f => f.severity !== 'minor');
  const minor = shown.filter(f => f.severity === 'minor');

  const parts = [
    COMMENT_MARKER,
    '## 🤖 AI Code Review',
    `**${VERDICT_LABEL[verdict.decision]}**　｜　${severityCounts(findings.map(f => f.severity))}`,
    '### 📋 總體評價',
    sanitize(overview, MAX_OVERVIEW),
    table(
      [['面向', '評等', '評語'], ...ASPECTS.map(a => [ASPECT_LABEL[a], RATING_LABEL[aspects[a].rating], aspects[a].comment])],
      ['left', 'center', 'left'],
      MAX_COMMENT,
    ),
    ...renderFlows(repo, sha, lines, flows),
  ];

  if (findings.length > 0) {
    parts.push(`### 🔍 發現的問題（${findings.length}）`);
    for (const f of major) parts.push(renderFinding(repo, sha, lines, f));
    if (minor.length > 0) {
      parts.push(
        `<details><summary>${SEVERITY_LABEL.minor}（${minor.length} 則，點開查看）</summary>`,
        ...minor.map(f => renderFinding(repo, sha, lines, f)),
        '</details>',
      );
    }
    if (findings.length > shown.length) parts.push(`另有 ${findings.length - shown.length} 則較輕微的發現因為留言長度上限沒有列出。`);
  }

  parts.push('### 🏁 最終評語', `**${VERDICT_LABEL[verdict.decision]}**`, sanitize(verdict.comment, MAX_COMMENT));

  const skipped = skippedSection(selection.skipped, selection.unlisted);
  if (skipped) parts.push(skipped);

  const notes = [
    `模型 ${code(review.model)}（輸入 ${review.inputTokens.toLocaleString('en-US')}／輸出 ${review.outputTokens.toLocaleString('en-US')} tokens）`,
    `commit ${code(sha.slice(0, 7))}`,
    'AI review 只供參考，不能取代人工 review',
  ];
  parts.push(`<sub>${notes.join(' · ')}</sub>`);

  return parts.join('\n\n');
}

export function renderNothingToReview(pr: PullRequest, selection: Selection): string {
  const parts = [COMMENT_MARKER, '## 🤖 AI Code Review', '這次的變更沒有可以送審的程式碼。'];
  const skipped = skippedSection(selection.skipped, selection.unlisted);
  if (skipped) parts.push(skipped);
  parts.push(`<sub>commit ${code(pr.headSha.slice(0, 7))}</sub>`);
  return parts.join('\n\n');
}
