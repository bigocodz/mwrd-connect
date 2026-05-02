/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as approvals from "../approvals.js";
import type * as audit from "../audit.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as autoQuote from "../autoQuote.js";
import type * as bundles from "../bundles.js";
import type * as catalogMigration from "../catalogMigration.js";
import type * as categories from "../categories.js";
import type * as clientCatalog from "../clientCatalog.js";
import type * as clientInvoiceAdjustments from "../clientInvoiceAdjustments.js";
import type * as clientInvoices from "../clientInvoices.js";
import type * as comments from "../comments.js";
import type * as contracts from "../contracts.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dateHelpers from "../dateHelpers.js";
import type * as deliveryNotes from "../deliveryNotes.js";
import type * as demoSeed from "../demoSeed.js";
import type * as documentRenderer from "../documentRenderer.js";
import type * as documents from "../documents.js";
import type * as email from "../email.js";
import type * as grn from "../grn.js";
import type * as http from "../http.js";
import type * as kyc from "../kyc.js";
import type * as leads from "../leads.js";
import type * as lib from "../lib.js";
import type * as margins from "../margins.js";
import type * as masterProducts from "../masterProducts.js";
import type * as notificationTemplates from "../notificationTemplates.js";
import type * as notifications from "../notifications.js";
import type * as notify from "../notify.js";
import type * as notifyHelpers from "../notifyHelpers.js";
import type * as orders from "../orders.js";
import type * as organization from "../organization.js";
import type * as payments from "../payments.js";
import type * as payouts from "../payouts.js";
import type * as productAdditionRequests from "../productAdditionRequests.js";
import type * as productionSeed from "../productionSeed.js";
import type * as products from "../products.js";
import type * as quotes from "../quotes.js";
import type * as reconciliation from "../reconciliation.js";
import type * as reports from "../reports.js";
import type * as reviews from "../reviews.js";
import type * as rfqs from "../rfqs.js";
import type * as schedules from "../schedules.js";
import type * as seed from "../seed.js";
import type * as spl from "../spl.js";
import type * as splHelpers from "../splHelpers.js";
import type * as statements from "../statements.js";
import type * as supplierInvoices from "../supplierInvoices.js";
import type * as threeWayMatch from "../threeWayMatch.js";
import type * as uploads from "../uploads.js";
import type * as users from "../users.js";
import type * as wafeq from "../wafeq.js";
import type * as wafeqHelpers from "../wafeqHelpers.js";
import type * as wafeqQueries from "../wafeqQueries.js";
import type * as wathq from "../wathq.js";
import type * as wathqHelpers from "../wathqHelpers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  approvals: typeof approvals;
  audit: typeof audit;
  auditLog: typeof auditLog;
  auth: typeof auth;
  autoQuote: typeof autoQuote;
  bundles: typeof bundles;
  catalogMigration: typeof catalogMigration;
  categories: typeof categories;
  clientCatalog: typeof clientCatalog;
  clientInvoiceAdjustments: typeof clientInvoiceAdjustments;
  clientInvoices: typeof clientInvoices;
  comments: typeof comments;
  contracts: typeof contracts;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dateHelpers: typeof dateHelpers;
  deliveryNotes: typeof deliveryNotes;
  demoSeed: typeof demoSeed;
  documentRenderer: typeof documentRenderer;
  documents: typeof documents;
  email: typeof email;
  grn: typeof grn;
  http: typeof http;
  kyc: typeof kyc;
  leads: typeof leads;
  lib: typeof lib;
  margins: typeof margins;
  masterProducts: typeof masterProducts;
  notificationTemplates: typeof notificationTemplates;
  notifications: typeof notifications;
  notify: typeof notify;
  notifyHelpers: typeof notifyHelpers;
  orders: typeof orders;
  organization: typeof organization;
  payments: typeof payments;
  payouts: typeof payouts;
  productAdditionRequests: typeof productAdditionRequests;
  productionSeed: typeof productionSeed;
  products: typeof products;
  quotes: typeof quotes;
  reconciliation: typeof reconciliation;
  reports: typeof reports;
  reviews: typeof reviews;
  rfqs: typeof rfqs;
  schedules: typeof schedules;
  seed: typeof seed;
  spl: typeof spl;
  splHelpers: typeof splHelpers;
  statements: typeof statements;
  supplierInvoices: typeof supplierInvoices;
  threeWayMatch: typeof threeWayMatch;
  uploads: typeof uploads;
  users: typeof users;
  wafeq: typeof wafeq;
  wafeqHelpers: typeof wafeqHelpers;
  wafeqQueries: typeof wafeqQueries;
  wathq: typeof wathq;
  wathqHelpers: typeof wathqHelpers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
