export type TableRow = Record<string, unknown>;

export function matchesSearchQuery(row: TableRow, query: string, fields: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => {
    const value = row[field];
    if (value == null) return false;
    return String(value).toLowerCase().includes(q);
  });
}

export function matchesSelectFilter(
  row: TableRow,
  field: string,
  selected: string,
  allValue = 'all',
): boolean {
  if (!selected || selected === allValue) return true;
  return String(row[field] ?? '') === selected;
}

export function filterTableRows<T extends TableRow>(
  rows: T[],
  options: {
    search?: string;
    searchFields?: string[];
    selectFilters?: Array<{ field: string; value: string; allValue?: string }>;
  },
): T[] {
  const { search = '', searchFields = [], selectFilters = [] } = options;
  return rows.filter((row) => {
    if (!matchesSearchQuery(row, search, searchFields)) return false;
    for (const filter of selectFilters) {
      if (!matchesSelectFilter(row, filter.field, filter.value, filter.allValue)) {
        return false;
      }
    }
    return true;
  });
}

export function sortTableRows<T extends TableRow>(
  rows: T[],
  field: string,
  direction: 'asc' | 'desc' = 'asc',
): T[] {
  const sorted = [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv));
  });
  return direction === 'asc' ? sorted : sorted.reverse();
}
