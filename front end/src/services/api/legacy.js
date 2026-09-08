'use strict';

export async function getTeamUser(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/team-users/${id}`, { headers });
  return parseApiResponse(res);
}

export async function getInbox(teamId, filter, phoneNumberId, limit = 20, offset = 0, search = '', filters = {}) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  if (filter) params.append('filter', filter);
  if (phoneNumberId) params.append('phoneNumberId', phoneNumberId);
  if (search) params.append('search', search);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.assigneeId) params.append('assigneeId', filters.assigneeId);
  params.append('limit', limit);
  params.append('offset', offset);
  const url = `/api/inbox?${params.toString()}`;
  const headers = getAuthHeaders();
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || `Inbox request failed (${res.status})`);
  return parseApiResponse(res);
}
export async function getInboxCounts(teamId, phoneNumberId = null, filters = {}) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  if (phoneNumberId) params.append('phoneNumberId', phoneNumberId);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.assigneeId) params.append('assigneeId', filters.assigneeId);
  const url = `/api/inbox/counts?${params.toString()}`;
  const headers = getAuthHeaders();
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || `Inbox counts request failed (${res.status})`);
  return parseApiResponse(res);
}
export async function getTemplates(phoneNumberId) {
  const headers = getAuthHeaders();
  const params = new URLSearchParams();
  if (phoneNumberId) params.append('phoneNumberId', phoneNumberId);
  const url = `/api/templates?${params.toString()}`;
  const res = await fetch(url, { headers });
  return parseApiResponse(res);
}

export async function starTemplate(name) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/templates/${name}/star`, {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function unstarTemplate(name) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/templates/${name}/star`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function deleteTemplate(name, hsmId, phoneNumberId) {
  const headers = getAuthHeaders();
  const params = new URLSearchParams();
  if (name) params.append('name', name);
  if (hsmId) params.append('hsm_id', hsmId);
  if (phoneNumberId) params.append('phoneNumberId', phoneNumberId);

  const res = await fetch(`/api/templates?${params.toString()}`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function createTemplate(templateData) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/templates', {
    method: 'POST',
    headers,
    body: JSON.stringify(templateData),
  });
  return parseApiResponse(res);
}

// ─── Template Folders ────────────────────────────────────────────────────────

export async function getTemplateFolders() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/templates/folders', { headers });
  return parseApiResponse(res);
}

export async function createTemplateFolder(name, color, emoji) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/templates/folders', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, color, emoji }),
  });
  return parseApiResponse(res);
}

export async function updateTemplateFolder(id, updates) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/templates/folders/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  return parseApiResponse(res);
}

export async function deleteTemplateFolder(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/templates/folders/${id}`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function assignTemplateToFolder(templateName, folderName) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/templates/${templateName}/group`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ group: folderName }),
  });
  return parseApiResponse(res);
}

export async function sendTestTemplate(to, templateName, languageCode, components, phoneNumberId) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/templates/send-test', {
    method: 'POST',
    headers,
    body: JSON.stringify({ to, templateName, languageCode, components, phoneNumberId }),
  });
  return parseApiResponse(res);
}

export async function getMessages(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/messages`, { headers });
  return parseApiResponse(res);
}

export async function getConversationContact(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/contact`, { headers });
  return parseApiResponse(res);
}

export async function markAsRead(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/read`, {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function updateConversationLeadStage(conversationId, stageId, teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`/api/conversations/${conversationId}/lead-stage${qs}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ stageId }),
  });
  return parseApiResponse(res);
}

export async function getNotes(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/notes?actorRole=agent`, { headers });
  return parseApiResponse(res);
}

export async function createNote(conversationId, authorUserId, body) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ actorRole: 'agent', authorUserId, body }),
  });
  return parseApiResponse(res);
}

export async function updateNote(conversationId, noteId, body) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/notes/${noteId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ body }),
  });
  return parseApiResponse(res);
}

export async function deleteNote(conversationId, noteId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/notes/${noteId}`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function getConversationActivity(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/activity`, { headers });
  return parseApiResponse(res);
}

export async function claimConversation(conversationId, teamId, userId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, teamId, userId }),
  });
  return parseApiResponse(res);
}

export async function reassignConversation(conversationId, teamId, newAssigneeUserId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/reassign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, teamId, newAssigneeUserId }),
  });
  return parseApiResponse(res);
}

export async function reassignExternalLead(leadId, newSalesPersonId) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/settings/integrations/xolox-crm/reassign', {
    method: 'POST',
    headers,
    body: JSON.stringify({ leadId, newSalesPersonId })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'XOLOX reassignment failed');
  return data;
}

export async function releaseConversation(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/release`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId }),
  });
  return parseApiResponse(res);
}

export async function sendText(conversationId, text) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/whatsapp/text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, text }),
  });
  return parseApiResponse(res);
}

export async function sendMedia(conversationId, kind, link, caption) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/whatsapp/media`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, kind, link, caption }),
  });
  return parseApiResponse(res);
}

export async function sendTemplate(conversationId, name, languageCode, components) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/whatsapp/template`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, name, languageCode, components }),
  });
  return parseApiResponse(res);
}

export async function retryTemplateMessage(messageId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/whatsapp/messages/${messageId}/retry`, {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function sendInteractive(conversationId, interactive) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/whatsapp/interactive`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, interactive }),
  });
  return parseApiResponse(res);
}

export async function uploadMedia(conversationId, file) {
  const headers = getAuthHeaders(null); // No Content-Type for FormData
  const formData = new FormData();
  formData.append('conversationId', conversationId);
  formData.append('file', file);

  const res = await fetch('/api/whatsapp/upload', {
    method: 'POST',
    headers,
    body: formData,
  });
  return parseApiResponse(res);
}

export async function uploadFlowMedia(file) {
  const headers = getAuthHeaders(null); // No Content-Type for FormData
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/templates/upload-test-media', {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Upload failed');
  }
  return parseApiResponse(res);
}

export async function fetchMediaLibrary(limit = 20) {
  const headers = getAuthHeaders();
  const params = new URLSearchParams();
  if (limit) params.append('limit', String(limit));
  const res = await fetch(`/api/whatsapp/media-library?${params.toString()}`, {
    method: 'GET',
    headers,
  });
  return parseApiResponse(res);
}

export async function uploadTemplateExampleMedia(file) {
  const headers = getAuthHeaders(null); // No Content-Type for FormData
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/templates/upload-example', {
    method: 'POST',
    headers,
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      'Template media upload failed';
    throw new Error(msg);
  }
  return json;
}

export async function uploadTemplateTestMedia(file) {
  const headers = getAuthHeaders(null); // No Content-Type for FormData
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/templates/upload-test-media', {
    method: 'POST',
    headers,
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      'Template test media upload failed';
    throw new Error(msg);
  }
  return json;
}

export async function resolveConversation(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ status: 'closed' }),
  });
  return parseApiResponse(res);
}

export async function blockConversation(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/block`, {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function unblockConversation(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/unblock`, {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function deleteConversation(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function pinConversation(conversationId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/pin`, {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function getDashboardData(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const url = `/api/dashboard?${params.toString()}`;
  const headers = getAuthHeaders();
  const res = await fetch(url, { headers, cache: 'no-store' });
  return parseApiResponse(res);
}

export async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseApiResponse(res);
}

export async function customerLogin(email, password) {
  const res = await fetch('/api/auth/customer/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseApiResponse(res);
}

export async function adminLogin(email, password) {
  const res = await fetch('/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseApiResponse(res);
}

export async function requestPasswordReset(email) {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseApiResponse(res);
}

export async function resetPassword(token, password) {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  return parseApiResponse(res);
}

export async function logout(accountType = 'customer') {
  const endpoint = accountType === 'admin' ? '/api/auth/admin/logout' : '/api/auth/customer/logout';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function verifyTwoFactor(mfaToken, code) {
  const res = await fetch('/api/auth/verify-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken, code }),
  });
  return parseApiResponse(res);
}

export async function getMyProfile() {
  const res = await fetch('/api/auth/me', {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  return parseApiResponse(res);
}

export async function updateMyProfile(data) {
  const res = await fetch('/api/auth/me', {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function setupTwoFactor() {
  const res = await fetch('/api/auth/2fa/setup', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function confirmTwoFactor(code) {
  const res = await fetch('/api/auth/2fa/confirm', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ code }),
  });
  return parseApiResponse(res);
}

export async function disableTwoFactor(code) {
  const res = await fetch('/api/auth/2fa/disable', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ code }),
  });
  return parseApiResponse(res);
}

export async function completeOnboarding() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/auth/onboarding', {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function getTeamUsers() {
  const res = await fetch('/api/settings/integrations/xolox-crm/team-users', {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Connect XOLOX CRM to load its users');
  return data;
}

export async function getLocalTeamUsers() {
  const res = await fetch('/api/team-users', {
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function createTeamUser(data) {
  const res = await fetch('/api/team-users', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateTeamUser(id, data) {
  const headers = getAuthHeaders();
  // Using local API instead of external since we just implemented it locally
  const res = await fetch(`/api/team-users/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function deleteTeamUser(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/team-users/${id}`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function getWorkflows() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/workflows', { headers });
  return parseApiResponse(res);
}

export async function getWorkflowStageContext(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/${id}/stage-context`, { headers });
  return parseApiResponse(res);
}

export async function getTemplatesByNames(names, phoneNumberId) {
  const headers = getAuthHeaders();
  const params = new URLSearchParams();
  if (Array.isArray(names) && names.length) params.append('names', names.join(','));
  if (phoneNumberId) params.append('phoneNumberId', phoneNumberId);
  const res = await fetch(`/api/templates/by-names?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

export async function getWorkflowSequence(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/${id}/sequence`, { headers });
  return parseApiResponse(res);
}

export async function getWorkflow(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/${id}`, { headers });
  return parseApiResponse(res);
}

export async function getWorkflowsKanban(teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`/api/workflows/kanban${qs}`, { headers });
  return parseApiResponse(res);
}

export async function assignWorkflowToStage(stageId, workflowId) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/workflows/kanban/assign', {
    method: 'POST',
    headers,
    body: JSON.stringify({ stageId, workflowId }),
  });
  return parseApiResponse(res);
}

export async function reorderStageWorkflows(moves) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/workflows/kanban/reorder', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ moves }),
  });
  return parseApiResponse(res);
}
export async function getLeadStages(teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`/api/settings/lead-stages${qs}`, { headers });
  return parseApiResponse(res);
}

export async function createLeadStage(data, teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`/api/settings/lead-stages${qs}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateLeadStage(id, data, teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`/api/settings/lead-stages/${id}${qs}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function deleteLeadStage(id, teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  await fetch(`/api/settings/lead-stages/${id}${qs}`, {
    method: 'DELETE',
    headers,
  });
}

export async function getWorkingHours(teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`/api/settings/working-hours${qs}`, {
    headers,
  });
  return parseApiResponse(res);
}

export async function saveWorkingHours(data, teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`/api/settings/working-hours${qs}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function getGenericIntegrationSettings(teamId, search = '') {
  const headers = getAuthHeaders();
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  if (search.trim()) params.set('search', search.trim());
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/api/settings/integrations${qs}`, {
    headers,
    cache: 'no-store',
  });
  return parseApiResponse(res);
}

export async function updateGenericIntegrationSettings(providerId, data, teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`/api/settings/integrations/${encodeURIComponent(providerId)}${qs}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || json.error || 'Failed to save integration settings');
  }
  return json;
}

export async function testGenericIntegration(providerId, teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`/api/settings/integrations/${encodeURIComponent(providerId)}/test${qs}`, {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function disconnectGenericIntegration(providerId, teamId) {
  const headers = getAuthHeaders();
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`/api/settings/integrations/${encodeURIComponent(providerId)}${qs}`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function getRules() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/rules', { headers });
  return parseApiResponse(res);
}

export async function createRule(data) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/rules', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateRule(id, data) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/rules/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function deleteRule(id) {
  const headers = getAuthHeaders();
  await fetch(`/api/rules/${id}`, {
    method: 'DELETE',
    headers,
  });
}

export async function createWorkflow(data) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/workflows', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateWorkflow(id, data) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function publishWorkflow(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/${id}/publish`, {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function retryWorkflowRun(id, runId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/${id}/runs/${runId}/retry`, {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function getWorkflowRuns(id, limit = 50, offset = 0) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/${id}/runs?limit=${limit}&offset=${offset}`, { headers });
  return parseApiResponse(res);
}

export async function deleteWorkflow(id) {
  const headers = getAuthHeaders();
  await fetch(`/api/workflows/${id}`, {
    method: 'DELETE',
    headers,
  });
}

export async function runWorkflow(id, phoneNumber) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/${id}/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phoneNumber }),
  });
  return parseApiResponse(res);
}

export async function syncXoloxAssignments(teamId) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/conversations/sync-xolox-assignments', {
    method: 'POST',
    headers,
    body: JSON.stringify({ teamId }),
  });
  return parseApiResponse(res);
}

export async function aiGenerateWorkflow(description) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/workflows/ai/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ description }),
  });
  return parseApiResponse(res);
}

export async function testZoomConnection(data) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/workflows/test-zoom', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function listWhatsappFlows() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/whatsapp/flows', {
    method: 'GET',
    headers,
  });
  if (!res.ok) {
    throw new Error('Failed to load flows');
  }
  const data = await res.json();
  return data && data.data ? data.data : [];
}

export async function syncWhatsappFlows() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/whatsapp/flows/sync', {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    throw new Error('Failed to sync flows');
  }
  return parseApiResponse(res);
}

export async function createWhatsappFlow(payload) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/whatsapp/flows', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = '';
    let details = null;
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json && json.details) {
          details = json.details;
        }
        message = (json && (json.message || json.error)) || text;
      } catch {
        message = text;
      }
    } catch {
    }
    const err = new Error(message || 'Failed to create flow');
    if (details) {
      err.details = details;
    }
    throw err;
  }
  return parseApiResponse(res);
}

export async function updateWhatsappFlow(id, payload) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/whatsapp/flows/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = '';
    let details = null;
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json && json.details) {
          details = json.details;
        }
        message = (json && (json.message || json.error)) || text;
      } catch {
        message = text;
      }
    } catch {
    }
    const err = new Error(message || 'Failed to update flow');
    if (details) {
      err.details = details;
    }
    throw err;
  }
  return parseApiResponse(res);
}

export async function forceReassignConversation(conversationId, teamId, newAssigneeUserId) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/conversations/reassign', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      conversationId,
      teamId,
      newAssigneeUserId,
      actorRole: 'admin' // Force admin role
    }),
  });
  return parseApiResponse(res);
}

export async function registerWorkspace(payload) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiResponse(res);
}

export async function verifyEmail(token) {
  const res = await fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return parseApiResponse(res);
}

export async function resendVerification(email) {
  const res = await fetch('/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseApiResponse(res);
}

export async function acceptWorkspaceInvite(payload) {
  const res = await fetch('/api/auth/invites/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseApiResponse(res);
}

export async function getTeamOrganization() {
  const res = await fetch('/api/team-management/organization', { headers: getAuthHeaders(), cache: 'no-store' });
  return parseApiResponse(res);
}

export async function getWorkspaceMembers(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') query.set(key, String(value));
  });
  const res = await fetch(`/api/team-management/members?${query.toString()}`, { headers: getAuthHeaders(), cache: 'no-store' });
  return parseApiResponse(res);
}

export async function getWorkspaceInvites(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') query.set(key, String(value));
  });
  const res = await fetch(`/api/team-management/invites?${query.toString()}`, { headers: getAuthHeaders(), cache: 'no-store' });
  return parseApiResponse(res);
}

export async function createDepartment(data) {
  const res = await fetch('/api/team-management/departments', {
    method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateDepartment(id, data) {
  const res = await fetch(`/api/team-management/departments/${id}`, {
    method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function deleteDepartment(id) {
  const res = await fetch(`/api/team-management/departments/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function createOrganizationTeam(data) {
  const res = await fetch('/api/team-management/teams', {
    method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateOrganizationTeam(id, data) {
  const res = await fetch(`/api/team-management/teams/${id}`, {
    method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function deleteOrganizationTeam(id) {
  const res = await fetch(`/api/team-management/teams/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function createWorkspaceInvite(data) {
  const res = await fetch('/api/team-management/invites', {
    method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function resendWorkspaceInvite(id) {
  const res = await fetch(`/api/team-management/invites/${id}/resend`, {
    method: 'POST', headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function revokeWorkspaceInvite(id) {
  const res = await fetch(`/api/team-management/invites/${id}`, {
    method: 'DELETE', headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function updateWorkspaceMemberRole(id, workspaceRoleKey) {
  const res = await fetch(`/api/team-management/members/${id}/role`, {
    method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ workspaceRoleKey }),
  });
  return parseApiResponse(res);
}

export async function updateWorkspaceMemberStatus(id, active) {
  const res = await fetch(`/api/team-management/members/${id}/status`, {
    method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ active }),
  });
  return parseApiResponse(res);
}

export async function getAdminWorkflowMonitor(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const res = await fetch(`/api/admin/operations/workflows?${query}`, { headers: getAuthHeaders(), cache: 'no-store' });
  return parseApiResponse(res);
}

export async function getAdminOperationsDashboard() {
  const res = await fetch('/api/admin/operations/dashboard', {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  const body = await parseApiResponse(res);
  if (!res.ok || body?.success === false || !body?.summary) {
    throw new Error(body?.message || body?.error || 'Dashboard data is unavailable');
  }
  return body;
}

export async function getAdminOperationsReports(days = 30) {
  const safeDays = [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30;
  const res = await fetch(`/api/admin/operations/reports?days=${safeDays}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  const body = await parseApiResponse(res);
  if (!res.ok || body?.success === false || !body?.summary) {
    throw new Error(body?.message || body?.error || 'Admin reports are unavailable');
  }
  return body;
}

export async function getAdminSystemHealth() {
  const res = await fetch('/api/admin/operations/health', {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  const body = await parseApiResponse(res);
  if (!body || typeof body.score !== 'number') {
    throw new Error(body?.message || body?.error || 'System health is unavailable');
  }
  return body;
}

export async function setAdminWorkflowStatus(id, status) {
  const res = await fetch(`/api/admin/operations/workflows/${id}/status`, {
    method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status }),
  });
  return parseApiResponse(res);
}

export async function retryAdminWorkflowRun(id) {
  const res = await fetch(`/api/admin/operations/workflow-runs/${id}/retry`, {
    method: 'POST', headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function changeMyPassword(currentPassword, newPassword) {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return parseApiResponse(res);
}

export async function getAdminWorkspaces({ page = 1, limit = 20, search = '', status = 'all' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  if (status && status !== 'all') params.set('status', status);
  const res = await fetch(`/api/admin/operations/workspaces?${params.toString()}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  return parseApiResponse(res);
}

export async function getAdminIntegrationMonitor({ page = 1, limit = 20, search = '', provider = 'all' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  if (provider && provider !== 'all') params.set('provider', provider);
  const res = await fetch(`/api/admin/operations/integrations?${params.toString()}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  return parseApiResponse(res);
}

function getAuthHeaders(contentType = 'application/json') {
  let token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  const user = localStorage.getItem('user');

  const decodeJwt = (jwtToken) => {
    try {
      const parts = String(jwtToken || '').split('.');
      if (parts.length < 2) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      const json = decodeURIComponent(
        atob(padded)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  };

  const decoded = token ? decodeJwt(token) : null;

  let role = 'agent';
  let teamId = null;
  if (user) {
    try {
      const u = JSON.parse(user);
      role = u.role || 'agent';
      const activeTeamId = localStorage.getItem('activeTeamId');
      const memberships = Array.isArray(u.teamIds) ? u.teamIds.map(String) : [];
      if (activeTeamId && memberships.includes(activeTeamId)) teamId = activeTeamId;
      if (!teamId && u.teamId) teamId = u.teamId;
      if (!teamId && Array.isArray(u.teamIds) && u.teamIds.length > 0) teamId = u.teamIds[0];
    } catch (e) { }
  }
  if (!teamId && decoded) {
    if (decoded.teamId) teamId = decoded.teamId;
    if (!teamId && decoded.team_id) teamId = decoded.team_id;
    if (!teamId && Array.isArray(decoded.team_ids) && decoded.team_ids.length > 0) teamId = decoded.team_ids[0];
  }
  if (decoded && (!user || !role)) {
    role = decoded.role || role;
  }

  const headers = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-user-role'] = role;
    // Keep list endpoints (including campaigns) scoped to the same workspace
    // the signed-in user is currently operating in. The backend verifies this
    // membership before trusting the header.
    if (teamId) headers['x-team-id'] = String(teamId);
  } else {
    console.warn('API call made without authentication token');
  }
  return headers;
}

// Drop-in replacement for `res.json()` across this file. Preserves the exact
// success-path shape (just the parsed JSON, nothing added) so no caller's behavior changes.
// On a non-2xx response it does NOT throw (many callers here don't wrap calls in try/catch
// and instead check `res.error`/`res.success` themselves) — it returns the parsed body with
// `error`/`message`/`success` normalized so the specific backend reason always wins over a
// generic HTTP-status label, instead of the `json.error || json.message` priority bug that
// has recurred multiple times in this file (message is the specific one; error is often just
// the generic status label like "Bad Request").
async function parseApiResponse(res) {
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (res.ok) return json;
  if (res.status === 401) {
    // Stop the app from continuing with a stale browser session. App.jsx owns
    // the actual redirect so API helpers remain usable from every screen.
    window.dispatchEvent(new CustomEvent('greeto:unauthorized'));
  }
  const reason = (json && (json.message || json.error)) || `Request failed (${res.status})`;
  return { ...(json || {}), success: false, error: reason, message: reason };
}

export async function getContacts(page = 1, limit = 10, search = "", filters = {}) {
  const headers = getAuthHeaders();
  const params = new URLSearchParams();
  if (page) params.append("page", page);
  if (limit) params.append("limit", limit);
  if (search) params.append("search", search);
  if (filters.leadStage) params.append("leadStage", filters.leadStage);
  if (filters.leadStatus) params.append("leadStatus", filters.leadStatus);
  if (filters.course) params.append("course", filters.course);
  if (filters.assignedTo) params.append("assignedTo", filters.assignedTo);
  if (filters.source && filters.source !== 'all') params.append("source", filters.source);
  
  const res = await fetch(`/api/contacts?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

export async function deleteContact(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/contacts/${id}`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function putContact(id, data) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/contacts/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateWorkflowDelay(stageId, workflowId, delayMinutes, isIndependent, targetTime) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/workflows/kanban/delay`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ stageId, workflowId, delayMinutes, isIndependent, targetTime }),
  });
  return parseApiResponse(res);
}

export async function getScheduledTasks(conversationId, contactPhone, limit = 10) {
  const headers = getAuthHeaders();
  const params = new URLSearchParams();
  if (conversationId) params.append('conversationId', conversationId);
  if (contactPhone) params.append('contactPhone', contactPhone);
  if (limit) params.append('limit', String(limit));
  const res = await fetch(`/api/reports/scheduled-tasks?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

export async function getLabels() {
  const res = await fetch(`/api/labels`, { headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function getEmailTemplates() {
  const res = await fetch(`/api/email-templates`, { headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function createEmailTemplate(data) {
  const res = await fetch(`/api/email-templates`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateEmailTemplate(id, data) {
  const res = await fetch(`/api/email-templates/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function deleteEmailTemplate(id) {
  const res = await fetch(`/api/email-templates/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}
export async function createLabel(name) {
  const res = await fetch(`/api/labels`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  return parseApiResponse(res);
}

export async function deleteLabel(id) {
  const res = await fetch(`/api/labels/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function getContactChannels() {
  const res = await fetch(`/api/contacts/channels`, { headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function addContact(data) {
  const res = await fetch(`/api/contacts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function importContactsBulk(channel_id, contacts) {
  const res = await fetch(`/api/contacts/import-bulk`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ channel_id, contacts }),
  });
  return parseApiResponse(res);
}

export async function createLabelWithContacts(name, contact_ids) {
  const res = await fetch(`/api/labels`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, contact_ids }),
  });
  return parseApiResponse(res);
}

export async function addContactsToLabel(labelId, contact_ids) {
  const res = await fetch(`/api/labels/${labelId}/contacts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ contact_ids }),
  });
  return parseApiResponse(res);
}

export async function getLabelContacts(labelId) {
  const res = await fetch(`/api/labels/${labelId}/contacts`, { headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function getCampaigns() {
  const res = await fetch('/api/campaigns', { headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function createCampaign(data) {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateCampaign(id, data) {
  const res = await fetch(`/api/campaigns/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function getCampaignReport(id) {
  const res = await fetch(`/api/campaigns/${id}/report`, { headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function retryCampaignRecipient(campaignId, logId) {
  const res = await fetch(`/api/campaigns/${campaignId}/recipients/${logId}/retry`, {
    method: 'POST', headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function stopCampaign(id) {
  const res = await fetch(`/api/campaigns/${id}/stop`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function deleteCampaign(id) {
  const res = await fetch(`/api/campaigns/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

// ─── Webhook Trigger events ───────────────────────────────────────────────────

export async function getWebhookEvents(workflowId) {
  const res = await fetch(`/api/workflow-webhooks/${workflowId}/events`, {
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function clearWebhookEvents(workflowId) {
  const res = await fetch(`/api/workflow-webhooks/${workflowId}/events`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}
export async function createPaymentLink(data) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/payments/create-link', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.message || payload.error || 'Unable to create payment link');
  }
  return payload;
}

// ─── AI Agent ─────────────────────────────────────────────────────────────────

export async function getAiConfig() {
  const res = await fetch('/api/ai-agent/config', { headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function updateAiConfig(data) {
  const res = await fetch('/api/ai-agent/config', {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function getAiKnowledge() {
  const res = await fetch('/api/ai-agent/knowledge', { headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function addAiTextKnowledge(data) {
  const res = await fetch('/api/ai-agent/knowledge/text', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function deleteAiKnowledge(id) {
  const res = await fetch(`/api/ai-agent/knowledge/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}

export async function uploadAiDocument(file, title) {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  
  const headers = getAuthHeaders();
  delete headers['Content-Type']; // Let browser set multipart boundary

  const res = await fetch('/api/ai-agent/knowledge/upload', {
    method: 'POST',
    headers,
    body: formData,
  });
  return parseApiResponse(res);
}

export async function testAiAgent(message) {
  const res = await fetch('/api/ai-agent/test', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message }),
  });
  return parseApiResponse(res);
}

export async function toggleAiForConversation(conversationId, isActive) {
  const res = await fetch(`/api/conversations/${conversationId}/ai-status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ is_active: isActive }),
  });
  return parseApiResponse(res);
}

export async function getWhatsAppSettings(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/whatsapp?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

export async function updateWhatsAppSettings(data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/whatsapp?${params.toString()}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}
export async function getTranslationSetting() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/settings/translation', { headers });
  return parseApiResponse(res);
}

export async function updateTranslationSetting(enabled) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/settings/translation', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ enabled }),
  });
  return parseApiResponse(res);
}

export async function onboardWhatsApp(payload, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  
  const body = typeof payload === 'string' 
    ? { accessToken: payload } 
    : payload;

  const res = await fetch(`/api/auth/whatsapp/onboard?${params.toString()}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return parseApiResponse(res);
}


export async function disconnectWhatsApp(phoneNumberId, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/whatsapp/${phoneNumberId}?${params.toString()}`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function patchWhatsAppSettings(phoneNumberId, data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const res = await fetch(`/api/settings/whatsapp/${encodeURIComponent(phoneNumberId)}?${params.toString()}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function setPrimaryWhatsAppNumber(phoneNumberId, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const res = await fetch(`/api/settings/whatsapp/${encodeURIComponent(phoneNumberId)}/primary?${params.toString()}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  return parseApiResponse(res);
}
export async function getTelegramSettings(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/auth/telegram/settings?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

export async function connectTelegram(botToken, displayName, teamId) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/auth/telegram/connect', {
    method: 'POST',
    headers,
    body: JSON.stringify({ botToken, displayName, teamId })
  });
  return parseApiResponse(res);
}

export async function disconnectTelegram(settingId, teamId) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/auth/telegram/disconnect/id/${encodeURIComponent(settingId)}?teamId=${encodeURIComponent(teamId || '')}`, {
    method: 'DELETE',
    headers
  });
  return parseApiResponse(res);
}

// ─── Instagram ────────────────────────────────────────────────────────────────

export async function connectInstagram(accessToken) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/auth/instagram/connect', {
    method: 'POST',
    headers,
    body: JSON.stringify({ accessToken }),
  });
  return parseApiResponse(res);
}

export async function connectInstagramManually(pageAccessToken, pageId) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/auth/instagram/connect-env', {
    method: 'POST',
    headers,
    body: JSON.stringify({ pageAccessToken, pageId }),
  });
  return parseApiResponse(res);
}

export async function getInstagramAppSettings() {
  const res = await fetch('/api/auth/instagram/settings', { headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function saveInstagramAppSettings(settings) {
  const res = await fetch('/api/auth/instagram/settings', {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(settings),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save Instagram app settings');
  return data;
}

export async function getInstagramStatus() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/auth/instagram/status', { headers });
  return parseApiResponse(res);
}

export async function disconnectInstagram(channelId) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/auth/instagram/disconnect', {
    method: 'POST',
    headers,
    body: JSON.stringify({ channelId }),
  });
  return parseApiResponse(res);
}

export async function sendInstagramText(conversationId, text) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/instagram/text', {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, text }),
  });
  return parseApiResponse(res);
}

export async function sendInstagramMedia(conversationId, kind, url, caption) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/instagram/media', {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, kind, url, caption }),
  });
  return parseApiResponse(res);
}

export async function createLabelFromCsv(name, file) {
  const form = new FormData();
  form.append('name', name);
  form.append('file', file);
  const headers = getAuthHeaders(null);
  const res = await fetch('/api/labels/csv', { method: 'POST', headers, body: form });
  return parseApiResponse(res);
}

export async function getWorkspaceLoginPolicy() {
  const res = await fetch('/api/team-management/login-policy', { headers: getAuthHeaders() });
  return parseApiResponse(res);
}

export async function updateWorkspaceLoginPolicy(loginSource) {
  const res = await fetch('/api/team-management/login-policy', {
    method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ loginSource }),
  });
  return parseApiResponse(res);
}

export async function sendMessengerText(conversationId, text) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/messenger/text', {
    method: 'POST', headers, body: JSON.stringify({ conversationId, text }),
  });
  return parseApiResponse(res);
}

export async function sendMessengerMedia(conversationId, kind, url, caption) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/messenger/media', {
    method: 'POST', headers, body: JSON.stringify({ conversationId, kind, url, caption }),
  });
  return parseApiResponse(res);
}

export async function getInstagramAutomations() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/instagram/automations', { headers });
  return parseApiResponse(res);
}

export async function createInstagramAutomation(data) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/instagram/automations', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateInstagramAutomation(id, data) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/instagram/automations/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function deleteInstagramAutomation(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/instagram/automations/${id}`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function toggleInstagramAutomation(id) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/instagram/automations/${id}/toggle`, {
    method: 'POST',
    headers,
  });
  return parseApiResponse(res);
}

export async function getInstagramMedia(channelId, after = null) {
  const headers = getAuthHeaders();
  let url = `/api/instagram/media-list?channelId=${channelId}`;
  if (after) url += `&after=${after}`;
  const res = await fetch(url, { headers });
  return parseApiResponse(res);
}
export async function getRazorpaySettings(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/razorpay?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

export async function updateRazorpaySettings(data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/razorpay?${params.toString()}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.message || payload.error || 'Unable to save Razorpay settings');
  }
  return payload;
}
export async function getWhatsAppAppSettings(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const res = await fetch(`/api/settings/whatsapp-app?${params.toString()}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load Meta app settings');
  return parseApiResponse(res);
}

export async function updateWhatsAppAppSettings(data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const res = await fetch(`/api/settings/whatsapp-app?${params.toString()}`, {
    method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || 'Failed to save Meta app settings');
  return body;
}

export async function disconnectRazorpay(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/razorpay?${params.toString()}`, {
    method: 'DELETE',
    headers,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.message || payload.error || 'Unable to disconnect Razorpay');
  }
  return payload;
}

// ─── Exotel ───────────────────────────────────────────────────────────────────

export async function getExotelSettings(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/exotel?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

export async function updateExotelSettings(data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/exotel?${params.toString()}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function disconnectExotel(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/exotel?${params.toString()}`, {
    method: 'DELETE',
    headers,
  });
  return parseApiResponse(res);
}

export async function initiateExotelCall(data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/exotel/call?${params.toString()}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function getExotelCallLogs(teamId, { limit = 25, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (teamId) params.append('teamId', teamId);
  params.append('limit', limit);
  params.append('offset', offset);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/exotel/calls?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

// ─── Twilio ───────────────────────────────────────────────────────────────────

export async function getTwilioSettings(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/twilio?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

export async function updateTwilioSettings(data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/twilio?${params.toString()}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseApiResponse(res);
}

export async function disconnectTwilio(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/twilio?${params.toString()}`, {
    method: 'DELETE', headers
  });
  return parseApiResponse(res);
}

export async function sendTwilioSms(data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/twilio/sms?${params.toString()}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseApiResponse(res);
}

export async function initiateTwilioCall(data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/twilio/call?${params.toString()}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseApiResponse(res);
}

export async function getTwilioLogs(teamId, { type, limit = 25, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  if (type) params.set('type', type);
  params.set('limit', limit);
  params.set('offset', offset);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/twilio/logs?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

// ─── Email ────────────────────────────────────────────────────────────────────

export async function getEmailSettings(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/email?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

export async function updateEmailSettings(data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/email?${params.toString()}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseApiResponse(res);
}

export async function disconnectEmail(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/email?${params.toString()}`, { method: 'DELETE', headers });
  return parseApiResponse(res);
}

export async function testEmailConnection(teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/email/test?${params.toString()}`, { method: 'POST', headers });
  return parseApiResponse(res);
}

export async function syncEmails(teamId, limit = 30) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/email/sync?${params.toString()}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit })
  });
  return parseApiResponse(res);
}

export async function sendEmailMessage(data, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/email/send?${params.toString()}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseApiResponse(res);
}

export async function getEmailMessages(teamId, { direction, search, limit = 30, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  if (direction) params.set('direction', direction);
  if (search) params.set('search', search);
  params.set('limit', limit);
  params.set('offset', offset);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/email/messages?${params.toString()}`, { headers });
  return parseApiResponse(res);
}

export async function markEmailRead(id, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/email/messages/${id}/read?${params.toString()}`, { method: 'PATCH', headers });
  return parseApiResponse(res);
}

export async function deleteEmailMessage(id, teamId) {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  const headers = getAuthHeaders();
  const res = await fetch(`/api/settings/email/messages/${id}?${params.toString()}`, { method: 'DELETE', headers });
  return parseApiResponse(res);
}

// Subscription catalog + customer billing
async function fetchJsonWithFallback(requests) {
  let lastPayload = null;
  for (const request of requests) {
    const res = await fetch(request.url, request.options);
    const payload = await res.json().catch(() => ({}));
    if (res.ok) return payload;
    lastPayload = payload;
  }
  return lastPayload || { error: 'Request failed' };
}

export async function getSubscriptionCatalog(includeInactive = false) {
  const params = new URLSearchParams();
  if (includeInactive) params.set('includeInactive', 'true');
  const headers = getAuthHeaders();
  const qs = params.toString();
  return fetchJsonWithFallback([
    { url: `/api/plans${qs ? `?${qs}` : ''}`, options: { headers, cache: 'no-store' } },
    { url: `/api/subscriptions/catalog${qs ? `?${qs}` : ''}`, options: { headers, cache: 'no-store' } },
  ]);
}

export async function getCustomerSubscription() {
  const headers = getAuthHeaders();
  return fetchJsonWithFallback([
    { url: '/api/customer/billing/subscription', options: { headers, cache: 'no-store' } },
    { url: '/api/subscriptions/current', options: { headers, cache: 'no-store' } },
  ]);
}

export async function checkoutSubscription(data) {
  const headers = getAuthHeaders();
  return fetchJsonWithFallback([
    {
      url: '/api/customer/billing/upgrade',
      options: { method: 'POST', headers, body: JSON.stringify(data) },
    },
    {
      url: '/api/subscriptions/checkout',
      options: { method: 'POST', headers, body: JSON.stringify(data) },
    },
  ]);
}

export async function cancelCustomerSubscription() {
  const headers = getAuthHeaders();
  return fetchJsonWithFallback([
    { url: '/api/customer/billing/cancel', options: { method: 'POST', headers } },
    { url: '/api/subscriptions/cancel', options: { method: 'POST', headers } },
  ]);
}

export async function reactivateCustomerSubscription() {
  const headers = getAuthHeaders();
  return fetchJsonWithFallback([
    { url: '/api/customer/billing/reactivate', options: { method: 'POST', headers } },
    { url: '/api/subscriptions/reactivate', options: { method: 'POST', headers } },
  ]);
}

export async function cancelScheduledUpgrade() {
  const headers = getAuthHeaders();
  return fetchJsonWithFallback([
    { url: '/api/customer/billing/cancel-scheduled', options: { method: 'POST', headers } },
    { url: '/api/subscriptions/cancel-scheduled', options: { method: 'POST', headers } },
  ]);
}

export async function getBillingPortalUrl(returnUrl) {
  const headers = getAuthHeaders();
  return fetchJsonWithFallback([
    { url: '/api/customer/billing/portal', options: { method: 'POST', headers, body: JSON.stringify({ returnUrl }) } },
    { url: '/api/subscriptions/portal', options: { method: 'POST', headers, body: JSON.stringify({ returnUrl }) } },
  ]);
}

export async function getPaymentMethods() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/checkout/methods', { headers, cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || 'Unable to load payment methods.');
  return body.gateways || {};
}

export async function createSubscriptionOrder(data) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/checkout/create-order', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || 'Unable to start checkout.');
  return body;
}

export async function verifySubscriptionPayment(data) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/checkout/verify-payment', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || 'Payment verification failed.');
  return body;
}

export async function getAdminSubscriptionPlans() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/subscriptions/admin/plans', { headers, cache: 'no-store' });
  return parseApiResponse(res);
}

export async function createAdminSubscriptionPlan(data) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/subscriptions/admin/plans', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function updateAdminSubscriptionPlan(id, data) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/subscriptions/admin/plans/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function deactivateAdminSubscriptionPlan(id, data = {}) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/subscriptions/admin/plans/${id}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify(data),
  });
  return parseApiResponse(res);
}

export async function getAdminAuditLogs(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  const headers = getAuthHeaders();
  const res = await fetch(`/api/admin/access-control/audit-logs?${params.toString()}`, {
    headers,
    cache: 'no-store',
  });
  return parseApiResponse(res);
}

async function accessControlRequest(method, path, body) {
  const headers = getAuthHeaders();
  const res = await fetch(`/api/admin/access-control${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export async function getAccessControlRoles() {
  return accessControlRequest('GET', '/roles');
}
export async function createAccessControlRole(payload) {
  return accessControlRequest('POST', '/roles', payload);
}
export async function updateAccessControlRole(id, payload) {
  return accessControlRequest('PATCH', `/roles/${id}`, payload);
}
export async function deleteAccessControlRole(id, reason) {
  return accessControlRequest('DELETE', `/roles/${id}`, { reason });
}
export async function getAccessControlPermissions() {
  return accessControlRequest('GET', '/permissions');
}
export async function addRolePermission(roleId, permId) {
  return accessControlRequest('POST', `/roles/${roleId}/permissions/${permId}`, {});
}
export async function removeRolePermission(roleId, permId) {
  return accessControlRequest('DELETE', `/roles/${roleId}/permissions/${permId}`, {});
}
export async function syncInternalRolePresets() {
  return accessControlRequest('POST', '/roles/internal-presets/sync', {});
}
export async function getAccessControlAdmins() {
  return accessControlRequest('GET', '/admins');
}
export async function assignAdminRole(adminId, roleId) {
  return accessControlRequest('POST', `/admins/${adminId}/roles/${roleId}`, {});
}
export async function revokeAdminRole(adminId, roleId) {
  return accessControlRequest('DELETE', `/admins/${adminId}/roles/${roleId}`, {});
}
export async function grantAdminPermission(adminId, permId) {
  return accessControlRequest('POST', `/admins/${adminId}/permissions/${permId}`, {});
}
export async function revokeAdminPermission(adminId, permId) {
  return accessControlRequest('DELETE', `/admins/${adminId}/permissions/${permId}`, {});
}
export async function getApprovalRequests(status) {
  return accessControlRequest('GET', `/approval-requests${status ? `?status=${status}` : ''}`);
}
export async function createApprovalRequest(payload) {
  return accessControlRequest('POST', '/approval-requests', payload);
}
export async function resolveApprovalRequest(id, type, note) {
  return accessControlRequest('POST', `/approval-requests/${id}/${type}`, { note });
}
export async function runSecurityAudit() {
  return accessControlRequest('POST', '/security-audit', {});
}

export async function syncXoloxContacts(page = 1, limit = 100, full = false) {
  const headers = getAuthHeaders();
  const res = await fetch('/api/contacts/sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({ page, limit, full })
  });
  return parseApiResponse(res);
}

export async function getXoloxSyncStatus() {
  const headers = getAuthHeaders();
  const res = await fetch('/api/contacts/sync/status', {
    headers
  });
  return parseApiResponse(res);
}
export async function postWebhookSample(workflowId, payload) {
  const headers = getAuthHeaders();
  headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api/workflow-webhooks/${workflowId}/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  return parseApiResponse(res);
}
