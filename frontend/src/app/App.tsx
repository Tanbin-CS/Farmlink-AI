import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { SandboxProvider } from '@/state/SandboxProvider';
import { PreferencesProvider } from '@/state/PreferencesProvider';
import { TooltipProvider } from '@/components/Term';
import { PageTransition } from '@/components/motion';
import { AppShell } from './AppShell';
import { SmoothScroll } from './SmoothScroll';
import { CommandPalette } from './CommandPalette';
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

export function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname === '/' ? 'landing' : 'app'}>
        <Route
          path="/"
          element={
            <PageTransition id="landing">
              <Landing />
            </PageTransition>
          }
        />
        <Route element={<AppShell />}>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/workspace" element={<Overview />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/cashflow" element={<CashflowPage />} />
          <Route path="/financing" element={<FinancingPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/copilot" element={null} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export function App({ client }: { client?: SandboxClient }) {
  return (
    <MotionConfig reducedMotion="user">
      <PreferencesProvider>
        <SandboxProvider initialClient={client}>
          <TooltipProvider delayDuration={150}>
            <SmoothScroll>
              <HashRouter>
                <AppRoutes />
                <CommandPalette />
              </HashRouter>
            </SmoothScroll>
          </TooltipProvider>
          <Toaster richColors position="top-center" offset={64} mobileOffset={64} closeButton />
        </SandboxProvider>
      </PreferencesProvider>
    </MotionConfig>
  );
}
