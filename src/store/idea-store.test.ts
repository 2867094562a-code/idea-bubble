import { afterEach, describe, expect, it, vi } from "vitest";
import { canSummarize, selectCollectedNodes, useIdeaStore } from "@/store/idea-store";
import { fixtureProject } from "@/test/fixtures";

describe("气泡收集状态", () => {
  afterEach(() => {
    vi.useRealTimers();
    useIdeaStore.setState({ project: undefined, past: [], future: [], collectionThreshold: 5 });
  });

  it("支持收集和取消收集", () => {
    vi.useFakeTimers();
    const project = fixtureProject();
    project.nodes.forEach((node) => (node.collected = false));
    useIdeaStore.setState({ project, hydrated: true });
    useIdeaStore.getState().toggleCollect("idea-1");
    expect(selectCollectedNodes(useIdeaStore.getState().project).map((node) => node.id)).toEqual(["idea-1"]);
    useIdeaStore.getState().toggleCollect("idea-1");
    expect(selectCollectedNodes(useIdeaStore.getState().project)).toHaveLength(0);
  });

  it("达到阈值只改变可总结状态", () => {
    const project = fixtureProject();
    expect(canSummarize(project, 5)).toBe(true);
    project.nodes.find((node) => node.id === "idea-5")!.collected = false;
    expect(canSummarize(project, 5)).toBe(false);
    expect(project.currentConcept).toBeDefined();
  });

  it("新增气泡会避开已有气泡和同批气泡", () => {
    const project = fixtureProject();
    useIdeaStore.setState({ project, hydrated: true });
    useIdeaStore.getState().addExpansion(
      "模块化",
      "idea-1",
      undefined,
      Array.from({ length: 10 }, (_, index) => ({
        word: `新方向${index + 1}`,
        category: "结构",
        reason: "用于验证自动避让布局",
        visualHint: "清晰轮廓",
        relevance: 0.9,
      })),
    );

    const nodes = useIdeaStore.getState().project!.nodes;
    const diameterOf = (node: (typeof nodes)[number]) =>
      node.depth === 0 ? 148 : Math.round(96 + node.relevance * 28);
    const added = nodes.filter((node) => node.parentId === "idea-1");

    expect(added).toHaveLength(10);
    for (const node of added) {
      const nodeDiameter = diameterOf(node);
      const nodeCenter = { x: node.position.x + nodeDiameter / 2, y: node.position.y + nodeDiameter / 2 };
      for (const other of nodes.filter((candidate) => candidate.id !== node.id)) {
        const otherDiameter = diameterOf(other);
        const otherCenter = {
          x: other.position.x + otherDiameter / 2,
          y: other.position.y + otherDiameter / 2,
        };
        expect(Math.hypot(nodeCenter.x - otherCenter.x, nodeCenter.y - otherCenter.y)).toBeGreaterThanOrEqual(
          (nodeDiameter + otherDiameter) / 2 + 32,
        );
      }
    }
  });
});
