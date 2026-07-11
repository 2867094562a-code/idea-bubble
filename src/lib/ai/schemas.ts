import { z } from "zod";

import { normalizeIdeaWord } from "@/lib/idea-normalization";
import { inspirationIdeaSchema } from "@/lib/schemas";

function uniqueIdeaWords(value: { ideas: Array<{ word: string }> }, context: z.RefinementCtx): void {
  const words = value.ideas.map((idea) => normalizeIdeaWord(idea.word));
  if (new Set(words).size !== words.length) {
    context.addIssue({
      code: "custom",
      path: ["ideas"],
      message: "同一批结果中不能出现重复词语",
    });
  }
}

export const imageAnalysisResultSchema = z
  .object({
    source: z.string().trim().min(1).max(200),
    ideas: z.array(inspirationIdeaSchema).length(10),
    analysis: z.string().trim().min(20).max(1_200),
  })
  .superRefine(uniqueIdeaWords);

export function repairedIdeasSchema(count: number) {
  return z
    .object({
      ideas: z.array(inspirationIdeaSchema).length(count),
    })
    .superRefine(uniqueIdeaWords);
}
