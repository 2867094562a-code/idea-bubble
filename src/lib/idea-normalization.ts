export function normalizeIdeaWord(word: string): string {
  return word
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}
