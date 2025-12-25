
export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  isError?: boolean;
}

export interface UploadedFile {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  createdAt: number;
  files: UploadedFile[];
}

export interface UsageStats {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  streamingText: string;
  totalInputTokens: number;
  totalOutputTokens: number;
}
