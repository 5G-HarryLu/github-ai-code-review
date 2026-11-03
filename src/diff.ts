// Annotates a unified-diff patch with new-file line numbers so the model can
// cite exact lines, and keeps the citable lines (added or context) by number
// so the comment can quote the code itself instead of trusting the model.

export interface AnnotatedPatch {
  text: string;
  /** New-file line number → line content, for added and context lines. */
  lines: Map<number, string>;
  /** New-file line numbers of added lines. */
  added: Set<number>;
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const WIDTH = 6;

export function annotatePatch(patch: string): AnnotatedPatch {
  const out: string[] = [];
  const lines = new Map<number, string>();
  const added = new Set<number>();
  let next = 0;

  for (const raw of patch.split('\n')) {
    const hunk = HUNK_HEADER.exec(raw);
    if (hunk) {
      next = Number(hunk[1]);
      out.push(raw);
      continue;
    }
    const mark = raw[0];
    if (mark === '+' || mark === ' ') {
      lines.set(next, raw.slice(1));
      if (mark === '+') added.add(next);
      out.push(`${String(next).padStart(WIDTH)} ${raw}`);
      next++;
    } else if (raw !== '') {
      // '-' removed lines and "\ No newline at end of file" have no new-file line.
      out.push(`${' '.repeat(WIDTH)} ${raw}`);
    }
  }
  return { text: out.join('\n'), lines, added };
}
