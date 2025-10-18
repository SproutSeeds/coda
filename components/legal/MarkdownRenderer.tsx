"use client";

import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";

type MarkdownRendererProps = {
  content: string;
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);
  return (
    <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            if (block.level === 1) {
              return (
                <h1 key={index} className="text-3xl font-semibold tracking-tight text-foreground">
                  {renderInline(block.text)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2 key={index} className="mt-10 text-2xl font-semibold text-foreground">
                  {renderInline(block.text)}
                </h2>
              );
            }
            return (
              <h3 key={index} className="mt-8 text-xl font-semibold text-foreground">
                {renderInline(block.text)}
              </h3>
            );
          case "paragraph":
            return (
              <p key={index} className="text-sm text-muted-foreground">
                {renderInline(block.text)}
              </p>
            );
          case "list":
            return block.ordered ? (
              <ol key={index} className="list-decimal pl-6 text-sm text-muted-foreground">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ol>
            ) : (
              <ul key={index} className="list-disc pl-6 text-sm text-muted-foreground">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "code":
            return (
              <pre key={index} className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
                <code>{block.code}</code>
              </pre>
            );
          case "table":
            return (
              <div key={index} className="overflow-x-auto text-sm text-muted-foreground">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {block.headers.map((header, headerIndex) => (
                        <th key={headerIndex} className="border border-border bg-muted/40 px-3 py-2 text-left font-semibold">
                          {renderInline(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="border border-border px-3 py-2 align-top">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

type HeadingBlock = {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
};

type ParagraphBlock = {
  type: "paragraph";
  text: string;
};

type ListBlock = {
  type: "list";
  ordered: boolean;
  items: string[];
};

type CodeBlock = {
  type: "code";
  code: string;
};

type TableBlock = {
  type: "table";
  headers: string[];
  rows: string[][];
};

type MarkdownBlock = HeadingBlock | ParagraphBlock | ListBlock | CodeBlock | TableBlock;

function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let buffer: string[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let tableBuffer: string[] = [];

  const flushParagraph = () => {
    if (buffer.length) {
      const text = buffer.join(" ").trim();
      if (text) {
        blocks.push({ type: "paragraph", text });
      }
      buffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer && listBuffer.items.length) {
      blocks.push({ type: "list", ordered: listBuffer.ordered, items: listBuffer.items });
    }
    listBuffer = null;
  };

  const flushTable = () => {
    if (!tableBuffer.length) return;
    const rows = tableBuffer
      .map((rowLine) => rowLine.trim())
      .filter(Boolean)
      .map((rowLine) => rowLine.replace(/^\|/, "").replace(/\|$/, ""))
      .map((rowLine) => rowLine.split("|").map((cell) => cell.trim()));

    if (rows.length >= 2) {
      const [headerRow, separatorRow, ...bodyRows] = rows;
      const hasSeparator = separatorRow.every((cell) => /-+/.test(cell));
      const dataRows = hasSeparator ? bodyRows : rows.slice(1);

      blocks.push({
        type: "table",
        headers: headerRow,
        rows: dataRows,
      });
    } else if (rows.length === 1) {
      blocks.push({ type: "paragraph", text: rows[0].join(" ") });
    }

    tableBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (inCodeBlock) {
      if (line.startsWith("```")) {
        blocks.push({ type: "code", code: codeBuffer.join("\n") });
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        codeBuffer.push(rawLine);
      }
      continue;
    }

    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      flushTable();
      inCodeBlock = true;
      codeBuffer = [];
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    if (line.startsWith("|")) {
      flushParagraph();
      flushList();
      tableBuffer.push(line);
      continue;
    }

    if (tableBuffer.length) {
      flushTable();
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 3, text: line.slice(4).trim() });
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 2, text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 1, text: line.slice(2).trim() });
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const [, , itemText] = orderedMatch;
      flushParagraph();
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(itemText.trim());
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(line.slice(2).trim());
      continue;
    }

    if (listBuffer) {
      flushList();
    }

    buffer.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushTable();

  return blocks;
}

function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|_([^_]+)_/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      nodes.push(
        <a key={`${match.index}-link`} href={match[2]} className="text-primary underline-offset-2 hover:underline">
          {match[1]}
        </a>,
      );
    } else if (match[3]) {
      nodes.push(
        <strong key={`${match.index}-strong`}>{match[3]}</strong>,
      );
    } else if (match[4]) {
      nodes.push(
        <em key={`${match.index}-em`}>{match[4]}</em>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  // Collapse adjacent strings to avoid unnecessary React fragments.
  return nodes.reduce<ReactNode[]>((acc, node) => {
    const previous = acc[acc.length - 1];
    if (typeof node === "string" && typeof previous === "string") {
      acc[acc.length - 1] = `${previous}${node}`;
    } else {
      acc.push(node);
    }
    return acc;
  }, []).map((node, idx) => (
    <Fragment key={idx}>{node}</Fragment>
  ));
}
