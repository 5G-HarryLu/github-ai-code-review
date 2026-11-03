// Turns the model's JSON into the PR comment. Model text is treated as
// untrusted: findings must cite a line that exists in the diff, and text is
// neutralised so it cannot mention people, link out, or inject HTML.
import type { Selection, SkippedFile } from './context.ts';
import { COMMENT_MARKER, type PullRequest, type Repo } from './github.ts';
import { SEVERITIES, type ReviewResult, type Severity } from './review.ts';

const MAX_FINDINGS = 50;
const MAX_SUMMARY = 3000;
const MAX_TITLE = 200;
const MAX_DETAIL = 4000;

const SEVERITY_LABEL: Record<Severity, string> = { critical: '嚴重', major: '重要', minor: '建議' };

const ZWSP = '​';
const CODE = /(`+)[\s\S]*?\1/g;

/** Neutralises markdown outside code spans and fences; code is left as written. */
export function sanitize(text: string, max: number): string {
  let t = text.length > max ? `${text.slice(0, max)}…（已截斷）` : text;
  if ((t.match(/```/g) ?? []).length % 2 === 1) t += '\n```';

  let out = '';
  let last = 0;
  for (const m of t.matchAll(CODE)) {
    out += neutralize(t.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + neutralize(t.slice(last));
}

function neutralize(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, '$1（$2）')
    .replace(/\b([a-z][a-z0-9+.-]*):\/\//gi, `$1:${ZWSP}//`)
    .replace(/\bwww\./gi, `www${ZWSP}.`)
    .replace(/(^|[^\w])@(?=[A-Za-z0-9])/g, `$1@${ZWSP}`);
}

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

export function render(repo: Repo, pr: PullRequest, selection: Selection, review: ReviewResult): string {
  const citable = new Map(selection.files.map(f => [f.filename, f.lines]));
  const valid = review.output.findings.filter(f => citable.get(f.file)?.has(f.line));
  const dropped = review.output.findings.length - valid.length;

  const order = (s: Severity) => SEVERITIES.indexOf(s);
  valid.sort((a, b) => order(a.severity) - order(b.severity) || a.file.localeCompare(b.file) || a.line - b.line);
  const shown = valid.slice(0, MAX_FINDINGS);

  const parts = [COMMENT_MARKER, '## AI Code Review', sanitize(review.output.summary, MAX_SUMMARY)];

  if (valid.length === 0) {
    parts.push('沒有發現問題。');
  } else {
    const counts = SEVERITIES.map(s => valid.filter(f => f.severity === s).length);
    parts.push(`| ${SEVERITIES.map(s => SEVERITY_LABEL[s]).join(' | ')} |\n|${' :-: |'.repeat(SEVERITIES.length)}\n| ${counts.join(' | ')} |`);
    for (const severity of SEVERITIES) {
      const group = shown.filter(f => f.severity === severity);
      if (group.length === 0) continue;
      parts.push(`### ${SEVERITY_LABEL[severity]}`);
      for (const f of group) {
        const where = `[${code(`${f.file}:${f.line}`)}](${lineUrl(repo, pr.headSha, f.file, f.line)})`;
        parts.push(`**${where} ${sanitize(f.title, MAX_TITLE)}**\n\n${sanitize(f.detail, MAX_DETAIL)}`);
      }
    }
    if (valid.length > shown.length) parts.push(`另有 ${valid.length - shown.length} 則較輕微的發現沒有列出。`);
  }

  const skipped = skippedSection(selection.skipped, selection.unlisted);
  if (skipped) parts.push(skipped);

  const notes = [
    `模型 ${code(review.model)}（輸入 ${review.inputTokens.toLocaleString('en-US')}／輸出 ${review.outputTokens.toLocaleString('en-US')} tokens）`,
    `commit ${code(pr.headSha.slice(0, 7))}`,
  ];
  if (dropped > 0) notes.push(`${dropped} 則發現指向 diff 以外的行，已捨棄`);
  notes.push('AI review 只供參考，不能取代人工 review');
  parts.push(`---\n<sub>${notes.join(' · ')}</sub>`);

  return parts.join('\n\n');
}

export function renderNothingToReview(pr: PullRequest, selection: Selection): string {
  const parts = [COMMENT_MARKER, '## AI Code Review', '這次的變更沒有可以送審的程式碼。'];
  const skipped = skippedSection(selection.skipped, selection.unlisted);
  if (skipped) parts.push(skipped);
  parts.push(`---\n<sub>commit ${code(pr.headSha.slice(0, 7))}</sub>`);
  return parts.join('\n\n');
}
