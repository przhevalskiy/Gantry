export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  timestamp: string;
  tokens_used?: number;
  response_time_ms?: number;
  intent?: string;
}

export interface Discussion {
  id: string;
  title: string;
  project_id?: string | null;
  task_id?: string | null;
  messages: Message[];
  is_active: boolean;
  intent?: string;
  created_at: string;
  updated_at: string;
}

export interface DiscussionCreate {
  title?: string;
  project_id?: string | null;
}

export interface DiscussionUpdate {
  title?: string;
  is_active?: boolean;
  intent?: string;
  project_id?: string | null;
}

export interface Project {
  id: string;
  name: string;
  repo_path?: string | null;
  github_url?: string | null;
  github_owner?: string | null;
  github_repo?: string | null;
  instructions?: string | null;
  locked_intent?: string | null;
  locked_service_type?: string | null;
  icon?: string | null;
  color?: string | null;
  parent_project_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  github_url?: string | null;
  instructions?: string | null;
  locked_intent?: string | null;
  locked_service_type?: string | null;
  icon?: string | null;
  color?: string | null;
  parent_project_id?: string | null;
}

export interface ProjectUpdate {
  name?: string;
  github_url?: string | null;
  instructions?: string | null;
  locked_intent?: string | null;
  locked_service_type?: string | null;
  icon?: string | null;
  color?: string | null;
  parent_project_id?: string | null;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  filename: string;
  content_type?: string | null;
  size_bytes?: number | null;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  body: string;
  hubspace_id?: string | null;
  icon?: string | null;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreate {
  name: string;
  description?: string | null;
  body: string;
  hubspace_id?: string | null;
  icon?: string | null;
  color?: string | null;
}

export interface TemplateUpdate {
  name?: string;
  description?: string | null;
  body?: string;
  hubspace_id?: string | null;
  icon?: string | null;
  color?: string | null;
}

export interface ChatRequest {
  discussion_id: string;
  message: string;
  temperature?: number;
  max_tokens?: number;
}

// SSE Event types
export interface SSEChunkEvent {
  type: 'chunk';
  content: string;
  provider: string;
}

export interface SSEDoneEvent {
  type: 'done';
  provider: string;
}

export interface SSEErrorEvent {
  type: 'error';
  error: string;
  provider: string;
}

export interface SSEDiscussionTitleEvent {
  type: 'discussion_title';
  discussion_id: string;
  title: string;
}

export interface SSEIntentEvent {
  type: 'intent';
  intent: string;
  label: string;
}

export interface SSEChecklistEvent {
  type: 'checklist';
  fields: Record<string, string>;
  intent: string;
}

export interface SSESubmittedEvent {
  type: 'submitted';
  hive_task_id: string;
  message: string;
}

export type SSEEvent =
  | SSEChunkEvent
  | SSEDiscussionTitleEvent
  | SSEIntentEvent
  | SSEChecklistEvent
  | SSESubmittedEvent
  | SSEDoneEvent
  | SSEErrorEvent;

// Attachment types (conversation-scoped files)
export interface AttachmentSummary {
  id: string;
  discussion_id: string;
  filename: string;
  file_content_type: string;
  file_size: number;
  chunk_count: number;
  created_at: string;
  is_image?: boolean;
}

export interface AttachmentChunk {
  id: string;
  content: string;
  chunk_index: number;
  content_type: string;
}

export interface AttachmentDetail {
  id: string;
  discussion_id: string;
  filename: string;
  file_content_type: string;
  file_size: number;
  chunk_count: number;
  created_at: string;
  is_image?: boolean;
  image_data?: string;
  full_text: string;
  chunks: AttachmentChunk[];
}

export interface ApiError {
  detail: string;
}

export interface HealthResponse {
  status: string;
  providers: Record<string, boolean>;
}
