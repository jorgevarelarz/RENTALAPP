import React from 'react';
import Sidebar from './Sidebar';
import NavBar from './NavBar';
import Breadcrumbs from './Breadcrumbs';
import Footer from './Footer';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card)' }}>
        <NavBar />
      </div>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 16 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
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
