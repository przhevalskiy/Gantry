import { describe, expect, it } from 'vitest';
import { diffFields } from './capture';

describe('diffFields', () => {
  it('marks changed values', () => {
    const diffs = diffFields(
      [
        { key: 'title', label: 'Title', value: 'Hat' },
        { key: 'price', label: 'Price', value: '10' },
      ],
      [
        { key: 'title', label: 'Title', value: 'Hat' },
        { key: 'price', label: 'Price', value: '12' },
      ],
    );
    expect(diffs.find((d) => d.key === 'price')?.changed).toBe(true);
    expect(diffs.find((d) => d.key === 'title')?.changed).toBe(false);
  });

  it('includes added fields', () => {
    const diffs = diffFields([], [{ key: 'sku', label: 'SKU', value: 'A1' }]);
    expect(diffs[0]?.changed).toBe(true);
    expect(diffs[0]?.before).toBe('');
  });
});
