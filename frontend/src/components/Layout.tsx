import React from 'react';
import Sidebar from './Sidebar';
import NavBar from './NavBar';
import Breadcrumbs from './Breadcrumbs';
import Footer from './Footer';
import styles from './Layout.module.css';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div>
      <div className={styles.navbar}>
        <div className={styles.container}>
          <NavBar />
        </div>
      </div>
      <div className={styles.layoutBody}>
        <Sidebar />
        <main className={styles.main}>
          <div className={styles.container}>
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
