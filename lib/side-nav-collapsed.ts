const SIDE_NAV_COLLAPSED_KEY = 'ih.admin.sideNav.collapsed';

/** Mini icon rail is the default, matching the main app's side nav. */
export function readSideNavCollapsed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(SIDE_NAV_COLLAPSED_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

const SIDE_NAV_SECTIONS_KEY = 'ih.admin.sideNav.sections';

/** Sections the user opened or closed by hand; anything missing follows the active route. */
export function readSideNavSections(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(SIDE_NAV_SECTIONS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writeSideNavSections(sections: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIDE_NAV_SECTIONS_KEY, JSON.stringify(sections));
  } catch {
    /* ignore quota / private mode */
  }
}

export function writeSideNavCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIDE_NAV_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}
