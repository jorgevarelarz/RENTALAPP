import { Schema, model, Document } from 'mongoose';

export interface IAppointment extends Document {
  serviceOfferId: string;
  ticketId?: string;
  proId: string;
  tenantId: string;
  ownerId: string;
  propertyAddress?: string;
  start: Date;
  end: Date;
  timezone?: string;
  status: 'proposed' | 'accepted' | 'scheduled' | 'confirmed' | 'rescheduled' | 'cancelled' | 'done';
  createdAt?: Date;
  updatedAt?: Date;
}

const AppointmentSchema = new Schema<IAppointment>({
  serviceOfferId: { type: String, index: true, required: true },
  ticketId: { type: String, index: true },
  proId: { type: String, index: true, required: true },
  tenantId: { type: String, index: true, required: true },
  ownerId: { type: String, index: true, required: true },
  propertyAddress: String,
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  timezone: String,
  status: { type: String, default: 'proposed' },
}, { timestamps: true });

AppointmentSchema.index({ proId: 1, tenantId: 1, start: -1 });

export default model<IAppointment>('Appointment', AppointmentSchema);
