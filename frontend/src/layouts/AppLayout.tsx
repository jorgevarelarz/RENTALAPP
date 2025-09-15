import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NavBar from '../components/NavBar';
import Breadcrumbs from '../components/Breadcrumbs';
import Footer from '../components/Footer';

const AppLayout: React.FC = () => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <header className="app-topbar">
          <div className="container">
            <NavBar />
          </div>
        </header>
        <div className="app-content">
          <div className="container">
            <Breadcrumbs />
            <Outlet />
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default AppLayout;
