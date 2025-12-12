import analyticsService from '@/services/AnalyticsService';

/**
 * Convenience functions for common analytics events
 */

export const trackScreenView = (screenName: string) => {
  analyticsService.logScreenView(screenName);
};

export const trackPurchase = (
  value: number,
  currency: string,
  items: { item_id: string; item_name: string; price: number; quantity: number }[]
) => {
  analyticsService.logPurchase(value, currency, items);
};

export const trackIAPPurchase = (productId: string, price: number, currency: string = 'USD') => {
  analyticsService.logIAPPurchase(productId, price, currency);
};

export const trackGameAction = (action: string, parameters?: Record<string, any>) => {
  analyticsService.logGameAction(action, parameters);
};

export const setUserProperty = (key: string, value: string | number | boolean) => {
  analyticsService.setUserProperties({ [key]: value });
};

export const setUserId = (userId: string) => {
  analyticsService.setUserId(userId);
};

