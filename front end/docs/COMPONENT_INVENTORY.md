# Actual component and hook signatures

Parsed source declarations and named function expressions. Line numbers point to the declaration start. This is a source inventory, not a complete runtime call graph or live verification.

| Name | Declared parameters | Actual source / line |
|---|---|---|
| App |  | src/App.jsx:5 |
| FrontendPreview |  | src/app/FrontendPreview.jsx:10 |
| Preloader | { onDone } | src/app/GreetoWorkspace.jsx:15 |
| PageBoundary | { children, label = 'Loading workspace' } | src/app/GreetoWorkspace.jsx:142 |
| AppContent |  | src/app/GreetoWorkspace.jsx:172 |
| App |  | src/app/GreetoWorkspace.jsx:2100 |
| WorkspaceSidebar | {activePage, onNavigate, role, userName, onLogout, preview=false} | src/app/layouts/WorkspaceSidebar.jsx:5 |
| Badge | { className, variant = 'default', ...props } | src/components/ui/Badge.jsx:4 |
| GreetoLoader | {<br>  label = 'Loading',<br>  sublabel = 'Preparing your workspace...',<br>  className = '',<br>  fullScreen = false,<br>} | src/components/ui/GreetoLoader.jsx:3 |
| LeadTaxonomyPage | {<br>  eyebrow,<br>  title,<br>  description,<br>  headerIcon: HeaderIcon,<br>  extraHeaderBadge,<br>  onCreate,<br>  createLabel,<br>  statCards = [],<br>  listIcon: ListIcon,<br>  listTitle,<br>  loading,<br>  loadingLabel,<br>  loadingSublabel,<br>  items = [],<br>  emptyIcon: EmptyIcon,<br>  emptyMessage,<br>  emptyCreateLabel,<br>  gridClassName = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3',<br>  renderCard,<br>  children,<br>} | src/components/ui/LeadTaxonomyPage.jsx:18 |
| Modal | { isOpen, onClose, title, children, className, zIndex = 'z-50' } | src/components/ui/Modal.jsx:6 |
| Toaster |  | src/components/ui/Toaster.jsx:4 |
| ViewToggle | {<br>  value,<br>  onChange,<br>  boardValue = 'board',<br>  tableValue = 'table',<br>  boardLabel = 'Board',<br>  tableLabel = 'Table',<br>  className = '',<br>} | src/components/ui/ViewToggle.jsx:4 |
| WorkspaceEmptyState | { title, description, primaryLabel, onPrimary, secondaryLabel, onSecondary } | src/components/ui/WorkspaceEmptyState.jsx:4 |
| XoloxSyncBadge |  | src/components/ui/XoloxSyncBadge.jsx:5 |
| ConfirmActionHost |  | src/components/ui/confirmAction.jsx:18 |
| useToast |  | src/components/ui/use-toast.jsx:137 |
| StatusBadge | { status } | src/features/admin/AccessControlPage.jsx:83 |
| Toast | { msg, onDone } | src/features/admin/AccessControlPage.jsx:109 |
| ConfirmModal | { title, message, onConfirm, onCancel, requireReason = false } | src/features/admin/AccessControlPage.jsx:120 |
| RolesTab | { roles, permissions, onRefresh, toast } | src/features/admin/AccessControlPage.jsx:155 |
| AdminsTab | { admins, roles, onRefresh, toast } | src/features/admin/AccessControlPage.jsx:416 |
| ApprovalsTab | { onRefresh, toast } | src/features/admin/AccessControlPage.jsx:618 |
| AuditTab | { toast } | src/features/admin/AccessControlPage.jsx:760 |
| SecurityAuditModal | { onClose } | src/features/admin/AccessControlPage.jsx:874 |
| AccessControlPage |  | src/features/admin/AccessControlPage.jsx:991 |
| MetricCard | { label, value, icon, iconBg, valueColor = 'text-slate-950' } | src/features/admin/AdminAuditLogsPage.jsx:114 |
| AdminAuditLogsPage | { searchQuery = '' } | src/features/admin/AdminAuditLogsPage.jsx:128 |
| AdminIntegrationsPage |  | src/features/admin/AdminIntegrationsPage.jsx:12 |
| AdminPlaceholder | { title, description, icon: Icon, cards = [] } | src/features/admin/AdminPortal.jsx:70 |
| AdminDashboard | { onNavigate } | src/features/admin/AdminPortal.jsx:103 |
| AdminWorkspacesPage |  | src/features/admin/AdminPortal.jsx:224 |
| AdminPortal | { currentUser, onLogout } | src/features/admin/AdminPortal.jsx:346 |
| PasswordField | { label, value, onChange, visible, onToggle, autoComplete } | src/features/admin/AdminSettingsPage.jsx:14 |
| AdminSettingsPage | { currentUser } | src/features/admin/AdminSettingsPage.jsx:28 |
| Section | { title, description, children } | src/features/admin/AdminSubscriptionPlanFormPage.jsx:102 |
| Field | { label, value, onChange, type = 'text', placeholder = '', hint, min, step } | src/features/admin/AdminSubscriptionPlanFormPage.jsx:114 |
| SelectField | { label, value, onChange, options, hint } | src/features/admin/AdminSubscriptionPlanFormPage.jsx:132 |
| ChoiceGrid | { label, options, selected, onToggle, hint } | src/features/admin/AdminSubscriptionPlanFormPage.jsx:144 |
| FeatureEditor | { value, onChange } | src/features/admin/AdminSubscriptionPlanFormPage.jsx:166 |
| CurrencyField | { label, value, onChange } | src/features/admin/AdminSubscriptionPlanFormPage.jsx:218 |
| TextArea | { label, value, onChange, rows = 3, placeholder = '', hint } | src/features/admin/AdminSubscriptionPlanFormPage.jsx:233 |
| AdminSubscriptionPlanFormPage | { plan, onBack, onSaved } | src/features/admin/AdminSubscriptionPlanFormPage.jsx:249 |
| Metric | { label, value, icon: Icon, tone = 'purple' } | src/features/admin/AdminSubscriptionsPage.jsx:14 |
| AdminSubscriptionsPage | { onCreate, onEdit } | src/features/admin/AdminSubscriptionsPage.jsx:32 |
| AdminWorkflowMonitorPage |  | src/features/admin/AdminWorkflowMonitorPage.jsx:11 |
| AiAgentPage | { onNavigate } | src/features/ai-agent/AiAgentPage.jsx:19 |
| useAiAgent |  | src/features/ai-agent/hooks/useAiAgent.jsx:9 |
| InviteAcceptancePage |  | src/features/auth/InviteAcceptancePage.jsx:6 |
| RightSectionLogin | { isAdminMode = false } | src/features/auth/LoginPage.jsx:5 |
| LoginPage | { onLogin, mode = 'customer' } | src/features/auth/LoginPage.jsx:160 |
| ResetPasswordPage |  | src/features/auth/ResetPasswordPage.jsx:5 |
| SignupPage |  | src/features/auth/SignupPage.jsx:5 |
| Field | { icon: Icon, label, children } | src/features/auth/SignupPage.jsx:65 |
| VerifyEmailPage |  | src/features/auth/VerifyEmailPage.jsx:5 |
| AuthNotice | { icon, title, message, action } | src/features/auth/VerifyEmailPage.jsx:14 |
| QuickWorkflowBuilder | { stage, onBack, onOpenVisualBuilder } | src/features/automation/QuickWorkflowBuilder.jsx:33 |
| RulesPage |  | src/features/automation/RulesPage.jsx:50 |
| RunsHistoryPanel | { workflow, onClose } | src/features/automation/RunsHistoryPanel.jsx:6 |
| SequencesPage | { onOpenWorkflow } | src/features/automation/SequencesPage.jsx:20 |
| NodeWrapper | { children, selected, title, icon: Icon, colorClass, status } | src/features/automation/WorkflowBuilder.jsx:184 |
| MediaPreview | { type, url, fileName } | src/features/automation/WorkflowBuilder.jsx:248 |
| TriggerNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:288 |
| TemplateNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:315 |
| DelayNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:356 |
| ConditionNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:383 |
| AttributeConditionNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:404 |
| SendMessageNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:432 |
| ListMessageNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:448 |
| ResponseMessageNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:488 |
| FeedbackNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:531 |
| PaymentRequestNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:563 |
| PaymentReminderNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:599 |
| UserRepliedNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:618 |
| CustomCodeNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:638 |
| ActionNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:648 |
| NotificationNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:700 |
| EndNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:712 |
| CampaignTriggerNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:721 |
| CustomerMessageTriggerNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:730 |
| CampaignConditionNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:740 |
| IncomingWebhookNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:787 |
| NewContactCreatedNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:812 |
| XoloxEventNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:827 |
| XoloxLookupAgentNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:849 |
| WebhookNodeConfig | { node, workflowId, updateNodeFields } | src/features/automation/WorkflowBuilder.jsx:861 |
| TwilioSmsNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1079 |
| TwilioCallNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1097 |
| ExotelCallNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1115 |
| AgentCallDispatchNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1139 |
| SetVariableNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1167 |
| LeadStageUpdatedWebhookNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1182 |
| StarforzeLeadUpdatedNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1190 |
| LeadStageUpdatedWebhookConfig | { workflowId } | src/features/automation/WorkflowBuilder.jsx:1197 |
| ZoomFetchNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1229 |
| LoopNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1240 |
| RelativeDelayNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1253 |
| ZoomMatchNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1272 |
| ZoomRegisterNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1281 |
| InlineMetaTemplateModal | { isOpen, onClose, onSubmitted } | src/features/automation/WorkflowBuilder.jsx:1333 |
| PlusEdge | {<br>  id,<br>  sourceX,<br>  sourceY,<br>  targetX,<br>  targetY,<br>  sourcePosition,<br>  targetPosition,<br>  style = {},<br>  markerEnd,<br>  source,<br>  target,<br>  sourceHandleId,<br>  targetHandleId,<br>} | src/features/automation/WorkflowBuilder.jsx:1724 |
| WaitForStageNode | { data, selected } | src/features/automation/WorkflowBuilder.jsx:1791 |
| WorkflowBuilder | { onBack, onSave, initialWorkflow, linkedPhones = [] } | src/features/automation/WorkflowBuilder.jsx:1810 |
| DraggableBlock | { type, actionType, label, icon: Icon, color, onAdd, disabledDrag } | src/features/automation/WorkflowBuilder.jsx:10098 |
| DelayModal | { isOpen, onClose, onSubmit, currentDelay, isIndependent: initialIndependent, targetTime: initialTargetTime } | src/features/automation/WorkflowsKanban.jsx:92 |
| CreateStageModal | { isOpen, onClose, onSubmit } | src/features/automation/WorkflowsKanban.jsx:228 |
| EditWorkflowModal | { isOpen, onClose, onSubmit, workflow } | src/features/automation/WorkflowsKanban.jsx:300 |
| TriggerChooserView | { selectedTrigger, selectedTab, onSelectTab, onSelectTrigger, onCancel, onBuild } | src/features/automation/WorkflowsKanban.jsx:372 |
| BuilderChoiceModal | { stage, onClose, onQuickBuilder, onVisualBuilder } | src/features/automation/WorkflowsKanban.jsx:458 |
| WorkflowsKanban | { currentUser, onOpenBuilder, onOpenQuickBuilder, onNavigate, onLogout } | src/features/automation/WorkflowsKanban.jsx:463 |
| WorkflowsPage | { onOpenBuilder } | src/features/automation/WorkflowsPage.jsx:12 |
| ConfirmModal | { title, message, confirmLabel, tone = 'danger', busy, onClose, onConfirm } | src/features/billing/SubscriptionsPage.jsx:133 |
| StatCard | { icon: Icon, label, value, hint, tone = 'purple' } | src/features/billing/SubscriptionsPage.jsx:165 |
| UsageMeter | { meter } | src/features/billing/SubscriptionsPage.jsx:189 |
| PlanCard | { plan, billingCycle, isCurrent, busy, onChoose, onTrial } | src/features/billing/SubscriptionsPage.jsx:215 |
| FeatureComparison | { plans } | src/features/billing/SubscriptionsPage.jsx:301 |
| GatewayPickerModal | { gateways, plan, onChoose, onCancel, busy } | src/features/billing/SubscriptionsPage.jsx:342 |
| TransitionModal | { currentPlanName, currentPeriodEnd, newPlan, onChoose, onCancel } | src/features/billing/SubscriptionsPage.jsx:376 |
| SubscriptionsPage |  | src/features/billing/SubscriptionsPage.jsx:412 |
| StatusBadge | { status } | src/features/campaigns/CampaignsPage.jsx:30 |
| CampaignPreview | { channel, template, mapping, smsMessage, headerUrl, headerFileName, contactFields = BASE_CONTACT_FIELDS } | src/features/campaigns/CampaignsPage.jsx:83 |
| ChannelIcon | { channel, size = 11 } | src/features/campaigns/CampaignsPage.jsx:104 |
| WhatsAppPreview | { template, mapping, headerUrl, headerFileName, contactFields = BASE_CONTACT_FIELDS } | src/features/campaigns/CampaignsPage.jsx:111 |
| Steps | { current, steps } | src/features/campaigns/CampaignsPage.jsx:166 |
| NewCampaignPage | { onClose, onSuccess } | src/features/campaigns/CampaignsPage.jsx:198 |
| CreateTemplateModal | { isOpen, onClose, onCreated } | src/features/campaigns/CampaignsPage.jsx:902 |
| CampaignReportModal | { campaign, onClose } | src/features/campaigns/CampaignsPage.jsx:1115 |
| CampaignsPage | { onNavigate } | src/features/campaigns/CampaignsPage.jsx:1188 |
| AvatarCircle | { name, email, size = 9, color = 'bg-indigo-100 text-indigo-700' } | src/features/channels/EmailPage.jsx:35 |
| ComposePanel | { settings, onSend, isSending, sendResult, defaultTo, defaultSubject, defaultBody, isReply, onClose } | src/features/channels/EmailPage.jsx:45 |
| EmailDetail | { msg, settings, onReply, onDelete, isSending, sendResult } | src/features/channels/EmailPage.jsx:153 |
| EmailPage | { currentUser } | src/features/channels/EmailPage.jsx:246 |
| EditableNode | { kind, title, value, onChange, placeholder, extra } | src/features/channels/InstagramAutoDMBuilder.jsx:46 |
| LibItem | { item } | src/features/channels/InstagramAutoDMBuilder.jsx:85 |
| InstagramAutoDMBuilder | { isOpen, onClose, post, channelId, onSaved } | src/features/channels/InstagramAutoDMBuilder.jsx:105 |
| RuleNameInput | { value, onChange } | src/features/channels/InstagramAutoDMBuilder.jsx:274 |
| InstagramAutomationsPanel | { channelId, embedded = false } | src/features/channels/InstagramAutomationsPanel.jsx:13 |
| InstagramMediaPage | { activeChannelId, onBack, embedded = false, hideHeader = false } | src/features/channels/InstagramMediaPage.jsx:9 |
| InstagramPage | { currentUser, socket } | src/features/channels/InstagramPage.jsx:31 |
| StatusBadge | { status } | src/features/channels/SmsPage.jsx:25 |
| DirectionIcon | { direction, status } | src/features/channels/SmsPage.jsx:41 |
| SmsComposer | { onSend, isSending, defaultTo, callerIdDefault } | src/features/channels/SmsPage.jsx:49 |
| SmsDetail | { log, onReply, isSending } | src/features/channels/SmsPage.jsx:105 |
| SmsPage | { currentUser } | src/features/channels/SmsPage.jsx:186 |
| TelegramPage | { currentUser, socket } | src/features/channels/TelegramPage.jsx:19 |
| ChannelIcon | { type, name } | src/features/contacts/ContactsEntry.jsx:173 |
| ContactDetailsPage | { contact, onBack, onDelete, onUpdate } | src/features/contacts/ContactsEntry.jsx:194 |
| DataField | { icon, label, value } | src/features/contacts/ContactsEntry.jsx:380 |
| LeadInput | { label, value, onChange, placeholder, type = 'text' } | src/features/contacts/ContactsEntry.jsx:395 |
| AddContactModal | { isOpen, onClose, channels, onSuccess } | src/features/contacts/ContactsEntry.jsx:410 |
| ImportContactsModal | { isOpen, onClose, channels, onImported } | src/features/contacts/ContactsEntry.jsx:617 |
| ContactsPage | { onNavigate } | src/features/contacts/ContactsEntry.jsx:930 |
| ContactsPage | { currentUser } | src/features/contacts/ContactsPage.jsx:10 |
| ContactDetailsDrawer | { contact, isOpen, onClose, onUpdate, onDelete } | src/features/contacts/components/ContactDetails/ContactDetailsDrawer.jsx:6 |
| ContactsFilterBar | { <br>    search, setSearch, <br>    filters, onFilterChange, <br>    onClearFilters <br>} | src/features/contacts/components/ContactsFilterBar.jsx:5 |
| ContactsHeader | { totalContacts, isSyncing, syncProgress, onSync, onAddContact } | src/features/contacts/components/ContactsHeader.jsx:4 |
| ContactRow | { contact, onSelect, onDelete, onEdit } | src/features/contacts/components/ContactsTable/ContactsTable.jsx:6 |
| ContactsTable | { contacts, isLoading, onSelectContact, onDeleteContact, onEditContact } | src/features/contacts/components/ContactsTable/ContactsTable.jsx:84 |
| AddContactModal | { isOpen, onClose, channels, onSuccess } | src/features/contacts/components/Modals/AddContactModal.jsx:6 |
| useContacts |  | src/features/contacts/hooks/useContacts.js:5 |
| useSync | onComplete | src/features/contacts/hooks/useSync.js:4 |
| ChannelIcon | { type, name, size = 14 } | src/features/contacts/utils/constants.jsx:24 |
| EmailTemplatesPage | { startCreate = false } | src/features/content/EmailTemplatesPage.jsx:75 |
| TemplateListModal | { isOpen, onClose, templates, onToggleStar } | src/features/content/TemplateListModal.jsx:7 |
| TemplatesPage | { onNavigate } | src/features/content/TemplatesPage.jsx:14 |
| Tab | { active, onClick, icon: Icon, label } | src/features/crm/LabelsPage.jsx:32 |
| GroupModal | { isOpen, onClose, editLabel, onSuccess } | src/features/crm/LabelsPage.jsx:49 |
| ViewContactsModal | { isOpen, onClose, label } | src/features/crm/LabelsPage.jsx:348 |
| LabelsPage | { onNavigate } | src/features/crm/LabelsPage.jsx:432 |
| StageFormModal | { isOpen, onClose, stage, onSaved } | src/features/crm/LeadStagesPage.jsx:28 |
| LeadStagesPage |  | src/features/crm/LeadStagesPage.jsx:168 |
| StatusFormModal | { isOpen, onClose, status, onSaved } | src/features/crm/LeadStatusPage.jsx:28 |
| LeadStatusPage |  | src/features/crm/LeadStatusPage.jsx:168 |
| DuplicateWarningModal | { isOpen, onClose, duplicate, onForceCreate } | src/features/crm/OpportunitiesPage.jsx:43 |
| OppModal | { isOpen, onClose, opp, stages, statuses, onSaved, onDuplicate } | src/features/crm/OpportunitiesPage.jsx:101 |
| OpportunitiesPage |  | src/features/crm/OpportunitiesPage.jsx:236 |
| ProposalModal | { isOpen, onClose, onSend } | src/features/crm/ProposalModal.jsx:24 |
| ShellCard | { children, className = '' } | src/features/dashboard/DashboardPage.jsx:44 |
| StatCard | { icon: Icon, label, value, helper, tone = 'purple' } | src/features/dashboard/DashboardPage.jsx:52 |
| ChartTooltip | { active, payload, label } | src/features/dashboard/DashboardPage.jsx:78 |
| SectionHeading | { icon: Icon, title, subtitle } | src/features/dashboard/DashboardPage.jsx:92 |
| DashboardPage | { teamId, onNavigate, currentUser, onLogout, hasWhatsApp, onConnectWhatsApp } | src/features/dashboard/DashboardPage.jsx:108 |
| ImplementationCenter | {onNavigate} | src/features/implementation/ImplementationCenter.jsx:8 |
| Chat | { socket, conversationId, channelExternalId, channelType, messages, onRefresh, isLoading, loadError, onRetry } | src/features/inbox/Chat.jsx:18 |
| ConversationActivityPanel | { conversationId } | src/features/inbox/ConversationActivityPanel.jsx:12 |
| ConversationFilters | { activeFilter, onSelectFilter, counts = {} } | src/features/inbox/ConversationFilters.jsx:5 |
| CustomerCard | { conversationId, onLeadStageUpdated, onContactUpdated } | src/features/inbox/CustomerCard.jsx:41 |
| GuestChat |  | src/features/inbox/GuestChat.jsx:7 |
| Inbox | { conversations, hasMore, isLoadingMore, onLoadMore, selectedId, onSelect, onPin, onResolve, onDelete, currentUser, filter, setFilter, counts, channelFilter, setChannelFilter, hasConnectedChannel = true, onConnectChannel } | src/features/inbox/Inbox.jsx:30 |
| Avatar | { name, size = 32 } | src/features/inbox/InternalChat.jsx:37 |
| RoomList | { rooms, loading, currentUser, onOpen, onNewChat } | src/features/inbox/InternalChat.jsx:55 |
| NewChat | { teamMembers, currentUser, onStart, onBack } | src/features/inbox/InternalChat.jsx:113 |
| ChatRoom | { room, currentUser, socket, onBack } | src/features/inbox/InternalChat.jsx:206 |
| InternalChat | { socket, currentUser, teamMembers = [], teamId, onClose } | src/features/inbox/InternalChat.jsx:417 |
| NotesPanel | { conversationId, currentUser, socket } | src/features/inbox/NotesPanel.jsx:10 |
| TagSelector | { selectedLabels, onChange } | src/features/inbox/TagSelector.jsx:6 |
| TemplatePanel | { conversationId } | src/features/inbox/TemplatePanel.jsx:10 |
| Nav | { onLogin } | src/features/marketing/LandingPage.jsx:9 |
| GlowOrb | { color, size, style } | src/features/marketing/LandingPage.jsx:59 |
| InboxMock | { tab } | src/features/marketing/LandingPage.jsx:73 |
| AnimatedNumber | { value, suffix } | src/features/marketing/LandingPage.jsx:189 |
| LogoStrip |  | src/features/marketing/LandingPage.jsx:226 |
| WorkflowDiagram |  | src/features/marketing/LandingPage.jsx:247 |
| LandingPage | { onLoginClick } | src/features/marketing/LandingPage.jsx:329 |
| LegalLayout | { title, updated, children } | src/features/marketing/LegalLayout.jsx:3 |
| PrivacyPolicyPage |  | src/features/marketing/PrivacyPolicyPage.jsx:3 |
| TermsPage |  | src/features/marketing/TermsPage.jsx:3 |
| HistoricalImage | { file, onOpen } | src/features/media/GalleryPage.jsx:41 |
| GalleryPage | { onNavigate } | src/features/media/GalleryPage.jsx:74 |
| GallerySelectModal | { isOpen, onClose, onSelect, resourceType = 'auto' } | src/features/media/GallerySelectModal.jsx:7 |
| GettingStartedPage | { variant = 'customer', onNavigate } | src/features/onboarding/GettingStartedPage.jsx:112 |
| OnboardingTour | { onComplete, activePage, setActivePage } | src/features/onboarding/OnboardingTour.jsx:136 |
| LegacyAdminReportsView |  | src/features/reports/ReportsPage.jsx:137 |
| AdminReportsView |  | src/features/reports/ReportsPage.jsx:407 |
| CustomerReportsView | { onNavigate } | src/features/reports/ReportsPage.jsx:512 |
| ReportsPage | { onNavigate, variant = 'customer' } | src/features/reports/ReportsPage.jsx:1765 |
| Field | { label, icon: Icon, children } | src/features/settings/ProfilePage.jsx:38 |
| ProfilePage | { currentUser, onProfileUpdated } | src/features/settings/ProfilePage.jsx:50 |
| CopyButton | { value } | src/features/settings/SettingsPage.jsx:1317 |
| RevealInput | { placeholder, value, onChange, disabled } | src/features/settings/SettingsPage.jsx:1332 |
| SettingsPage | { currentUser, onNavigate, initialMode = 'overview', autoOpenWhatsApp = false, onAutoOpenWhatsAppHandled } | src/features/settings/SettingsPage.jsx:1361 |
| FeatureStudioPage | {featureId,scope,onNavigate,preview=false} | src/features/studio/FeatureStudioPage.jsx:9 |
| ParameterInput | {field,value,onChange,error} | src/features/studio/ParameterInput.jsx:2 |
| StatusBadge | { status } | src/features/voice/CallsPage.jsx:35 |
| DirectionIcon | { direction, status } | src/features/voice/CallsPage.jsx:50 |
| DialPad | { value, onChange, onCall, isDialing, callerIdDefault } | src/features/voice/CallsPage.jsx:66 |
| CallDetail | { log, onCallBack, isDialing } | src/features/voice/CallsPage.jsx:140 |
| CallsPage | { currentUser } | src/features/voice/CallsPage.jsx:220 |
| FlowBuilder | { onBack, flowData, onSave, initialScreens } | src/features/whatsapp-flows/FlowBuilder.jsx:63 |
| FlowsCreate | { onCancel, onSave } | src/features/whatsapp-flows/FlowsCreate.jsx:153 |
| FlowsList | { onCreate } | src/features/whatsapp-flows/FlowsList.jsx:9 |
| FlowsPage |  | src/features/whatsapp-flows/FlowsPage.jsx:5 |
| TeamMembersPage | { onNavigate, adminMode = false } | src/features/workforce/TeamMembersPage.jsx:21 |
| TeamPage | { conversations, agents, currentUser, onAssign, onUnassign } | src/features/workforce/TeamPage.jsx:10 |
| useWhatsAppEmbeddedSignup | { appId, configId } = {} | src/hooks/useWhatsAppEmbeddedSignup.js:31 |
| PageLayout | {eyebrow, title, description, actions, children} | src/shared/ui/PageLayout.jsx:2 |
| Notice | {children, kind='info'} | src/shared/ui/PageLayout.jsx:8 |
| StatePage | {title,children} | src/shared/ui/PageLayout.jsx:9 |
