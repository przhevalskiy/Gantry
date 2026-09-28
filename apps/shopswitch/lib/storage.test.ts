import { describe, expect, it } from 'vitest';
import { parseShopifyAdmin } from './storage';

describe('parseShopifyAdmin', () => {
  it('parses admin.shopify.com store URLs', () => {
    const parsed = parseShopifyAdmin('https://admin.shopify.com/store/acme-co/products');
    expect(parsed).toEqual({
      handle: 'acme-co',
      adminUrl: 'https://admin.shopify.com/store/acme-co',
    });
  });

  it('parses myshopify admin URLs', () => {
    const parsed = parseShopifyAdmin('https://acme-co.myshopify.com/admin/orders');
    expect(parsed?.handle).toBe('acme-co');
  });

  it('rejects non-shopify URLs', () => {
    expect(parseShopifyAdmin('https://example.com')).toBeNull();
  });
});
