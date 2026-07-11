import type { z } from "zod";

import type { ImageAnalysisResult, AITask } from "@/lib/ai/types";
import type { ConceptSummary, ImagePrompt, InspirationIdea, ProjectPlan } from "@/lib/domain";
import { normalizeIdeaWord } from "@/lib/idea-normalization";
import {
  conceptSummarySchema,
  expansionResultSchema,
  imagePromptSchema,
  planRequestSchema,
  projectPlanSchema,
  promptRequestSchema,
  summarizeRequestSchema,
  type ExpansionResult,
} from "@/lib/schemas";
import { imageAnalysisResultSchema } from "@/lib/ai/schemas";

type ExpandInput = z.infer<typeof import("@/lib/schemas").expandRequestSchema>;
type SummarizeInput = z.infer<typeof summarizeRequestSchema>;
type PlanInput = z.infer<typeof planRequestSchema>;
type PromptInput = z.infer<typeof promptRequestSchema>;

interface IdeaSlot {
  category: string;
  words: string[];
  visual: string[];
}

const IDEA_SLOTS: IdeaSlot[] = [
  {
    category: "形态结构",
    words: ["模块拼接", "蜂窝分区", "层叠曲面", "可变骨架"],
    visual: ["重复单元有序连接", "六边形分区向外生长", "薄片层层错位", "骨架随使用状态展开"],
  },
  {
    category: "形态结构",
    words: ["环抱轮廓", "悬浮夹层", "折叠网格", "渐变孔隙"],
    visual: ["轮廓向中心收拢", "上下表面留出空气层", "网格沿折线收合", "孔洞由密到疏过渡"],
  },
  {
    category: "功能体验",
    words: ["自适应反馈", "快速重组", "轻量支撑", "触感引导"],
    visual: ["受力区域实时变化", "组件一扣即合", "关键区域形成支撑桥", "表面纹理指引操作"],
  },
  {
    category: "功能体验",
    words: ["无感切换", "分区响应", "渐进交互", "情境提醒"],
    visual: ["状态转换自然连续", "不同区域独立响应", "交互层级逐步展开", "环境变化触发微光"],
  },
  {
    category: "材质工艺",
    words: ["再生纤维", "透明弹性体", "软硬共塑", "微孔织物"],
    visual: ["短纤维形成可见肌理", "半透明材料包覆边缘", "硬骨架与软表皮一体成型", "织面布满呼吸微孔"],
  },
  {
    category: "材质工艺",
    words: ["雾面金属", "植物基复材", "温变涂层", "编织壳体"],
    visual: ["低反光金属呈柔和高光", "天然颗粒嵌入基材", "颜色随温度缓慢变化", "纤维交错形成承力外壳"],
  },
  {
    category: "情绪氛围",
    words: ["安静生长", "轻盈秩序", "温暖科技", "克制未来感"],
    visual: ["柔光从结构缝隙溢出", "元素保持呼吸间距", "暖色光包裹精密细节", "冷静留白衬托单一焦点"],
  },
  {
    category: "使用场景",
    words: ["移动工作站", "夜间通勤", "共享展陈", "户外休憩"],
    visual: ["组件随身携带并快速展开", "暗光环境出现安全引导", "多人围绕模块共同操作", "结构与自然地面轻触"],
  },
  {
    category: "跨界联想",
    words: ["建筑表皮", "细胞网络", "乐器共鸣", "折纸机构"],
    visual: ["立面单元形成遮蔽层", "节点像细胞彼此传递", "空腔产生节奏化回声", "单张材料沿折线成形"],
  },
  {
    category: "反向创意",
    words: ["不完整美学", "暴露连接", "刻意失衡", "慢速响应"],
    visual: ["保留可见缺口与未封闭边缘", "连接件成为视觉主角", "重心偏移但保持稳定", "变化延迟形成期待感"],
  },
];

const HONEYCOMB_IDEAS: InspirationIdea[] = [
  {
    word: "六边晶格",
    category: "形态结构",
    reason: "蜂巢以六边形连续铺展，在较少材料下形成稳定、可扩张的结构。",
    visualHint: "六边单元由中心向外连续生长",
    relevance: 0.97,
  },
  {
    word: "巢室模块",
    category: "形态结构",
    reason: "把独立巢室转译为可替换模块，便于组合、维护和局部升级。",
    visualHint: "独立舱格以统一接口拼接",
    relevance: 0.94,
  },
  {
    word: "群体协同",
    category: "功能体验",
    reason: "蜂群通过分工共同维持巢穴，可映射为多人或多组件协作机制。",
    visualHint: "多个节点围绕共享目标同步响应",
    relevance: 0.93,
  },
  {
    word: "通风孔道",
    category: "功能体验",
    reason: "蜂巢内部需要空气交换，可转化为分区导流、散热和呼吸体验。",
    visualHint: "孔道在结构内部形成连续气流路径",
    relevance: 0.91,
  },
  {
    word: "蜂蜡半透",
    category: "材质工艺",
    reason: "蜂蜡温润、半透明且可塑，适合作为材料触感与透光语言。",
    visualHint: "暖色半透明表皮包裹细密纹理",
    relevance: 0.92,
  },
  {
    word: "仿生承重",
    category: "材质工艺",
    reason: "蜂窝夹层具有轻量高强特征，可启发减重与局部增强工艺。",
    visualHint: "薄表层夹持中空蜂窝芯材",
    relevance: 0.96,
  },
  {
    word: "蜂蜜暖色",
    category: "情绪氛围",
    reason: "蜂蜜的琥珀色和柔和透光能建立温暖、可信赖的感受。",
    visualHint: "琥珀金由中心向边缘渐淡",
    relevance: 0.86,
  },
  {
    word: "分布式动线",
    category: "使用场景",
    reason: "巢室之间拥有多条连接路径，可启发无单点阻塞的流动方式。",
    visualHint: "多条短路径连接相邻功能单元",
    relevance: 0.89,
  },
  {
    word: "层级协作",
    category: "跨界联想",
    reason: "从蜂群的角色层级联想到组织、服务或信息系统的协作关系。",
    visualHint: "不同尺度节点形成清晰协作层级",
    relevance: 0.84,
  },
  {
    word: "可扩张单元",
    category: "反向创意",
    reason: "不预设最终边界，让系统像蜂巢一样按需求逐格生长。",
    visualHint: "边缘保留开放接口等待新单元接入",
    relevance: 0.9,
  },
];

const DIRECTION_HINT: Record<ExpandInput["direction"], string> = {
  balanced: "兼顾视觉辨识与落地可能",
  practical: "优先考虑可制造性和真实使用",
  bold: "强化反差、尺度和记忆点",
  "cross-domain": "主动借用其他行业的结构逻辑",
  specific: "把联想落实到可描述的细节",
};

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function compactSource(source: string): string {
  return source.trim().replace(/\s+/g, " ").slice(0, 200);
}

function uniqueWord(base: string, source: string, index: number, used: Set<string>): string {
  const fragment = source.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 6) || "灵感";
  const candidates = [base, `${base}·${fragment}`, `${base}·${index + 1}`];
  for (const candidate of candidates) {
    const normalized = normalizeIdeaWord(candidate);
    if (!used.has(normalized)) {
      used.add(normalized);
      return candidate.slice(0, 30);
    }
  }

  let suffix = 1;
  while (used.has(normalizeIdeaWord(`${base}·${suffix}`))) suffix += 1;
  const value = `${base}·${suffix}`.slice(0, 30);
  used.add(normalizeIdeaWord(value));
  return value;
}

export function generateMockExpansion(input: ExpandInput): ExpansionResult {
  const source = compactSource(input.source);
  const seed = stableHash(`${source}|${input.direction}`);
  const used = new Set(input.existingWords.map(normalizeIdeaWord));
  if (/(蜂巢|蜂窝)/u.test(source)) {
    const ideas = HONEYCOMB_IDEAS.map((idea, index) => ({
      ...idea,
      word: uniqueWord(idea.word, source, index, used),
    }));
    return expansionResultSchema.parse({ source, ideas });
  }
  const ideas: InspirationIdea[] = IDEA_SLOTS.map((slot, index) => {
    const choice = (seed + index * 17) % slot.words.length;
    const word = uniqueWord(slot.words[choice], source, index, used);
    const relevance = Math.min(0.97, 0.73 + ((seed + index * 11) % 23) / 100);
    return {
      word,
      category: slot.category,
      reason: `从“${source}”提取${slot.category}线索，${DIRECTION_HINT[input.direction]}。`,
      visualHint: slot.visual[choice],
      relevance: Number(relevance.toFixed(2)),
    };
  });

  return expansionResultSchema.parse({ source, ideas });
}

export function generateMockSummary(input: SummarizeInput): ConceptSummary {
  const words = input.collectedIdeas.map((idea) => idea.word);
  const titleWords = words.slice(0, 2).join(" × ");
  const tone = {
    default: "清晰而具有延展性",
    concise: "简洁直接",
    professional: "专业且可执行",
    bold: "大胆并具有强烈反差",
    commercial: "兼顾识别度与商业转化",
    visual: "强调形态、材质和氛围",
  }[input.tone];
  const summary = `本概念以“${words.join("、")}”为核心线索，为“${input.projectInfo.name}”建立${tone}的创意方向。方案把这些灵感从单独词语转化为可组合的结构、体验与视觉语言，并围绕${input.projectInfo.goal || "项目目标"}组织使用路径。后续应优先验证关键场景中的理解成本、制作可行性与差异化，同时保留从原始气泡回溯每项决策的依据。`;

  return conceptSummarySchema.parse({
    title: `${titleWords || "灵感组合"}概念`,
    summary,
    keywords: [...new Set(words)].slice(0, 12),
    conflicts: [
      "视觉表现力与实际制造成本之间需要取得平衡",
      input.projectInfo.forbiddenElements
        ? `需避开：${input.projectInfo.forbiddenElements}`
        : "需确认材料、工艺与交付周期的边界",
    ],
    questions: ["哪个使用场景最值得优先制作原型？", "目标用户判断方案成功的首要标准是什么？"],
    sourceNodeIds: input.collectedIdeas.map((idea) => idea.id),
  });
}

export function generateMockPlan(input: PlanInput): ProjectPlan {
  const sourceNodeIds = input.collectedIdeas.map((idea) => idea.id);
  const ideas = input.collectedIdeas.map((idea) => idea.word);
  const audience = input.projectInfo.audience || "核心目标用户";
  const scenario = input.projectInfo.scenario || "主要使用场景";

  return projectPlanSchema.parse({
    projectName: input.projectInfo.name,
    subtitle: input.concept.title,
    oneLineConcept: `以${ideas.slice(0, 3).join("、")}构建可感知、可验证的创新体验。`,
    executiveSummary: `${input.concept.summary} 本计划将概念拆分为洞察、原型、验证和交付四个阶段，以明确产出和检查点降低执行风险。`,
    background: `项目面向${audience}，聚焦${scenario}中的真实需求与体验机会。`,
    problemDefinition: input.projectInfo.goal || "需要把分散灵感转化为可执行、可验证的项目方案。",
    targetAudience: [audience],
    usageScenarios: [scenario],
    projectGoals: ["形成有辨识度的核心概念", "完成可测试原型", "建立可追溯的决策依据"],
    coreIdeas: ideas,
    designDirection: ["以模块关系组织整体结构", "让关键交互保持直观", "控制复杂度并保留扩展空间"],
    visualDirection: ["圆润但克制的形态", "清晰的层级与留白", "用材质和光影强化重点"],
    functionalDirection: ["优先实现核心任务闭环", "对高频动作提供即时反馈", "为后续功能保留接口"],
    materialsOrResources: ["低保真原型材料", "关键工艺样件", "用户访谈与场景记录"],
    colorDirection: ["中性底色", "单一高识别强调色", "状态色保持可访问对比度"],
    executionSteps: [
      {
        stage: "阶段一：洞察确认",
        objective: "确认问题和成功标准",
        tasks: ["梳理用户场景", "排序核心灵感", "定义衡量指标"],
        deliverables: ["需求清单", "概念边界", "成功指标"],
        estimatedDependencies: ["项目干系人", "用户资料"],
      },
      {
        stage: "阶段二：概念原型",
        objective: "把核心想法变成可体验方案",
        tasks: ["绘制关键流程", "制作低保真原型", "评审形态与交互"],
        deliverables: ["流程图", "原型", "视觉方向板"],
        estimatedDependencies: ["设计资源", "原型工具"],
      },
      {
        stage: "阶段三：用户验证",
        objective: "验证理解度、可用性与吸引力",
        tasks: ["招募目标用户", "执行任务测试", "记录问题并分级"],
        deliverables: ["测试记录", "问题清单", "迭代建议"],
        estimatedDependencies: ["测试用户", "测试环境"],
      },
      {
        stage: "阶段四：方案交付",
        objective: "形成可实施的最终版本",
        tasks: ["完成重点迭代", "整理规范和资源", "制定后续排期"],
        deliverables: ["最终方案", "实施规范", "下一阶段路线图"],
        estimatedDependencies: ["开发或制作团队", "预算与排期"],
      },
    ],
    risks: ["范围扩张导致核心体验被稀释", "材料或技术验证晚于设计决策", "目标用户样本不足"],
    validationMethods: ["任务完成率", "半结构化访谈", "原型可用性测试", "成本与工艺评审"],
    nextActions: ["确认一号优先场景", "选择三个核心气泡进入原型", "安排首次用户测试"],
    sourceNodeIds,
  });
}

export function generateMockImagePrompt(input: PromptInput): ImagePrompt {
  const ideas = input.plan.coreIdeas.slice(0, 8);
  const subject = input.plan.projectName;
  const forbidden = input.projectInfo.forbiddenElements.trim();

  return imagePromptSchema.parse({
    promptCN: `${subject}概念设计，以${ideas.join("、")}为核心，圆润克制的未来形态，模块化结构，细腻雾面与半透明材质，清晰层级，真实产品摄影质感，柔和侧光，高细节。`,
    promptEN: `${subject} concept design, inspired by ${ideas.join(", ")}, restrained rounded futuristic form, modular structure, refined matte and translucent materials, clear visual hierarchy, realistic product photography, soft side lighting, high detail.`,
    subject,
    style: "克制的未来主义产品设计",
    composition: "主体居中偏下，三分之二视角，留出充足负空间",
    materials: input.plan.materialsOrResources.slice(0, 6),
    colorPalette: input.plan.colorDirection.slice(0, 6),
    lighting: "柔和大面积侧光，边缘有轻微轮廓光",
    camera: "50mm 镜头，略高机位，浅景深，真实比例",
    negativePrompt: ["低清晰度", "过度装饰", "文字水印", "比例错误", ...(forbidden ? [forbidden] : [])],
    sourceIdeas: ideas,
    sourceNodeIds: input.plan.sourceNodeIds,
  });
}

export function generateMockImageAnalysis(input: {
  id: string;
  name: string;
  mimeType: string;
}): ImageAnalysisResult {
  const expansion = generateMockExpansion({
    source: `图像“${input.name}”`,
    existingWords: [],
    direction: "specific",
  });
  return imageAnalysisResultSchema.parse({
    source: input.name.slice(0, 200),
    analysis: `演示模式根据文件名“${input.name}”和类型 ${input.mimeType} 生成确定性视觉分析；未读取或伪装真实图像内容。输出用于完整演示从素材到灵感气泡的流程。`,
    ideas: expansion.ideas,
  });
}

export function mockModelName(task: AITask): string {
  return `mock-${task}`;
}
