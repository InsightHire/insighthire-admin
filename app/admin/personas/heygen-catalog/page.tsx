import { redirect } from 'next/navigation';

/** Legacy vendor-named URL — keep bookmarks working. */
export default function HeygenCatalogRedirect() {
  redirect('/admin/personas/avatar-library');
}
