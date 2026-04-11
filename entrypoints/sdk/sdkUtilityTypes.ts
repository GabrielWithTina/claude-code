// SDK utility types that cannot be expressed as Zod schemas
// because they are mapped types over external interfaces.

import type { BetaUsage } from '@anthropic-ai/sdk/resources/beta/messages/messages.js'

/**
 * A version of the Anthropic SDK BetaUsage type where every field is non-nullable.
 * Used throughout the codebase to avoid null-checking on usage fields.
 */
export type NonNullableUsage = {
  [K in keyof BetaUsage]: NonNullable<BetaUsage[K]>
}
