import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SandboxProvider } from '@/state/SandboxProvider';
import { PreferencesProvider } from '@/state/PreferencesProvider';
import { AppShell } from './AppShell';
import { Landing } from '@/features/landing/Landing';
import { SetupPage } from '@/features/setup/SetupPage';
import { Overview } from '@/features/overview/Overview';
import { RecordsPage } from '@/features/records/RecordsPage';
import { CashflowPage } from '@/features/cashflow/CashflowPage';
import { FinancingPage } from '@/features/financing/FinancingPage';
import { ApplicationsPage } from '@/features/applications/ApplicationsPage';
import { ActivityPage } from '@/features/activity/ActivityPage';
import { AboutPage } from '@/features/about/AboutPage';
import type { SandboxClient } from '@/services/types';

const shell = (el: React.ReactNode) => <AppShell>{el}</AppShell>;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/setup" element={shell(<SetupPage />)} />
      <Route path="/workspace" element={shell(<Overview />)} />
      <Route path="/records" element={shell(<RecordsPage />)} />
      <Route path="/cashflow" element={shell(<CashflowPage />)} />
      <Route path="/financing" element={shell(<FinancingPage />)} />
      <Route path="/applications" element={shell(<ApplicationsPage />)} />
      <Route path="/activity" element={shell(<ActivityPage />)} />
      <Route path="/about" element={shell(<AboutPage />)} />
      <Route path="/copilot" element={shell(null)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App({ client }: { client?: SandboxClient }) {
  return (
    <PreferencesProvider>
      <SandboxProvider initialClient={client}>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
        <Toaster richColors position="top-center" offset={64} mobileOffset={64} closeButton />
      </SandboxProvider>
    </PreferencesProvider>
  );
}
