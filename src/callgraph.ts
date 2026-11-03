// Finds, for each function the PR changes, who calls it and what the changed
// lines call, by searching the checked-out PR head with `git grep`. Matching is
// by name, so overloads and same-named functions can be mixed up; the model is
// told so. The model never runs a search: the action decides what is read.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ReviewFile } from './context.ts';

const run = promisify(execFile);

const MAX_CHANGED_FUNCTIONS = 15;
const MAX_CALLERS = 5;
const MAX_CALLEES = 8;
const MAX_SNIPPET_LINES = 40;
const CALLER_WINDOW = 4;
const MAX_SCAN = 3000;

export interface Snippet {
  file: string;
  /** Line number of the first entry in `lines`; a `null` entry marks skipped lines. */
  start: number;
  lines: (string | null)[];
}

export interface FunctionRef {
  name: string;
  file: string;
  line: number;
}

export interface Caller {
  /** The function containing the call. */
  caller: FunctionRef;
  file: string;
  line: number;
  snippet: Snippet;
}

export interface Callee {
  definition: FunctionRef;
  snippet: Snippet;
}

export interface ChangedFunction {
  fn: FunctionRef;
  callers: Caller[];
  callees: Callee[];
}

interface Language {
  extensions: string[];
  definition: RegExp[];
}

const LANGUAGES: Record<string, Language> = {
  go: {
    extensions: ['go'],
    definition: [/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*[[(]/],
  },
  csharp: {
    extensions: ['cs'],
    definition: [
      /^\s*(?:\[[^\]]*\]\s*)*(?:(?:public|private|protected|internal|static|virtual|override|abstract|async|sealed|extern|unsafe|new|partial|readonly)\s+)+[^=;]*?\b([A-Za-z_]\w*)\s*(?:<[^<>()]*>)?\s*\(/,
    ],
  },
  typescript: {
    extensions: ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'],
    definition: [
      /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
      /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/,
      /^\s*(?:(?:public|private|protected|static|async|readonly|override|abstract|get|set)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^<>()]*>)?\s*\([^;]*\)\s*(?::\s*[^{;=]+)?\{\s*$/,
    ],
  },
};

const KEYWORDS = new Set(
  'if else for foreach while do switch case catch return throw new await async using lock typeof sizeof nameof default func go defer select function yield base this super delete void in of is as var let const class struct interface enum get set when where fixed checked unchecked'.split(' '),
);

const EXCLUDED_PATHS = ['*_test.go', '*Tests/*', '*Test/*', '*.test.*', '*.spec.*', 'vendor/*', '*/vendor/*', '*node_modules/*', 'dist/*', '*/dist/*'];

function languageOf(file: string): Language | undefined {
  const ext = /\.([^./]+)$/.exec(file)?.[1].toLowerCase();
  return Object.values(LANGUAGES).find(l => ext !== undefined && l.extensions.includes(ext));
}

/** The line with string literals and line comments removed, for brace counting and call detection. */
function codeOnly(line: string): string {
  return line
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '""')
    .replace(/\/\/.*$/, '')
    .replace(/^\s*(?:\/?\*.*)$/, '');
}

function definitionName(lang: Language, line: string): string | undefined {
  for (const re of lang.definition) {
    const name = re.exec(line)?.[1];
    if (name && !KEYWORDS.has(name)) return name;
  }
  return undefined;
}

/** 1-based line where the function starting at `start` ends, by brace matching. */
function functionEnd(lines: string[], start: number): number {
  let depth = 0;
  let opened = false;
  for (let i = start - 1; i < lines.length && i < start - 1 + MAX_SCAN; i++) {
    for (const ch of codeOnly(lines[i])) {
      if (ch === '{') {
        depth++;
        opened = true;
      } else if (ch === '}') {
        depth--;
      }
    }
    if (opened && depth <= 0) return i + 1;
    // Declarations without a body, or expression-bodied members, end at the first `;`.
    if (!opened && i >= start + 1 && /;\s*$/.test(lines[i])) return i + 1;
  }
  return start;
}

/** The innermost named function containing `line`, if any. */
function enclosingFunction(lang: Language, lines: string[], file: string, line: number): (FunctionRef & { end: number }) | undefined {
  for (let i = line; i >= 1 && i > line - MAX_SCAN; i--) {
    const name = definitionName(lang, lines[i - 1]);
    if (!name) continue;
    const end = functionEnd(lines, i);
    if (end >= line) return { name, file, line: i, end };
  }
  return undefined;
}

function callsIn(line: string): string[] {
  return [...codeOnly(line).matchAll(/(?<![\w$])([A-Za-z_$][\w$]*)\s*(?:<[^<>()]*>)?\s*\(/g)].map(m => m[1]).filter(n => !KEYWORDS.has(n));
}

function snippet(file: string, lines: string[], start: number, end: number): Snippet {
  const last = Math.min(end, lines.length, start + MAX_SNIPPET_LINES - 1);
  return { file, start, lines: lines.slice(start - 1, last) };
}

/** The caller's signature, then a window around the call. */
function callSnippet(file: string, lines: string[], fnLine: number, call: number): Snippet {
  const from = Math.max(1, call - CALLER_WINDOW);
  const window = lines.slice(from - 1, Math.min(lines.length, call + CALLER_WINDOW));
  if (fnLine >= from) {
    return { file, start: fnLine, lines: lines.slice(fnLine - 1, Math.min(lines.length, call + CALLER_WINDOW)) };
  }
  return { file, start: fnLine, lines: [lines[fnLine - 1], ...(fnLine + 1 < from ? [null] : lines.slice(fnLine, from - 1)), ...window] };
}

export class Repository {
  private readonly cache = new Map<string, Promise<string[]>>();
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  /** Throws unless the working tree is checked out at `sha`. */
  async assertHead(sha: string): Promise<void> {
    const { stdout } = await run('git', ['rev-parse', 'HEAD'], { cwd: this.root }).catch(() => ({ stdout: '' }));
    if (stdout.trim() !== sha) {
      throw new Error(
        `工作目錄不是 PR head（${sha.slice(0, 7)}）的 checkout。請在這個 action 前加上 actions/checkout，並設定 ref: \${{ github.event.pull_request.head.sha }} 與 persist-credentials: false`,
      );
    }
  }

  lines(file: string): Promise<string[]> {
    let cached = this.cache.get(file);
    if (!cached) {
      cached = readFile(join(this.root, file), 'utf8').then(text => text.split(/\r?\n/));
      this.cache.set(file, cached);
    }
    return cached;
  }

  /** Lines containing `name` in non-test source files of the language. */
  async grep(name: string, lang: Language): Promise<Array<{ file: string; line: number; text: string }>> {
    const pathspecs = [...lang.extensions.map(e => `*.${e}`), ...EXCLUDED_PATHS.map(p => `:(exclude)${p}`)];
    try {
      const { stdout } = await run('git', ['grep', '-n', '-I', '-F', '-e', name, '--', ...pathspecs], { cwd: this.root, maxBuffer: 64 * 1024 * 1024 });
      return stdout.split('\n').flatMap(row => {
        const m = /^(.+?):(\d+):(.*)$/.exec(row);
        return m ? [{ file: m[1], line: Number(m[2]), text: m[3] }] : [];
      });
    } catch (error) {
      if ((error as { code?: number }).code === 1) return []; // no match
      throw error;
    }
  }
}

async function findCallers(repo: Repository, lang: Language, fn: FunctionRef): Promise<Caller[]> {
  const call = new RegExp(`(?<![\\w$.])${fn.name}\\s*(?:<[^<>()]*>)?\\s*\\(|\\.${fn.name}\\s*(?:<[^<>()]*>)?\\s*\\(`);
  const callers: Caller[] = [];
  const seen = new Set<string>();
  for (const hit of await repo.grep(fn.name, lang)) {
    if (callers.length >= MAX_CALLERS) break;
    if (!call.test(codeOnly(hit.text)) || definitionName(lang, hit.text) === fn.name) continue;
    const lines = await repo.lines(hit.file);
    // A hit outside any function is a declaration (interfaces, abstract members), not a call.
    const caller = enclosingFunction(lang, lines, hit.file, hit.line);
    if (!caller || (caller.file === fn.file && caller.line === fn.line)) continue;
    const key = `${caller.file}:${caller.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    callers.push({
      caller: { name: caller.name, file: caller.file, line: caller.line },
      file: hit.file,
      line: hit.line,
      snippet: callSnippet(hit.file, lines, caller.line, hit.line),
    });
  }
  return callers;
}

async function findDefinition(repo: Repository, lang: Language, name: string, near: string): Promise<Callee | undefined> {
  const defs = [];
  for (const hit of await repo.grep(name, lang)) {
    if (definitionName(lang, hit.text) === name) defs.push(hit);
  }
  const dir = near.slice(0, near.lastIndexOf('/') + 1);
  const best = defs.find(d => d.file === near) ?? defs.find(d => d.file.startsWith(dir)) ?? defs[0];
  if (!best) return undefined;
  const lines = await repo.lines(best.file);
  return { definition: { name, file: best.file, line: best.line }, snippet: snippet(best.file, lines, best.line, functionEnd(lines, best.line)) };
}

export async function buildCallGraph(repo: Repository, files: ReviewFile[]): Promise<ChangedFunction[]> {
  const result: ChangedFunction[] = [];
  for (const file of files) {
    const lang = languageOf(file.filename);
    if (!lang || file.added.size === 0) continue;
    const lines = await repo.lines(file.filename);

    const changed = new Map<number, { fn: FunctionRef; calls: string[] }>();
    for (const n of [...file.added].sort((a, b) => a - b)) {
      const fn = enclosingFunction(lang, lines, file.filename, n);
      if (!fn) continue;
      const entry = changed.get(fn.line) ?? { fn: { name: fn.name, file: fn.file, line: fn.line }, calls: [] };
      changed.set(fn.line, entry);
      if (n !== fn.line) entry.calls.push(...callsIn(lines[n - 1]));
    }

    for (const { fn, calls } of changed.values()) {
      if (result.length >= MAX_CHANGED_FUNCTIONS) return result;
      const callees: Callee[] = [];
      for (const name of [...new Set(calls)].filter(n => n !== fn.name)) {
        if (callees.length >= MAX_CALLEES) break;
        const def = await findDefinition(repo, lang, name, fn.file);
        if (def) callees.push(def);
      }
      result.push({ fn, callers: await findCallers(repo, lang, fn), callees });
    }
  }
  return result;
}
