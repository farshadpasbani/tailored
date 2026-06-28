import { describe, it, expect } from "vitest";
import { jdMarkdownToHtml } from "./pdf.js";

describe("jdMarkdownToHtml", () => {
  it("converts headings, bullets, bold and paragraphs", () => {
    const html = jdMarkdownToHtml("## Responsibilities\n\n- Build models\n- Write **clean** code\n\nA closing line.");
    expect(html).toContain("<h2>Responsibilities</h2>");
    expect(html).toContain("<li>Build models</li>");
    expect(html).toContain("<strong>clean</strong>");
    expect(html).toContain("<p>A closing line.</p>");
  });

  it("escapes HTML in the source so an employer's text cannot inject markup", () => {
    const html = jdMarkdownToHtml("Use C++ & <script>alert(1)</script> safely.");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("C++ &amp;");
  });

  it("renders metadata in the header", () => {
    const html = jdMarkdownToHtml("Body.", {
      title: "AI Engineer, Trustworthy Systems",
      company: "Halyard",
      location: "London, UK",
      source: "https://example.com/job/1",
      date: "2026-06-27",
    });
    expect(html).toContain('class="name">AI Engineer, Trustworthy Systems<');
    expect(html).toContain("Halyard · London, UK");
    expect(html).toContain('href="https://example.com/job/1"');
    expect(html).toContain("captured 2026-06-27");
  });

  it("converts markdown links to anchors", () => {
    const html = jdMarkdownToHtml("See [the role](https://example.com/x).");
    expect(html).toContain('<a href="https://example.com/x">the role</a>');
  });

  it("neutralises an attribute-breakout payload in a link href", () => {
    const html = jdMarkdownToHtml('[x](https://evil.com/"onmouseover="alert(1))')
    // No raw double-quote may survive inside or after the href to break the attribute.
    expect(html).not.toContain('"onmouseover="');
    expect(html).not.toMatch(/href="https:\/\/evil\.com\/"/);
    expect(html).toContain("&quot;");
  });

  it("falls back to a default title when none is given", () => {
    const html = jdMarkdownToHtml("Just a body.");
    expect(html).toContain('class="name">Job Description<');
  });
});
