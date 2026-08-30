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

export function writeSideNavCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIDE_NAV_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}
