import { createDefaultExportPreset } from "@/lib/defaults";
import type { ConceptSummary, InspirationNode, Project, ProjectPlan } from "@/lib/domain";

export const fixtureNodes: InspirationNode[] = [
  {
    id: "root-hive",
    word: "蜂巢",
    category: "原始灵感",
    reason: "用户输入的起始灵感",
    visualHint: "连续六边形",
    relevance: 1,
    position: { x: 420, y: 260 },
    depth: 0,
    collected: false,
    locked: false,
    collapsed: false,
    createdAt: "2026-07-11T08:00:00.000Z",
  },
  ...["模块化", "轻量支撑", "透明弹性体", "安静生长", "夜间通勤"].map((word, index) => ({
    id: `idea-${index + 1}`,
    parentId: "root-hive",
    word,
    category: ["结构", "功能", "材质", "情绪", "场景"][index],
    reason: `${word}来自蜂巢的结构与体验联想`,
    visualHint: `${word}的视觉语言`,
    relevance: 0.92 - index * 0.05,
    position: { x: 100 + index * 150, y: 480 },
    depth: 1,
    collected: true,
    locked: false,
    collapsed: false,
    createdAt: "2026-07-11T08:01:00.000Z",
  })),
];

export const fixtureConcept: ConceptSummary = {
  title: "共生模块通勤系统",
  summary:
    "本概念从蜂巢的模块秩序出发，把轻量支撑、透明弹性体与安静生长组合为面向夜间通勤的产品语言。设计通过可替换单元适应不同出行强度，并用低干扰光线反馈安全状态；所有关键判断均可回溯至用户收集的灵感气泡。",
  keywords: ["模块化", "轻量支撑", "透明弹性体", "安静生长", "夜间通勤"],
  conflicts: ["透明材料的耐久性与重量需要平衡"],
  questions: ["首版原型优先验证哪一种通勤场景？"],
  sourceNodeIds: ["idea-1", "idea-2", "idea-3", "idea-4", "idea-5"],
};

export const fixturePlan: ProjectPlan = {
  projectName: "蜂巢通勤概念",
  subtitle: "共生模块通勤系统",
  oneLineConcept: "用可替换蜂巢单元构建轻量、安全且可持续的通勤体验。",
  executiveSummary: fixtureConcept.summary,
  background: "城市夜间通勤需要兼顾安全、舒适与个性表达。",
  problemDefinition: "传统装备难以随不同通勤强度快速调整。",
  targetAudience: ["18–35 岁城市通勤者"],
  usageScenarios: ["夜间骑行", "步行换乘"],
  projectGoals: ["完成可体验原型", "验证模块更换效率"],
  coreIdeas: fixtureConcept.keywords,
  designDirection: ["六边形模块", "轻量骨架"],
  visualDirection: ["深色基底", "柔和轮廓光"],
  functionalDirection: ["快速拆装", "分区支撑"],
  materialsOrResources: ["再生纤维", "透明弹性体"],
  colorDirection: ["深海蓝", "薄荷绿"],
  executionSteps: [
    {
      stage: "阶段一：概念验证",
      objective: "确认模块结构与用户价值",
      tasks: ["制作结构样件", "完成五人可用性测试"],
      deliverables: ["低保真原型", "测试记录"],
      estimatedDependencies: ["工业设计", "材料供应商"],
    },
    {
      stage: "阶段二：设计深化",
      objective: "完成可交付方案",
      tasks: ["细化结构", "验证光线反馈"],
      deliverables: ["高保真原型", "设计规范"],
      estimatedDependencies: ["电子工程", "视觉设计"],
    },
  ],
  risks: ["材料耐久性不足", "模块连接结构复杂"],
  validationMethods: ["拆装时长", "任务完成率", "用户访谈"],
  nextActions: ["确认一号场景", "制作连接结构样件"],
  sourceNodeIds: fixtureConcept.sourceNodeIds,
};

export function fixtureProject(): Project {
  const preset = createDefaultExportPreset();
  preset.id = "preset-1";
  preset.includeSourceIdeas = true;
  preset.includedSections = [
    "cover",
    "projectInfo",
    "collectedIdeas",
    "concept",
    "plan",
    "execution",
    "risks",
    "version",
    "exportedAt",
  ];
  return {
    id: "project-hive",
    info: {
      designObject: "通勤水杯",
      name: "蜂巢通勤概念",
      type: "产品设计",
      customType: "",
      goal: "为夜间通勤者设计可调节的轻量装备",
      audience: "18–35 岁城市通勤者",
      scenario: "夜间骑行与步行换乘",
      requirements: "适合快速原型验证",
      forbiddenElements: "高饱和霓虹",
    },
    originalInputs: ["蜂巢"],
    assets: [],
    nodes: structuredClone(fixtureNodes),
    edges: fixtureNodes
      .slice(1)
      .map((node) => ({ id: `root-hive-${node.id}`, source: "root-hive", target: node.id })),
    currentConcept: structuredClone(fixtureConcept),
    conceptVersions: [
      {
        id: "concept-v1",
        name: "概念 v1",
        data: structuredClone(fixtureConcept),
        createdAt: "2026-07-11T08:03:00.000Z",
      },
    ],
    currentPlan: structuredClone(fixturePlan),
    planVersions: [
      {
        id: "plan-v1",
        name: "正式版",
        data: structuredClone(fixturePlan),
        createdAt: "2026-07-11T08:05:00.000Z",
        isFinal: true,
      },
    ],
    imagePromptVersions: [],
    exportPresets: [preset],
    exportJobs: [],
    aiRequestLogs: [],
    createdAt: "2026-07-11T08:00:00.000Z",
    updatedAt: "2026-07-11T08:06:00.000Z",
  };
}
