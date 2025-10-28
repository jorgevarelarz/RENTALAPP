import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import profilesReducer from './profilesSlice';
import propertiesReducer from './propertiesSlice';
import contractsReducer from './contractsSlice';
import incidentsReducer from './incidentsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    profiles: profilesReducer,
    properties: propertiesReducer,
    contracts: contractsReducer,
    incidents: incidentsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
