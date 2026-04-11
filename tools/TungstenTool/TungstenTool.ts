// Stub for TungstenTool (internal Anthropic tool — not available in this build)
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    command: z.string().describe('Command to execute'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

export type Output = { output: string }

export const TUNGSTEN_TOOL_NAME = 'Tungsten'

export const TungstenTool = buildTool({
  name: TUNGSTEN_TOOL_NAME,
  async description() {
    return 'Internal tool — not available in this build.'
  },
  userFacingName() {
    return 'Tungsten'
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  isConcurrencySafe() {
    return false
  },
  isReadOnly() {
    return false
  },
  async checkPermissions(_input, _context) {
    return { result: 'allow', message: '' } as const
  },
  async prompt() {
    return 'Internal tool — not available in this build.'
  },
  renderToolUseMessage(input) {
    return null
  },
  renderToolUseErrorMessage(input, _error) {
    return null
  },
  renderToolResultMessage(_output, _input) {
    return null
  },
  async call(_input, _context) {
    throw new Error('TungstenTool is not available in this build.')
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content: 'TungstenTool is not available in this build.',
    }
  },
} satisfies ToolDef<InputSchema, Output>)

export function clearSessionsWithTungstenUsage(): void {
  // stub
}

export function resetInitializationState(): void {
  // stub
}
