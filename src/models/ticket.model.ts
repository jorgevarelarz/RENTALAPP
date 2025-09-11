import { Schema, model, Document } from 'mongoose';
export interface ITicket extends Document {
  contractId: string;
  propertyId?: string;
  openedBy: string;  // tenant
  ownerId: string;   // landlord
  proId?: string;    // assigned pro
  service: string;
  title: string;
  description: string;
  status: 'open'|'quoted'|'in_progress'|'awaiting_schedule'|'scheduled'|'awaiting_validation'|'closed'|'disputed';
  quote?: { amount: number; currency: 'EUR'; proId: string; ts: Date };
  extra?: { amount: number; reason: string; status: 'pending'|'approved'|'rejected' };
  invoiceUrl?: string;
  history: { ts: Date; actor: string; action: string; payload?: any }[];
  escrowId?: string;
}
const s = new Schema<ITicket>({
  contractId: { type: String, required: true },
  propertyId: String,
  openedBy: { type: String, required: true },
  ownerId: { type: String, required: true },
  proId: String,
  service: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, default: 'open' },
  quote: { amount: Number, currency: String, proId: String, ts: Date },
  extra: { amount: Number, reason: String, status: String },
  invoiceUrl: String,
  history: [{ ts: Date, actor: String, action: String, payload: Schema.Types.Mixed }],
  escrowId: String
},{timestamps:true});
export default model<ITicket>('Ticket', s);
