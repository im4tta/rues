import React from "react";

export function parseMarkdownWithWikilinks(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableAlign: string[] = [];
  let tableRows: string[][] = [];
  let key = 0;

  const flushTable = () => {
    if (!tableHeaders.length) return;
    const colCount = tableHeaders.length;
    result.push(
      <div key={`table-${key++}`} className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              {tableHeaders.map((h, i) => (
                <th key={i} className="border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 font-mono font-medium text-[var(--text-2)]" style={{ textAlign: (tableAlign[i] || "left") as any }}>{renderInline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-[var(--border)] px-2 py-1 text-[var(--text-2)]" style={{ textAlign: (tableAlign[ci] || "left") as any }}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeaders = [];
    tableAlign = [];
    tableRows = [];
    inTable = false;
  };

  const renderInline = (s: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    const re = /\[\[([^\]]+)\]\]|(\*\*|__)(.+?)\2|(`+)(.+?)\4|(\*|_)(.+?)\6/g;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      if (m[1]) {
        const [label, link] = m[1].split("|");
        const href = (link || label).replace(/ /g, "-");
        parts.push(<a key={idx++} href={`#${href}`} className="text-[var(--violet-text)] underline hover:opacity-80" onClick={(e) => { e.preventDefault(); }}>{label}</a>);
      } else if (m[2]) {
        parts.push(<strong key={idx++}>{m[3]}</strong>);
      } else if (m[4]) {
        parts.push(<code key={idx++} className="rounded bg-[var(--surface-2)] px-1 font-mono text-[10px]">{m[5]}</code>);
      } else if (m[6]) {
        parts.push(<em key={idx++}>{m[7]}</em>);
      }
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts.length ? <>{parts}</> : s;
  };

  for (const line of lines) {
    // Table detection
    const tableMatch = line.match(/^\|(.+)\|$/);
    if (tableMatch) {
      const cells = tableMatch[1].split("|").map((c) => c.trim());
      // Check if this is a separator row (|---|)
      if (/^[-:| ]+$/.test(cells.join(" ").replace(/\|/g, "").trim())) {
        tableAlign = cells.map((c) => {
          if (c.startsWith(":") && c.endsWith(":")) return "center";
          if (c.endsWith(":")) return "right";
          return "left";
        });
        continue;
      }
      if (!inTable) {
        flushTable();
        inTable = true;
        tableHeaders = cells;
      } else if (tableHeaders.length > 0) {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // Regular line
    if (line.startsWith("### ")) {
      result.push(<h3 key={key++} className="mt-3 mb-1 font-display text-[13px] font-semibold text-[var(--text)]">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      result.push(<h2 key={key++} className="mt-4 mb-1 font-display text-[15px] font-semibold text-[var(--text)]">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("# ")) {
      result.push(<h1 key={key++} className="mt-4 mb-2 font-display text-[17px] font-semibold text-[var(--text)]">{renderInline(line.slice(2))}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      result.push(<li key={key++} className="ml-4 list-disc text-[var(--text-2)]">{renderInline(line.slice(2))}</li>);
    } else if (/^\d+[.)]\s/.test(line)) {
      result.push(<li key={key++} className="ml-4 list-decimal text-[var(--text-2)]">{renderInline(line.replace(/^\d+[.)]\s/, ""))}</li>);
    } else if (line.startsWith("> ")) {
      result.push(<blockquote key={key++} className="border-l-2 border-[var(--violet-border)] pl-3 italic text-[var(--text-2)]">{renderInline(line.slice(2))}</blockquote>);
    } else if (/^---+$/.test(line.trim())) {
      result.push(<hr key={key++} className="my-3 border-[var(--border)]" />);
    } else if (line.trim() === "") {
      result.push(<div key={key++} className="h-2" />);
    } else if (line.startsWith("```") && line.trim() !== "```") {
      // Fenced code block start — not fully handled, just render as inline
      result.push(<code key={key++} className="block whitespace-pre-wrap rounded bg-[var(--surface-2)] p-2 font-mono text-[11px] text-[var(--text-2)]">{line.slice(3)}</code>);
    } else {
      result.push(<p key={key++} className="text-[var(--text-2)]">{renderInline(line)}</p>);
    }
  }
  flushTable();
  return result;
}



export function renderBasicMarkdownLines(text: string): React.ReactNode[] {
  return parseMarkdownWithWikilinks(text);
}

