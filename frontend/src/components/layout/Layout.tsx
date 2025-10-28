import React from 'react';
import Sidebar from './Sidebar';
import NavBar from './NavBar';
import Breadcrumbs from '../ui/Breadcrumbs';
import Footer from './Footer';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div>
      <div className="navbar">
        <div className="container">
          <NavBar />
        </div>
      </div>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 16 }}>
          <div className="container">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
