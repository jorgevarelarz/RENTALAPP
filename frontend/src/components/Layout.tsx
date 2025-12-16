import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import NavBar from './NavBar';
import Breadcrumbs from './Breadcrumbs';
import Footer from './Footer';
import PolicyModal from './PolicyModal';
import { usePolicyAcceptance } from '../hooks/usePolicyAcceptance';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasAccepted } = usePolicyAcceptance();
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
    // Show policy modal on first visit if not accepted
    if (!hasAccepted) {
      setShowPolicy(true);
    }
  }, [hasAccepted]);

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
      
      <PolicyModal 
        isOpen={showPolicy} 
        onClose={() => setShowPolicy(false)} 
      />
    </div>
  );
};

export default Layout;
