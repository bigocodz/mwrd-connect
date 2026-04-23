/**
 * Margin hierarchy logic for MWRD pricing.
 *
 * Priority:
 * 1. Quote-item override margin
 * 2. Client-specific margin (profiles.client_margin)
 * 3. Category-specific margin (margin_settings where type='CATEGORY')
 * 4. Global default margin (margin_settings where type='GLOBAL')
 */

export interface MarginContext {
  /** Override margin on a specific quote item */
  quoteItemMargin?: number | null;
  /** Per-client margin from profiles.client_margin */
  clientMargin?: number | null;
  /** Category-level margin from margin_settings */
  categoryMargin?: number | null;
  /** Global default margin from margin_settings */
  globalMargin: number;
}

const VAT_RATE = 0.15;

/**
 * Resolve the effective margin percent from the hierarchy.
 */
export function resolveMargin(ctx: MarginContext): number {
  if (ctx.quoteItemMargin != null && ctx.quoteItemMargin >= 0) return ctx.quoteItemMargin;
  if (ctx.clientMargin != null && ctx.clientMargin >= 0) return ctx.clientMargin;
  if (ctx.categoryMargin != null && ctx.categoryMargin >= 0) return ctx.categoryMargin;
  return ctx.globalMargin;
}

/**
 * Calculate the final price before VAT.
 * finalPrice = costPrice × (1 + marginPercent / 100)
 */
export function calculateFinalPrice(costPrice: number, marginPercent: number): number {
  return costPrice * (1 + marginPercent / 100);
}

/**
 * Calculate the VAT-inclusive price.
 * vatPrice = finalPrice × 1.15
 */
export function calculatePriceWithVat(finalPrice: number): number {
  return finalPrice * (1 + VAT_RATE);
}

/**
 * Full pricing calculation from cost price through margin hierarchy.
 */
export function calculateFullPricing(costPrice: number, ctx: MarginContext) {
  const marginPercent = resolveMargin(ctx);
  const finalPrice = calculateFinalPrice(costPrice, marginPercent);
  const priceWithVat = calculatePriceWithVat(finalPrice);
  return {
    marginPercent,
    finalPrice: Math.round(finalPrice * 100) / 100,
    priceWithVat: Math.round(priceWithVat * 100) / 100,
  };
}
