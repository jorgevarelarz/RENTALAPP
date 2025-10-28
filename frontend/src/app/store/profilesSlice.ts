import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface KycState {
  status: VerificationStatus;
  updatedAt?: string;
}

export interface ProBadge {
  level: 'PRO_800' | 'PRO_1200' | 'PRO_1600' | 'NONE';
  maxRent: number;
}

export interface ProfilesState {
  kyc: KycState;
  pro: ProBadge;
}

const initialState: ProfilesState = {
  kyc: { status: 'pending' },
  pro: { level: 'NONE', maxRent: 0 },
};

const profilesSlice = createSlice({
  name: 'profiles',
  initialState,
  reducers: {
    updateKyc(state, action: PayloadAction<KycState>) {
      state.kyc = action.payload;
    },
    updatePro(state, action: PayloadAction<ProBadge>) {
      state.pro = action.payload;
    },
  },
});

export const { updateKyc, updatePro } = profilesSlice.actions;
export default profilesSlice.reducer;
