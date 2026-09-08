/** Navigation is a UX guard, never a substitute for server authorization. */
export const PAGE_ALIASES = Object.freeze({payments: 'subscriptions', 'create-template': 'email-templates'});
export function canonicalPage(page) { return PAGE_ALIASES[page] || page; }
export function allowedFeature(feature, role) {
  return Boolean(feature && typeof role === 'string' && feature.roles.includes(role.toLowerCase()));
}
export function resolvePage(pathname, features) {
  const raw = String(pathname || '/').split('?')[0].split('/').filter(Boolean)[0] || 'inbox';
  const id = canonicalPage(raw);
  return features.find(f => f.id === id)?.id || 'not-found';
}
export function filterNavigation(features, role, query = '') {
  const q = query.trim().toLowerCase();
  return features.filter(f => allowedFeature(f, role) && (!q || `${f.label} ${f.description} ${f.id}`.toLowerCase().includes(q)));
}
/** IDs in a URL are selectors only. Authorization must come from the server session. */
export function selectedTask(search, tasks) {
  const id = new URLSearchParams(search).get('task');
  return tasks.find(task => task.id === id) || null;
}
