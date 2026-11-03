// Decides which changed files go to the model, within a size budget.
// Every file left out is reported with a reason; nothing is dropped silently.
import { annotatePatch } from './diff.ts';
import type { ChangedFile } from './github.ts';

/** Upper bound on annotated diff text sent in one review (~100k tokens). */
export const MAX_DIFF_CHARS = 400_000;

export interface ReviewFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  annotated: string;
  lines: Map<number, string>;
  added: Set<number>;
}

export interface SkippedFile {
  filename: string;
  reason: string;
}

export interface Selection {
  files: ReviewFile[];
  skipped: SkippedFile[];
  /** Files GitHub did not list at all (the files API stops at 3000). */
  unlisted: number;
}

const SKIP_RULES: Array<[RegExp, string]> = [
  [/(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|go\.sum|Cargo\.lock|poetry\.lock|uv\.lock|composer\.lock|Gemfile\.lock|packages\.lock\.json)$/, 'lockfile'],
  [/\.(min\.js|min\.css|map|snap)$/, '自動產生的檔案'],
  [/(\.g\.cs|\.designer\.cs|\.pb\.go|_pb2\.py)$/i, '自動產生的檔案'],
  [/(^|\/)(dist|vendor|node_modules)\//, '建置產物或第三方程式碼'],
];

export function selectFiles(changed: ChangedFile[], totalChangedFiles: number, maxChars = MAX_DIFF_CHARS): Selection {
  const files: ReviewFile[] = [];
  const skipped: SkippedFile[] = [];
  let used = 0;

  for (const f of changed) {
    const rule = SKIP_RULES.find(([re]) => re.test(f.filename));
    if (rule) {
      skipped.push({ filename: f.filename, reason: rule[1] });
      continue;
    }
    if (f.status === 'removed') {
      skipped.push({ filename: f.filename, reason: '整個檔案被刪除' });
      continue;
    }
    if (!f.patch) {
      skipped.push({ filename: f.filename, reason: 'GitHub 沒有提供 diff（二進位檔、純改名或單檔 diff 太大）' });
      continue;
    }
    const { text, lines, added } = annotatePatch(f.patch);
    if (used + text.length > maxChars) {
      skipped.push({ filename: f.filename, reason: '超過單次審查的大小上限' });
      continue;
    }
    used += text.length;
    files.push({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, annotated: text, lines, added });
  }

  return { files, skipped, unlisted: Math.max(0, totalChangedFiles - changed.length) };
}
