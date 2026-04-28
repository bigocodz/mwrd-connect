import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import AccountStatus from "./pages/AccountStatus";
import Unauthorized from "./pages/Unauthorized";
import GetStarted from "./pages/GetStarted";
import ClientDashboard from "./pages/dashboards/ClientDashboard";
import SupplierDashboard from "./pages/dashboards/SupplierDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminCreateUser from "./pages/admin/AdminCreateUser";
import AdminPendingProducts from "./pages/admin/AdminPendingProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminTemplates from "./pages/admin/AdminTemplates";
import Account from "./pages/Account";
import AdminMarginSettings from "./pages/admin/AdminMarginSettings";
import SupplierProducts from "./pages/supplier/SupplierProducts";
import SupplierProductForm from "./pages/supplier/SupplierProductForm";
import SupplierProductsBulk from "./pages/supplier/SupplierProductsBulk";
import ClientCatalog from "./pages/client/ClientCatalog";
import ClientRfqs from "./pages/client/ClientRfqs";
import ClientCreateRfq from "./pages/client/ClientCreateRfq";
import ClientRfqDetail from "./pages/client/ClientRfqDetail";
import ClientQuoteComparison from "./pages/client/ClientQuoteComparison";
import ClientQuotes from "./pages/client/ClientQuotes";
import ClientOrders from "./pages/client/ClientOrders";
import ClientOrderDetail from "./pages/client/ClientOrderDetail";
import ClientOrganization from "./pages/client/ClientOrganization";
import ClientSchedules from "./pages/client/ClientSchedules";
import ClientInvoices from "./pages/client/ClientInvoices";
import ClientReports from "./pages/client/ClientReports";
import ClientAccount from "./pages/client/ClientAccount";
import AdminRfqs from "./pages/admin/AdminRfqs";
import AdminRfqQuoteComparison from "./pages/admin/AdminRfqQuoteComparison";
import AdminPendingQuotes from "./pages/admin/AdminPendingQuotes";
import AdminQuoteReview from "./pages/admin/AdminQuoteReview";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminCredit from "./pages/admin/AdminCredit";
import AdminPayouts from "./pages/admin/AdminPayouts";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail";
import AdminSupplierInvoices from "./pages/admin/AdminSupplierInvoices";
import AdminClientInvoices from "./pages/admin/AdminClientInvoices";
import AdminContracts from "./pages/admin/AdminContracts";
import AdminContractDetail from "./pages/admin/AdminContractDetail";
import AdminLifecycle from "./pages/admin/AdminLifecycle";
import AdminDisputes from "./pages/admin/AdminDisputes";
import AdminPreferredSuppliers from "./pages/admin/AdminPreferredSuppliers";
import AdminApprovals from "./pages/admin/AdminApprovals";
import SupplierRfqs from "./pages/supplier/SupplierRfqs";
import SupplierRfqRespond from "./pages/supplier/SupplierRfqRespond";
import SupplierOrders from "./pages/supplier/SupplierOrders";
import SupplierOrderDetail from "./pages/supplier/SupplierOrderDetail";
import SupplierInvoices from "./pages/supplier/SupplierInvoices";
import SupplierAnalytics from "./pages/supplier/SupplierAnalytics";
import SupplierKyc from "./pages/supplier/SupplierKyc";
import SupplierPayouts from "./pages/supplier/SupplierPayouts";
import SupplierReviews from "./pages/supplier/SupplierReviews";
import NotFound from "./pages/NotFound";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!);
const queryClient = new QueryClient();

const App = () => (
  <ConvexAuthProvider client={convex}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/landing" element={<Index />} />
                <Route path="/landing/" element={<Index />} />
                <Route path="/get-started" element={<GetStarted />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route path="/account-status" element={<AccountStatus />} />
                <Route path="/account" element={
                  <ProtectedRoute allowedRoles={["CLIENT", "SUPPLIER", "ADMIN"]}><Account /></ProtectedRoute>
                } />
                <Route path="/unauthorized" element={<Unauthorized />} />
                {/* Client */}
                <Route path="/client/dashboard" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientDashboard /></ProtectedRoute>
                } />
                <Route path="/client/catalog" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientCatalog /></ProtectedRoute>
                } />
                <Route path="/client/rfqs" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientRfqs /></ProtectedRoute>
                } />
                <Route path="/client/rfq/new" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientCreateRfq /></ProtectedRoute>
                } />
                <Route path="/client/rfqs/:rfqId" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientRfqDetail /></ProtectedRoute>
                } />
                <Route path="/client/rfqs/:rfqId/compare" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientQuoteComparison /></ProtectedRoute>
                } />
                <Route path="/client/quotes" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientQuotes /></ProtectedRoute>
                } />
                <Route path="/client/orders" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientOrders /></ProtectedRoute>
                } />
                <Route path="/client/orders/:orderId" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientOrderDetail /></ProtectedRoute>
                } />
                <Route path="/client/organization" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientOrganization /></ProtectedRoute>
                } />
                <Route path="/client/schedules" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientSchedules /></ProtectedRoute>
                } />
                <Route path="/client/invoices" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientInvoices /></ProtectedRoute>
                } />
                <Route path="/client/reports" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientReports /></ProtectedRoute>
                } />
                <Route path="/client/account" element={
                  <ProtectedRoute allowedRoles={["CLIENT"]}><ClientAccount /></ProtectedRoute>
                } />
                {/* Supplier */}
                <Route path="/supplier/dashboard" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierDashboard /></ProtectedRoute>
                } />
                <Route path="/supplier/products" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierProducts /></ProtectedRoute>
                } />
                <Route path="/supplier/products/add" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierProductForm /></ProtectedRoute>
                } />
                <Route path="/supplier/products/bulk" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierProductsBulk /></ProtectedRoute>
                } />
                <Route path="/supplier/products/:productId" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierProductForm /></ProtectedRoute>
                } />
                <Route path="/supplier/rfqs" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierRfqs /></ProtectedRoute>
                } />
                <Route path="/supplier/rfqs/:rfqId/respond" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierRfqRespond /></ProtectedRoute>
                } />
                <Route path="/supplier/orders" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierOrders /></ProtectedRoute>
                } />
                <Route path="/supplier/orders/:orderId" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierOrderDetail /></ProtectedRoute>
                } />
                <Route path="/supplier/invoices" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierInvoices /></ProtectedRoute>
                } />
                <Route path="/supplier/analytics" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierAnalytics /></ProtectedRoute>
                } />
                <Route path="/supplier/kyc" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierKyc /></ProtectedRoute>
                } />
                <Route path="/supplier/payouts" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierPayouts /></ProtectedRoute>
                } />
                <Route path="/supplier/reviews" element={
                  <ProtectedRoute allowedRoles={["SUPPLIER"]}><SupplierReviews /></ProtectedRoute>
                } />
                {/* Admin */}
                <Route path="/admin/dashboard" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>
                } />
                <Route path="/admin/users" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminUsers /></ProtectedRoute>
                } />
                <Route path="/admin/users/create" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminCreateUser /></ProtectedRoute>
                } />
                <Route path="/admin/users/:userId" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminUserDetail /></ProtectedRoute>
                } />
                <Route path="/admin/products/pending" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminPendingProducts /></ProtectedRoute>
                } />
                <Route path="/admin/categories" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminCategories /></ProtectedRoute>
                } />
                <Route path="/admin/templates" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminTemplates /></ProtectedRoute>
                } />
                <Route path="/admin/margin-settings" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminMarginSettings /></ProtectedRoute>
                } />
                <Route path="/admin/rfqs" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminRfqs /></ProtectedRoute>
                } />
                <Route path="/admin/rfqs/:rfqId/quotes" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminRfqQuoteComparison /></ProtectedRoute>
                } />
                <Route path="/admin/quotes/pending" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminPendingQuotes /></ProtectedRoute>
                } />
                <Route path="/admin/quotes/:quoteId/review" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminQuoteReview /></ProtectedRoute>
                } />
                <Route path="/admin/payments" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminPayments /></ProtectedRoute>
                } />
                <Route path="/admin/credit" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminCredit /></ProtectedRoute>
                } />
                <Route path="/admin/payouts" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminPayouts /></ProtectedRoute>
                } />
                <Route path="/admin/reviews" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminReviews /></ProtectedRoute>
                } />
                <Route path="/admin/audit-log" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminAuditLog /></ProtectedRoute>
                } />
                <Route path="/admin/leads" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminLeads /></ProtectedRoute>
                } />
                <Route path="/admin/orders" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminOrders /></ProtectedRoute>
                } />
                <Route path="/admin/orders/:orderId" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminOrderDetail /></ProtectedRoute>
                } />
                <Route path="/admin/supplier-invoices" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminSupplierInvoices /></ProtectedRoute>
                } />
                <Route path="/admin/client-invoices" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminClientInvoices /></ProtectedRoute>
                } />
                <Route path="/admin/contracts" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminContracts /></ProtectedRoute>
                } />
                <Route path="/admin/contracts/:contractId" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminContractDetail /></ProtectedRoute>
                } />
                <Route path="/admin/lifecycle" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminLifecycle /></ProtectedRoute>
                } />
                <Route path="/admin/disputes" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminDisputes /></ProtectedRoute>
                } />
                <Route path="/admin/preferred-suppliers" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminPreferredSuppliers /></ProtectedRoute>
                } />
                <Route path="/admin/approvals" element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}><AdminApprovals /></ProtectedRoute>
                } />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ConvexAuthProvider>
);

export default App;
