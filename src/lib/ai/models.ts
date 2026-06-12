/**
 * Anthropic model IDs, centralized so version bumps happen in one place
 * instead of across ~13 route files.
 *
 * - SONNET: heavier reasoning (chat, lab analysis, plan generation, vision).
 * - HAIKU: fast, cheap structured generation (briefs, tips, ratings, macros).
 */
export const MODEL_SONNET = 'claude-sonnet-4-6'
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001'
