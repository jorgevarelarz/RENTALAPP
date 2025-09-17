import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import PropertiesList from './pages/properties/PropertiesList';
import PropertyDetail from './pages/properties/PropertyDetail';
import FavoritesPage from './pages/properties/FavoritesPage';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ...otras rutas */}
        <Route path="/properties" element={<PropertiesList />} />
        <Route path="/properties/:id" element={<PropertyDetail />} />
        <Route path="/me/favorites" element={<FavoritesPage />} />
      </Routes>
    </BrowserRouter>
  );
}
