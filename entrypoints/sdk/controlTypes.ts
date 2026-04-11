// SDK Control Types — types derived from controlSchemas.ts
// Stub file for build compatibility.

import type { z } from 'zod/v4'
import type {
  SDKControlInitializeRequestSchema,
  SDKControlInitializeResponseSchema,
  SDKControlInterruptRequestSchema,
  SDKControlPermissionRequestSchema,
  SDKControlSetPermissionModeRequestSchema,
  SDKControlSetModelRequestSchema,
  SDKControlSetMaxThinkingTokensRequestSchema,
  SDKControlMcpStatusRequestSchema,
  SDKControlMcpStatusResponseSchema,
  SDKControlGetContextUsageRequestSchema,
  SDKControlGetContextUsageResponseSchema,
  SDKControlRewindFilesRequestSchema,
  SDKControlRewindFilesResponseSchema,
  SDKControlCancelAsyncMessageRequestSchema,
  SDKControlCancelAsyncMessageResponseSchema,
  SDKControlSeedReadStateRequestSchema,
  SDKHookCallbackRequestSchema,
  SDKControlMcpMessageRequestSchema,
  SDKControlMcpSetServersRequestSchema,
  SDKControlMcpSetServersResponseSchema,
  SDKControlReloadPluginsRequestSchema,
  SDKControlReloadPluginsResponseSchema,
  SDKControlMcpReconnectRequestSchema,
  SDKControlMcpToggleRequestSchema,
  SDKControlStopTaskRequestSchema,
  SDKControlApplyFlagSettingsRequestSchema,
  SDKControlGetSettingsRequestSchema,
  SDKControlGetSettingsResponseSchema,
} from './controlSchemas.js'

type Infer<T extends () => z.ZodType> = z.infer<ReturnType<T>>

export type SDKControlInitializeRequest = Infer<typeof SDKControlInitializeRequestSchema>
export type SDKControlInitializeResponse = Infer<typeof SDKControlInitializeResponseSchema>
export type SDKControlInterruptRequest = Infer<typeof SDKControlInterruptRequestSchema>
export type SDKControlPermissionRequest = Infer<typeof SDKControlPermissionRequestSchema>
export type SDKControlSetPermissionModeRequest = Infer<typeof SDKControlSetPermissionModeRequestSchema>
export type SDKControlSetModelRequest = Infer<typeof SDKControlSetModelRequestSchema>
export type SDKControlSetMaxThinkingTokensRequest = Infer<typeof SDKControlSetMaxThinkingTokensRequestSchema>
export type SDKControlMcpStatusRequest = Infer<typeof SDKControlMcpStatusRequestSchema>
export type SDKControlMcpStatusResponse = Infer<typeof SDKControlMcpStatusResponseSchema>
export type SDKControlGetContextUsageRequest = Infer<typeof SDKControlGetContextUsageRequestSchema>
export type SDKControlGetContextUsageResponse = Infer<typeof SDKControlGetContextUsageResponseSchema>
export type SDKControlRewindFilesRequest = Infer<typeof SDKControlRewindFilesRequestSchema>
export type SDKControlRewindFilesResponse = Infer<typeof SDKControlRewindFilesResponseSchema>
export type SDKControlCancelAsyncMessageRequest = Infer<typeof SDKControlCancelAsyncMessageRequestSchema>
export type SDKControlCancelAsyncMessageResponse = Infer<typeof SDKControlCancelAsyncMessageResponseSchema>
export type SDKControlSeedReadStateRequest = Infer<typeof SDKControlSeedReadStateRequestSchema>
export type SDKHookCallbackRequest = Infer<typeof SDKHookCallbackRequestSchema>
export type SDKControlMcpMessageRequest = Infer<typeof SDKControlMcpMessageRequestSchema>
export type SDKControlMcpSetServersRequest = Infer<typeof SDKControlMcpSetServersRequestSchema>
export type SDKControlMcpSetServersResponse = Infer<typeof SDKControlMcpSetServersResponseSchema>
export type SDKControlReloadPluginsRequest = Infer<typeof SDKControlReloadPluginsRequestSchema>
export type SDKControlReloadPluginsResponse = Infer<typeof SDKControlReloadPluginsResponseSchema>
export type SDKControlMcpReconnectRequest = Infer<typeof SDKControlMcpReconnectRequestSchema>
export type SDKControlMcpToggleRequest = Infer<typeof SDKControlMcpToggleRequestSchema>
export type SDKControlStopTaskRequest = Infer<typeof SDKControlStopTaskRequestSchema>
export type SDKControlApplyFlagSettingsRequest = Infer<typeof SDKControlApplyFlagSettingsRequestSchema>
export type SDKControlGetSettingsRequest = Infer<typeof SDKControlGetSettingsRequestSchema>
export type SDKControlGetSettingsResponse = Infer<typeof SDKControlGetSettingsResponseSchema>

export type SDKControlRequestInner =
  | SDKControlInitializeRequest
  | SDKControlInterruptRequest
  | SDKControlPermissionRequest
  | SDKControlSetPermissionModeRequest
  | SDKControlSetModelRequest
  | SDKControlSetMaxThinkingTokensRequest
  | SDKControlMcpStatusRequest
  | SDKControlGetContextUsageRequest
  | SDKControlRewindFilesRequest
  | SDKControlCancelAsyncMessageRequest
  | SDKControlSeedReadStateRequest
  | SDKHookCallbackRequest
  | SDKControlMcpMessageRequest
  | SDKControlMcpSetServersRequest
  | SDKControlReloadPluginsRequest
  | SDKControlMcpReconnectRequest
  | SDKControlMcpToggleRequest
  | SDKControlStopTaskRequest
  | SDKControlApplyFlagSettingsRequest
  | SDKControlGetSettingsRequest

export type SDKControlRequest = {
  type: 'control'
  request_id?: string
  data: SDKControlRequestInner
}

export type SDKControlResponse = {
  type: 'control_response'
  request_id?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
  error?: string
}

// StdoutMessage — the union of all messages written to stdout by the CLI
import type { SDKMessage } from './coreTypes.js'
export type StdoutMessage = SDKMessage | SDKControlRequest | SDKControlResponse

// Alias for the permission-request subtype
export type SDKControlPermissionRequest_ = SDKControlPermissionRequest
