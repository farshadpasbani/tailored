export interface IpLeak { term: string; line: number; index: number; }
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function scanProtected(text: string, terms: string[]): IpLeak[] {
  const leaks: IpLeak[] = [];
  for (const term of terms) {
    if (!term) continue;
    const re = new RegExp(esc(term), "gi");
    for (let m = re.exec(text); m; m = re.exec(text)) leaks.push({ term, index: m.index, line: text.slice(0, m.index).split("\n").length });
  }
  return leaks.sort((a, b) => a.index - b.index);
}
