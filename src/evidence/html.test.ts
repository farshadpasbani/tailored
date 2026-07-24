import { describe, expect, it } from "vitest";
import { extractSourceClaimMarkers, parseDeclarativeHtml } from "./html.js";

describe("declarative authored HTML", () => {
  it.each([
    ["script", "<script>document.body.textContent='owned'</script>"],
    ["event attribute", "<img src=x onerror=\"document.body.remove()\">"],
    ["SVG event", "<svg onload=\"document.body.remove()\"></svg>"],
    ["JavaScript URL", "<a href=\"javascript:alert(1)\">x</a>"],
    ["executable data URL", "<a href=\"data:text/html,<script>alert(1)</script>\">x</a>"],
    ["iframe srcdoc", "<iframe srcdoc=\"<p>injected</p>\"></iframe>"],
    ["object", "<object data=\"payload.html\"></object>"],
    ["embed", "<embed src=\"payload.html\">"],
    ["meta refresh", "<meta http-equiv=refresh content=\"0;url=payload.html\">"],
    ["SVG script", "<svg><script>alert(1)</script></svg>"],
    ["MathML handler", "<math><mtext onclick=\"alert(1)\">x</mtext></math>"],
  ])("rejects %s", (_label, html) => {
    const result = parseDeclarativeHtml(html);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/active|allowed|declarative/i);
  });

  it("accepts ordinary CV markup and injects the restrictive trusted CSP", () => {
    const result = parseDeclarativeHtml('<!doctype html><html><head><style>p{color:#222}</style></head><body><p><strong>Safe</strong> CV</p></body></html>');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.snapshotHtml).toMatch(/Content-Security-Policy/i);
  });

  it("extracts exact claim text with browser-compatible entities, inline punctuation and block spans", () => {
    const markers = extractSourceClaimMarkers('<p data-claim-id="c"><strong>©</strong>, &pound; &euro; &hellip; A&thinsp;B &eacute;<span style="display:block">next</span><a>link</a>.</p>');
    expect(markers).toEqual([expect.objectContaining({ id: "c", text: "©, £ € … A B é next link." })]);
  });
});
