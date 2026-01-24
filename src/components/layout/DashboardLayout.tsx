'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    avatar: string | null;
    roles: string[];
  };
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className={styles.layout}>
      <Sidebar 
        user={user} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      <Header 
        user={user} 
        isDashboard={true}
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
