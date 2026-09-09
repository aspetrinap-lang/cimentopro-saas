import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ConfigProvider } from '@/lib/ConfigContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import OperatorPanel from '@/pages/OperatorPanel';
import History from '@/pages/History';
import Analysis from '@/pages/Analysis';
import StatisticalAnalysis from '@/pages/StatisticalAnalysis';
import CostAnalysis from '@/pages/CostAnalysis';
import PricingSimulator from '@/pages/PricingSimulator';
import Cadastro from '@/pages/Cadastro';
import Configuracoes from '@/pages/Configuracoes';
import MachineDashboard from '@/pages/MachineDashboard';
import ExecutiveSummaryPage from '@/pages/ExecutiveSummaryPage';
import VirtualEngineerPage from '@/pages/VirtualEngineerPage';
import Molds from '@/pages/Molds';
import ProductionLines from '@/pages/ProductionLines';
import Maintenance from '@/pages/Maintenance';
import Backup from '@/pages/Backup';
import Quality from '@/pages/Quality';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import PinLogin from '@/pages/PinLogin';
import { OperatorProvider } from '@/lib/OperatorContext';
import { CompanyProvider } from '@/lib/CompanyContext';
import { ThemeProvider } from 'next-themes';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      );
    }
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/operator-panel" element={<OperatorPanel />} />
        <Route path="/history" element={<History />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/stats" element={<StatisticalAnalysis />} />
        <Route path="/costs" element={<CostAnalysis />} />
        <Route path="/pricing" element={<PricingSimulator />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/executive-summary" element={<ExecutiveSummaryPage />} />
        <Route path="/virtual-engineer" element={<VirtualEngineerPage />} />
        <Route path="/machines" element={<MachineDashboard />} />
        <Route path="/lines" element={<ProductionLines />} />
        <Route path="/molds" element={<Molds />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/quality" element={<Quality />} />
        <Route path="/backup" element={<Backup />} />
      </Route>
      <Route path="/pin-login" element={<PinLogin />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <AuthProvider>
      <CompanyProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ConfigProvider>
          <OperatorProvider>
            <Router>
              <AuthenticatedApp />
            </Router>
            <Toaster />
          </OperatorProvider>
        </ConfigProvider>
      </QueryClientProvider>
      </CompanyProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;