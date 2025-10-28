import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type UserRole = 'TENANT' | 'LANDLORD' | 'PROFESSIONAL' | 'AGENCY' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  status: 'idle' | 'loading' | 'authenticated';
}

const initialState: AuthState = {
  user: null,
  token: null,
  status: 'idle',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signInSuccess(state, action: PayloadAction<{ user: AuthUser; token: string }>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.status = 'authenticated';
    },
    signOut(state) {
      state.user = null;
      state.token = null;
      state.status = 'idle';
    },
    setActiveRole(state, action: PayloadAction<UserRole>) {
      if (state.user && state.user.roles.includes(action.payload)) {
        state.user = { ...state.user, activeRole: action.payload };
      }
    },
  },
});

export const { signInSuccess, signOut, setActiveRole } = authSlice.actions;
export default authSlice.reducer;
