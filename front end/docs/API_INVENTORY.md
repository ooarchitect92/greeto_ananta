# Existing API function signatures

Observed source exports, not a live OpenAPI contract. Dynamic URL and body expressions must be reviewed in the implementation.

| Function | Parameters | Observed path literals | Actual file / line |
|---|---|---|---|
| getTeamUser | id | /api/team-users/${id} | src/services/api/legacy.js:3 |
| getInbox | teamId, filter, phoneNumberId, limit = 20, offset = 0, search = '', filters = {} | /api/inbox?${params.toString()} | src/services/api/legacy.js:9 |
| getInboxCounts | teamId, phoneNumberId = null, filters = {} | /api/inbox/counts?${params.toString()} | src/services/api/legacy.js:26 |
| getTemplates | phoneNumberId | /api/templates?${params.toString()} | src/services/api/legacy.js:39 |
| starTemplate | name | /api/templates/${name}/star | src/services/api/legacy.js:48 |
| unstarTemplate | name | /api/templates/${name}/star | src/services/api/legacy.js:57 |
| deleteTemplate | name, hsmId, phoneNumberId | /api/templates?${params.toString()} | src/services/api/legacy.js:66 |
| createTemplate | templateData | /api/templates | src/services/api/legacy.js:80 |
| getTemplateFolders |  | /api/templates/folders | src/services/api/legacy.js:92 |
| createTemplateFolder | name, color, emoji | /api/templates/folders | src/services/api/legacy.js:98 |
| updateTemplateFolder | id, updates | /api/templates/folders/${id} | src/services/api/legacy.js:108 |
| deleteTemplateFolder | id | /api/templates/folders/${id} | src/services/api/legacy.js:118 |
| assignTemplateToFolder | templateName, folderName | /api/templates/${templateName}/group | src/services/api/legacy.js:127 |
| sendTestTemplate | to, templateName, languageCode, components, phoneNumberId | /api/templates/send-test | src/services/api/legacy.js:137 |
| getMessages | conversationId | /api/conversations/${conversationId}/messages | src/services/api/legacy.js:147 |
| getConversationContact | conversationId | /api/conversations/${conversationId}/contact | src/services/api/legacy.js:153 |
| markAsRead | conversationId | /api/conversations/${conversationId}/read | src/services/api/legacy.js:159 |
| updateConversationLeadStage | conversationId, stageId, teamId | /api/conversations/${conversationId}/lead-stage${qs} | src/services/api/legacy.js:168 |
| getNotes | conversationId | /api/conversations/${conversationId}/notes?actorRole=agent | src/services/api/legacy.js:179 |
| createNote | conversationId, authorUserId, body | /api/conversations/${conversationId}/notes | src/services/api/legacy.js:185 |
| updateNote | conversationId, noteId, body | /api/conversations/${conversationId}/notes/${noteId} | src/services/api/legacy.js:195 |
| deleteNote | conversationId, noteId | /api/conversations/${conversationId}/notes/${noteId} | src/services/api/legacy.js:205 |
| getConversationActivity | conversationId | /api/conversations/${conversationId}/activity | src/services/api/legacy.js:214 |
| claimConversation | conversationId, teamId, userId | /api/conversations/claim | src/services/api/legacy.js:220 |
| reassignConversation | conversationId, teamId, newAssigneeUserId | /api/conversations/reassign | src/services/api/legacy.js:230 |
| reassignExternalLead | leadId, newSalesPersonId | /api/settings/integrations/xolox-crm/reassign | src/services/api/legacy.js:240 |
| releaseConversation | conversationId | /api/conversations/release | src/services/api/legacy.js:252 |
| sendText | conversationId, text | /api/whatsapp/text | src/services/api/legacy.js:262 |
| sendMedia | conversationId, kind, link, caption | /api/whatsapp/media | src/services/api/legacy.js:272 |
| sendTemplate | conversationId, name, languageCode, components | /api/whatsapp/template | src/services/api/legacy.js:282 |
| retryTemplateMessage | messageId | /api/whatsapp/messages/${messageId}/retry | src/services/api/legacy.js:292 |
| sendInteractive | conversationId, interactive | /api/whatsapp/interactive | src/services/api/legacy.js:301 |
| uploadMedia | conversationId, file | /api/whatsapp/upload | src/services/api/legacy.js:311 |
| uploadFlowMedia | file | /api/templates/upload-test-media | src/services/api/legacy.js:325 |
| fetchMediaLibrary | limit = 20 | /api/whatsapp/media-library?${params.toString()} | src/services/api/legacy.js:342 |
| uploadTemplateExampleMedia | file | /api/templates/upload-example | src/services/api/legacy.js:353 |
| uploadTemplateTestMedia | file | /api/templates/upload-test-media | src/services/api/legacy.js:373 |
| resolveConversation | conversationId | /api/conversations/${conversationId}/status | src/services/api/legacy.js:393 |
| blockConversation | conversationId | /api/conversations/${conversationId}/block | src/services/api/legacy.js:403 |
| unblockConversation | conversationId | /api/conversations/${conversationId}/unblock | src/services/api/legacy.js:412 |
| deleteConversation | conversationId | /api/conversations/${conversationId} | src/services/api/legacy.js:421 |
| pinConversation | conversationId | /api/conversations/${conversationId}/pin | src/services/api/legacy.js:430 |
| getDashboardData | teamId | /api/dashboard?${params.toString()} | src/services/api/legacy.js:439 |
| login | email, password | /api/auth/login | src/services/api/legacy.js:448 |
| customerLogin | email, password | /api/auth/customer/login | src/services/api/legacy.js:457 |
| adminLogin | email, password | /api/auth/admin/login | src/services/api/legacy.js:466 |
| requestPasswordReset | email | /api/auth/forgot-password | src/services/api/legacy.js:475 |
| resetPassword | token, password | /api/auth/reset-password | src/services/api/legacy.js:484 |
| logout | accountType = 'customer' | /api/auth/admin/logout, /api/auth/customer/logout | src/services/api/legacy.js:493 |
| verifyTwoFactor | mfaToken, code | /api/auth/verify-2fa | src/services/api/legacy.js:502 |
| getMyProfile |  | /api/auth/me | src/services/api/legacy.js:511 |
| updateMyProfile | data | /api/auth/me | src/services/api/legacy.js:519 |
| setupTwoFactor |  | /api/auth/2fa/setup | src/services/api/legacy.js:528 |
| confirmTwoFactor | code | /api/auth/2fa/confirm | src/services/api/legacy.js:536 |
| disableTwoFactor | code | /api/auth/2fa/disable | src/services/api/legacy.js:545 |
| completeOnboarding |  | /api/auth/onboarding | src/services/api/legacy.js:554 |
| getTeamUsers |  | /api/settings/integrations/xolox-crm/team-users | src/services/api/legacy.js:563 |
| getLocalTeamUsers |  | /api/team-users | src/services/api/legacy.js:572 |
| createTeamUser | data | /api/team-users | src/services/api/legacy.js:579 |
| updateTeamUser | id, data | /api/team-users/${id} | src/services/api/legacy.js:588 |
| deleteTeamUser | id | /api/team-users/${id} | src/services/api/legacy.js:599 |
| getWorkflows |  | /api/workflows | src/services/api/legacy.js:608 |
| getWorkflowStageContext | id | /api/workflows/${id}/stage-context | src/services/api/legacy.js:614 |
| getTemplatesByNames | names, phoneNumberId | /api/templates/by-names?${params.toString()} | src/services/api/legacy.js:620 |
| getWorkflowSequence | id | /api/workflows/${id}/sequence | src/services/api/legacy.js:629 |
| getWorkflow | id | /api/workflows/${id} | src/services/api/legacy.js:635 |
| getWorkflowsKanban | teamId | /api/workflows/kanban${qs} | src/services/api/legacy.js:641 |
| assignWorkflowToStage | stageId, workflowId | /api/workflows/kanban/assign | src/services/api/legacy.js:648 |
| reorderStageWorkflows | moves | /api/workflows/kanban/reorder | src/services/api/legacy.js:658 |
| getLeadStages | teamId | /api/settings/lead-stages${qs} | src/services/api/legacy.js:667 |
| createLeadStage | data, teamId | /api/settings/lead-stages${qs} | src/services/api/legacy.js:674 |
| updateLeadStage | id, data, teamId | /api/settings/lead-stages/${id}${qs} | src/services/api/legacy.js:685 |
| deleteLeadStage | id, teamId | /api/settings/lead-stages/${id}${qs} | src/services/api/legacy.js:696 |
| getWorkingHours | teamId | /api/settings/working-hours${qs} | src/services/api/legacy.js:705 |
| saveWorkingHours | data, teamId | /api/settings/working-hours${qs} | src/services/api/legacy.js:714 |
| getGenericIntegrationSettings | teamId, search = '' | /api/settings/integrations${qs} | src/services/api/legacy.js:725 |
| updateGenericIntegrationSettings | providerId, data, teamId | /api/settings/integrations/${encodeURIComponent(providerId)}${qs} | src/services/api/legacy.js:738 |
| testGenericIntegration | providerId, teamId | /api/settings/integrations/${encodeURIComponent(providerId)}/test${qs} | src/services/api/legacy.js:753 |
| disconnectGenericIntegration | providerId, teamId | /api/settings/integrations/${encodeURIComponent(providerId)}${qs} | src/services/api/legacy.js:763 |
| getRules |  | /api/rules | src/services/api/legacy.js:773 |
| createRule | data | /api/rules | src/services/api/legacy.js:779 |
| updateRule | id, data | /api/rules/${id} | src/services/api/legacy.js:789 |
| deleteRule | id | /api/rules/${id} | src/services/api/legacy.js:799 |
| createWorkflow | data | /api/workflows | src/services/api/legacy.js:807 |
| updateWorkflow | id, data | /api/workflows/${id} | src/services/api/legacy.js:817 |
| publishWorkflow | id | /api/workflows/${id}/publish | src/services/api/legacy.js:827 |
| retryWorkflowRun | id, runId | /api/workflows/${id}/runs/${runId}/retry | src/services/api/legacy.js:836 |
| getWorkflowRuns | id, limit = 50, offset = 0 | /api/workflows/${id}/runs?limit=${limit}&offset=${offset} | src/services/api/legacy.js:845 |
| deleteWorkflow | id | /api/workflows/${id} | src/services/api/legacy.js:851 |
| runWorkflow | id, phoneNumber | /api/workflows/${id}/run | src/services/api/legacy.js:859 |
| syncXoloxAssignments | teamId | /api/conversations/sync-xolox-assignments | src/services/api/legacy.js:869 |
| aiGenerateWorkflow | description | /api/workflows/ai/generate | src/services/api/legacy.js:879 |
| testZoomConnection | data | /api/workflows/test-zoom | src/services/api/legacy.js:889 |
| listWhatsappFlows |  | /api/whatsapp/flows | src/services/api/legacy.js:899 |
| syncWhatsappFlows |  | /api/whatsapp/flows/sync | src/services/api/legacy.js:912 |
| createWhatsappFlow | payload | /api/whatsapp/flows | src/services/api/legacy.js:924 |
| updateWhatsappFlow | id, payload | /api/whatsapp/flows/${id} | src/services/api/legacy.js:956 |
| forceReassignConversation | conversationId, teamId, newAssigneeUserId | /api/conversations/reassign | src/services/api/legacy.js:988 |
| registerWorkspace | payload | /api/auth/register | src/services/api/legacy.js:1003 |
| verifyEmail | token | /api/auth/verify-email | src/services/api/legacy.js:1012 |
| resendVerification | email | /api/auth/resend-verification | src/services/api/legacy.js:1021 |
| acceptWorkspaceInvite | payload | /api/auth/invites/accept | src/services/api/legacy.js:1030 |
| getTeamOrganization |  | /api/team-management/organization | src/services/api/legacy.js:1039 |
| getWorkspaceMembers | params = {} | /api/team-management/members?${query.toString()} | src/services/api/legacy.js:1044 |
| getWorkspaceInvites | params = {} | /api/team-management/invites?${query.toString()} | src/services/api/legacy.js:1053 |
| createDepartment | data | /api/team-management/departments | src/services/api/legacy.js:1062 |
| updateDepartment | id, data | /api/team-management/departments/${id} | src/services/api/legacy.js:1069 |
| deleteDepartment | id | /api/team-management/departments/${id} | src/services/api/legacy.js:1076 |
| createOrganizationTeam | data | /api/team-management/teams | src/services/api/legacy.js:1081 |
| updateOrganizationTeam | id, data | /api/team-management/teams/${id} | src/services/api/legacy.js:1088 |
| deleteOrganizationTeam | id | /api/team-management/teams/${id} | src/services/api/legacy.js:1095 |
| createWorkspaceInvite | data | /api/team-management/invites | src/services/api/legacy.js:1100 |
| resendWorkspaceInvite | id | /api/team-management/invites/${id}/resend | src/services/api/legacy.js:1107 |
| revokeWorkspaceInvite | id | /api/team-management/invites/${id} | src/services/api/legacy.js:1114 |
| updateWorkspaceMemberRole | id, workspaceRoleKey | /api/team-management/members/${id}/role | src/services/api/legacy.js:1121 |
| updateWorkspaceMemberStatus | id, active | /api/team-management/members/${id}/status | src/services/api/legacy.js:1128 |
| getAdminWorkflowMonitor | params = {} | /api/admin/operations/workflows?${query} | src/services/api/legacy.js:1135 |
| getAdminOperationsDashboard |  | /api/admin/operations/dashboard | src/services/api/legacy.js:1144 |
| getAdminOperationsReports | days = 30 | /api/admin/operations/reports?days=${safeDays} | src/services/api/legacy.js:1156 |
| getAdminSystemHealth |  | /api/admin/operations/health | src/services/api/legacy.js:1169 |
| setAdminWorkflowStatus | id, status | /api/admin/operations/workflows/${id}/status | src/services/api/legacy.js:1181 |
| retryAdminWorkflowRun | id | /api/admin/operations/workflow-runs/${id}/retry | src/services/api/legacy.js:1188 |
| changeMyPassword | currentPassword, newPassword | /api/auth/change-password | src/services/api/legacy.js:1195 |
| getAdminWorkspaces | { page = 1, limit = 20, search = '', status = 'all' } = {} | /api/admin/operations/workspaces?${params.toString()} | src/services/api/legacy.js:1204 |
| getAdminIntegrationMonitor | { page = 1, limit = 20, search = '', provider = 'all' } = {} | /api/admin/operations/integrations?${params.toString()} | src/services/api/legacy.js:1215 |
| getContacts | page = 1, limit = 10, search = "", filters = {} | /api/contacts?${params.toString()} | src/services/api/legacy.js:1314 |
| deleteContact | id | /api/contacts/${id} | src/services/api/legacy.js:1330 |
| putContact | id, data | /api/contacts/${id} | src/services/api/legacy.js:1339 |
| updateWorkflowDelay | stageId, workflowId, delayMinutes, isIndependent, targetTime | /api/workflows/kanban/delay | src/services/api/legacy.js:1349 |
| getScheduledTasks | conversationId, contactPhone, limit = 10 | /api/reports/scheduled-tasks?${params.toString()} | src/services/api/legacy.js:1359 |
| getLabels |  | /api/labels | src/services/api/legacy.js:1369 |
| getEmailTemplates |  | /api/email-templates | src/services/api/legacy.js:1374 |
| createEmailTemplate | data | /api/email-templates | src/services/api/legacy.js:1379 |
| updateEmailTemplate | id, data | /api/email-templates/${id} | src/services/api/legacy.js:1388 |
| deleteEmailTemplate | id | /api/email-templates/${id} | src/services/api/legacy.js:1397 |
| createLabel | name | /api/labels | src/services/api/legacy.js:1404 |
| deleteLabel | id | /api/labels/${id} | src/services/api/legacy.js:1413 |
| getContactChannels |  | /api/contacts/channels | src/services/api/legacy.js:1421 |
| addContact | data | /api/contacts | src/services/api/legacy.js:1426 |
| importContactsBulk | channel_id, contacts | /api/contacts/import-bulk | src/services/api/legacy.js:1435 |
| createLabelWithContacts | name, contact_ids | /api/labels | src/services/api/legacy.js:1444 |
| addContactsToLabel | labelId, contact_ids | /api/labels/${labelId}/contacts | src/services/api/legacy.js:1453 |
| getLabelContacts | labelId | /api/labels/${labelId}/contacts | src/services/api/legacy.js:1462 |
| getCampaigns |  | /api/campaigns | src/services/api/legacy.js:1467 |
| createCampaign | data | /api/campaigns | src/services/api/legacy.js:1472 |
| updateCampaign | id, data | /api/campaigns/${id} | src/services/api/legacy.js:1481 |
| getCampaignReport | id | /api/campaigns/${id}/report | src/services/api/legacy.js:1490 |
| retryCampaignRecipient | campaignId, logId | /api/campaigns/${campaignId}/recipients/${logId}/retry | src/services/api/legacy.js:1495 |
| stopCampaign | id | /api/campaigns/${id}/stop | src/services/api/legacy.js:1502 |
| deleteCampaign | id | /api/campaigns/${id} | src/services/api/legacy.js:1510 |
| getWebhookEvents | workflowId | /api/workflow-webhooks/${workflowId}/events | src/services/api/legacy.js:1520 |
| clearWebhookEvents | workflowId | /api/workflow-webhooks/${workflowId}/events | src/services/api/legacy.js:1527 |
| createPaymentLink | data | /api/payments/create-link | src/services/api/legacy.js:1534 |
| getAiConfig |  | /api/ai-agent/config | src/services/api/legacy.js:1550 |
| updateAiConfig | data | /api/ai-agent/config | src/services/api/legacy.js:1555 |
| getAiKnowledge |  | /api/ai-agent/knowledge | src/services/api/legacy.js:1564 |
| addAiTextKnowledge | data | /api/ai-agent/knowledge/text | src/services/api/legacy.js:1569 |
| deleteAiKnowledge | id | /api/ai-agent/knowledge/${id} | src/services/api/legacy.js:1578 |
| uploadAiDocument | file, title | /api/ai-agent/knowledge/upload | src/services/api/legacy.js:1586 |
| testAiAgent | message | /api/ai-agent/test | src/services/api/legacy.js:1602 |
| toggleAiForConversation | conversationId, isActive | /api/conversations/${conversationId}/ai-status | src/services/api/legacy.js:1611 |
| getWhatsAppSettings | teamId | /api/settings/whatsapp?${params.toString()} | src/services/api/legacy.js:1620 |
| updateWhatsAppSettings | data, teamId | /api/settings/whatsapp?${params.toString()} | src/services/api/legacy.js:1628 |
| getTranslationSetting |  | /api/settings/translation | src/services/api/legacy.js:1639 |
| updateTranslationSetting | enabled | /api/settings/translation | src/services/api/legacy.js:1645 |
| onboardWhatsApp | payload, teamId | /api/auth/whatsapp/onboard?${params.toString()} | src/services/api/legacy.js:1655 |
| disconnectWhatsApp | phoneNumberId, teamId | /api/settings/whatsapp/${phoneNumberId}?${params.toString()} | src/services/api/legacy.js:1673 |
| patchWhatsAppSettings | phoneNumberId, data, teamId | /api/settings/whatsapp/${encodeURIComponent(phoneNumberId)}?${params.toString()} | src/services/api/legacy.js:1684 |
| setPrimaryWhatsAppNumber | phoneNumberId, teamId | /api/settings/whatsapp/${encodeURIComponent(phoneNumberId)}/primary?${params.toString()} | src/services/api/legacy.js:1695 |
| getTelegramSettings | teamId | /api/auth/telegram/settings?${params.toString()} | src/services/api/legacy.js:1704 |
| connectTelegram | botToken, displayName, teamId | /api/auth/telegram/connect | src/services/api/legacy.js:1712 |
| disconnectTelegram | settingId, teamId | /api/auth/telegram/disconnect/id/${encodeURIComponent(settingId)}?teamId=${encodeURIComponent(teamId \|\|  | src/services/api/legacy.js:1722 |
| connectInstagram | accessToken | /api/auth/instagram/connect | src/services/api/legacy.js:1733 |
| connectInstagramManually | pageAccessToken, pageId | /api/auth/instagram/connect-env | src/services/api/legacy.js:1743 |
| getInstagramAppSettings |  | /api/auth/instagram/settings | src/services/api/legacy.js:1753 |
| saveInstagramAppSettings | settings | /api/auth/instagram/settings | src/services/api/legacy.js:1758 |
| getInstagramStatus |  | /api/auth/instagram/status | src/services/api/legacy.js:1769 |
| disconnectInstagram | channelId | /api/auth/instagram/disconnect | src/services/api/legacy.js:1775 |
| sendInstagramText | conversationId, text | /api/instagram/text | src/services/api/legacy.js:1785 |
| sendInstagramMedia | conversationId, kind, url, caption | /api/instagram/media | src/services/api/legacy.js:1795 |
| createLabelFromCsv | name, file | /api/labels/csv | src/services/api/legacy.js:1805 |
| getWorkspaceLoginPolicy |  | /api/team-management/login-policy | src/services/api/legacy.js:1814 |
| updateWorkspaceLoginPolicy | loginSource | /api/team-management/login-policy | src/services/api/legacy.js:1819 |
| sendMessengerText | conversationId, text | /api/messenger/text | src/services/api/legacy.js:1826 |
| sendMessengerMedia | conversationId, kind, url, caption | /api/messenger/media | src/services/api/legacy.js:1834 |
| getInstagramAutomations |  | /api/instagram/automations | src/services/api/legacy.js:1842 |
| createInstagramAutomation | data | /api/instagram/automations | src/services/api/legacy.js:1848 |
| updateInstagramAutomation | id, data | /api/instagram/automations/${id} | src/services/api/legacy.js:1858 |
| deleteInstagramAutomation | id | /api/instagram/automations/${id} | src/services/api/legacy.js:1868 |
| toggleInstagramAutomation | id | /api/instagram/automations/${id}/toggle | src/services/api/legacy.js:1877 |
| getInstagramMedia | channelId, after = null | /api/instagram/media-list?channelId=${channelId} | src/services/api/legacy.js:1886 |
| getRazorpaySettings | teamId | /api/settings/razorpay?${params.toString()} | src/services/api/legacy.js:1893 |
| updateRazorpaySettings | data, teamId | /api/settings/razorpay?${params.toString()} | src/services/api/legacy.js:1901 |
| getWhatsAppAppSettings | teamId | /api/settings/whatsapp-app?${params.toString()} | src/services/api/legacy.js:1916 |
| updateWhatsAppAppSettings | data, teamId | /api/settings/whatsapp-app?${params.toString()} | src/services/api/legacy.js:1924 |
| disconnectRazorpay | teamId | /api/settings/razorpay?${params.toString()} | src/services/api/legacy.js:1935 |
| getExotelSettings | teamId | /api/settings/exotel?${params.toString()} | src/services/api/legacy.js:1952 |
| updateExotelSettings | data, teamId | /api/settings/exotel?${params.toString()} | src/services/api/legacy.js:1960 |
| disconnectExotel | teamId | /api/settings/exotel?${params.toString()} | src/services/api/legacy.js:1972 |
| initiateExotelCall | data, teamId | /api/settings/exotel/call?${params.toString()} | src/services/api/legacy.js:1983 |
| getExotelCallLogs | teamId, { limit = 25, offset = 0 } = {} | /api/settings/exotel/calls?${params.toString()} | src/services/api/legacy.js:1995 |
| getTwilioSettings | teamId | /api/settings/twilio?${params.toString()} | src/services/api/legacy.js:2007 |
| updateTwilioSettings | data, teamId | /api/settings/twilio?${params.toString()} | src/services/api/legacy.js:2015 |
| disconnectTwilio | teamId | /api/settings/twilio?${params.toString()} | src/services/api/legacy.js:2027 |
| sendTwilioSms | data, teamId | /api/settings/twilio/sms?${params.toString()} | src/services/api/legacy.js:2037 |
| initiateTwilioCall | data, teamId | /api/settings/twilio/call?${params.toString()} | src/services/api/legacy.js:2049 |
| getTwilioLogs | teamId, { type, limit = 25, offset = 0 } = {} | /api/settings/twilio/logs?${params.toString()} | src/services/api/legacy.js:2061 |
| getEmailSettings | teamId | /api/settings/email?${params.toString()} | src/services/api/legacy.js:2074 |
| updateEmailSettings | data, teamId | /api/settings/email?${params.toString()} | src/services/api/legacy.js:2082 |
| disconnectEmail | teamId | /api/settings/email?${params.toString()} | src/services/api/legacy.js:2094 |
| testEmailConnection | teamId | /api/settings/email/test?${params.toString()} | src/services/api/legacy.js:2102 |
| syncEmails | teamId, limit = 30 | /api/settings/email/sync?${params.toString()} | src/services/api/legacy.js:2110 |
| sendEmailMessage | data, teamId | /api/settings/email/send?${params.toString()} | src/services/api/legacy.js:2122 |
| getEmailMessages | teamId, { direction, search, limit = 30, offset = 0 } = {} | /api/settings/email/messages?${params.toString()} | src/services/api/legacy.js:2134 |
| markEmailRead | id, teamId | /api/settings/email/messages/${id}/read?${params.toString()} | src/services/api/legacy.js:2146 |
| deleteEmailMessage | id, teamId | /api/settings/email/messages/${id}?${params.toString()} | src/services/api/legacy.js:2154 |
| getSubscriptionCatalog | includeInactive = false | /api/plans${qs ? , /api/subscriptions/catalog${qs ?  | src/services/api/legacy.js:2174 |
| getCustomerSubscription |  | /api/customer/billing/subscription, /api/subscriptions/current | src/services/api/legacy.js:2185 |
| checkoutSubscription | data | /api/customer/billing/upgrade, /api/subscriptions/checkout | src/services/api/legacy.js:2193 |
| cancelCustomerSubscription |  | /api/customer/billing/cancel, /api/subscriptions/cancel | src/services/api/legacy.js:2207 |
| reactivateCustomerSubscription |  | /api/customer/billing/reactivate, /api/subscriptions/reactivate | src/services/api/legacy.js:2215 |
| cancelScheduledUpgrade |  | /api/customer/billing/cancel-scheduled, /api/subscriptions/cancel-scheduled | src/services/api/legacy.js:2223 |
| getBillingPortalUrl | returnUrl | /api/customer/billing/portal, /api/subscriptions/portal | src/services/api/legacy.js:2231 |
| getPaymentMethods |  | /api/checkout/methods | src/services/api/legacy.js:2239 |
| createSubscriptionOrder | data | /api/checkout/create-order | src/services/api/legacy.js:2247 |
| verifySubscriptionPayment | data | /api/checkout/verify-payment | src/services/api/legacy.js:2259 |
| getAdminSubscriptionPlans |  | /api/subscriptions/admin/plans | src/services/api/legacy.js:2271 |
| createAdminSubscriptionPlan | data | /api/subscriptions/admin/plans | src/services/api/legacy.js:2277 |
| updateAdminSubscriptionPlan | id, data | /api/subscriptions/admin/plans/${id} | src/services/api/legacy.js:2287 |
| deactivateAdminSubscriptionPlan | id, data = {} | /api/subscriptions/admin/plans/${id} | src/services/api/legacy.js:2297 |
| getAdminAuditLogs | filters = {} | /api/admin/access-control/audit-logs?${params.toString()}, /api/admin/access-control${path} | src/services/api/legacy.js:2307 |
| getAccessControlRoles |  |  | src/services/api/legacy.js:2333 |
| createAccessControlRole | payload |  | src/services/api/legacy.js:2336 |
| updateAccessControlRole | id, payload |  | src/services/api/legacy.js:2339 |
| deleteAccessControlRole | id, reason |  | src/services/api/legacy.js:2342 |
| getAccessControlPermissions |  |  | src/services/api/legacy.js:2345 |
| addRolePermission | roleId, permId |  | src/services/api/legacy.js:2348 |
| removeRolePermission | roleId, permId |  | src/services/api/legacy.js:2351 |
| syncInternalRolePresets |  |  | src/services/api/legacy.js:2354 |
| getAccessControlAdmins |  |  | src/services/api/legacy.js:2357 |
| assignAdminRole | adminId, roleId |  | src/services/api/legacy.js:2360 |
| revokeAdminRole | adminId, roleId |  | src/services/api/legacy.js:2363 |
| grantAdminPermission | adminId, permId |  | src/services/api/legacy.js:2366 |
| revokeAdminPermission | adminId, permId |  | src/services/api/legacy.js:2369 |
| getApprovalRequests | status |  | src/services/api/legacy.js:2372 |
| createApprovalRequest | payload |  | src/services/api/legacy.js:2375 |
| resolveApprovalRequest | id, type, note |  | src/services/api/legacy.js:2378 |
| runSecurityAudit |  |  | src/services/api/legacy.js:2381 |
| syncXoloxContacts | page = 1, limit = 100, full = false | /api/contacts/sync | src/services/api/legacy.js:2385 |
| getXoloxSyncStatus |  | /api/contacts/sync/status | src/services/api/legacy.js:2395 |
| postWebhookSample | workflowId, payload | /api/workflow-webhooks/${workflowId}/test | src/services/api/legacy.js:2402 |
