export interface Message {
  id: string;
  senderId: string;
  content: string | null;
  type: "text" | "image" | "video" | "file";
  mediaKey?: string | null;
  createdAt: string;
  deliveredAt?: string | null;
}
