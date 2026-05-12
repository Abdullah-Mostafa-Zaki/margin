export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachment?: {
    type: 'audio' | 'image'
    previewUrl?: string
  }
}
