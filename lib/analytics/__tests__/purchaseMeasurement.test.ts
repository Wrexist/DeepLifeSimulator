import { purchaseOfferMeasurement } from '../purchaseMeasurement';

it('labels a store price as an offer, never revenue or the amount charged', () => {
  expect(purchaseOfferMeasurement({ price: 49.99, currency: 'SEK', displayPrice: '49,99 kr' }))
    .toEqual({ measurement: 'purchase_flow', catalog_price: 49.99, currency: 'SEK', displayPrice: '49,99 kr' });
  expect(purchaseOfferMeasurement({ price: '49,99 kr' })).not.toHaveProperty('catalog_price');
  expect(purchaseOfferMeasurement({ price: NaN })).not.toHaveProperty('catalog_price');
  expect(purchaseOfferMeasurement()).toEqual({ measurement: 'purchase_flow' });
});
