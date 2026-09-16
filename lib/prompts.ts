// Shared prompt pack. One sentence, family-safe, blank-page-proof.
// Server picks a random one when host doesn't supply a prompt,
// so the game never stalls on the same 2 hardcodes.
// Re-exports the 120-card library + DRAW packs + QUIZ pack. Legacy callers can
// still import { PROMPTS, randomPrompt } from here.
export * from "@/lib/prompts_text";
export * from "@/lib/prompts_draw";
export * from "@/lib/prompts_quiz";

// Back-compat helpers that keep the old call shape (string) while new
// callers use the richer PromptCard type.
import { PROMPTS as _PROMPTS, randomPrompt as _newPick, hintForPrompt as _hint } from "@/lib/prompts_text";
import { DRAW_PROMPTS, randomDrawPrompt as _drawPick } from "@/lib/prompts_draw";
export const DRAW_PROMPT_TEXTS = DRAW_PROMPTS.map((p) => p.text);
export function nextTextPrompt(opts: { exclude?: string | null; used?: string[] } = {}): string {
  return _newPick(opts).text;
}
export function nextDrawPrompt(exclude?: string | null): string {
  return _drawPick(exclude).text;
}
export { _PROMPTS as PROMPTS_OLD, _hint as hintForLegacy }
