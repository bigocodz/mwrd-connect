import { internalAction, internalMutation } from "./_generated/server";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// ── Demo credentials ─────────────────────────────────────────────────────────
export const DEMO_ACCOUNTS = {
  admin: {
    email: "demo-admin@mwrd.sa",
    password: "DemoAdmin123!",
    name: JSON.stringify({ role: "ADMIN", company_name: "MWRD Admin" }),
  },
  client: {
    email: "demo-client@mwrd.sa",
    password: "DemoClient123!",
    name: JSON.stringify({ role: "CLIENT", company_name: "Al-Noor Trading Co." }),
  },
  supplier1: {
    email: "demo-supplier1@mwrd.sa",
    password: "DemoSupplier123!",
    name: JSON.stringify({ role: "SUPPLIER", company_name: "Al-Faisal Office Supplies" }),
  },
  supplier2: {
    email: "demo-supplier2@mwrd.sa",
    password: "DemoSupplier123!",
    name: JSON.stringify({ role: "SUPPLIER", company_name: "Al-Rashid Facility Solutions" }),
  },
};

const daysAgo = (d: number) => Date.now() - d * 86_400_000;
const daysFromNow = (d: number) => Date.now() + d * 86_400_000;
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// margin = cost × (1 + pct/100), vat = final × 1.15
const price = (cost: number, pct: number) => {
  const final = Math.round(cost * (1 + pct / 100) * 100) / 100;
  const withVat = Math.round(final * 1.15 * 100) / 100;
  return { final, withVat };
};

/**
 * Step 1 — create auth accounts for all 4 demo users.
 * Run: npx convex run demoSeed:runDemoSeed
 */
export const runDemoSeed = internalAction({
  args: {},
  handler: async (ctx) => {
    for (const acc of Object.values(DEMO_ACCOUNTS)) {
      try {
        await createAccount(ctx, {
          provider: "password",
          account: { id: acc.email, secret: acc.password },
          profile: { email: acc.email, name: acc.name },
        });
      } catch {
        // already exists — continue
      }
    }
    return await ctx.runMutation(internal.demoSeed.populateDemoData, {});
  },
});

/**
 * Step 2 — insert all demo data. Can also be re-run independently after
 * accounts already exist.
 * Run: npx convex run demoSeed:populateDemoData
 */
export const populateDemoData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // ── helpers ──────────────────────────────────────────────────────────────
    const findProfile = async (email: string) => {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique();
      if (!user) throw new Error(`User not found: ${email}`);
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();
      if (!p) throw new Error(`Profile not found for ${email}`);
      return p;
    };

    // ── profiles ──────────────────────────────────────────────────────────────
    const admin = await findProfile(DEMO_ACCOUNTS.admin.email);
    const client = await findProfile(DEMO_ACCOUNTS.client.email);
    const sup1 = await findProfile(DEMO_ACCOUNTS.supplier1.email);
    const sup2 = await findProfile(DEMO_ACCOUNTS.supplier2.email);

    await ctx.db.patch(admin._id, { role: "ADMIN", status: "ACTIVE", kyc_status: "VERIFIED", must_change_password: false });
    await ctx.db.patch(client._id, {
      role: "CLIENT",
      status: "ACTIVE",
      kyc_status: "VERIFIED",
      must_change_password: false,
      payment_terms: "net_30",
      credit_limit: 100_000,
      current_balance: 14_135.80,
    });
    await ctx.db.patch(sup1._id, { role: "SUPPLIER", status: "ACTIVE", kyc_status: "VERIFIED", must_change_password: false });
    await ctx.db.patch(sup2._id, {
      role: "SUPPLIER",
      status: "ACTIVE",
      kyc_status: "VERIFIED",
      must_change_password: false,
      is_preferred: true,
      preferred_note: "Excellent delivery record and competitive pricing on facility supplies.",
      preferred_at: daysAgo(30),
      preferred_by: admin._id,
    });

    // ── margin settings ──────────────────────────────────────────────────────
    await ctx.db.insert("margin_settings", { type: "GLOBAL", margin_percent: 15 });
    await ctx.db.insert("margin_settings", { type: "CATEGORY", category: "Office Supplies", margin_percent: 12 });
    await ctx.db.insert("margin_settings", { type: "CATEGORY", category: "Cleaning & Hygiene", margin_percent: 18 });

    // ── products — Supplier 1 (Al-Faisal Office Supplies) ──────────────────
    const prodA4 = await ctx.db.insert("products", {
      supplier_id: sup1._id,
      name: "A4 Copy Paper (500 sheets/box)",
      description: "High-quality 80gsm A4 copy paper, ideal for laser and inkjet printers. Box of 5 reams (500 sheets).",
      category: "Office Supplies",
      subcategory: "Paper & Stationery",
      sku: "PAP-A4-80G",
      brand: "Navigator",
      images: [],
      cost_price: 45,
      lead_time_days: 3,
      availability_status: "AVAILABLE",
      approval_status: "APPROVED",
      stock_quantity: 500,
      low_stock_threshold: 50,
      stock_updated_at: daysAgo(1),
    });

    const prodToner = await ctx.db.insert("products", {
      supplier_id: sup1._id,
      name: "HP LaserJet Toner Cartridge CF217A",
      description: "Original HP toner for M102a/w, M130a/fn/fw/nw. Approximately 1,600 pages at 5% coverage.",
      category: "Office Supplies",
      subcategory: "Printer Supplies",
      sku: "HP-CF217A",
      brand: "HP",
      images: [],
      cost_price: 180,
      lead_time_days: 5,
      availability_status: "LIMITED_STOCK",
      approval_status: "APPROVED",
      stock_quantity: 8,
      low_stock_threshold: 5,
      stock_updated_at: daysAgo(1),
    });

    const prodStapler = await ctx.db.insert("products", {
      supplier_id: sup1._id,
      name: "Heavy Duty Stapler (50-sheet capacity)",
      description: "Metal construction heavy-duty stapler. Uses standard 26/6 staples. 50-sheet capacity.",
      category: "Office Supplies",
      subcategory: "Desk Accessories",
      sku: "STPL-HD-50",
      brand: "Rapid",
      images: [],
      cost_price: 35,
      lead_time_days: 2,
      availability_status: "AVAILABLE",
      approval_status: "APPROVED",
      stock_quantity: 50,
      low_stock_threshold: 10,
      stock_updated_at: daysAgo(1),
    });

    // ── products — Supplier 2 (Al-Rashid Facility Solutions) ───────────────
    const prodCleaner = await ctx.db.insert("products", {
      supplier_id: sup2._id,
      name: "Multipurpose Floor Cleaner (5L)",
      description: "Professional-grade floor cleaner — effective against grease and bacteria. Pleasant citrus scent. 5-litre container.",
      category: "Cleaning & Hygiene",
      subcategory: "Floor Care",
      sku: "CLN-FLOOR-5L",
      brand: "Dettol Pro",
      images: [],
      cost_price: 28,
      lead_time_days: 2,
      availability_status: "AVAILABLE",
      approval_status: "APPROVED",
      stock_quantity: 200,
      low_stock_threshold: 30,
      stock_updated_at: daysAgo(1),
    });

    const prodCloth = await ctx.db.insert("products", {
      supplier_id: sup2._id,
      name: "Microfiber Cleaning Cloth (Pack of 10)",
      description: "Ultra-absorbent microfiber cloths for streak-free cleaning on all surfaces. Pack of 10 assorted colours.",
      category: "Cleaning & Hygiene",
      subcategory: "Cleaning Accessories",
      sku: "CLN-MFIB-10PK",
      brand: "Vileda",
      images: [],
      cost_price: 22,
      lead_time_days: 2,
      availability_status: "AVAILABLE",
      approval_status: "APPROVED",
      stock_quantity: 150,
      low_stock_threshold: 20,
      stock_updated_at: daysAgo(1),
    });

    // ── client org hierarchy ─────────────────────────────────────────────────
    const costCenter = await ctx.db.insert("cost_centers", {
      client_id: client._id,
      code: "CC-OPS",
      name: "Operations",
      notes: "Main operations cost center covering facilities and consumables",
    });
    const branch = await ctx.db.insert("branches", {
      client_id: client._id,
      name: "Riyadh HQ",
      location: "King Fahd Road, Riyadh 12211, Saudi Arabia",
    });
    const department = await ctx.db.insert("departments", {
      client_id: client._id,
      name: "Procurement",
      notes: "Central procurement team responsible for all supplier relationships",
    });

    // ── client catalog ───────────────────────────────────────────────────────
    await ctx.db.insert("client_catalog_entries", {
      client_id: client._id,
      product_id: prodA4,
      alias: "Copier Paper Standard",
      notes: "Primary paper stock for all offices",
      pinned: true,
    });
    await ctx.db.insert("client_catalog_entries", {
      client_id: client._id,
      product_id: prodToner,
      notes: "Matches our HP M130fn fleet",
      pinned: true,
    });
    await ctx.db.insert("client_catalog_entries", {
      client_id: client._id,
      product_id: prodCleaner,
      notes: "Preferred floor cleaner for all branches",
    });

    // ── approval rule ────────────────────────────────────────────────────────
    await ctx.db.insert("approval_rules", {
      client_id: client._id,
      name: "High-Value Purchase Approval",
      min_amount: 5_000,
      enabled: true,
      notes: "All purchase orders exceeding SAR 5,000 require management sign-off before the order is confirmed.",
      cost_center_id: costCenter,
    });

    // ── RFQ schedule ─────────────────────────────────────────────────────────
    await ctx.db.insert("rfq_schedules", {
      client_id: client._id,
      name: "Monthly Office Supplies Reorder",
      cadence: "MONTHLY",
      next_run_at: daysFromNow(12),
      active: true,
      template: {
        category: "Office Supplies",
        delivery_location: "Riyadh HQ Warehouse",
        lead_time_days: 7,
        cost_center_id: costCenter,
        branch_id: branch,
        department_id: department,
        items: [
          { product_id: prodA4, quantity: 100, flexibility: "EXACT_MATCH", special_notes: "Navigator brand preferred" },
          { product_id: prodToner, quantity: 5, flexibility: "OPEN_TO_EQUIVALENT" },
        ],
      },
    });

    // ── contract (Supplier 1 + Client, ACTIVE) ───────────────────────────────
    const contract = await ctx.db.insert("contracts", {
      name: "Annual Office Supplies Agreement 2025",
      client_id: client._id,
      supplier_id: sup1._id,
      status: "ACTIVE",
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      payment_terms: "Net 30",
      discount_percent: 5,
      terms:
        "Prices are fixed for the contract duration. Volume discounts apply per item schedule attached. " +
        "Supplier guarantees delivery within stated lead times. Force majeure clause applies.",
      notes: "Reviewed and counter-signed by both parties on 2024-12-15.",
      created_by: admin._id,
    });
    await ctx.db.insert("contract_lines", {
      contract_id: contract,
      product_id: prodA4,
      description: "A4 Copy Paper (500 sheets/box) — contracted rate",
      unit_price: 42,
      min_quantity: 50,
      notes: "Valid for orders of 50+ boxes. Price includes delivery to Riyadh.",
    });
    await ctx.db.insert("contract_lines", {
      contract_id: contract,
      product_id: prodToner,
      description: "HP LaserJet Toner CF217A — contracted rate",
      unit_price: 165,
      notes: "Includes next-business-day delivery at no extra cost.",
    });

    // ─────────────────────────────────────────────────────────────────────────
    // JOURNEY A — Completed order (Q3 restock, ~85 days ago)
    //   RFQ: CLOSED  |  Quote: ACCEPTED  |  Order: COMPLETED
    //   Client invoice: PAID  |  Supplier invoice: PAID  |  Review: ★★★★★
    // ─────────────────────────────────────────────────────────────────────────
    // Pricing: Office Supplies margin = 12%
    //   A4:      cost=45,  final=50.40, withVat=57.96
    //   Toner:   cost=180, final=201.60, withVat=231.84
    //   Stapler: cost=35,  final=39.20,  withVat=45.08
    const pA4 = price(45, 12);    // { final: 50.40, withVat: 57.96 }
    const pToner = price(180, 12); // { final: 201.60, withVat: 231.84 }
    const pStapler = price(35, 12); // { final: 39.20, withVat: 45.08 }

    const rfqA = await ctx.db.insert("rfqs", {
      client_id: client._id,
      status: "CLOSED",
      category: "Office Supplies",
      required_by: isoDate(daysAgo(60)),
      delivery_location: "Riyadh HQ Warehouse",
      notes: "Q3 2025 quarterly office supplies restock",
      cost_center_id: costCenter,
      branch_id: branch,
      department_id: department,
    });
    const rfqA_itemA4 = await ctx.db.insert("rfq_items", {
      rfq_id: rfqA,
      product_id: prodA4,
      quantity: 200,
      flexibility: "EXACT_MATCH",
      special_notes: "Navigator brand only",
    });
    const rfqA_itemToner = await ctx.db.insert("rfq_items", {
      rfq_id: rfqA,
      product_id: prodToner,
      quantity: 10,
      flexibility: "OPEN_TO_EQUIVALENT",
    });
    const rfqA_itemStapler = await ctx.db.insert("rfq_items", {
      rfq_id: rfqA,
      product_id: prodStapler,
      quantity: 5,
      flexibility: "OPEN_TO_ALTERNATIVES",
    });
    await ctx.db.insert("rfq_supplier_assignments", {
      rfq_id: rfqA,
      supplier_id: sup1._id,
      assigned_at: daysAgo(90),
    });

    const quoteA = await ctx.db.insert("quotes", {
      rfq_id: rfqA,
      supplier_id: sup1._id,
      status: "ACCEPTED",
      reviewed_by: admin._id,
      reviewed_at: daysAgo(84),
      supplier_notes:
        "All items in stock and ready to dispatch. Navigator A4 paper confirmed. " +
        "Toner is original HP — no compatibles. Staplers are Rapid brand as specified.",
      revision_count: 0,
    });
    await ctx.db.insert("quote_items", {
      quote_id: quoteA,
      rfq_item_id: rfqA_itemA4,
      is_quoted: true,
      supplier_product_id: prodA4,
      cost_price: 45,
      lead_time_days: 3,
      margin_percent: 12,
      final_price_before_vat: pA4.final,
      final_price_with_vat: pA4.withVat,
    });
    await ctx.db.insert("quote_items", {
      quote_id: quoteA,
      rfq_item_id: rfqA_itemToner,
      is_quoted: true,
      supplier_product_id: prodToner,
      cost_price: 180,
      lead_time_days: 5,
      margin_percent: 12,
      final_price_before_vat: pToner.final,
      final_price_with_vat: pToner.withVat,
    });
    await ctx.db.insert("quote_items", {
      quote_id: quoteA,
      rfq_item_id: rfqA_itemStapler,
      is_quoted: true,
      supplier_product_id: prodStapler,
      cost_price: 35,
      lead_time_days: 2,
      margin_percent: 12,
      final_price_before_vat: pStapler.final,
      final_price_with_vat: pStapler.withVat,
    });

    // Order A totals:
    //   A4:      200 × 50.40  = 10,080  |  200 × 57.96  = 11,592.00
    //   Toner:    10 × 201.60 =  2,016  |   10 × 231.84 =  2,318.40
    //   Stapler:   5 × 39.20  =    196  |    5 × 45.08  =    225.40
    //   ────────────────────────────────────────────────────────────
    //   Total:                  12,292  |                  14,135.80
    const orderA = await ctx.db.insert("orders", {
      rfq_id: rfqA,
      quote_id: quoteA,
      client_id: client._id,
      supplier_id: sup1._id,
      status: "COMPLETED",
      total_before_vat: 12_292,
      total_with_vat: 14_135.80,
      delivery_location: "Riyadh HQ Warehouse",
      required_by: isoDate(daysAgo(60)),
      confirmed_at: daysAgo(82),
      preparing_at: daysAgo(80),
      dispatched_at: daysAgo(77),
      delivered_at: daysAgo(75),
      completed_at: daysAgo(74),
      carrier: "Aramex",
      tracking_number: "ARX-2025-884421",
      tracking_url: "https://www.aramex.com/track/884421",
      estimated_delivery_at: daysAgo(76),
    });

    await ctx.db.insert("order_events", { order_id: orderA, actor_id: admin._id, actor_role: "ADMIN", event_type: "CREATED", message: "Order created after client accepted the supplier quote.", created_at: daysAgo(83) });
    await ctx.db.insert("order_events", { order_id: orderA, actor_id: sup1._id, actor_role: "SUPPLIER", event_type: "CONFIRMED", message: "Order confirmed — all items reserved for this shipment.", created_at: daysAgo(82) });
    await ctx.db.insert("order_events", { order_id: orderA, actor_id: sup1._id, actor_role: "SUPPLIER", event_type: "PREPARING", message: "Picking and packing in progress.", created_at: daysAgo(80) });
    await ctx.db.insert("order_events", { order_id: orderA, actor_id: sup1._id, actor_role: "SUPPLIER", event_type: "DISPATCHED", message: "Shipment dispatched via Aramex — tracking: ARX-2025-884421. ETA: 2 business days.", created_at: daysAgo(77) });
    await ctx.db.insert("order_events", { order_id: orderA, actor_id: sup1._id, actor_role: "SUPPLIER", event_type: "DELIVERED", message: "Delivered to Riyadh HQ Warehouse. Signed by Ahmed Al-Sayed.", created_at: daysAgo(75) });
    await ctx.db.insert("order_events", { order_id: orderA, actor_id: client._id, actor_role: "CLIENT", event_type: "COMPLETED", message: "All items received and verified. No issues.", created_at: daysAgo(74) });

    // Client invoice A — PAID
    const clientInvA = await ctx.db.insert("client_invoices", {
      client_id: client._id,
      order_id: orderA,
      invoice_number: "MWRD-2025-001",
      issue_date: isoDate(daysAgo(73)),
      due_date: isoDate(daysAgo(43)),
      subtotal: 12_292,
      vat_amount: 1_843.80,
      total_amount: 14_135.80,
      status: "PAID",
      issued_by: admin._id,
      paid_at: daysAgo(50),
      paid_reference: "BNK-TRF-SA-20250601",
      notes: "Q3 2025 Office Supplies — Order A",
    });

    // Payment A
    const paymentA = await ctx.db.insert("payments", {
      client_id: client._id,
      order_id: String(orderA),
      amount: 14_135.80,
      payment_method: "BANK_TRANSFER",
      status: "PAID",
      bank_reference: "BNK-TRF-SA-20250601",
      confirmed_by: admin._id,
      confirmed_at: daysAgo(50),
      notes: "Full settlement for MWRD-2025-001",
    });
    await ctx.db.insert("payment_allocations", {
      payment_id: paymentA,
      invoice_id: clientInvA,
      amount: 14_135.80,
      allocated_by: admin._id,
    });

    // Supplier invoice A — PAID
    //   Supplier cost: 200×45 + 10×180 + 5×35 = 9,000 + 1,800 + 175 = 10,975
    //   Supplier VAT:  10,975 × 0.15 = 1,646.25  |  Total = 12,621.25
    await ctx.db.insert("supplier_invoices", {
      supplier_id: sup1._id,
      order_id: orderA,
      invoice_number: "SUP-ALFAISAL-2025-047",
      issue_date: isoDate(daysAgo(74)),
      due_date: isoDate(daysAgo(44)),
      subtotal: 10_975,
      vat_amount: 1_646.25,
      total_amount: 12_621.25,
      status: "PAID",
      reviewed_by: admin._id,
      reviewed_at: daysAgo(70),
      paid_at: daysAgo(45),
      paid_reference: "MWRD-PAY-SUP-20250611",
    });

    // Supplier payout A
    await ctx.db.insert("supplier_payouts", {
      supplier_id: sup1._id,
      order_id: String(orderA),
      amount: 12_621.25,
      payment_method: "BANK_TRANSFER",
      status: "PAID",
      recorded_by: admin._id,
      bank_reference: "MWRD-PAY-SUP-20250611",
      paid_at: daysAgo(45),
      notes: "Payout for Order A — invoice SUP-ALFAISAL-2025-047",
    });

    // Review A
    await ctx.db.insert("reviews", {
      client_id: client._id,
      supplier_id: sup1._id,
      order_id: String(orderA),
      rating: 5,
      comment:
        "Excellent service — all items delivered on time and in perfect condition. " +
        "Navigator paper quality is outstanding. Will continue ordering from Al-Faisal.",
    });

    // ─────────────────────────────────────────────────────────────────────────
    // JOURNEY B — Dispatched order (facility cleaning, ~14 days ago)
    //   RFQ: CLOSED  |  Quote: ACCEPTED  |  Order: DISPATCHED
    // ─────────────────────────────────────────────────────────────────────────
    // Pricing: Cleaning & Hygiene margin = 18%
    //   Cleaner: cost=28, final=33.04, withVat=38.00
    //   Cloth:   cost=22, final=25.96, withVat=29.85
    const pCleaner = price(28, 18); // { final: 33.04, withVat: 38.00 }
    const pCloth = price(22, 18);   // { final: 25.96, withVat: 29.85 }

    const rfqB = await ctx.db.insert("rfqs", {
      client_id: client._id,
      status: "CLOSED",
      category: "Cleaning & Hygiene",
      required_by: isoDate(daysFromNow(5)),
      delivery_location: "Riyadh HQ Facility Room",
      notes: "Monthly cleaning supplies top-up",
      cost_center_id: costCenter,
      branch_id: branch,
      department_id: department,
    });
    const rfqB_itemCleaner = await ctx.db.insert("rfq_items", {
      rfq_id: rfqB,
      product_id: prodCleaner,
      quantity: 20,
      flexibility: "EXACT_MATCH",
    });
    const rfqB_itemCloth = await ctx.db.insert("rfq_items", {
      rfq_id: rfqB,
      product_id: prodCloth,
      quantity: 30,
      flexibility: "OPEN_TO_EQUIVALENT",
    });
    await ctx.db.insert("rfq_supplier_assignments", {
      rfq_id: rfqB,
      supplier_id: sup2._id,
      assigned_at: daysAgo(14),
    });

    const quoteB = await ctx.db.insert("quotes", {
      rfq_id: rfqB,
      supplier_id: sup2._id,
      status: "ACCEPTED",
      reviewed_by: admin._id,
      reviewed_at: daysAgo(9),
      supplier_notes: "All items available. Dettol Pro 5L confirmed. Vileda microfiber cloths in stock.",
      revision_count: 0,
    });
    await ctx.db.insert("quote_items", {
      quote_id: quoteB,
      rfq_item_id: rfqB_itemCleaner,
      is_quoted: true,
      supplier_product_id: prodCleaner,
      cost_price: 28,
      lead_time_days: 2,
      margin_percent: 18,
      final_price_before_vat: pCleaner.final,
      final_price_with_vat: pCleaner.withVat,
    });
    await ctx.db.insert("quote_items", {
      quote_id: quoteB,
      rfq_item_id: rfqB_itemCloth,
      is_quoted: true,
      supplier_product_id: prodCloth,
      cost_price: 22,
      lead_time_days: 2,
      margin_percent: 18,
      final_price_before_vat: pCloth.final,
      final_price_with_vat: pCloth.withVat,
    });

    // Order B totals:
    //   Cleaner: 20 × 33.04 = 660.80 | 20 × 38.00 = 760.00
    //   Cloth:   30 × 25.96 = 778.80 | 30 × 29.85 = 895.50
    //   ───────────────────────────────────────────────────
    //   Total:              1,439.60 |              1,655.50
    const orderB = await ctx.db.insert("orders", {
      rfq_id: rfqB,
      quote_id: quoteB,
      client_id: client._id,
      supplier_id: sup2._id,
      status: "DISPATCHED",
      total_before_vat: 1_439.60,
      total_with_vat: 1_655.50,
      delivery_location: "Riyadh HQ Facility Room",
      required_by: isoDate(daysFromNow(5)),
      confirmed_at: daysAgo(7),
      preparing_at: daysAgo(5),
      dispatched_at: daysAgo(3),
      carrier: "SMSA Express",
      tracking_number: "SMSA-2025-990182",
      tracking_url: "https://www.smsaexpress.com/track/990182",
      estimated_delivery_at: daysFromNow(1),
    });

    await ctx.db.insert("order_events", { order_id: orderB, actor_id: admin._id, actor_role: "ADMIN", event_type: "CREATED", message: "Order created after client accepted quote.", created_at: daysAgo(8) });
    await ctx.db.insert("order_events", { order_id: orderB, actor_id: sup2._id, actor_role: "SUPPLIER", event_type: "CONFIRMED", message: "Order confirmed — items reserved.", created_at: daysAgo(7) });
    await ctx.db.insert("order_events", { order_id: orderB, actor_id: sup2._id, actor_role: "SUPPLIER", event_type: "PREPARING", message: "Preparing shipment.", created_at: daysAgo(5) });
    await ctx.db.insert("order_events", { order_id: orderB, actor_id: sup2._id, actor_role: "SUPPLIER", event_type: "DISPATCHED", message: "Dispatched via SMSA Express — tracking SMSA-2025-990182. Expected tomorrow.", created_at: daysAgo(3) });

    // Pending supplier invoice for Order B
    await ctx.db.insert("supplier_invoices", {
      supplier_id: sup2._id,
      order_id: orderB,
      invoice_number: "SUP-RASHID-2025-012",
      issue_date: isoDate(daysAgo(3)),
      subtotal: 1_220,
      vat_amount: 183,
      total_amount: 1_403,
      status: "SUBMITTED",
      notes: "Invoice for Order B — Cleaning & Hygiene supplies",
    });

    // ─────────────────────────────────────────────────────────────────────────
    // JOURNEY C — Quote awaiting client decision
    //   RFQ: QUOTED  |  Quote: SENT_TO_CLIENT
    // ─────────────────────────────────────────────────────────────────────────
    const rfqC = await ctx.db.insert("rfqs", {
      client_id: client._id,
      status: "QUOTED",
      category: "Office Supplies",
      required_by: isoDate(daysFromNow(14)),
      delivery_location: "Riyadh HQ Warehouse",
      notes: "Mid-month paper restock — running low on A4",
      cost_center_id: costCenter,
      branch_id: branch,
    });
    const rfqC_itemA4 = await ctx.db.insert("rfq_items", {
      rfq_id: rfqC,
      product_id: prodA4,
      quantity: 100,
      flexibility: "EXACT_MATCH",
      special_notes: "Navigator brand preferred",
    });
    await ctx.db.insert("rfq_supplier_assignments", {
      rfq_id: rfqC,
      supplier_id: sup1._id,
      assigned_at: daysAgo(5),
    });

    const quoteC = await ctx.db.insert("quotes", {
      rfq_id: rfqC,
      supplier_id: sup1._id,
      status: "SENT_TO_CLIENT",
      reviewed_by: admin._id,
      reviewed_at: daysAgo(2),
      supplier_notes: "100 boxes available. Same Navigator brand as previous order.",
      revision_count: 0,
    });
    await ctx.db.insert("quote_items", {
      quote_id: quoteC,
      rfq_item_id: rfqC_itemA4,
      is_quoted: true,
      supplier_product_id: prodA4,
      cost_price: 45,
      lead_time_days: 3,
      margin_percent: 12,
      final_price_before_vat: pA4.final,
      final_price_with_vat: pA4.withVat,
    });

    // Pending client invoice — unrelated standalone (to show overdue state)
    await ctx.db.insert("client_invoices", {
      client_id: client._id,
      invoice_number: "MWRD-2025-002",
      issue_date: isoDate(daysAgo(45)),
      due_date: isoDate(daysAgo(15)),
      subtotal: 1_439.60,
      vat_amount: 215.94,
      total_amount: 1_655.54,
      status: "OVERDUE",
      issued_by: admin._id,
      notes: "Q3 Cleaning Supplies — Order B (advance invoice)",
      reminder_count: 2,
      last_reminder_at: daysAgo(5),
    });

    // ─────────────────────────────────────────────────────────────────────────
    // JOURNEY D — Quote pending admin review
    //   RFQ: OPEN  |  Quote: PENDING_ADMIN (supplier quoted, admin hasn't reviewed)
    // ─────────────────────────────────────────────────────────────────────────
    const rfqD = await ctx.db.insert("rfqs", {
      client_id: client._id,
      status: "OPEN",
      category: "Office Supplies",
      required_by: isoDate(daysFromNow(21)),
      delivery_location: "Riyadh HQ Warehouse",
      notes: "Q4 stationery procurement — staplers and desk accessories",
      cost_center_id: costCenter,
      branch_id: branch,
      department_id: department,
    });
    const rfqD_itemStapler = await ctx.db.insert("rfq_items", {
      rfq_id: rfqD,
      product_id: prodStapler,
      quantity: 20,
      flexibility: "OPEN_TO_ALTERNATIVES",
      special_notes: "Any heavy-duty stapler with 40+ sheet capacity",
    });
    const rfqD_itemCustom = await ctx.db.insert("rfq_items", {
      rfq_id: rfqD,
      custom_item_description: "Whiteboard markers (assorted colours, pack of 12)",
      quantity: 15,
      flexibility: "OPEN_TO_ALTERNATIVES",
    });
    await ctx.db.insert("rfq_supplier_assignments", {
      rfq_id: rfqD,
      supplier_id: sup1._id,
      assigned_at: daysAgo(3),
    });

    const quoteD = await ctx.db.insert("quotes", {
      rfq_id: rfqD,
      supplier_id: sup1._id,
      status: "PENDING_ADMIN",
      supplier_notes: "Staplers from Rapid — same model as before. Whiteboard markers: Expo brand, pack of 12 assorted.",
      revision_count: 0,
    });
    await ctx.db.insert("quote_items", {
      quote_id: quoteD,
      rfq_item_id: rfqD_itemStapler,
      is_quoted: true,
      supplier_product_id: prodStapler,
      cost_price: 35,
      lead_time_days: 2,
      margin_percent: 12,
      final_price_before_vat: pStapler.final,
      final_price_with_vat: pStapler.withVat,
    });
    await ctx.db.insert("quote_items", {
      quote_id: quoteD,
      rfq_item_id: rfqD_itemCustom,
      is_quoted: true,
      cost_price: 18,
      lead_time_days: 2,
      margin_percent: 12,
      final_price_before_vat: price(18, 12).final,
      final_price_with_vat: price(18, 12).withVat,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // JOURNEY E — Open RFQ, no supplier response yet
    // ─────────────────────────────────────────────────────────────────────────
    const rfqE = await ctx.db.insert("rfqs", {
      client_id: client._id,
      status: "OPEN",
      category: "Cleaning & Hygiene",
      required_by: isoDate(daysFromNow(30)),
      delivery_location: "Riyadh HQ Facility Room",
      notes: "Quarterly deep-clean supply order — all branches",
      cost_center_id: costCenter,
    });
    await ctx.db.insert("rfq_items", {
      rfq_id: rfqE,
      product_id: prodCleaner,
      quantity: 50,
      flexibility: "OPEN_TO_EQUIVALENT",
    });
    await ctx.db.insert("rfq_items", {
      rfq_id: rfqE,
      product_id: prodCloth,
      quantity: 80,
      flexibility: "OPEN_TO_EQUIVALENT",
    });
    await ctx.db.insert("rfq_supplier_assignments", {
      rfq_id: rfqE,
      supplier_id: sup2._id,
      assigned_at: daysAgo(1),
    });

    // ── notifications ────────────────────────────────────────────────────────
    await ctx.db.insert("notifications", {
      user_id: client._id,
      title: "Quote ready for review",
      message: "Al-Faisal Office Supplies has responded to your RFQ for 100 boxes of A4 paper.",
      read: false,
      link: `/client/rfqs/${rfqC}`,
    });
    await ctx.db.insert("notifications", {
      user_id: client._id,
      title: "Shipment dispatched",
      message: "Your cleaning supplies order is on the way via SMSA Express (SMSA-2025-990182).",
      read: false,
      link: `/client/orders/${orderB}`,
    });
    await ctx.db.insert("notifications", {
      user_id: sup1._id,
      title: "New RFQ assigned",
      message: "You have been assigned a new RFQ for staplers and whiteboard markers.",
      read: false,
      link: `/supplier/rfqs/${rfqD}/respond`,
    });
    await ctx.db.insert("notifications", {
      user_id: admin._id,
      title: "Quote pending review",
      message: "Al-Faisal Office Supplies submitted a quote for RFQ D — awaiting admin review.",
      read: false,
      link: `/admin/quotes/${quoteD}/review`,
    });

    return {
      success: true,
      accounts: {
        admin: { email: DEMO_ACCOUNTS.admin.email, password: DEMO_ACCOUNTS.admin.password },
        client: { email: DEMO_ACCOUNTS.client.email, password: DEMO_ACCOUNTS.client.password },
        supplier1: { email: DEMO_ACCOUNTS.supplier1.email, password: DEMO_ACCOUNTS.supplier1.password },
        supplier2: { email: DEMO_ACCOUNTS.supplier2.email, password: DEMO_ACCOUNTS.supplier2.password },
      },
      summary: {
        products: 5,
        rfqs: 5,
        quotes: 4,
        orders: 2,
        "order statuses": ["COMPLETED (Order A)", "DISPATCHED (Order B)"],
        "client invoices": 2,
        "supplier invoices": 2,
        contract: "Annual Office Supplies Agreement 2025 (ACTIVE)",
        "approval rule": "High-Value Purchase Approval (≥ SAR 5,000)",
        "rfq schedule": "Monthly Office Supplies Reorder (MONTHLY)",
        notifications: 4,
      },
    };
  },
});
