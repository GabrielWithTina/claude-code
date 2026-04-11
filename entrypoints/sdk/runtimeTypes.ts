// SDK Runtime Types — non-serializable types (callbacks, interfaces with methods).
// Stub file for build compatibility.

import type { z } from 'zod/v4'
import type { SDKMessage, SDKResultMessage, SDKSessionInfo, SDKUserMessage } from './coreTypes.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyZodRawShape = { [k: string]: z.ZodType<any, any> }
export type InferShape<T extends AnyZodRawShape> = { [K in keyof T]: z.infer<T[K]> }

export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

export type McpSdkServerConfigWithInstance = {
  type: 'sdk'
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SdkMcpToolDefinition<Schema extends AnyZodRawShape = any> = {
  name: string
  description: string
  inputSchema: Schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extras?: Record<string, any>
}

export type SessionMessage = {
  role: 'user' | 'assistant'
  content: string
  uuid?: string
}

export type ListSessionsOptions = {
  dir?: string
  limit?: number
  offset?: number
}

export type GetSessionInfoOptions = {
  dir?: string
}

export type GetSessionMessagesOptions = {
  dir?: string
  limit?: number
  offset?: number
  includeSystemMessages?: boolean
}

export type SessionMutationOptions = {
  dir?: string
}

export type ForkSessionOptions = {
  dir?: string
  upToMessageId?: string
  title?: string
}

export type ForkSessionResult = {
  sessionId: string
}

export type Options = {
  maxTurns?: number
  systemPrompt?: string
  model?: string
  cwd?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export type InternalOptions = Options & {
  _internal?: boolean
}

export type Query = AsyncGenerator<SDKMessage>
export type InternalQuery = AsyncGenerator<SDKMessage>

export type SDKSessionOptions = Options

export type SDKSession = {
  query(prompt: string | AsyncIterable<SDKUserMessage>): AsyncGenerator<SDKMessage>
  abort(): void
  getSessionId(): string
}
