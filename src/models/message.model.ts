import { Schema, model, Document } from 'mongoose';

export interface IMessage extends Document {
  conversationId: string;
  senderId: string;
  type: 'user' | 'system';
  body?: string;
  attachmentUrl?: string;
  systemCode?: string;
  payload?: any;
  readBy: string[];
  createdAt?: Date;
}

const MessageSchema = new Schema<IMessage>({
  conversationId: { type: String, index: true, required: true },
  senderId: { type: String, required: true },
  type: { type: String, enum: ['user', 'system'], default: 'user' },
  body: { type: String, maxlength: 2000 },
  attachmentUrl: String,
  systemCode: String,
  payload: Schema.Types.Mixed,
  readBy: { type: [String], default: [] },
}, { timestamps: { createdAt: true, updatedAt: false } });

MessageSchema.index({ conversationId: 1, createdAt: -1 });

export default model<IMessage>('Message', MessageSchema);
