import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";

import AdminApprovals from "@/pages/admin/AdminApprovals";
import AdminAuditLog from "@/pages/admin/AdminAuditLog";
import AdminBundles from "@/pages/admin/AdminBundles";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminClientInvoices from "@/pages/admin/AdminClientInvoices";
import AdminContracts from "@/pages/admin/AdminContracts";
import AdminContractDetail from "@/pages/admin/AdminContractDetail";
import AdminCredit from "@/pages/admin/AdminCredit";
import AdminDeliveryNotes from "@/pages/admin/AdminDeliveryNotes";
import AdminDisputes from "@/pages/admin/AdminDisputes";
import AdminLeads from "@/pages/admin/AdminLeads";
import AdminLifecycle from "@/pages/admin/AdminLifecycle";
import AdminMarginSettings from "@/pages/admin/AdminMarginSettings";
import AdminMasterCatalog from "@/pages/admin/AdminMasterCatalog";
import AdminOrderDetail from "@/pages/admin/AdminOrderDetail";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminPayouts from "@/pages/admin/AdminPayouts";
import AdminPayments from "@/pages/admin/AdminPayments";
import AdminPendingProducts from "@/pages/admin/AdminPendingProducts";
import AdminPendingQuotes from "@/pages/admin/AdminPendingQuotes";
import AdminPreferredSuppliers from "@/pages/admin/AdminPreferredSuppliers";
import AdminProductRequests from "@/pages/admin/AdminProductRequests";
import AdminQuoteReview from "@/pages/admin/AdminQuoteReview";
import AdminReviews from "@/pages/admin/AdminReviews";
import AdminRfqQuoteComparison from "@/pages/admin/AdminRfqQuoteComparison";
import AdminRfqs from "@/pages/admin/AdminRfqs";
import AdminSupplierInvoices from "@/pages/admin/AdminSupplierInvoices";
import AdminTemplates from "@/pages/admin/AdminTemplates";
import AdminUserDetail from "@/pages/admin/AdminUserDetail";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminDashboard from "@/pages/dashboards/AdminDashboard";
import ClientAccount from "@/pages/client/ClientAccount";
import ClientCart from "@/pages/client/ClientCart";
import ClientCatalog from "@/pages/client/ClientCatalog";
import ClientCreateRfq from "@/pages/client/ClientCreateRfq";
import ClientDashboard from "@/pages/dashboards/ClientDashboard";
import ClientInvoices from "@/pages/client/ClientInvoices";
import ClientOrderDetail from "@/pages/client/ClientOrderDetail";
import ClientOrders from "@/pages/client/ClientOrders";
import ClientOrganization from "@/pages/client/ClientOrganization";
import ClientQuoteComparison from "@/pages/client/ClientQuoteComparison";
import ClientQuotes from "@/pages/client/ClientQuotes";
import ClientReports from "@/pages/client/ClientReports";
import ClientRfqDetail from "@/pages/client/ClientRfqDetail";
import ClientRfqs from "@/pages/client/ClientRfqs";
import ClientSchedules from "@/pages/client/ClientSchedules";
import SupplierAutoQuoteQueue from "@/pages/supplier/SupplierAutoQuoteQueue";
import SupplierAnalytics from "@/pages/supplier/SupplierAnalytics";
import SupplierCatalogBrowse from "@/pages/supplier/SupplierCatalogBrowse";
import SupplierDeliveryNoteForm from "@/pages/supplier/SupplierDeliveryNoteForm";
import SupplierDeliveryNotes from "@/pages/supplier/SupplierDeliveryNotes";
import SupplierDashboard from "@/pages/dashboards/SupplierDashboard";
import SupplierInvoices from "@/pages/supplier/SupplierInvoices";
import SupplierKyc from "@/pages/supplier/SupplierKyc";
import SupplierOfferForm from "@/pages/supplier/SupplierOfferForm";
import SupplierOrderDetail from "@/pages/supplier/SupplierOrderDetail";
import SupplierOrders from "@/pages/supplier/SupplierOrders";
import SupplierPayouts from "@/pages/supplier/SupplierPayouts";
import SupplierProductRequest from "@/pages/supplier/SupplierProductRequest";
import SupplierProductForm from "@/pages/supplier/SupplierProductForm";
import SupplierProducts from "@/pages/supplier/SupplierProducts";
import SupplierProductsBulk from "@/pages/supplier/SupplierProductsBulk";
import SupplierReviews from "@/pages/supplier/SupplierReviews";
import SupplierRfqRespond from "@/pages/supplier/SupplierRfqRespond";
import SupplierRfqs from "@/pages/supplier/SupplierRfqs";

const currentRole = vi.hoisted(() => ({ value: "ADMIN" as "ADMIN" | "CLIENT" | "SUPPLIER" }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    profile: {
      _id: "profile_1",
      role: currentRole.value,
      status: "ACTIVE",
      kyc_status: "VERIFIED",
      company_name: "Smoke Test Co",
      public_id: `${currentRole.value}-0001`,
    },
    loading: false,
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(async () => undefined),
  useAction: () => vi.fn(async () => undefined),
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
  ConvexAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/admin/WafeqPanel", () => ({
  WafeqPanel: () => <div data-testid="wafeq-panel" />,
  InvoiceWafeqStatus: () => <span data-testid="invoice-wafeq-status" />,
}));

vi.mock("recharts", () => {
  const Chart = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Primitive = () => <div />;
  return {
    Area: Primitive,
    AreaChart: Chart,
    Bar: Primitive,
    BarChart: Chart,
    CartesianGrid: Primitive,
    Cell: Primitive,
    Legend: Primitive,
    Line: Primitive,
    LineChart: Chart,
    Pie: Primitive,
    PieChart: Chart,
    ResponsiveContainer: Chart,
    Tooltip: Primitive,
    XAxis: Primitive,
    YAxis: Primitive,
  };
});

type PortalCase = {
  name: string;
  role: typeof currentRole.value;
  path: string;
  element: React.ReactElement;
};

const cases: PortalCase[] = [
  { name: "admin dashboard", role: "ADMIN", path: "/admin/dashboard", element: <AdminDashboard /> },
  { name: "admin users", role: "ADMIN", path: "/admin/users", element: <AdminUsers /> },
  { name: "admin user detail", role: "ADMIN", path: "/admin/users/profile_1", element: <AdminUserDetail /> },
  { name: "admin pending products", role: "ADMIN", path: "/admin/products/pending", element: <AdminPendingProducts /> },
  { name: "admin master catalog", role: "ADMIN", path: "/admin/master-catalog", element: <AdminMasterCatalog /> },
  { name: "admin product requests", role: "ADMIN", path: "/admin/product-requests", element: <AdminProductRequests /> },
  { name: "admin bundles", role: "ADMIN", path: "/admin/bundles", element: <AdminBundles /> },
  { name: "admin categories", role: "ADMIN", path: "/admin/categories", element: <AdminCategories /> },
  { name: "admin templates", role: "ADMIN", path: "/admin/templates", element: <AdminTemplates /> },
  { name: "admin margin settings", role: "ADMIN", path: "/admin/margin-settings", element: <AdminMarginSettings /> },
  { name: "admin rfqs", role: "ADMIN", path: "/admin/rfqs", element: <AdminRfqs /> },
  { name: "admin rfq quotes", role: "ADMIN", path: "/admin/rfqs/rfq_1/quotes", element: <AdminRfqQuoteComparison /> },
  { name: "admin pending quotes", role: "ADMIN", path: "/admin/quotes/pending", element: <AdminPendingQuotes /> },
  { name: "admin quote review", role: "ADMIN", path: "/admin/quotes/quote_1/review", element: <AdminQuoteReview /> },
  { name: "admin payments", role: "ADMIN", path: "/admin/payments", element: <AdminPayments /> },
  { name: "admin credit", role: "ADMIN", path: "/admin/credit", element: <AdminCredit /> },
  { name: "admin payouts", role: "ADMIN", path: "/admin/payouts", element: <AdminPayouts /> },
  { name: "admin reviews", role: "ADMIN", path: "/admin/reviews", element: <AdminReviews /> },
  { name: "admin audit log", role: "ADMIN", path: "/admin/audit-log", element: <AdminAuditLog /> },
  { name: "admin leads", role: "ADMIN", path: "/admin/leads", element: <AdminLeads /> },
  { name: "admin orders", role: "ADMIN", path: "/admin/orders", element: <AdminOrders /> },
  { name: "admin order detail", role: "ADMIN", path: "/admin/orders/order_1", element: <AdminOrderDetail /> },
  { name: "admin delivery notes", role: "ADMIN", path: "/admin/delivery-notes", element: <AdminDeliveryNotes /> },
  { name: "admin supplier invoices", role: "ADMIN", path: "/admin/supplier-invoices", element: <AdminSupplierInvoices /> },
  { name: "admin client invoices", role: "ADMIN", path: "/admin/client-invoices", element: <AdminClientInvoices /> },
  { name: "admin contracts", role: "ADMIN", path: "/admin/contracts", element: <AdminContracts /> },
  { name: "admin contract detail", role: "ADMIN", path: "/admin/contracts/contract_1", element: <AdminContractDetail /> },
  { name: "admin lifecycle", role: "ADMIN", path: "/admin/lifecycle", element: <AdminLifecycle /> },
  { name: "admin disputes", role: "ADMIN", path: "/admin/disputes", element: <AdminDisputes /> },
  { name: "admin preferred suppliers", role: "ADMIN", path: "/admin/preferred-suppliers", element: <AdminPreferredSuppliers /> },
  { name: "admin approvals", role: "ADMIN", path: "/admin/approvals", element: <AdminApprovals /> },
  { name: "client dashboard", role: "CLIENT", path: "/client/dashboard", element: <ClientDashboard /> },
  { name: "client catalog", role: "CLIENT", path: "/client/catalog", element: <ClientCatalog /> },
  { name: "client cart", role: "CLIENT", path: "/client/cart", element: <ClientCart /> },
  { name: "client rfqs", role: "CLIENT", path: "/client/rfqs", element: <ClientRfqs /> },
  { name: "client create rfq", role: "CLIENT", path: "/client/rfq/new", element: <ClientCreateRfq /> },
  { name: "client rfq detail", role: "CLIENT", path: "/client/rfqs/rfq_1", element: <ClientRfqDetail /> },
  { name: "client quote comparison", role: "CLIENT", path: "/client/rfqs/rfq_1/compare", element: <ClientQuoteComparison /> },
  { name: "client quotes", role: "CLIENT", path: "/client/quotes", element: <ClientQuotes /> },
  { name: "client orders", role: "CLIENT", path: "/client/orders", element: <ClientOrders /> },
  { name: "client order detail", role: "CLIENT", path: "/client/orders/order_1", element: <ClientOrderDetail /> },
  { name: "client organization", role: "CLIENT", path: "/client/organization", element: <ClientOrganization /> },
  { name: "client schedules", role: "CLIENT", path: "/client/schedules", element: <ClientSchedules /> },
  { name: "client invoices", role: "CLIENT", path: "/client/invoices", element: <ClientInvoices /> },
  { name: "client reports", role: "CLIENT", path: "/client/reports", element: <ClientReports /> },
  { name: "client account", role: "CLIENT", path: "/client/account", element: <ClientAccount /> },
  { name: "supplier dashboard", role: "SUPPLIER", path: "/supplier/dashboard", element: <SupplierDashboard /> },
  { name: "supplier catalog browse", role: "SUPPLIER", path: "/supplier/catalog", element: <SupplierCatalogBrowse /> },
  { name: "supplier products", role: "SUPPLIER", path: "/supplier/products", element: <SupplierProducts /> },
  { name: "supplier product add", role: "SUPPLIER", path: "/supplier/products/add", element: <SupplierProductForm /> },
  { name: "supplier product edit", role: "SUPPLIER", path: "/supplier/products/product_1", element: <SupplierProductForm /> },
  { name: "supplier bulk products", role: "SUPPLIER", path: "/supplier/products/bulk", element: <SupplierProductsBulk /> },
  { name: "supplier offer add", role: "SUPPLIER", path: "/supplier/offers/new", element: <SupplierOfferForm /> },
  { name: "supplier offer edit", role: "SUPPLIER", path: "/supplier/offers/offer_1", element: <SupplierOfferForm /> },
  { name: "supplier product request", role: "SUPPLIER", path: "/supplier/product-requests/new", element: <SupplierProductRequest /> },
  { name: "supplier auto quote queue", role: "SUPPLIER", path: "/supplier/auto-quotes", element: <SupplierAutoQuoteQueue /> },
  { name: "supplier delivery notes", role: "SUPPLIER", path: "/supplier/delivery-notes", element: <SupplierDeliveryNotes /> },
  { name: "supplier delivery note form", role: "SUPPLIER", path: "/supplier/delivery-notes/new", element: <SupplierDeliveryNoteForm /> },
  { name: "supplier rfqs", role: "SUPPLIER", path: "/supplier/rfqs", element: <SupplierRfqs /> },
  { name: "supplier rfq response", role: "SUPPLIER", path: "/supplier/rfqs/rfq_1/respond", element: <SupplierRfqRespond /> },
  { name: "supplier orders", role: "SUPPLIER", path: "/supplier/orders", element: <SupplierOrders /> },
  { name: "supplier order detail", role: "SUPPLIER", path: "/supplier/orders/order_1", element: <SupplierOrderDetail /> },
  { name: "supplier invoices", role: "SUPPLIER", path: "/supplier/invoices", element: <SupplierInvoices /> },
  { name: "supplier analytics", role: "SUPPLIER", path: "/supplier/analytics", element: <SupplierAnalytics /> },
  { name: "supplier kyc", role: "SUPPLIER", path: "/supplier/kyc", element: <SupplierKyc /> },
  { name: "supplier payouts", role: "SUPPLIER", path: "/supplier/payouts", element: <SupplierPayouts /> },
  { name: "supplier reviews", role: "SUPPLIER", path: "/supplier/reviews", element: <SupplierReviews /> },
];

const renderPortalPage = ({ path, element, role }: PortalCase) => {
  currentRole.value = role;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <Routes>
          <Route path="*" element={element} />
        </Routes>
      </LanguageProvider>
    </MemoryRouter>,
  );
};

describe("portal page smoke rendering", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each(cases)("$name renders without loaded query data", (portalCase) => {
    expect(() => renderPortalPage(portalCase)).not.toThrow();
  });
});
