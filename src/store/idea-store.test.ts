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
});
