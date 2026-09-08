import features from '../../contracts/navigation.json';
import groups from '../../contracts/navigation-groups.json';
import { allowedFeature, canonicalPage } from './policy.js';
export { features, groups };
export const getFeature = id => features.find(feature => feature.id === canonicalPage(id));
export const canAccessPage = (id, role) => allowedFeature(getFeature(id), role);
export const studioPageIds = features.filter(f => f.uiStatus === 'frontend_configuration' && f.id !== 'implementation').map(f => f.id);
export const scopeFromUser = user => ({
  tenantId: user?.tenantId || '', workspaceId: user?.workspaceId || '',
  environment: user?.environment || '', userId: user?.id || user?._id || '',
});
