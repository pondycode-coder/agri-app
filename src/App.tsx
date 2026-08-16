import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import { I18nProvider } from "./context/I18nProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import OAuthCallback from "./pages/OAuthCallback";
import Dashboard from "./pages/Dashboard";
import Farms from "./pages/Farms";
import Plots from "./pages/Plots";
import CropCycles from "./pages/CropCycles";
import Inventory from "./pages/Inventory";
import Workers from "./pages/Workers";
import Tasks from "./pages/Tasks";
import Financials from "./pages/Financials";
import Contacts from "./pages/Contacts";
import Investments from "./pages/Investments";
import Profile from "./pages/Profile";
import SaasAdmin from "./pages/SaasAdmin";
import { useAuth } from "./context/AuthProvider";
import { RoleGuard } from "./components/RoleGuard";

// Private route component
const PrivateRoute = ({ children }: { children: React.ReactElement }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            {/* Protected routes */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/dashboard/farms" element={<PrivateRoute><RoleGuard resource="farms"><Farms /></RoleGuard></PrivateRoute>} />
            <Route path="/dashboard/plots" element={<PrivateRoute><RoleGuard resource="plots"><Plots /></RoleGuard></PrivateRoute>} />
            <Route path="/dashboard/crops" element={<PrivateRoute><RoleGuard resource="crops"><CropCycles /></RoleGuard></PrivateRoute>} />
            <Route path="/dashboard/inventory" element={<PrivateRoute><RoleGuard resource="inventory"><Inventory /></RoleGuard></PrivateRoute>} />
            <Route path="/dashboard/workers" element={<PrivateRoute><RoleGuard resource="workers"><Workers /></RoleGuard></PrivateRoute>} />
            <Route path="/dashboard/tasks" element={<PrivateRoute><RoleGuard resource="tasks"><Tasks /></RoleGuard></PrivateRoute>} />
            <Route path="/dashboard/financials" element={<PrivateRoute><RoleGuard resource="financials"><Financials /></RoleGuard></PrivateRoute>} />
            <Route path="/dashboard/contacts" element={<PrivateRoute><RoleGuard resource="contacts"><Contacts /></RoleGuard></PrivateRoute>} />
            <Route path="/dashboard/investments" element={<PrivateRoute><RoleGuard resource="investments"><Investments /></RoleGuard></PrivateRoute>} />
            <Route path="/dashboard/profile" element={<PrivateRoute><RoleGuard resource="profile"><Profile /></RoleGuard></PrivateRoute>} />
            <Route path="/dashboard/saas-admin" element={<PrivateRoute><SaasAdmin /></PrivateRoute>} />
            {/* Home route - redirect to dashboard if authenticated, else to login */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Navigate to="/dashboard" replace />
                </PrivateRoute>
              }
            />
            {/* Catch-all for 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;