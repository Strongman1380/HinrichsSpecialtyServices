import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, ADMIN_EMAIL, ADMIN_UID } from "./firebase-auth";
import Layout from "./components/Layout";
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SurveysPage = lazy(() => import("./pages/SurveysPage"));
const SurveyPublicPage = lazy(() => import("./pages/SurveyPublicPage"));
const CRMPage = lazy(() => import("./pages/CRMPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const EmailPage = lazy(() => import("./pages/EmailPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
import LoginPage from "./pages/LoginPage";
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));

const ClientWorkspace = lazy(() => import("./pages/ClientWorkspace"));


export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Check if user is logged in AND has the allowed email
      if (user && user.email === ADMIN_EMAIL && user.uid === ADMIN_UID && user.emailVerified) {
        setUser(user);
      } else {
        if (user) {
          // If logged in with wrong email, sign them out
          signOut(auth).catch(() => {});
        }
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Suspense fallback={<p role="status" className="p-8">Loading workspace…</p>}><Routes>
        {/* Public survey link — no nav chrome */}
        <Route path="/s/:surveyId" element={<SurveyPublicPage />} />

        {/* Login Page */}
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />

        {/* Protected Admin app — wrapped in sidebar layout */}
        <Route element={user ? <Layout user={user} /> : <Navigate to="/login" replace />}>
          <Route index element={<DashboardPage />} />
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/surveys" element={<SurveysPage />} />
          <Route path="/crm" element={<CRMPage />} />
          <Route path="/clients/:contactId" element={<ClientWorkspace />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/email" element={<EmailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<p className="p-8">Page not found. <a href="/crm/">Return to dashboard</a></p>} />
      </Routes></Suspense>
    </BrowserRouter>
  );
}
