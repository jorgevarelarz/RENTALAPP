import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProcessedEvent extends Document {
  eventId: string;
  createdAt: Date;
}

const ProcessedEventSchema = new Schema<IProcessedEvent>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ProcessedEvent: Model<IProcessedEvent> =
  mongoose.models.ProcessedEvent || mongoose.model<IProcessedEvent>('ProcessedEvent', ProcessedEventSchema);

export default ProcessedEvent;

