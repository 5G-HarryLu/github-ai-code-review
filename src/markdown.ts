// Model text is untrusted markdown. It is parsed with the same GFM grammar
// GitHub uses, reduced to an allowlist of node types, and serialized back, so
// code spans, fences and escaping are decided by a real parser rather than by
// regexes. Outside code, nothing can mention people, reference issues, link
// out, load images or inject HTML.
import type { AlignType, Nodes, PhrasingContent, Root, RootContent, TableCell } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfm } from 'micromark-extension-gfm';

const ZWSP = '\u200b';

/** Sanitized block markdown (paragraphs, lists, code blocks, tables). */
export function sanitize(text: string, max: number): string {
  return serialize({ type: 'root', children: clean(parse(truncate(text, max)).children) as RootContent[] });
}

/** Sanitized single-line markdown, for headings and other one-line slots. */
export function sanitizeInline(text: string, max: number): string {
  return serialize({ type: 'root', children: [{ type: 'paragraph', children: phrasing(text, max) }] });
}

/** A fenced code block; the fence is made longer than any backtick run in the code. */
export function codeBlock(code: string, lang: string): string {
  return serialize({ type: 'root', children: [{ type: 'code', lang: lang || null, value: code.replace(/\s+$/, '') }] });
}

/** A GFM table whose cells are sanitized inline markdown. The first row is the header. */
export function table(rows: string[][], align: AlignType[], maxCell: number): string {
  return serialize({
    type: 'root',
    children: [
      {
        type: 'table',
        align,
        children: rows.map(row => ({
          type: 'tableRow',
          children: row.map((cell): TableCell => ({ type: 'tableCell', children: phrasing(cell, maxCell) })),
        })),
      },
    ],
  });
}

/** Inline content of one line of model text; anything that is not a single paragraph becomes plain text. */
function phrasing(text: string, max: number): PhrasingContent[] {
  const line = truncate(text.replace(/\s*\n\s*/g, ' '), max);
  const blocks = clean(parse(line).children);
  return blocks.length === 1 && blocks[0].type === 'paragraph'
    ? blocks[0].children
    : [{ type: 'text', value: neutralizeText(line) }];
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…（已截斷）` : text;
}

function parse(text: string): Root {
  return fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}

function serialize(root: Root): string {
  return toMarkdown(root, { extensions: [gfmToMarkdown({ tablePipeAlign: false })], bullet: '-', fences: true }).trim();
}

/** Breaks the text patterns GitHub turns into links, mentions and cross-references. */
function neutralizeText(value: string): string {
  return value
    .replace(/:\/\//g, `:${ZWSP}//`)
    .replace(/\bwww\./gi, `www${ZWSP}.`)
    .replace(/@(?=\w)/g, `@${ZWSP}`)
    .replace(/#(?=\d)/g, `#${ZWSP}`);
}

function clean(nodes: Nodes[]): Nodes[] {
  return nodes.flatMap(cleanNode);
}

function cleanNode(node: Nodes): Nodes[] {
  switch (node.type) {
    case 'text':
      return [{ type: 'text', value: neutralizeText(node.value) }];
    case 'code':
    case 'inlineCode':
    case 'break':
    case 'thematicBreak':
      return [node];
    case 'html':
      return [{ type: 'text', value: neutralizeText(node.value) }];
    case 'heading':
      return [{ type: 'paragraph', children: [{ type: 'strong', children: clean(node.children) as PhrasingContent[] }] }];
    case 'link':
    case 'linkReference':
      return clean(node.children);
    case 'image':
    case 'imageReference':
      return node.alt ? [{ type: 'text', value: neutralizeText(node.alt) }] : [];
    case 'definition':
    case 'footnoteDefinition':
    case 'footnoteReference':
    case 'yaml':
      return [];
    case 'root':
    case 'paragraph':
    case 'emphasis':
    case 'strong':
    case 'delete':
    case 'blockquote':
    case 'list':
    case 'listItem':
    case 'table':
    case 'tableRow':
    case 'tableCell':
      return [{ ...node, children: clean(node.children) } as Nodes];
  }
}
