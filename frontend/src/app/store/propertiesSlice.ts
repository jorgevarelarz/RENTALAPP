import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Property {
  id: string;
  title: string;
  city: string;
  price: number;
  onlyPRO?: boolean;
  onlyPROMinLevel?: 'PRO_800' | 'PRO_1200' | 'PRO_1600';
}

export interface PropertiesState {
  items: Property[];
  filters: {
    search?: string;
    onlyPRO?: boolean;
  };
}

const initialState: PropertiesState = {
  items: [
    { id: 'prop-1', title: 'Ático moderno en Chamberí', city: 'Madrid', price: 1450, onlyPRO: true, onlyPROMinLevel: 'PRO_1200' },
    { id: 'prop-2', title: 'Piso familiar en Gràcia', city: 'Barcelona', price: 1250 },
    { id: 'prop-3', title: 'Loft creativo en Ruzafa', city: 'Valencia', price: 890, onlyPRO: true, onlyPROMinLevel: 'PRO_800' },
  ],
  filters: {},
};

const propertiesSlice = createSlice({
  name: 'properties',
  initialState,
  reducers: {
    setProperties(state, action: PayloadAction<Property[]>) {
      state.items = action.payload;
    },
    updateFilters(state, action: PayloadAction<PropertiesState['filters']>) {
      state.filters = { ...state.filters, ...action.payload };
    },
  },
});

export const { setProperties, updateFilters } = propertiesSlice.actions;
export default propertiesSlice.reducer;
