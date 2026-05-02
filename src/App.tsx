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
import { ErrorBoundary } from "./components/ErrorBoundary";
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
import AdminMasterCatalog from "./pages/admin/AdminMasterCatalog";
import AdminProductRequests from "./pages/admin/AdminProductRequests";
import AdminTemplates from "./pages/admin/AdminTemplates";
import Account from "./pages/Account";
import AdminMarginSettings from "./pages/admin/AdminMarginSettings";
import SupplierProducts from "./pages/supplier/SupplierProducts";
import SupplierProductForm from "./pages/supplier/SupplierProductForm";
import SupplierProductsBulk from "./pages/supplier/SupplierProductsBulk";
import SupplierCatalogBrowse from "./pages/supplier/SupplierCatalogBrowse";
import SupplierOfferForm from "./pages/supplier/SupplierOfferForm";
import SupplierProductRequest from "./pages/supplier/SupplierProductRequest";
import SupplierAutoQuoteQueue from "./pages/supplier/SupplierAutoQuoteQueue";
import ClientCatalog from "./pages/client/ClientCatalog";
import ClientCart from "./pages/client/ClientCart";
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

/**
 * Wraps each protected page in an ErrorBoundary so a single query failure
 * doesn't white-screen the entire app.
 */
const SafeRoute = ({ children, roles }: { children: React.ReactNode; roles: ("CLIENT" | "SUPPLIER" | "ADMIN")[] }) => (
  <ProtectedRoute allowedRoles={roles}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </ProtectedRoute>
);

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
                  <SafeRoute roles={["CLIENT", "SUPPLIER", "ADMIN"]}><Account /></SafeRoute>
                } />
                <Route path="/unauthorized" element={<Unauthorized />} />
                {/* Client */}
                <Route path="/client/dashboard" element={
                  <SafeRoute roles={["CLIENT"]}><ClientDashboard /></SafeRoute>
                } />
                <Route path="/client/catalog" element={
                  <SafeRoute roles={["CLIENT"]}><ClientCatalog /></SafeRoute>
                } />
                <Route path="/client/cart" element={
                  <SafeRoute roles={["CLIENT"]}><ClientCart /></SafeRoute>
                } />
                <Route path="/client/rfqs" element={
                  <SafeRoute roles={["CLIENT"]}><ClientRfqs /></SafeRoute>
                } />
                <Route path="/client/rfq/new" element={
                  <SafeRoute roles={["CLIENT"]}><ClientCreateRfq /></SafeRoute>
                } />
                <Route path="/client/rfqs/:rfqId" element={
                  <SafeRoute roles={["CLIENT"]}><ClientRfqDetail /></SafeRoute>
                } />
                <Route path="/client/rfqs/:rfqId/compare" element={
                  <SafeRoute roles={["CLIENT"]}><ClientQuoteComparison /></SafeRoute>
                } />
                <Route path="/client/quotes" element={
                  <SafeRoute roles={["CLIENT"]}><ClientQuotes /></SafeRoute>
                } />
                <Route path="/client/orders" element={
                  <SafeRoute roles={["CLIENT"]}><ClientOrders /></SafeRoute>
                } />
                <Route path="/client/orders/:orderId" element={
                  <SafeRoute roles={["CLIENT"]}><ClientOrderDetail /></SafeRoute>
                } />
                <Route path="/client/organization" element={
                  <SafeRoute roles={["CLIENT"]}><ClientOrganization /></SafeRoute>
                } />
                <Route path="/client/schedules" element={
                  <SafeRoute roles={["CLIENT"]}><ClientSchedules /></SafeRoute>
                } />
                <Route path="/client/invoices" element={
                  <SafeRoute roles={["CLIENT"]}><ClientInvoices /></SafeRoute>
                } />
                <Route path="/client/reports" element={
                  <SafeRoute roles={["CLIENT"]}><ClientReports /></SafeRoute>
                } />
                <Route path="/client/account" element={
                  <SafeRoute roles={["CLIENT"]}><ClientAccount /></SafeRoute>
                } />
                {/* Supplier */}
                <Route path="/supplier/dashboard" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierDashboard /></SafeRoute>
                } />
                <Route path="/supplier/products" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierProducts /></SafeRoute>
                } />
                <Route path="/supplier/products/add" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierProductForm /></SafeRoute>
                } />
                <Route path="/supplier/products/bulk" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierProductsBulk /></SafeRoute>
                } />
                <Route path="/supplier/products/:productId" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierProductForm /></SafeRoute>
                } />
                <Route path="/supplier/catalog" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierCatalogBrowse /></SafeRoute>
                } />
                <Route path="/supplier/offers/new" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierOfferForm /></SafeRoute>
                } />
                <Route path="/supplier/offers/:offerId" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierOfferForm /></SafeRoute>
                } />
                <Route path="/supplier/product-requests/new" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierProductRequest /></SafeRoute>
                } />
                <Route path="/supplier/auto-quotes" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierAutoQuoteQueue /></SafeRoute>
                } />
                <Route path="/supplier/rfqs" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierRfqs /></SafeRoute>
                } />
                <Route path="/supplier/rfqs/:rfqId/respond" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierRfqRespond /></SafeRoute>
                } />
                <Route path="/supplier/orders" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierOrders /></SafeRoute>
                } />
                <Route path="/supplier/orders/:orderId" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierOrderDetail /></SafeRoute>
                } />
                <Route path="/supplier/invoices" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierInvoices /></SafeRoute>
                } />
                <Route path="/supplier/analytics" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierAnalytics /></SafeRoute>
                } />
                <Route path="/supplier/kyc" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierKyc /></SafeRoute>
                } />
                <Route path="/supplier/payouts" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierPayouts /></SafeRoute>
                } />
                <Route path="/supplier/reviews" element={
                  <SafeRoute roles={["SUPPLIER"]}><SupplierReviews /></SafeRoute>
                } />
                {/* Admin */}
                <Route path="/admin/dashboard" element={
                  <SafeRoute roles={["ADMIN"]}><AdminDashboard /></SafeRoute>
                } />
                <Route path="/admin/users" element={
                  <SafeRoute roles={["ADMIN"]}><AdminUsers /></SafeRoute>
                } />
                <Route path="/admin/users/create" element={
                  <SafeRoute roles={["ADMIN"]}><AdminCreateUser /></SafeRoute>
                } />
                <Route path="/admin/users/:userId" element={
                  <SafeRoute roles={["ADMIN"]}><AdminUserDetail /></SafeRoute>
                } />
                <Route path="/admin/products/pending" element={
                  <SafeRoute roles={["ADMIN"]}><AdminPendingProducts /></SafeRoute>
                } />
                <Route path="/admin/master-catalog" element={
                  <SafeRoute roles={["ADMIN"]}><AdminMasterCatalog /></SafeRoute>
                } />
                <Route path="/admin/product-requests" element={
                  <SafeRoute roles={["ADMIN"]}><AdminProductRequests /></SafeRoute>
                } />
                <Route path="/admin/categories" element={
                  <SafeRoute roles={["ADMIN"]}><AdminCategories /></SafeRoute>
                } />
                <Route path="/admin/templates" element={
                  <SafeRoute roles={["ADMIN"]}><AdminTemplates /></SafeRoute>
                } />
                <Route path="/admin/margin-settings" element={
                  <SafeRoute roles={["ADMIN"]}><AdminMarginSettings /></SafeRoute>
                } />
                <Route path="/admin/rfqs" element={
                  <SafeRoute roles={["ADMIN"]}><AdminRfqs /></SafeRoute>
                } />
                <Route path="/admin/rfqs/:rfqId/quotes" element={
                  <SafeRoute roles={["ADMIN"]}><AdminRfqQuoteComparison /></SafeRoute>
                } />
                <Route path="/admin/quotes/pending" element={
                  <SafeRoute roles={["ADMIN"]}><AdminPendingQuotes /></SafeRoute>
                } />
                <Route path="/admin/quotes/:quoteId/review" element={
                  <SafeRoute roles={["ADMIN"]}><AdminQuoteReview /></SafeRoute>
                } />
                <Route path="/admin/payments" element={
                  <SafeRoute roles={["ADMIN"]}><AdminPayments /></SafeRoute>
                } />
                <Route path="/admin/credit" element={
                  <SafeRoute roles={["ADMIN"]}><AdminCredit /></SafeRoute>
                } />
                <Route path="/admin/payouts" element={
                  <SafeRoute roles={["ADMIN"]}><AdminPayouts /></SafeRoute>
                } />
                <Route path="/admin/reviews" element={
                  <SafeRoute roles={["ADMIN"]}><AdminReviews /></SafeRoute>
                } />
                <Route path="/admin/audit-log" element={
                  <SafeRoute roles={["ADMIN"]}><AdminAuditLog /></SafeRoute>
                } />
                <Route path="/admin/leads" element={
                  <SafeRoute roles={["ADMIN"]}><AdminLeads /></SafeRoute>
                } />
                <Route path="/admin/orders" element={
                  <SafeRoute roles={["ADMIN"]}><AdminOrders /></SafeRoute>
                } />
                <Route path="/admin/orders/:orderId" element={
                  <SafeRoute roles={["ADMIN"]}><AdminOrderDetail /></SafeRoute>
                } />
                <Route path="/admin/supplier-invoices" element={
                  <SafeRoute roles={["ADMIN"]}><AdminSupplierInvoices /></SafeRoute>
                } />
                <Route path="/admin/client-invoices" element={
                  <SafeRoute roles={["ADMIN"]}><AdminClientInvoices /></SafeRoute>
                } />
                <Route path="/admin/contracts" element={
                  <SafeRoute roles={["ADMIN"]}><AdminContracts /></SafeRoute>
                } />
                <Route path="/admin/contracts/:contractId" element={
                  <SafeRoute roles={["ADMIN"]}><AdminContractDetail /></SafeRoute>
                } />
                <Route path="/admin/lifecycle" element={
                  <SafeRoute roles={["ADMIN"]}><AdminLifecycle /></SafeRoute>
                } />
                <Route path="/admin/disputes" element={
                  <SafeRoute roles={["ADMIN"]}><AdminDisputes /></SafeRoute>
                } />
                <Route path="/admin/preferred-suppliers" element={
                  <SafeRoute roles={["ADMIN"]}><AdminPreferredSuppliers /></SafeRoute>
                } />
                <Route path="/admin/approvals" element={
                  <SafeRoute roles={["ADMIN"]}><AdminApprovals /></SafeRoute>
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
