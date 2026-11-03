// Model text is untrusted markdown. It is parsed with the same GFM grammar
// GitHub uses, reduced to an allowlist of node types, and serialized back, so
// code spans, fences and escaping are decided by a real parser rather than by
// regexes. Outside code, nothing can mention people, reference issues, link
// out, load images or inject HTML.
import type { Nodes, Paragraph, PhrasingContent, Root, RootContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfm } from 'micromark-extension-gfm';

const ZWSP = '​';

/** Sanitized block markdown (paragraphs, lists, code blocks, tables). */
export function sanitize(text: string, max: number): string {
  return serialize({ type: 'root', children: clean(parse(truncate(text, max)).children) as RootContent[] });
}

/** Sanitized single-line markdown, for headings and other one-line slots. */
export function sanitizeInline(text: string, max: number): string {
  const line = truncate(text.replace(/\s*\n\s*/g, ' '), max);
  const blocks = clean(parse(line).children);
  const paragraph: Paragraph =
    blocks.length === 1 && blocks[0].type === 'paragraph'
      ? blocks[0]
      : { type: 'paragraph', children: [{ type: 'text', value: neutralizeText(line) }] };
  return serialize({ type: 'root', children: [paragraph] });
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…（已截斷）` : text;
}

function parse(text: string): Root {
  return fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}

function serialize(root: Root): string {
  return toMarkdown(root, { extensions: [gfmToMarkdown()], bullet: '-', fences: true }).trim();
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
