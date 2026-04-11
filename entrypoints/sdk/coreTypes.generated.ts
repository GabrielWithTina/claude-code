// AUTO-GENERATED from coreSchemas.ts — do not edit directly.
// Generated stub for build compatibility.

import type { z } from 'zod/v4'
import type { MessageParam, Message, RawMessageStreamEvent } from '@anthropic-ai/sdk/resources/index.mjs'
import type { UUID } from 'crypto'
import type { NonNullableUsage } from './sdkUtilityTypes.js'
import type {
  ModelUsageSchema,
  OutputFormatTypeSchema,
  BaseOutputFormatSchema,
  JsonSchemaOutputFormatSchema,
  OutputFormatSchema,
  ApiKeySourceSchema,
  ConfigScopeSchema,
  SdkBetaSchema,
  ThinkingAdaptiveSchema,
  ThinkingEnabledSchema,
  ThinkingDisabledSchema,
  ThinkingConfigSchema,
  McpStdioServerConfigSchema,
  McpSSEServerConfigSchema,
  McpHttpServerConfigSchema,
  McpSdkServerConfigSchema,
  McpServerConfigForProcessTransportSchema,
  McpClaudeAIProxyServerConfigSchema,
  McpServerStatusConfigSchema,
  McpServerStatusSchema,
  McpSetServersResultSchema,
  PermissionUpdateDestinationSchema,
  PermissionBehaviorSchema,
  PermissionRuleValueSchema,
  PermissionUpdateSchema,
  PermissionDecisionClassificationSchema,
  PermissionResultSchema,
  PermissionModeSchema,
  HookEventSchema,
  BaseHookInputSchema,
  PreToolUseHookInputSchema,
  PermissionRequestHookInputSchema,
  PostToolUseHookInputSchema,
  PostToolUseFailureHookInputSchema,
  PermissionDeniedHookInputSchema,
  NotificationHookInputSchema,
  UserPromptSubmitHookInputSchema,
  SessionStartHookInputSchema,
  SetupHookInputSchema,
  StopHookInputSchema,
  StopFailureHookInputSchema,
  SubagentStartHookInputSchema,
  SubagentStopHookInputSchema,
  PreCompactHookInputSchema,
  PostCompactHookInputSchema,
  TeammateIdleHookInputSchema,
  TaskCreatedHookInputSchema,
  TaskCompletedHookInputSchema,
  ElicitationHookInputSchema,
  ElicitationResultHookInputSchema,
  ConfigChangeHookInputSchema,
  InstructionsLoadedHookInputSchema,
  WorktreeCreateHookInputSchema,
  WorktreeRemoveHookInputSchema,
  CwdChangedHookInputSchema,
  FileChangedHookInputSchema,
  ExitReasonSchema,
  SessionEndHookInputSchema,
  HookInputSchema,
  AsyncHookJSONOutputSchema,
  PreToolUseHookSpecificOutputSchema,
  UserPromptSubmitHookSpecificOutputSchema,
  SessionStartHookSpecificOutputSchema,
  SetupHookSpecificOutputSchema,
  SubagentStartHookSpecificOutputSchema,
  PostToolUseHookSpecificOutputSchema,
  PostToolUseFailureHookSpecificOutputSchema,
  PermissionDeniedHookSpecificOutputSchema,
  NotificationHookSpecificOutputSchema,
  PermissionRequestHookSpecificOutputSchema,
  CwdChangedHookSpecificOutputSchema,
  FileChangedHookSpecificOutputSchema,
  ElicitationHookSpecificOutputSchema,
  ElicitationResultHookSpecificOutputSchema,
  WorktreeCreateHookSpecificOutputSchema,
  SyncHookJSONOutputSchema,
  HookJSONOutputSchema,
  PromptRequestOptionSchema,
  PromptRequestSchema,
  PromptResponseSchema,
  SlashCommandSchema,
  AgentInfoSchema,
  ModelInfoSchema,
  AccountInfoSchema,
  AgentMcpServerSpecSchema,
  AgentDefinitionSchema,
  SettingSourceSchema,
  SdkPluginConfigSchema,
  RewindFilesResultSchema,
  SDKAssistantMessageErrorSchema,
  SDKStatusSchema,
  SDKUserMessageSchema,
  SDKUserMessageReplaySchema,
  SDKRateLimitInfoSchema,
  SDKAssistantMessageSchema,
  SDKRateLimitEventSchema,
  SDKStreamlinedTextMessageSchema,
  SDKStreamlinedToolUseSummaryMessageSchema,
  SDKPermissionDenialSchema,
  SDKResultSuccessSchema,
  SDKResultErrorSchema,
  SDKResultMessageSchema,
  SDKSystemMessageSchema,
  SDKPartialAssistantMessageSchema,
  SDKCompactBoundaryMessageSchema,
  SDKStatusMessageSchema,
  SDKPostTurnSummaryMessageSchema,
  SDKAPIRetryMessageSchema,
  SDKLocalCommandOutputMessageSchema,
  SDKHookStartedMessageSchema,
  SDKHookProgressMessageSchema,
  SDKHookResponseMessageSchema,
  SDKToolProgressMessageSchema,
  SDKAuthStatusMessageSchema,
  SDKFilesPersistedEventSchema,
  SDKTaskNotificationMessageSchema,
  SDKTaskStartedMessageSchema,
  SDKSessionStateChangedMessageSchema,
  SDKTaskProgressMessageSchema,
  SDKToolUseSummaryMessageSchema,
  SDKElicitationCompleteMessageSchema,
  SDKPromptSuggestionMessageSchema,
  SDKSessionInfoSchema,
  SDKMessageSchema,
  FastModeStateSchema,
} from './coreSchemas.js'

type Infer<T extends () => z.ZodType> = z.infer<ReturnType<T>>

export type ModelUsage = Infer<typeof ModelUsageSchema>
export type OutputFormatType = Infer<typeof OutputFormatTypeSchema>
export type BaseOutputFormat = Infer<typeof BaseOutputFormatSchema>
export type JsonSchemaOutputFormat = Infer<typeof JsonSchemaOutputFormatSchema>
export type OutputFormat = Infer<typeof OutputFormatSchema>
export type ApiKeySource = Infer<typeof ApiKeySourceSchema>
export type ConfigScope = Infer<typeof ConfigScopeSchema>
export type SdkBeta = Infer<typeof SdkBetaSchema>
export type ThinkingAdaptive = Infer<typeof ThinkingAdaptiveSchema>
export type ThinkingEnabled = Infer<typeof ThinkingEnabledSchema>
export type ThinkingDisabled = Infer<typeof ThinkingDisabledSchema>
export type ThinkingConfig = Infer<typeof ThinkingConfigSchema>
export type McpStdioServerConfig = Infer<typeof McpStdioServerConfigSchema>
export type McpSSEServerConfig = Infer<typeof McpSSEServerConfigSchema>
export type McpHttpServerConfig = Infer<typeof McpHttpServerConfigSchema>
export type McpSdkServerConfig = Infer<typeof McpSdkServerConfigSchema>
export type McpServerConfigForProcessTransport = Infer<typeof McpServerConfigForProcessTransportSchema>
export type McpClaudeAIProxyServerConfig = Infer<typeof McpClaudeAIProxyServerConfigSchema>
export type McpServerStatusConfig = Infer<typeof McpServerStatusConfigSchema>
export type McpServerStatus = Infer<typeof McpServerStatusSchema>
export type McpSetServersResult = Infer<typeof McpSetServersResultSchema>
export type PermissionUpdateDestination = Infer<typeof PermissionUpdateDestinationSchema>
export type PermissionBehavior = Infer<typeof PermissionBehaviorSchema>
export type PermissionRuleValue = Infer<typeof PermissionRuleValueSchema>
export type PermissionUpdate = Infer<typeof PermissionUpdateSchema>
export type PermissionDecisionClassification = Infer<typeof PermissionDecisionClassificationSchema>
export type PermissionResult = Infer<typeof PermissionResultSchema>
export type PermissionMode = Infer<typeof PermissionModeSchema>
export type HookEvent = Infer<typeof HookEventSchema>
export type BaseHookInput = Infer<typeof BaseHookInputSchema>
export type PreToolUseHookInput = Infer<typeof PreToolUseHookInputSchema>
export type PermissionRequestHookInput = Infer<typeof PermissionRequestHookInputSchema>
export type PostToolUseHookInput = Infer<typeof PostToolUseHookInputSchema>
export type PostToolUseFailureHookInput = Infer<typeof PostToolUseFailureHookInputSchema>
export type PermissionDeniedHookInput = Infer<typeof PermissionDeniedHookInputSchema>
export type NotificationHookInput = Infer<typeof NotificationHookInputSchema>
export type UserPromptSubmitHookInput = Infer<typeof UserPromptSubmitHookInputSchema>
export type SessionStartHookInput = Infer<typeof SessionStartHookInputSchema>
export type SetupHookInput = Infer<typeof SetupHookInputSchema>
export type StopHookInput = Infer<typeof StopHookInputSchema>
export type StopFailureHookInput = Infer<typeof StopFailureHookInputSchema>
export type SubagentStartHookInput = Infer<typeof SubagentStartHookInputSchema>
export type SubagentStopHookInput = Infer<typeof SubagentStopHookInputSchema>
export type PreCompactHookInput = Infer<typeof PreCompactHookInputSchema>
export type PostCompactHookInput = Infer<typeof PostCompactHookInputSchema>
export type TeammateIdleHookInput = Infer<typeof TeammateIdleHookInputSchema>
export type TaskCreatedHookInput = Infer<typeof TaskCreatedHookInputSchema>
export type TaskCompletedHookInput = Infer<typeof TaskCompletedHookInputSchema>
export type ElicitationHookInput = Infer<typeof ElicitationHookInputSchema>
export type ElicitationResultHookInput = Infer<typeof ElicitationResultHookInputSchema>
export type ConfigChangeHookInput = Infer<typeof ConfigChangeHookInputSchema>
export type InstructionsLoadedHookInput = Infer<typeof InstructionsLoadedHookInputSchema>
export type WorktreeCreateHookInput = Infer<typeof WorktreeCreateHookInputSchema>
export type WorktreeRemoveHookInput = Infer<typeof WorktreeRemoveHookInputSchema>
export type CwdChangedHookInput = Infer<typeof CwdChangedHookInputSchema>
export type FileChangedHookInput = Infer<typeof FileChangedHookInputSchema>
export type ExitReason = Infer<typeof ExitReasonSchema>
export type SessionEndHookInput = Infer<typeof SessionEndHookInputSchema>
export type HookInput = Infer<typeof HookInputSchema>
export type AsyncHookJSONOutput = Infer<typeof AsyncHookJSONOutputSchema>
export type PreToolUseHookSpecificOutput = Infer<typeof PreToolUseHookSpecificOutputSchema>
export type UserPromptSubmitHookSpecificOutput = Infer<typeof UserPromptSubmitHookSpecificOutputSchema>
export type SessionStartHookSpecificOutput = Infer<typeof SessionStartHookSpecificOutputSchema>
export type SetupHookSpecificOutput = Infer<typeof SetupHookSpecificOutputSchema>
export type SubagentStartHookSpecificOutput = Infer<typeof SubagentStartHookSpecificOutputSchema>
export type PostToolUseHookSpecificOutput = Infer<typeof PostToolUseHookSpecificOutputSchema>
export type PostToolUseFailureHookSpecificOutput = Infer<typeof PostToolUseFailureHookSpecificOutputSchema>
export type PermissionDeniedHookSpecificOutput = Infer<typeof PermissionDeniedHookSpecificOutputSchema>
export type NotificationHookSpecificOutput = Infer<typeof NotificationHookSpecificOutputSchema>
export type PermissionRequestHookSpecificOutput = Infer<typeof PermissionRequestHookSpecificOutputSchema>
export type CwdChangedHookSpecificOutput = Infer<typeof CwdChangedHookSpecificOutputSchema>
export type FileChangedHookSpecificOutput = Infer<typeof FileChangedHookSpecificOutputSchema>
export type ElicitationHookSpecificOutput = Infer<typeof ElicitationHookSpecificOutputSchema>
export type ElicitationResultHookSpecificOutput = Infer<typeof ElicitationResultHookSpecificOutputSchema>
export type WorktreeCreateHookSpecificOutput = Infer<typeof WorktreeCreateHookSpecificOutputSchema>
export type SyncHookJSONOutput = Infer<typeof SyncHookJSONOutputSchema>
export type HookJSONOutput = Infer<typeof HookJSONOutputSchema>
export type PromptRequestOption = Infer<typeof PromptRequestOptionSchema>
export type PromptRequest = Infer<typeof PromptRequestSchema>
export type PromptResponse = Infer<typeof PromptResponseSchema>
export type SlashCommand = Infer<typeof SlashCommandSchema>
export type AgentInfo = Infer<typeof AgentInfoSchema>
export type ModelInfo = Infer<typeof ModelInfoSchema>
export type AccountInfo = Infer<typeof AccountInfoSchema>
export type AgentMcpServerSpec = Infer<typeof AgentMcpServerSpecSchema>
export type AgentDefinition = Infer<typeof AgentDefinitionSchema>
export type SettingSource = Infer<typeof SettingSourceSchema>
export type SdkPluginConfig = Infer<typeof SdkPluginConfigSchema>
export type RewindFilesResult = Infer<typeof RewindFilesResultSchema>
export type SDKAssistantMessageError = Infer<typeof SDKAssistantMessageErrorSchema>
export type SDKStatus = Infer<typeof SDKStatusSchema>

// External type aliases
export type APIUserMessage = MessageParam
export type APIAssistantMessage = Message
export type RawMessageStreamEventType = RawMessageStreamEvent

// SDK message types
export type SDKUserMessage = Infer<typeof SDKUserMessageSchema>
export type SDKUserMessageReplay = Infer<typeof SDKUserMessageReplaySchema>
export type SDKRateLimitInfo = Infer<typeof SDKRateLimitInfoSchema>
export type SDKAssistantMessage = Infer<typeof SDKAssistantMessageSchema>
export type SDKRateLimitEvent = Infer<typeof SDKRateLimitEventSchema>
export type SDKStreamlinedTextMessage = Infer<typeof SDKStreamlinedTextMessageSchema>
export type SDKStreamlinedToolUseSummaryMessage = Infer<typeof SDKStreamlinedToolUseSummaryMessageSchema>
export type SDKPermissionDenial = Infer<typeof SDKPermissionDenialSchema>
export type SDKResultSuccess = Infer<typeof SDKResultSuccessSchema>
export type SDKResultError = Infer<typeof SDKResultErrorSchema>
export type SDKResultMessage = Infer<typeof SDKResultMessageSchema>
export type SDKSystemMessage = Infer<typeof SDKSystemMessageSchema>
export type SDKPartialAssistantMessage = Infer<typeof SDKPartialAssistantMessageSchema>
export type SDKCompactBoundaryMessage = Infer<typeof SDKCompactBoundaryMessageSchema>
export type SDKStatusMessage = Infer<typeof SDKStatusMessageSchema>
export type SDKPostTurnSummaryMessage = Infer<typeof SDKPostTurnSummaryMessageSchema>
export type SDKAPIRetryMessage = Infer<typeof SDKAPIRetryMessageSchema>
export type SDKLocalCommandOutputMessage = Infer<typeof SDKLocalCommandOutputMessageSchema>
export type SDKHookStartedMessage = Infer<typeof SDKHookStartedMessageSchema>
export type SDKHookProgressMessage = Infer<typeof SDKHookProgressMessageSchema>
export type SDKHookResponseMessage = Infer<typeof SDKHookResponseMessageSchema>
export type SDKToolProgressMessage = Infer<typeof SDKToolProgressMessageSchema>
export type SDKAuthStatusMessage = Infer<typeof SDKAuthStatusMessageSchema>
export type SDKFilesPersistedEvent = Infer<typeof SDKFilesPersistedEventSchema>
export type SDKTaskNotificationMessage = Infer<typeof SDKTaskNotificationMessageSchema>
export type SDKTaskStartedMessage = Infer<typeof SDKTaskStartedMessageSchema>
export type SDKSessionStateChangedMessage = Infer<typeof SDKSessionStateChangedMessageSchema>
export type SDKTaskProgressMessage = Infer<typeof SDKTaskProgressMessageSchema>
export type SDKToolUseSummaryMessage = Infer<typeof SDKToolUseSummaryMessageSchema>
export type SDKElicitationCompleteMessage = Infer<typeof SDKElicitationCompleteMessageSchema>
export type SDKPromptSuggestionMessage = Infer<typeof SDKPromptSuggestionMessageSchema>
export type SDKSessionInfo = Infer<typeof SDKSessionInfoSchema>
export type SDKMessage = Infer<typeof SDKMessageSchema>
export type FastModeState = Infer<typeof FastModeStateSchema>
