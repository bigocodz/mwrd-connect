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
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as dashboard from "../dashboard.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as leads from "../leads.js";
import type * as lib from "../lib.js";
import type * as margins from "../margins.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as payouts from "../payouts.js";
import type * as products from "../products.js";
import type * as quotes from "../quotes.js";
import type * as reviews from "../reviews.js";
import type * as rfqs from "../rfqs.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auditLog: typeof auditLog;
  auth: typeof auth;
  dashboard: typeof dashboard;
  email: typeof email;
  http: typeof http;
  leads: typeof leads;
  lib: typeof lib;
  margins: typeof margins;
  notifications: typeof notifications;
  payments: typeof payments;
  payouts: typeof payouts;
  products: typeof products;
  quotes: typeof quotes;
  reviews: typeof reviews;
  rfqs: typeof rfqs;
  seed: typeof seed;
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
