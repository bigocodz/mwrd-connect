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
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as clientCatalog from "../clientCatalog.js";
import type * as clientInvoices from "../clientInvoices.js";
import type * as contracts from "../contracts.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as kyc from "../kyc.js";
import type * as leads from "../leads.js";
import type * as lib from "../lib.js";
import type * as margins from "../margins.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as organization from "../organization.js";
import type * as payments from "../payments.js";
import type * as payouts from "../payouts.js";
import type * as products from "../products.js";
import type * as quotes from "../quotes.js";
import type * as reconciliation from "../reconciliation.js";
import type * as reviews from "../reviews.js";
import type * as rfqs from "../rfqs.js";
import type * as schedules from "../schedules.js";
import type * as seed from "../seed.js";
import type * as statements from "../statements.js";
import type * as supplierInvoices from "../supplierInvoices.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  approvals: typeof approvals;
  auditLog: typeof auditLog;
  auth: typeof auth;
  clientCatalog: typeof clientCatalog;
  clientInvoices: typeof clientInvoices;
  contracts: typeof contracts;
  crons: typeof crons;
  dashboard: typeof dashboard;
  email: typeof email;
  http: typeof http;
  kyc: typeof kyc;
  leads: typeof leads;
  lib: typeof lib;
  margins: typeof margins;
  notifications: typeof notifications;
  orders: typeof orders;
  organization: typeof organization;
  payments: typeof payments;
  payouts: typeof payouts;
  products: typeof products;
  quotes: typeof quotes;
  reconciliation: typeof reconciliation;
  reviews: typeof reviews;
  rfqs: typeof rfqs;
  schedules: typeof schedules;
  seed: typeof seed;
  statements: typeof statements;
  supplierInvoices: typeof supplierInvoices;
  users: typeof users;
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
