// Turns the model's JSON into the PR comment. Every piece of model text goes
// through markdown.ts; locations are linked only when they point at a line
// that exists in the reviewed diff.
import type { Selection, SkippedFile } from './context.ts';
import { COMMENT_MARKER, type PullRequest, type Repo } from './github.ts';
import { sanitize, sanitizeInline } from './markdown.ts';
import { ASPECTS, type Aspect, type Rating, type ReviewResult, SEVERITIES, type Severity, type Verdict } from './review.ts';

const MAX_FINDINGS = 50;
const MAX_OVERVIEW = 3000;
const MAX_COMMENT = 1500;
const MAX_TITLE = 200;
const MAX_DETAIL = 4000;

const ASPECT_LABEL: Record<Aspect, string> = {
  design: '🏗️ 程式設計',
  correctness: '🎯 意圖與正確性',
  concurrency: '🔀 並行與交易一致性',
  security: '🔒 安全性',
  performance: '⚡ 時間與空間複雜度',
  style: '🎨 Coding style 一致性',
};
const RATING_LABEL: Record<Rating, string> = {
  good: '🟢 良好',
  fair: '🟡 可改善',
  poor: '🔴 有問題',
  na: '⚪ 不適用',
};
const SEVERITY_LABEL: Record<Severity, string> = { critical: '🚨 嚴重', major: '⚠️ 重要', minor: '💡 建議' };
const VERDICT_LABEL: Record<Verdict, string> = {
  approve: '✅ 可以合併',
  approve_with_suggestions: '💬 可以合併，建議之後改善',
  request_changes: '⛔ 需要修改後再合併',
};

/** Inline code for values we did not write (file paths, model ids). */
function code(value: string): string {
  return `\`${value.replace(/[`\r\n]/g, '')}\``;
}

function lineUrl(repo: Repo, sha: string, file: string, line: number): string {
  const path = file.split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${repo.owner}/${repo.repo}/blob/${sha}/${path}#L${line}`;
}

function skippedSection(skipped: SkippedFile[], unlisted: number): string {
  if (skipped.length === 0 && unlisted === 0) return '';
  const items = skipped.map(s => `- ${code(s.filename)}：${s.reason}`);
  if (unlisted > 0) items.push(`- 另有 ${unlisted} 個檔案 GitHub API 沒有列出`);
  const count = skipped.length + unlisted;
  return `<details><summary>沒有送審的檔案（${count}）</summary>\n\n${items.join('\n')}\n\n</details>`;
}

function severityCounts(severities: Severity[]): string {
  const parts = SEVERITIES.flatMap(s => {
    const n = severities.filter(x => x === s).length;
    return n > 0 ? [`${SEVERITY_LABEL[s]} ${n}`] : [];
  });
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function render(repo: Repo, pr: PullRequest, selection: Selection, review: ReviewResult): string {
  const { overview, aspects, findings, verdict } = review.output;
  const citable = new Map(selection.files.map(f => [f.filename, f.lines]));

  const rank = (s: Severity) => SEVERITIES.indexOf(s);
  const sorted = [...findings].sort((a, b) => rank(a.severity) - rank(b.severity) || a.file.localeCompare(b.file) || a.line - b.line);
  const shown = sorted.slice(0, MAX_FINDINGS);

  const parts = [
    COMMENT_MARKER,
    '## 🤖 AI Code Review',
    `**${VERDICT_LABEL[verdict.decision]}**　｜　${severityCounts(findings.map(f => f.severity))}`,
    '### 📋 總體評價',
    sanitize(overview, MAX_OVERVIEW),
    [
      '| 面向 | 評等 | 發現 |',
      '| :-- | :-: | :-- |',
      ...ASPECTS.map(a => `| ${ASPECT_LABEL[a]} | ${RATING_LABEL[aspects[a].rating]} | ${severityCounts(findings.filter(f => f.aspect === a).map(f => f.severity))} |`),
    ].join('\n'),
  ];

  for (const aspect of ASPECTS) {
    const group = shown.filter(f => f.aspect === aspect);
    const { rating, comment } = aspects[aspect];
    if (rating === 'na' && group.length === 0) continue;
    parts.push('---', `### ${ASPECT_LABEL[aspect]}　${RATING_LABEL[rating]}`, sanitize(comment, MAX_COMMENT));
    for (const f of group) {
      const where = citable.get(f.file)?.has(f.line)
        ? `📍 [${code(`${f.file}:${f.line}`)}](${lineUrl(repo, pr.headSha, f.file, f.line)})`
        : `📍 ${code(`${f.file}:${f.line}`)}（不在這次 diff 的行號內，無法連結）`;
      parts.push(`#### ${SEVERITY_LABEL[f.severity]}｜${sanitizeInline(f.title, MAX_TITLE)}`, where, sanitize(f.detail, MAX_DETAIL));
    }
  }
  if (findings.length > shown.length) parts.push(`另有 ${findings.length - shown.length} 則較輕微的發現沒有列出。`);

  parts.push('---', '### 🏁 最終評語', `**${VERDICT_LABEL[verdict.decision]}**`, sanitize(verdict.comment, MAX_COMMENT));

  const skipped = skippedSection(selection.skipped, selection.unlisted);
  if (skipped) parts.push(skipped);

  const notes = [
    `模型 ${code(review.model)}（輸入 ${review.inputTokens.toLocaleString('en-US')}／輸出 ${review.outputTokens.toLocaleString('en-US')} tokens）`,
    `commit ${code(pr.headSha.slice(0, 7))}`,
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
