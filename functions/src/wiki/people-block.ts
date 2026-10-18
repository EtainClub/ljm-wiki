/** 기존 수동 관찰은 보존하고 사건 목록만 생성 구간으로 전환한다. */
export function replaceEventSection(text: string, body: string): string {
  const generated = `<!-- generated:events -->\n${body}\n<!-- /generated -->`;
  const block = /<!--\s*generated:events\s*-->[\s\S]*?<!--\s*\/generated\s*-->/;
  if (block.test(text)) return text.replace(block, () => generated);
  const section = /(^## 등장한 사건[^\n]*\n)([\s\S]*?)(?=^## |$(?![\s\S]))/m;
  if (section.test(text)) {
    return text.replace(section, (_match, heading: string, old: string) => {
      const notes = old.split("\n").filter((line) => !/^- \[\[events\//.test(line)).join("\n").trim();
      return `${heading}\n${generated}\n\n${notes ? notes + "\n\n" : ""}`;
    });
  }
  return `${text.trimEnd()}\n\n## 등장한 사건\n\n${generated}\n`;
}
