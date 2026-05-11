import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider }  from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GOOGLE_CLIENT_ID }     from './authConfig';

import LoginPage        from './components/shared/LoginPage';
import AppShell         from './components/shared/AppShell';
import UploadPage       from './components/planner/UploadPage';
import EditByMonth      from './components/planner/EditByMonth';
import MyDashboard      from './components/planner/MyDashboard';
import SubmitPage       from './components/planner/SubmitPage';
import ConsolidatedView from './components/manager/ConsolidatedView';
import OverheadAnalysis from './components/manager/OverheadAnalysis';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <span className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full inline-block" />
    </div>
  );
}

function AuthedApp() {
  const { user, role, isLoading } = useAuth();

  if (isLoading) return <Spinner />;
  if (!user)     return <LoginPage />;

  const defaultPath = role === 'Manager' ? '/manager' : '/planner/edit';

  return (
    <AppShell>
      <Routes>
        <Route path="/planner/upload"    element={<UploadPage />} />
        <Route path="/planner/edit"      element={<EditByMonth />} />
        <Route path="/planner/dashboard" element={<MyDashboard />} />
        <Route path="/planner/submit"    element={<SubmitPage />} />
        {(role === 'Manager' || role === 'Exec') && (
          <>
            <Route path="/manager"          element={<ConsolidatedView />} />
            <Route path="/manager/overhead" element={<OverheadAnalysis />} />
          </>
        )}
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        {/* basename syncs React Router with Vite's base (/wfm-cap-plan/ in prod, / in dev) */}
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthedApp />
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
