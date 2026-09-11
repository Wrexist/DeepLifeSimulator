/** Catalog prices describe an offer, never the amount charged for a trial. */
export function purchaseOfferMeasurement(product?: {
  displayPrice?: unknown; localizedPrice?: unknown; price?: unknown;
  currency?: unknown; currencyCode?: unknown;
}): Record<string, string | number> {
  const display = product?.displayPrice ?? product?.localizedPrice;
  const currency = product?.currency ?? product?.currencyCode;
  return {
    measurement: 'purchase_flow',
    ...(typeof display === 'string' && display ? { displayPrice: display } : {}),
    ...(typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? { currency } : {}),
    ...(typeof product?.price === 'number' && Number.isFinite(product.price) && product.price >= 0
      ? { catalog_price: product.price } : {}),
  };
}
