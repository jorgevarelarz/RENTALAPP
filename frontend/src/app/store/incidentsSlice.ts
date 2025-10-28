import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type IncidentStatus =
  | 'OPEN'
  | 'QUOTE'
  | 'ESCROW'
  | 'IN_PROGRESS'
  | 'EXTRA_REQUESTED'
  | 'DONE'
  | 'DISPUTE'
  | 'CLOSED';

export interface Incident {
  id: string;
  propertyId: string;
  tenantId: string;
  assignedProfessionalId?: string;
  status: IncidentStatus;
  createdAt: string;
}

export interface IncidentsState {
  items: Incident[];
}

const initialState: IncidentsState = {
  items: [
    { id: 'inc-1', propertyId: 'prop-1', tenantId: 'tenant-1', status: 'ESCROW', createdAt: new Date().toISOString() },
    { id: 'inc-2', propertyId: 'prop-2', tenantId: 'tenant-2', status: 'OPEN', createdAt: new Date().toISOString() },
  ],
};

const incidentsSlice = createSlice({
  name: 'incidents',
  initialState,
  reducers: {
    setIncidents(state, action: PayloadAction<Incident[]>) {
      state.items = action.payload;
    },
    updateIncidentStatus(state, action: PayloadAction<{ id: string; status: IncidentStatus }>) {
      const incident = state.items.find(item => item.id === action.payload.id);
      if (incident) incident.status = action.payload.status;
    },
  },
});

export const { setIncidents, updateIncidentStatus } = incidentsSlice.actions;
export default incidentsSlice.reducer;
