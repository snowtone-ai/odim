// Minimal markdown block parser for repo-controlled, trusted documentation
// (docs/api-reference.md). Supports the subset used there: #/##/### headings,
// nested "-" lists, fenced code blocks, inline code, and paragraphs.
// Output is structured data rendered as React elements — never raw HTML.

export type InlineSegment = { code: boolean; text: string };

export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; segments: InlineSegment[] }
  | { type: "paragraph"; segments: InlineSegment[] }
  | { type: "list"; items: { indent: number; segments: InlineSegment[] }[] }
  | { type: "code"; language: string; code: string };

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const parts = text.split("`");
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index].length === 0) continue;
    segments.push({ code: index % 2 === 1, text: parts[index] });
  }
  return segments;
}

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1; // closing fence
      blocks.push({ type: "code", language: fence[1], code: code.join("\n") });
      continue;
    }

    const heading = line.match(/^(#{1,3}) (.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        segments: parseInline(heading[2])
      });
      index += 1;
      continue;
    }

    if (/^\s*- /.test(line)) {
      const items: { indent: number; segments: InlineSegment[] }[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^(\s*)- (.+)$/);
        if (!item) break;
        items.push({ indent: Math.floor(item[1].length / 2), segments: parseInline(item[2]) });
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !/^(#{1,3} |```|\s*- )/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", segments: parseInline(paragraph.join(" ")) });
  }

  return blocks;
}
