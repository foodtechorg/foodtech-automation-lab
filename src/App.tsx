import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Auth from "./pages/Auth";
import SetPassword from "./pages/SetPassword";
import Dashboard from "./pages/Dashboard";
import MyRequests from "./pages/MyRequests";
import NewRequest from "./pages/NewRequest";
import RDBoard from "./pages/RDBoard";
import RDAnalytics from "./pages/RDAnalytics";
import Analytics from "./pages/Analytics";
import RequestDetail from "./pages/RequestDetail";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";
// Purchase module pages
import PurchaseRequests from "./pages/purchase/PurchaseRequests";
import NewPurchaseRequest from "./pages/purchase/NewPurchaseRequest";
import PurchaseRequestDetail from "./pages/purchase/PurchaseRequestDetail";
import PurchaseInvoices from "./pages/purchase/PurchaseInvoices";
import PurchaseInvoiceDetail from "./pages/purchase/PurchaseInvoiceDetail";
import ApprovedRequestsQueue from "./pages/purchase/ApprovedRequestsQueue";
// Development module pages
import DevelopmentBoard from "./pages/development/DevelopmentBoard";
import DevelopmentRequestDetail from "./pages/development/DevelopmentRequestDetail";
import NoAccess from "./pages/development/NoAccess";
// Knowledge Base pages
import KnowledgeBase from "./pages/kb/KnowledgeBase";
import KBDocumentForm from "./pages/kb/KBDocumentForm";
import KBDocumentDetail from "./pages/kb/KBDocumentDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <AdminPanel />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/my"
              element={
                <ProtectedRoute allowedRoles={['sales_manager', 'admin', 'quality_manager']}>
                  <Layout>
                    <MyRequests />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/new"
              element={
                <ProtectedRoute allowedRoles={['sales_manager', 'admin', 'quality_manager']}>
                  <Layout>
                    <NewRequest />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RequestDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rd/board"
              element={
                <ProtectedRoute allowedRoles={['rd_dev', 'rd_manager', 'admin', 'ceo', 'coo', 'quality_manager', 'admin_director', 'financial_analyst']}>
                  <Layout>
                    <RDBoard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rd/analytics"
              element={
                <ProtectedRoute allowedRoles={['rd_dev', 'rd_manager', 'admin', 'ceo', 'coo', 'quality_manager', 'admin_director', 'sales_manager', 'financial_analyst']}>
                  <Layout>
                    <RDAnalytics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute allowedRoles={['rd_manager', 'admin', 'ceo', 'coo', 'quality_manager', 'admin_director']}>
                  <Layout>
                    <Analytics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Purchase module routes */}
            <Route
              path="/purchase/requests"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PurchaseRequests />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase/requests/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewPurchaseRequest />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase/requests/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PurchaseRequestDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase/invoices"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PurchaseInvoices />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase/invoices/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PurchaseInvoiceDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase/queue"
              element={
                <ProtectedRoute allowedRoles={['procurement_manager', 'coo', 'ceo', 'treasurer', 'chief_accountant', 'accountant', 'admin']}>
                  <Layout>
                    <ApprovedRequestsQueue />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Development module routes */}
            <Route
              path="/development"
              element={
                <ProtectedRoute allowedRoles={['admin', 'rd_dev', 'coo', 'ceo', 'quality_manager', 'admin_director']} fallback={<Layout><NoAccess /></Layout>}>
                  <Layout>
                    <DevelopmentBoard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/development/requests/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'rd_dev', 'coo', 'ceo', 'quality_manager', 'admin_director']} fallback={<Layout><NoAccess /></Layout>}>
                  <Layout>
                    <DevelopmentRequestDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Knowledge Base routes */}
            <Route
              path="/kb"
              element={
                <ProtectedRoute allowedRoles={['coo', 'admin']}>
                  <Layout>
                    <KnowledgeBase />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/kb/new"
              element={
                <ProtectedRoute allowedRoles={['coo', 'admin']}>
                  <Layout>
                    <KBDocumentForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/kb/:id"
              element={
                <ProtectedRoute allowedRoles={['coo', 'admin']}>
                  <Layout>
                    <KBDocumentDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/kb/:id/edit"
              element={
                <ProtectedRoute allowedRoles={['coo', 'admin']}>
                  <Layout>
                    <KBDocumentForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
