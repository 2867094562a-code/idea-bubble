import { describe, expect, it } from "vitest";
import { expansionResultSchema, filterDuplicateIdeas } from "@/lib/schemas";

function idea(word: string, relevance = 0.8) {
  return { word, category: "结构", reason: `${word}的关联原因`, visualHint: `${word}视觉提示`, relevance };
}

describe("气泡 AI Schema", () => {
  it("只接受恰好 10 个唯一气泡", () => {
    const valid = { source: "蜂巢", ideas: Array.from({ length: 10 }, (_, index) => idea(`灵感${index}`)) };
    expect(expansionResultSchema.parse(valid).ideas).toHaveLength(10);
    expect(() => expansionResultSchema.parse({ ...valid, ideas: valid.ideas.slice(0, 9) })).toThrow();
    expect(() =>
      expansionResultSchema.parse({ ...valid, ideas: [...valid.ideas.slice(0, 9), idea("灵感0")] }),
    ).toThrow();
  });

  it("拒绝超出 0–1 的相关度", () => {
    const result = {
      source: "蜂巢",
      ideas: Array.from({ length: 10 }, (_, index) => idea(`灵感${index}`, index === 2 ? 1.2 : 0.8)),
    };
    expect(() => expansionResultSchema.parse(result)).toThrow();
  });

  it("过滤画布已有词和批内重复词", () => {
    const filtered = filterDuplicateIdeas(
      [idea("模块 化"), idea("轻量"), idea("轻-量"), idea("透明")],
      ["模块化"],
    );
    expect(filtered.map((item) => item.word)).toEqual(["轻量", "透明"]);
  });
});
