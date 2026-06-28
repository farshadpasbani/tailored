// Render a captured job description (the markdown a fetch returns) into a clean,
// house-styled HTML document for archival as a PDF beside the CV. This is NOT a
// general markdown engine: it handles the small subset a job posting actually uses
// (headings, bullets, bold, links, paragraphs, rules) and escapes everything else,
// so an employer's raw text can never inject markup.

export interface JdMeta {
  title?: string;
  company?: string;
  location?: string;
  source?: string;
  date?: string;
}

// Escape every character that is syntactically significant in HTML text OR inside
// a double-quoted attribute value. Quotes matter because inline() drops the URL
// into an href="..."; without escaping them a crafted link could break out of the
// attribute and inject event handlers.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Inline formatting, applied AFTER escaping so source text cannot inject tags.
// The URL class also excludes quotes and angle brackets as defence in depth, so a
// hostile href cannot even reach the attribute as raw characters.
function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"'<>]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

function jdBody(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  let para: string[] = [];
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") { flushPara(); closeList(); continue; }
    if (/^#{1,6}\s+/.test(line)) {
      flushPara(); closeList();
      const level = line.match(/^#+/)![0].length;
      const tag = level <= 1 ? "h1" : level === 2 ? "h2" : "h3";
      out.push(`<${tag}>${inline(line.replace(/^#{1,6}\s+/, ""))}</${tag}>`);
      continue;
    }
    if (/^([-*])\s+/.test(line)) {
      flushPara();
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.replace(/^([-*])\s+/, ""))}</li>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushPara(); closeList(); out.push("<hr/>"); continue; }
    closeList();
    para.push(line);
  }
  flushPara(); closeList();
  return out.join("\n");
}

export function jdMarkdownToHtml(markdown: string, meta: JdMeta = {}): string {
  const title = meta.title ? escapeHtml(meta.title) : "Job Description";
  const subBits: string[] = [];
  if (meta.company) subBits.push(escapeHtml(meta.company));
  if (meta.location) subBits.push(escapeHtml(meta.location));
  const contactBits: string[] = [];
  if (meta.source) contactBits.push(`<a href="${escapeHtml(meta.source)}">${escapeHtml(meta.source)}</a>`);
  if (meta.date) contactBits.push(`captured ${escapeHtml(meta.date)}`);

  const header = [
    `<div class="name">${title}</div>`,
    subBits.length ? `<div class="role">${subBits.join(" · ")}</div>` : "",
    contactBits.length ? `<div class="contact">${contactBits.join('<span class="sep">/</span>')}</div>` : "",
  ].filter(Boolean).join("\n    ");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @page { size: A4; margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.4; color: #2c3640;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  a { color: #0e7490; text-decoration: none; word-break: break-all; }
  header { margin-bottom: 10px; border-bottom: 2px solid #16212b; padding-bottom: 8px; }
  .name { font-size: 19pt; font-weight: 700; color: #16212b; line-height: 1.1; }
  .role { font-size: 11.5pt; font-weight: 600; color: #0e7490; margin-top: 3px; }
  .contact { font-size: 8.8pt; color: #5a6571; margin-top: 4px; }
  .sep { color: #c2cad1; padding: 0 6px; }
  h1 { font-size: 13pt; color: #16212b; margin: 14px 0 6px; }
  h2 { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
       color: #16212b; border-bottom: 1px solid #dde3e8; padding-bottom: 3px; margin: 14px 0 6px; }
  h3 { font-size: 10.5pt; color: #16212b; margin: 10px 0 4px; }
  p { margin: 0 0 7px; }
  ul { margin: 4px 0 8px; padding-left: 18px; }
  li { margin-bottom: 3px; }
  hr { border: 0; border-top: 1px solid #dde3e8; margin: 10px 0; }
</style>
</head>
<body>
  <header>
    ${header}
  </header>
  ${jdBody(markdown)}
</body>
</html>
`;
}
