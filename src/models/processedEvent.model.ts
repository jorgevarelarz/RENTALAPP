import { Schema, model, Model, Document, Types, models } from 'mongoose';

export interface IProcessedEvent extends Document {
  provider: string;
  eventId: string;
  contractId: Types.ObjectId;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const processedEventSchema = new Schema<IProcessedEvent>(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

processedEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const ProcessedEvent: Model<IProcessedEvent> =
  models.ProcessedEvent || model<IProcessedEvent>('ProcessedEvent', processedEventSchema);

export default ProcessedEvent;
