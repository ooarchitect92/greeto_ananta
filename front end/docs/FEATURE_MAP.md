# Workspace feature map

55 registered workspace entries. Existing public/auth/admin routes are listed separately in `SURFACE_MAP.md`. Configuration does not imply live integration.

## Workspace

| ID / route | Label | Actual frontend owner | UI / server status | Source |
|---|---|---|---|---|
| dashboard / /dashboard | Dashboard | src/features/dashboard/DashboardPage.jsx | existing_screen / legacy_integration_unverified | §1.2 |
| getting-started / /getting-started | Getting started | src/features/onboarding/GettingStartedPage.jsx | existing_screen / legacy_integration_unverified | §10 |

## Customers & conversations

| ID / route | Label | Actual frontend owner | UI / server status | Source |
|---|---|---|---|---|
| inbox / /inbox | Unified inbox | src/features/inbox/Inbox.jsx | existing_screen / legacy_integration_unverified | §13 |
| contacts / /contacts | Contacts | src/features/contacts/ContactsEntry.jsx | existing_screen / legacy_integration_unverified | §23.2 |
| labels / /labels | Labels | src/features/crm/LabelsPage.jsx | existing_screen / legacy_integration_unverified | §23.2 |
| opportunities / /opportunities | Sales pipeline | src/features/crm/OpportunitiesPage.jsx | existing_screen / legacy_integration_unverified | §23.2 |
| lead-stages / /lead-stages | Lead stages | src/features/crm/LeadStagesPage.jsx | existing_screen / legacy_integration_unverified | §23.2 |
| lead-status / /lead-status | Lead statuses | src/features/crm/LeadStatusPage.jsx | existing_screen / legacy_integration_unverified | §23.2 |
| customer-state / /customer-state | Customer Graph & consent | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §23.2 |

## Missions & growth

| ID / route | Label | Actual frontend owner | UI / server status | Source |
|---|---|---|---|---|
| campaigns / /campaigns | Campaigns | src/features/campaigns/CampaignsPage.jsx | existing_screen / legacy_integration_unverified | §23.1 |
| templates / /templates | WhatsApp templates | src/features/content/TemplatesPage.jsx | existing_screen / legacy_integration_unverified | §11 |
| email-templates / /email-templates | Email templates | src/features/content/EmailTemplatesPage.jsx | existing_screen / legacy_integration_unverified | §23.1 |
| missions / /missions | Mission Studio | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §17.1–17.2 |
| experiences / /experiences | Experience Studio | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §17.3 |
| audiences / /audiences | Audience & schedule controls | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §23.1 |

## Automation & trust

| ID / route | Label | Actual frontend owner | UI / server status | Source |
|---|---|---|---|---|
| workflows / /workflows | Workflow builder | src/features/automation/WorkflowsKanban.jsx | existing_screen / legacy_integration_unverified | §18 |
| sequences / /sequences | Sequences | src/features/automation/SequencesPage.jsx | existing_screen / legacy_integration_unverified | §18 |
| rules / /rules | Automation rules | src/features/automation/RulesPage.jsx | existing_screen / legacy_integration_unverified | §18 |
| flows / /flows | WhatsApp Flows | src/features/whatsapp-flows/FlowsPage.jsx | existing_screen / legacy_integration_unverified | §17.3 |
| journey-twin / /journey-twin | Journey Twin | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §20.1–20.2 |
| change-radar / /change-radar | Change Radar & Workflow Doctor | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §20.3 |
| policy-studio / /policy-studio | Policy Studio | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §19 |
| approvals / /approvals | Approvals & human tasks | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §19 |
| action-receipts / /action-receipts | Action receipts | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §9 and §19 |

## AI workforce

| ID / route | Label | Actual frontend owner | UI / server status | Source |
|---|---|---|---|---|
| ai-agent / /ai-agent | AI agents | src/features/ai-agent/AiAgentPage.jsx | existing_screen / legacy_integration_unverified | §21 |
| ai-policy / /ai-policy | AI models & routing | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §21 |
| knowledge / /knowledge | Knowledge & retrieval | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §21.2–21.4 |
| ai-evaluations / /ai-evaluations | AI evaluations | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §21 |

## Channels & integrations

| ID / route | Label | Actual frontend owner | UI / server status | Source |
|---|---|---|---|---|
| integrations / /integrations | Connected integrations | src/features/settings/SettingsPage.jsx | existing_screen / legacy_integration_unverified | §22 |
| instagram / /instagram | Instagram inbox | src/features/channels/InstagramPage.jsx | existing_screen / legacy_integration_unverified | §13 |
| telegram / /telegram | Telegram inbox | src/features/channels/TelegramPage.jsx | existing_screen / legacy_integration_unverified | §13 |
| sms / /sms | SMS inbox | src/features/channels/SmsPage.jsx | existing_screen / legacy_integration_unverified | §13 |
| email / /email | Email inbox | src/features/channels/EmailPage.jsx | existing_screen / legacy_integration_unverified | §13 |
| channel-center / /channel-center | Channel Control Center | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §11 |
| connector-studio / /connector-studio | Connector Studio | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §22.1–22.2 |
| webhooks / /webhooks | Webhooks & deliveries | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §16 |
| developer-center / /developer-center | Developer Center | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §22.3 |

## Business operations

| ID / route | Label | Actual frontend owner | UI / server status | Source |
|---|---|---|---|---|
| calls / /calls | Call history | src/features/voice/CallsPage.jsx | existing_screen / legacy_integration_unverified | §24 |
| gallery / /gallery | Media library | src/features/media/GalleryPage.jsx | existing_screen / legacy_integration_unverified | §24.1 |
| reports / /reports | Reports | src/features/reports/ReportsPage.jsx | existing_screen / legacy_integration_unverified | §25 |
| business-studio / /business-studio | Forms, commerce & bookings | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §23.3–23.4 |
| voice-studio / /voice-studio | Calling configuration | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §24.2 |
| support-center / /support-center | Support & diagnostics | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §26 |

## Workspace management

| ID / route | Label | Actual frontend owner | UI / server status | Source |
|---|---|---|---|---|
| subscriptions / /subscriptions | Subscription & invoices | src/features/billing/SubscriptionsPage.jsx | existing_screen / legacy_integration_unverified | §25 |
| team / /team | Teams | src/features/workforce/TeamPage.jsx | existing_screen / legacy_integration_unverified | §10 |
| team-members / /team-members | Team members | src/features/workforce/TeamMembersPage.jsx | existing_screen / legacy_integration_unverified | §10 |
| settings / /settings | Workspace settings | src/features/settings/SettingsPage.jsx | existing_screen / legacy_integration_unverified | §10 |
| profile / /profile | My profile | src/features/settings/ProfilePage.jsx | existing_screen / legacy_integration_unverified | §10 |
| billing-controls / /billing-controls | Usage & budget controls | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §25 |
| workspace-access / /workspace-access | Workspace & access policies | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §10 and §28.1 |
| security-center / /security-center | Security & governance | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §28 |
| data-lifecycle / /data-lifecycle | Retention & data requests | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §27 |
| operations / /operations | System health & operations | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §29–30 |
| agency-center / /agency-center | Agency & marketplace | src/features/studio/FeatureStudioPage.jsx | frontend_configuration / not_connected | §36 ECO |

## Implementation

| ID / route | Label | Actual frontend owner | UI / server status | Source |
|---|---|---|---|---|
| implementation / /implementation | Implementation Center | src/features/implementation/ImplementationCenter.jsx | frontend_configuration / not_connected | §36–37 |
