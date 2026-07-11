import { describe, expect, it } from "vitest";
import { generateMockExpansion, generateMockPlan, generateMockSummary } from "@/lib/ai/mock";
import { fixtureProject } from "@/test/fixtures";

describe("Mock AI 闭环", () => {
  it("对蜂巢稳定生成严格 10 个不重复气泡", () => {
    const first = generateMockExpansion({ source: "蜂巢", existingWords: [], direction: "balanced" });
    const second = generateMockExpansion({ source: "蜂巢", existingWords: [], direction: "balanced" });
    expect(first).toEqual(second);
    expect(first.ideas).toHaveLength(10);
    expect(new Set(first.ideas.map((idea) => idea.word)).size).toBe(10);
    expect(first.ideas.map((idea) => idea.word)).toEqual(
      expect.arrayContaining(["六边晶格", "巢室模块", "蜂蜡半透", "仿生承重", "可扩张单元"]),
    );
    expect(first.ideas.every((idea) => /蜂|巢|六边|群体|分布|扩张/u.test(`${idea.word}${idea.reason}`))).toBe(
      true,
    );

    const continued = generateMockExpansion({
      source: "蜂巢",
      existingWords: first.ideas.map((idea) => idea.word),
      direction: "balanced",
    });
    expect(continued.ideas).toHaveLength(10);
    expect(continued.ideas.every((idea) => !first.ideas.some((old) => old.word === idea.word))).toBe(true);
  });

  it("总结和计划保留来源节点", () => {
    const project = fixtureProject();
    const collected = project.nodes.filter((node) => node.collected);
    const summary = generateMockSummary({
      projectInfo: project.info,
      collectedIdeas: collected.map(({ id, word, category, reason }) => ({ id, word, category, reason })),
      provider: "mock",
      tone: "professional",
    });
    const plan = generateMockPlan({
      projectInfo: project.info,
      concept: summary,
      collectedIdeas: collected,
      provider: "mock",
    });
    expect(summary.sourceNodeIds).toEqual(collected.map((node) => node.id));
    expect(plan.sourceNodeIds).toEqual(collected.map((node) => node.id));
    expect(plan.executionSteps.length).toBeGreaterThan(0);
  });
});
