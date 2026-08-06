import { describe, expect, it } from 'vitest';
import { filterTableRows, matchesSearchQuery, matchesSelectFilter, sortTableRows } from './data-table-filters';

const rows = [
  { id: '1', name: 'Acme Corp', status: 'ACTIVE', plan: 'ENTERPRISE' },
  { id: '2', name: 'Beta LLC', status: 'TRIAL', plan: 'STARTER' },
  { id: '3', name: 'Gamma Inc', status: 'ACTIVE', plan: 'STARTER' },
];

describe('data-table filter helpers', () => {
  it('matches search across configured fields', () => {
    expect(matchesSearchQuery(rows[0], 'acme', ['name'])).toBe(true);
    expect(matchesSearchQuery(rows[1], 'acme', ['name'])).toBe(false);
    expect(matchesSearchQuery(rows[0], '', ['name'])).toBe(true);
  });

  it('matches select filter with all sentinel', () => {
    expect(matchesSelectFilter(rows[0], 'status', 'all')).toBe(true);
    expect(matchesSelectFilter(rows[0], 'status', 'ACTIVE')).toBe(true);
    expect(matchesSelectFilter(rows[1], 'status', 'ACTIVE')).toBe(false);
  });

  it('filters rows by search and select filters together', () => {
    const filtered = filterTableRows(rows, {
      search: 'a',
      searchFields: ['name'],
      selectFilters: [{ field: 'status', value: 'ACTIVE' }],
    });
    expect(filtered.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('sorts rows ascending and descending', () => {
    expect(sortTableRows(rows, 'name', 'asc').map((r) => r.name)).toEqual([
      'Acme Corp',
      'Beta LLC',
      'Gamma Inc',
    ]);
    expect(sortTableRows(rows, 'name', 'desc')[0]?.name).toBe('Gamma Inc');
  });
});
