import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ContractStatus =
  | 'draft'
  | 'in_review'
  | 'signing'
  | 'signed'
  | 'active'
  | 'completed';

export interface ContractSummary {
  id: string;
  propertyId: string;
  tenantId: string;
  landlordId: string;
  status: ContractStatus;
  lastUpdate: string;
}

export interface ContractsState {
  items: ContractSummary[];
  activeContractId?: string;
}

const initialState: ContractsState = {
  items: [
    { id: 'contract-1', propertyId: 'prop-1', tenantId: 'tenant-1', landlordId: 'landlord-1', status: 'active', lastUpdate: new Date().toISOString() },
    { id: 'contract-2', propertyId: 'prop-2', tenantId: 'tenant-2', landlordId: 'landlord-1', status: 'signing', lastUpdate: new Date().toISOString() },
  ],
};

const contractsSlice = createSlice({
  name: 'contracts',
  initialState,
  reducers: {
    setContracts(state, action: PayloadAction<ContractSummary[]>) {
      state.items = action.payload;
    },
    setActiveContract(state, action: PayloadAction<string | undefined>) {
      state.activeContractId = action.payload;
    },
  },
});

export const { setContracts, setActiveContract } = contractsSlice.actions;
export default contractsSlice.reducer;
