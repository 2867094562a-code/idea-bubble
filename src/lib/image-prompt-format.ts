import type { ImagePrompt } from "@/lib/domain";

/** A portable payload for image providers that accept JSON-style prompt input. */
export function createImageJsonPrompt(prompt: Omit<ImagePrompt, "jsonPrompt">): string {
  return JSON.stringify(
    {
      prompt: prompt.promptEN,
      prompt_cn: prompt.promptCN,
      subject: prompt.subject,
      style: prompt.style,
      composition: prompt.composition,
      background: prompt.background,
      model_direction: prompt.modelDirection,
      viewpoint: prompt.viewpoint,
      materials: prompt.materials,
      color_palette: prompt.colorPalette,
      lighting: prompt.lighting,
      camera: prompt.camera,
      negative_prompt: prompt.negativePrompt,
    },
    null,
    2,
  );
}
