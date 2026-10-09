import type { Metadata } from 'next';
import { Suspense } from 'react';
import '../styles.css';
import '../styles-md.css';
import '../styles-xl.css';
import { AppNavbar } from '../components/AppNavbar';
import { DashboardContent } from './DashboardContent';

export const metadata: Metadata = {
  title: 'Dashboard | Cercador de pisos turístics Barcelona',
  description: 'Les finques amb més places d\'habitatges d\'ús turístic de Barcelona i la distribució per carrer.',
};

export default function DashboardPage() {
  return (
    <main className="app-wrapper" style={{ minHeight: '100vh' }}>
      <AppNavbar />
      <Suspense fallback={null}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
