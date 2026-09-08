# Parameter reference

231 documented fields. Stable configuration keys are frontend handoff contracts; proposed endpoint bodies require server agreement. Existing pages do not all consume these planning schemas yet. For every legacy UI/hook function and API call signature, also consult the two actual-source inventories.

Shared context: tenantId, workspaceId, environment and userId must be supplied by the existing server-backed session; browser values are not authority. Query selectors: `task` must be an exact source task ID; development-only `feature` selects a registered page. Legacy workflow detail paths use `/workflows/:workflowId`.

## Dashboard — `dashboard`

Workspace overview and operational metrics.

Route: `/dashboard`. Owner: `src/features/dashboard/DashboardPage.jsx`. Source: §1.2.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| workspace_ref | Workspace reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| range | Date range / select | True | "today" | {"options": ["today", "last_7_days", "last_30_days"]} | Date range for this configuration. Validated again by the backend before execution. |
| timezone | Timezone / select | True | "Asia/Kolkata" | {"options": ["Asia/Kolkata", "UTC"]} | Timezone for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Getting started — `getting-started`

Guided setup and onboarding.

Route: `/getting-started`. Owner: `src/features/onboarding/GettingStartedPage.jsx`. Source: §10.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Unified inbox — `inbox`

Existing conversation timeline, assignment, notes and customer context.

Route: `/inbox`. Owner: `src/features/inbox/Inbox.jsx`. Source: §13.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| teamId | Team ID / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| filter | Inbox filter / select | True | "all" | {"options": ["all", "unread", "mine", "unassigned", "closed"]} | Inbox filter for this configuration. Validated again by the backend before execution. |
| phoneNumberId | Phone number ID / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| limit | Page size / number | True | 20 | {"min": 1, "max": 100} | Page size for this configuration. Validated again by the backend before execution. |
| offset | Offset / number | True | 0 | {"min": 0, "max": 100000} | Offset for this configuration. Validated again by the backend before execution. |
| search | Search text / text | False | "" | {"maxLength": 200} | Search text for this configuration. Validated again by the backend before execution. |
| filters | Additional filters / json | True | {} | {} | Additional filters for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Contacts — `contacts`

Existing contact directory, search, filters and imports.

Route: `/contacts`. Owner: `src/features/contacts/ContactsEntry.jsx`. Source: §23.2.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| search | Contact search / text | False | "" | {"maxLength": 200} | Contact search for this configuration. Validated again by the backend before execution. |
| page | Page / number | True | 1 | {"min": 1, "max": 100000} | Page for this configuration. Validated again by the backend before execution. |
| limit | Page size / number | True | 20 | {"min": 1, "max": 100} | Page size for this configuration. Validated again by the backend before execution. |
| labels | Label references / json | True | [] | {} | Label references for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Labels — `labels`

Shared customer and conversation labels.

Route: `/labels`. Owner: `src/features/crm/LabelsPage.jsx`. Source: §23.2.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Sales pipeline — `opportunities`

Existing opportunities and pipeline stages.

Route: `/opportunities`. Owner: `src/features/crm/OpportunitiesPage.jsx`. Source: §23.2.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Lead stages — `lead-stages`

Configure pipeline stages.

Route: `/lead-stages`. Owner: `src/features/crm/LeadStagesPage.jsx`. Source: §23.2.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Lead statuses — `lead-status`

Configure lead status taxonomy.

Route: `/lead-status`. Owner: `src/features/crm/LeadStatusPage.jsx`. Source: §23.2.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Campaigns — `campaigns`

Existing campaign management and creation.

Route: `/campaigns`. Owner: `src/features/campaigns/CampaignsPage.jsx`. Source: §23.1.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Campaign name / text | True | "" | {"maxLength": 120} | Campaign name for this configuration. Validated again by the backend before execution. |
| audience_ref | Audience reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| template_ref | Template reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| template_parameters | Template parameters / json | True | {} | {} | Template parameters for this configuration. Validated again by the backend before execution. |
| scheduled_at | Schedule (with timezone) / datetime | False | "" | {} | Schedule (with timezone) for this configuration. Validated again by the backend before execution. |
| timezone | IANA timezone / text | True | "Asia/Kolkata" | {"typeHint": "iana-timezone"} | IANA timezone for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## WhatsApp templates — `templates`

Existing reusable message templates.

Route: `/templates`. Owner: `src/features/content/TemplatesPage.jsx`. Source: §11.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Email templates — `email-templates`

Existing email content editor.

Route: `/email-templates`. Owner: `src/features/content/EmailTemplatesPage.jsx`. Source: §23.1.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Workflow builder — `workflows`

Existing visual workflow editor and board.

Route: `/workflows`. Owner: `src/features/automation/WorkflowsKanban.jsx`. Source: §18.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| id | Workflow ID / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| name | Workflow name / text | True | "" | {"maxLength": 120} | Workflow name for this configuration. Validated again by the backend before execution. |
| trigger | Trigger / json | True | {} | {} | Trigger for this configuration. Validated again by the backend before execution. |
| nodes | Nodes / json | True | [] | {} | Nodes for this configuration. Validated again by the backend before execution. |
| edges | Edges / json | True | [] | {} | Edges for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Sequences — `sequences`

Existing multi-step sequences.

Route: `/sequences`. Owner: `src/features/automation/SequencesPage.jsx`. Source: §18.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Automation rules — `rules`

Existing trigger and routing rules.

Route: `/rules`. Owner: `src/features/automation/RulesPage.jsx`. Source: §18.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## WhatsApp Flows — `flows`

Existing channel-specific interactive flow builder.

Route: `/flows`. Owner: `src/features/whatsapp-flows/FlowsPage.jsx`. Source: §17.3.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## AI agents — `ai-agent`

Existing AI agent configuration.

Route: `/ai-agent`. Owner: `src/features/ai-agent/AiAgentPage.jsx`. Source: §21.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Connected integrations — `integrations`

Existing provider configuration; account readiness requires server evidence.

Route: `/integrations`. Owner: `src/features/settings/SettingsPage.jsx`. Source: §22.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Instagram inbox — `instagram`

Preserved legacy channel view; unified timeline is the target architecture.

Route: `/instagram`. Owner: `src/features/channels/InstagramPage.jsx`. Source: §13.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Telegram inbox — `telegram`

Preserved legacy channel view.

Route: `/telegram`. Owner: `src/features/channels/TelegramPage.jsx`. Source: §13.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## SMS inbox — `sms`

Preserved legacy SMS view.

Route: `/sms`. Owner: `src/features/channels/SmsPage.jsx`. Source: §13.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Email inbox — `email`

Preserved legacy email view.

Route: `/email`. Owner: `src/features/channels/EmailPage.jsx`. Source: §13.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Call history — `calls`

Existing calling interface; availability is provider-dependent.

Route: `/calls`. Owner: `src/features/voice/CallsPage.jsx`. Source: §24.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Media library — `gallery`

Existing media gallery and attachment picker.

Route: `/gallery`. Owner: `src/features/media/GalleryPage.jsx`. Source: §24.1.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Reports — `reports`

Existing workflow and workspace reports.

Route: `/reports`. Owner: `src/features/reports/ReportsPage.jsx`. Source: §25.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Subscription & invoices — `subscriptions`

Existing plan and billing page.

Route: `/subscriptions`. Owner: `src/features/billing/SubscriptionsPage.jsx`. Source: §25.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Teams — `team`

Existing team management screen, distinct from workspace members.

Route: `/team`. Owner: `src/features/workforce/TeamPage.jsx`. Source: §10.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Team members — `team-members`

Existing team management.

Route: `/team-members`. Owner: `src/features/workforce/TeamMembersPage.jsx`. Source: §10.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Workspace settings — `settings`

Existing workspace configuration.

Route: `/settings`. Owner: `src/features/settings/SettingsPage.jsx`. Source: §10.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## My profile — `profile`

Existing account profile.

Route: `/profile`. Owner: `src/features/settings/ProfilePage.jsx`. Source: §10.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Mission Studio — `missions`

Define an objective, audience, success evidence, allowed actions and budget before compilation.

Route: `/missions`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §17.1–17.2.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Mission name / text | True | "Appointment follow-up" | {"maxLength": 120} | Mission name for this configuration. Validated again by the backend before execution. |
| objective | Business objective / textarea | True | "Help opted-in customers confirm their appointments." | {"maxLength": 4000} | Business objective for this configuration. Validated again by the backend before execution. |
| audience_ref | Audience snapshot reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| workflow_ref | Workflow draft reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| success_predicate | Success evidence predicate / textarea | True | "appointment.confirmed = true" | {"maxLength": 4000} | Success evidence predicate for this configuration. Validated again by the backend before execution. |
| channels | Allowed channels / multiselect | True | ["whatsapp"] | {"options": ["whatsapp", "instagram", "messenger", "telegram", "email", "sms", "webchat", "rcs"]} | Allowed channels for this configuration. Validated again by the backend before execution. |
| budget_minor | Budget in minor currency units / number | True | 100000 | {"min": 0, "max": 100000000} | Budget in minor currency units for this configuration. Validated again by the backend before execution. |
| currency | Currency / select | True | "INR" | {"options": ["INR", "USD", "EUR", "GBP"]} | Currency for this configuration. Validated again by the backend before execution. |
| owner_ref | Accountable owner reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| human_approval_required | Require human approval / boolean | False | true | {} | Require human approval for this configuration. Validated again by the backend before execution. |
| max_actions | Maximum actions per run / number | True | 10 | {"min": 1, "max": 100} | Maximum actions per run for this configuration. Validated again by the backend before execution. |
| expires_in_hours | Draft expiry (hours) / number | True | 72 | {"min": 1, "max": 8760} | Draft expiry (hours) for this configuration. Validated again by the backend before execution. |

Integration: `POST /v1/missions` — **proposed, not called**.

## Experience Studio — `experiences`

Design channel-native fields and fallback behavior without claiming provider support.

Route: `/experiences`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §17.3.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Experience name / text | True | "Appointment confirmation" | {"maxLength": 120} | Experience name for this configuration. Validated again by the backend before execution. |
| channel | Preferred channel / select | True | "whatsapp" | {"options": ["whatsapp", "instagram", "messenger", "telegram", "email", "sms", "webchat", "rcs"]} | Preferred channel for this configuration. Validated again by the backend before execution. |
| renderer | Preferred renderer / select | True | "interactive_message" | {"options": ["interactive_message", "whatsapp_flow", "telegram_buttons", "web_form"]} | Preferred renderer for this configuration. Validated again by the backend before execution. |
| fields | Fields schema / json | True | [{"name": "appointment_ref", "type": "string", "required": true}] | {} | Fields schema for this configuration. Validated again by the backend before execution. |
| confirmation_text | Confirmation copy / textarea | True | "Thank you. Your request is recorded." | {"maxLength": 4000} | Confirmation copy for this configuration. Validated again by the backend before execution. |
| expires_in_minutes | Session expiry (minutes) / number | True | 30 | {"min": 1, "max": 1440} | Session expiry (minutes) for this configuration. Validated again by the backend before execution. |
| fallback | Permitted fallback / select | True | "none" | {"options": ["none", "scoped_web_form", "human_handoff"]} | Permitted fallback for this configuration. Validated again by the backend before execution. |
| consent_policy_ref | Consent policy reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Journey Twin — `journey-twin`

Configure deterministic synthetic scenarios. No real providers, customers, network or business outcomes.

Route: `/journey-twin`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §20.1–20.2.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| mission_ref | Mission reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| version_ref | Immutable version reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| scenario | Scenario / select | True | "happy_path" | {"options": ["happy_path", "provider_timeout", "duplicate_event", "opt_out", "approval_expired"]} | Scenario for this configuration. Validated again by the backend before execution. |
| seed | Deterministic seed / number | True | 42 | {"min": 0, "max": 2147483647} | Deterministic seed for this configuration. Validated again by the backend before execution. |
| virtual_duration_minutes | Virtual duration (minutes) / number | True | 60 | {"min": 1, "max": 10080} | Virtual duration (minutes) for this configuration. Validated again by the backend before execution. |
| synthetic_only | Synthetic data only / boolean | False | true | {} | Synthetic data only for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Change Radar & Workflow Doctor — `change-radar`

Describe capability changes and proposed repairs; automatic production rollout is not enabled.

Route: `/change-radar`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §20.3.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| capability_ref | Capability reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| current_version | Current contract version / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| candidate_version | Candidate contract version / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| impact | Impact class / select | True | "unknown" | {"options": ["unknown", "compatible", "breaking", "restricted"]} | Impact class for this configuration. Validated again by the backend before execution. |
| evidence_summary | Evidence summary / textarea | True | "" | {"maxLength": 4000} | Evidence summary for this configuration. Validated again by the backend before execution. |
| repair_policy | Repair policy / select | True | "review_only" | {"options": ["review_only", "sandbox_proposal"]} | Repair policy for this configuration. Validated again by the backend before execution. |
| reviewer_ref | Reviewer reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Policy Studio — `policy-studio`

Author action policy inputs, consent, budget and approval requirements.

Route: `/policy-studio`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §19.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Policy name / text | True | "Consent-first policy" | {"maxLength": 120} | Policy name for this configuration. Validated again by the backend before execution. |
| allowed_actions | Allowed action names / multiselect | True | ["message.send"] | {"options": ["message.send", "crm.update", "calendar.book", "payment.request", "human.handoff"]} | Allowed action names for this configuration. Validated again by the backend before execution. |
| consent_policy_ref | Consent policy reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| approval_required | Require human approval / boolean | False | true | {} | Require human approval for this configuration. Validated again by the backend before execution. |
| max_actions_per_run | Actions per run / number | True | 10 | {"min": 1, "max": 100} | Actions per run for this configuration. Validated again by the backend before execution. |
| max_budget_minor | Budget limit (minor units) / number | True | 100000 | {"min": 0, "max": 100000000} | Budget limit (minor units) for this configuration. Validated again by the backend before execution. |
| approval_ttl_minutes | Approval validity (minutes) / number | True | 30 | {"min": 1, "max": 1440} | Approval validity (minutes) for this configuration. Validated again by the backend before execution. |
| unknown_outcome_policy | Unknown outcome behavior / select | True | "manual_review" | {"options": ["manual_review", "reconcile_only"]} | Unknown outcome behavior for this configuration. Validated again by the backend before execution. |
| suspend_new_actions | Propose a kill switch / boolean | False | false | {} | Propose a kill switch for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Approvals & human tasks — `approvals`

Prepare a decision bound to an exact action version and input hash; submitting decisions requires the server.

Route: `/approvals`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §19.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| approval_ref | Approval reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| action_ref | Action reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| input_hash | Input digest / text | True | "" | {"maxLength": 64, "pattern": "^[a-fA-F0-9]{64}$"} | SHA-256 hex digest of the immutable action input. The server must verify this binding before accepting a decision. |
| decision | Decision / select | True | "approve" | {"options": ["approve", "reject"]} | Decision for this configuration. Validated again by the backend before execution. |
| reason | Decision reason / textarea | True | "" | {"maxLength": 4000} | Decision reason for this configuration. Validated again by the backend before execution. |
| expires_at | Expiry (with timezone) / datetime | True | "" | {} | Expiry (with timezone) for this configuration. Validated again by the backend before execution. |
| reviewer_ref | Reviewer reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |

Integration: `POST /v1/approvals/{id}/decisions` — **proposed, not called**.

## Action receipts — `action-receipts`

Keep transport acceptance, provider acceptance, delivery and verified business success separate.

Route: `/action-receipts`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §9 and §19.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| action_ref | Action reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| request_ref | Request reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| observed_state | Observed state / select | True | "unknown" | {"options": ["unknown", "accepted", "provider_accepted", "delivered", "read", "verified_success", "failed"]} | Observed state for this configuration. Validated again by the backend before execution. |
| evidence_level | Evidence level / select | True | "none" | {"options": ["none", "transport", "provider", "business"]} | Evidence level for this configuration. Validated again by the backend before execution. |
| evidence_ref | Evidence reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| notes | Evidence notes / textarea | False | "" | {"maxLength": 4000} | Evidence notes for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Channel Control Center — `channel-center`

Plan onboarding and record readiness evidence per channel; connection status is never fabricated.

Route: `/channel-center`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §11.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| provider | Provider / select | True | "whatsapp" | {"options": ["whatsapp", "instagram", "messenger", "telegram", "email", "sms", "webchat", "rcs"]} | Provider for this configuration. Validated again by the backend before execution. |
| connection_ref | Connection reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| business_portfolio_ref | Business portfolio reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| waba_ref | WhatsApp Business Account reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| phone_number_ref | Phone number reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| capability_state | Readiness state / select | True | "not_configured" | {"options": ["not_configured", "not_authorized", "not_eligible", "not_supported", "temporarily_unhealthy", "ready"]} | Readiness state for this configuration. Validated again by the backend before execution. |
| capability_version | Capability evidence version / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| required_scopes | Required permission names / textarea | False | "" | {"maxLength": 4000} | Required permission names for this configuration. Validated again by the backend before execution. |
| next_action | Required setup action / textarea | True | "Request authorization through the server-mediated onboarding flow." | {"maxLength": 4000} | Required setup action for this configuration. Validated again by the backend before execution. |

Integration: `POST /v1/channel-connections/authorizations` — **proposed, not called**.

## Customer Graph & consent — `customer-state`

Configure evidence-based identity linking, preferences and journey state.

Route: `/customer-state`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §23.2.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| customer_ref | Customer reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| operation | Operation / select | True | "update_preferences" | {"options": ["update_preferences", "link_verified_identity", "revoke_consent", "review_memory"]} | Operation for this configuration. Validated again by the backend before execution. |
| identity_evidence_ref | Verified identity evidence reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| purpose | Allowed purpose / select | True | "support" | {"options": ["support", "appointment", "marketing", "transactional"]} | Allowed purpose for this configuration. Validated again by the backend before execution. |
| consent_state | Consent state / select | True | "unknown" | {"options": ["unknown", "granted", "revoked"]} | Consent state for this configuration. Validated again by the backend before execution. |
| channels | Allowed channels / multiselect | False | [] | {"options": ["whatsapp", "instagram", "messenger", "telegram", "email", "sms", "webchat", "rcs"]} | Allowed channels for this configuration. Validated again by the backend before execution. |
| memory_policy | Memory policy / select | True | "none" | {"options": ["none", "authorized_summary", "authorized_history"]} | Memory policy for this configuration. Validated again by the backend before execution. |
| policy_version | Policy version / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| reason | Change reason / textarea | True | "" | {"maxLength": 4000} | Change reason for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Audience & schedule controls — `audiences`

Describe immutable audiences, quiet hours, frequency caps and suppression.

Route: `/audiences`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §23.1.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Audience name / text | True | "Opted-in appointments" | {"maxLength": 120} | Audience name for this configuration. Validated again by the backend before execution. |
| segment_ref | Segment reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| snapshot_ref | Immutable audience snapshot / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| filters | Filter rules / json | True | {"operator": "and", "conditions": []} | {} | Filter rules for this configuration. Validated again by the backend before execution. |
| timezone | IANA timezone / text | True | "Asia/Kolkata" | {"typeHint": "iana-timezone"} | IANA timezone for this configuration. Validated again by the backend before execution. |
| quiet_hours_start | Quiet hours start / time | True | "21:00" | {} | Quiet hours start for this configuration. Validated again by the backend before execution. |
| quiet_hours_end | Quiet hours end / time | True | "09:00" | {} | Quiet hours end for this configuration. Validated again by the backend before execution. |
| max_per_contact_per_day | Per-contact daily limit / number | True | 1 | {"min": 1, "max": 100} | Per-contact daily limit for this configuration. Validated again by the backend before execution. |
| exclude_opt_out | Exclude opt-out contacts / boolean | False | true | {} | Exclude opt-out contacts for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## AI models & routing — `ai-policy`

Define model order, bounded fallbacks, local endpoint references and cost limits. No keys are stored in the browser.

Route: `/ai-policy`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §21.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Routing policy name / text | True | "Support assistant" | {"maxLength": 120} | Routing policy name for this configuration. Validated again by the backend before execution. |
| provider | Primary provider / select | True | "tenant_model_gateway" | {"options": ["tenant_model_gateway", "local_model_gateway"]} | Primary provider for this configuration. Validated again by the backend before execution. |
| primary_model_ref | Primary model reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| fallback_model_refs | Ordered fallback model references / json | True | [] | {} | Ordered fallback model references for this configuration. Validated again by the backend before execution. |
| credential_ref | Server-held credential reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| max_fallbacks | Maximum fallback attempts / number | True | 1 | {"min": 0, "max": 3} | Maximum fallback attempts for this configuration. Validated again by the backend before execution. |
| timeout_ms | Timeout (milliseconds) / number | True | 15000 | {"min": 1000, "max": 120000} | Timeout (milliseconds) for this configuration. Validated again by the backend before execution. |
| max_output_tokens | Output token limit / number | True | 1000 | {"min": 1, "max": 16000} | Output token limit for this configuration. Validated again by the backend before execution. |
| daily_budget_minor | Daily cost limit (minor units) / number | True | 10000 | {"min": 0, "max": 100000000} | Daily cost limit (minor units) for this configuration. Validated again by the backend before execution. |
| tool_autonomy | Tool autonomy / select | True | "suggest_only" | {"options": ["suggest_only", "approval_required", "policy_bounded"]} | Tool autonomy for this configuration. Validated again by the backend before execution. |
| cross_tenant_reuse | Cross-tenant reuse (prohibited) / boolean | False | false | {} | Cross-tenant reuse (prohibited) for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Knowledge & retrieval — `knowledge`

Configure source references, access controls, retrieval and cache invalidation.

Route: `/knowledge`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §21.2–21.4.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Knowledge collection name / text | True | "Support knowledge" | {"maxLength": 120} | Knowledge collection name for this configuration. Validated again by the backend before execution. |
| source_type | Source type / select | True | "file_reference" | {"options": ["file_reference", "website_reference", "connector_reference"]} | Source type for this configuration. Validated again by the backend before execution. |
| source_ref | Source reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| acl_policy_ref | Access policy reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| retrieval_mode | Retrieval mode / select | True | "hybrid" | {"options": ["hybrid", "keyword", "vector"]} | Retrieval mode for this configuration. Validated again by the backend before execution. |
| top_k | Maximum retrieved passages / number | True | 5 | {"min": 1, "max": 30} | Maximum retrieved passages for this configuration. Validated again by the backend before execution. |
| chunk_size | Chunk size (tokens) / number | True | 500 | {"min": 100, "max": 2000} | Chunk size (tokens) for this configuration. Validated again by the backend before execution. |
| overlap | Chunk overlap (tokens) / number | True | 50 | {"min": 0, "max": 500} | Chunk overlap (tokens) for this configuration. Validated again by the backend before execution. |
| citations_required | Require citations / boolean | False | true | {} | Require citations for this configuration. Validated again by the backend before execution. |
| cache_ttl_seconds | Scoped cache TTL (seconds) / number | True | 3600 | {"min": 0, "max": 86400} | Scoped cache TTL (seconds) for this configuration. Validated again by the backend before execution. |
| knowledge_version | Knowledge version / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## AI evaluations — `ai-evaluations`

Describe tenant-isolated test sets, safety thresholds and approval gates.

Route: `/ai-evaluations`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §21.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| agent_ref | Agent reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| dataset_ref | Approved evaluation dataset / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| prompt_version | Prompt version / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| minimum_grounded_score | Minimum grounded score (%) / number | True | 90 | {"min": 0, "max": 100} | Minimum grounded score (%) for this configuration. Validated again by the backend before execution. |
| maximum_cost_minor | Maximum test cost (minor units) / number | True | 1000 | {"min": 0, "max": 1000000} | Maximum test cost (minor units) for this configuration. Validated again by the backend before execution. |
| release_policy | Release policy / select | True | "review_required" | {"options": ["review_required", "block_on_failure"]} | Release policy for this configuration. Validated again by the backend before execution. |
| reviewer_ref | Approver reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Connector Studio — `connector-studio`

Describe OAuth/OpenAPI/HTTP integrations. Imports and connectivity checks remain server responsibilities.

Route: `/connector-studio`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §22.1–22.2.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Connector name / text | True | "Appointment service" | {"maxLength": 120} | Connector name for this configuration. Validated again by the backend before execution. |
| kind | Connector type / select | True | "oauth" | {"options": ["oauth", "openapi", "http", "private_agent"]} | Connector type for this configuration. Validated again by the backend before execution. |
| base_url | Public API base URL / url | True | "https://api.example.com" | {} | Public API base URL for this configuration. Validated again by the backend before execution. |
| credential_ref | Server credential reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| method | HTTP method / select | True | "GET" | {"options": ["GET", "POST", "PUT", "PATCH", "DELETE"]} | HTTP method for this configuration. Validated again by the backend before execution. |
| operation_path | Operation path / text | True | "/appointments" | {"pattern": "^/[A-Za-z0-9_/{}/.:-]*$"} | Operation path for this configuration. Validated again by the backend before execution. |
| input_schema | Input schema / json | True | {"type": "object", "properties": {}} | {} | Input schema for this configuration. Validated again by the backend before execution. |
| timeout_ms | Timeout (milliseconds) / number | True | 10000 | {"min": 1000, "max": 60000} | Timeout (milliseconds) for this configuration. Validated again by the backend before execution. |
| side_effect_class | Side-effect class / select | True | "read" | {"options": ["read", "write", "financial", "destructive"]} | Side-effect class for this configuration. Validated again by the backend before execution. |
| approval_required | Human approval required / boolean | False | true | {} | Human approval required for this configuration. Validated again by the backend before execution. |

Integration: `POST /v1/connectors/imports` — **proposed, not called**.

## Webhooks & deliveries — `webhooks`

Configure subscriptions and inspect replay intent without sending network requests.

Route: `/webhooks`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §16.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Endpoint name / text | True | "CRM events" | {"maxLength": 120} | Endpoint name for this configuration. Validated again by the backend before execution. |
| url | HTTPS callback URL / url | True | "https://hooks.example.com/events" | {} | HTTPS callback URL for this configuration. Validated again by the backend before execution. |
| events | Subscribed events / multiselect | True | ["message.updated"] | {"options": ["message.updated", "mission.completed", "action.verified", "contact.updated", "delivery.failed"]} | Subscribed events for this configuration. Validated again by the backend before execution. |
| signing_secret_ref | Server signing-secret reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| timeout_ms | Timeout (milliseconds) / number | True | 5000 | {"min": 1000, "max": 30000} | Timeout (milliseconds) for this configuration. Validated again by the backend before execution. |
| max_attempts | Maximum attempts / number | True | 5 | {"min": 1, "max": 10} | Maximum attempts for this configuration. Validated again by the backend before execution. |
| replay_window_seconds | Replay window (seconds) / number | True | 300 | {"min": 30, "max": 900} | Replay window (seconds) for this configuration. Validated again by the backend before execution. |
| require_business_ack | Require separate business acknowledgement / boolean | False | false | {} | Require separate business acknowledgement for this configuration. Validated again by the backend before execution. |

Integration: `POST /v1/webhook-endpoints` — **proposed, not called**.

## Developer Center — `developer-center`

Prepare versioned service identities, scopes, sandbox requests and event subscriptions.

Route: `/developer-center`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §22.3.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Service identity name / text | True | "CRM integration" | {"maxLength": 120} | Service identity name for this configuration. Validated again by the backend before execution. |
| scopes | Requested scopes / multiselect | True | ["messages:read"] | {"options": ["messages:read", "messages:write", "missions:read", "missions:write", "contacts:read", "webhooks:manage"]} | Requested scopes for this configuration. Validated again by the backend before execution. |
| environment | Target environment / select | True | "sandbox" | {"options": ["sandbox", "production"]} | Target environment for this configuration. Validated again by the backend before execution. |
| expiry_days | Credential expiry (days) / number | True | 30 | {"min": 1, "max": 365} | Credential expiry (days) for this configuration. Validated again by the backend before execution. |
| owner_ref | Owner reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| mcp_policy_ref | MCP policy reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| read_only | Read-only access / boolean | False | true | {} | Read-only access for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Forms, commerce & bookings — `business-studio`

Define business module handoffs using references; no payment or booking is executed.

Route: `/business-studio`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §23.3–23.4.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Business flow name / text | True | "Appointment request" | {"maxLength": 120} | Business flow name for this configuration. Validated again by the backend before execution. |
| module | Business module / select | True | "appointment" | {"options": ["appointment", "form", "order", "payment", "deal", "task"]} | Business module for this configuration. Validated again by the backend before execution. |
| connector_ref | Authorized connector reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| resource_ref | Calendar/catalog/pipeline reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| timezone | IANA timezone / text | True | "Asia/Kolkata" | {"typeHint": "iana-timezone"} | IANA timezone for this configuration. Validated again by the backend before execution. |
| duration_minutes | Appointment duration (minutes) / number | True | 30 | {"min": 5, "max": 480} | Appointment duration (minutes) for this configuration. Validated again by the backend before execution. |
| amount_minor | Payment amount (minor units) / number | True | 0 | {"min": 0, "max": 100000000} | Payment amount (minor units) for this configuration. Validated again by the backend before execution. |
| currency | Currency / select | True | "INR" | {"options": ["INR", "USD", "EUR", "GBP"]} | Currency for this configuration. Validated again by the backend before execution. |
| confirmation_required | Require confirmation / boolean | False | true | {} | Require confirmation for this configuration. Validated again by the backend before execution. |
| cancellation_policy | Cancellation/compensation policy / textarea | True | "Route uncertain results to a human reviewer." | {"maxLength": 4000} | Cancellation/compensation policy for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Calling configuration — `voice-studio`

Capture eligibility, consent, recording policy and handoff. A visible form does not enable calling.

Route: `/voice-studio`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §24.2.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| provider | Calling adapter / select | True | "whatsapp_business" | {"options": ["whatsapp_business", "sip", "exotel", "twilio"]} | Calling adapter for this configuration. Validated again by the backend before execution. |
| connection_ref | Connection reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| direction | Direction / select | True | "user_initiated" | {"options": ["user_initiated", "business_initiated"]} | Direction for this configuration. Validated again by the backend before execution. |
| permission_evidence_ref | Call permission evidence / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| recording_policy | Recording policy / select | True | "disabled" | {"options": ["disabled", "explicit_consent_only"]} | Recording policy for this configuration. Validated again by the backend before execution. |
| max_duration_seconds | Maximum duration (seconds) / number | True | 1800 | {"min": 30, "max": 14400} | Maximum duration (seconds) for this configuration. Validated again by the backend before execution. |
| fallback_queue_ref | Human queue reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| transcription_enabled | Propose consented transcription / boolean | False | false | {} | Propose consented transcription for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Support & diagnostics — `support-center`

Prepare a support request with scoped, redacted evidence. No ticket is submitted by this frontend-only draft.

Route: `/support-center`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §26.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| subject | Subject / text | True | "Connection readiness review" | {"maxLength": 160} | Subject for this configuration. Validated again by the backend before execution. |
| severity | Severity / select | True | "low" | {"options": ["low", "medium", "high", "critical"]} | Severity for this configuration. Validated again by the backend before execution. |
| category | Category / select | True | "setup" | {"options": ["setup", "delivery", "automation", "billing", "security"]} | Category for this configuration. Validated again by the backend before execution. |
| description | Description / textarea | True | "" | {"maxLength": 4000} | Description for this configuration. Validated again by the backend before execution. |
| request_ref | Related request reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| evidence_ref | Redacted evidence bundle reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| access_mode | Support access / select | True | "no_access" | {"options": ["no_access", "time_boxed_read_only"]} | Support access for this configuration. Validated again by the backend before execution. |
| access_expiry_minutes | Support access expiry (minutes) / number | True | 30 | {"min": 5, "max": 240} | Support access expiry (minutes) for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Usage & budget controls — `billing-controls`

Configure entitlements and usage views without computing a real bill or charging customers.

Route: `/billing-controls`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §25.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| plan_ref | Plan reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| currency | Currency / select | True | "INR" | {"options": ["INR", "USD", "EUR", "GBP"]} | Currency for this configuration. Validated again by the backend before execution. |
| monthly_budget_minor | Monthly budget (minor units) / number | True | 100000 | {"min": 0, "max": 100000000} | Monthly budget (minor units) for this configuration. Validated again by the backend before execution. |
| alert_threshold_percent | Budget alert threshold (%) / number | True | 80 | {"min": 1, "max": 100} | Budget alert threshold (%) for this configuration. Validated again by the backend before execution. |
| usage_view | Usage evidence / select | True | "provisional" | {"options": ["provisional", "reconciled"]} | Usage evidence for this configuration. Validated again by the backend before execution. |
| over_limit_policy | Over-limit policy / select | True | "block_new_actions" | {"options": ["block_new_actions", "request_approval"]} | Over-limit policy for this configuration. Validated again by the backend before execution. |
| billing_owner_ref | Billing owner reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Workspace & access policies — `workspace-access`

Define non-secret workspace configuration; all authority remains server-verified.

Route: `/workspace-access`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §10 and §28.1.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Workspace name / text | True | "Customer operations" | {"maxLength": 120} | Workspace name for this configuration. Validated again by the backend before execution. |
| timezone | IANA timezone / text | True | "Asia/Kolkata" | {"typeHint": "iana-timezone"} | IANA timezone for this configuration. Validated again by the backend before execution. |
| locale | Locale / select | True | "en-IN" | {"options": ["en-IN", "en-US", "en-GB"]} | Locale for this configuration. Validated again by the backend before execution. |
| environment | Environment / select | True | "sandbox" | {"options": ["sandbox", "production"]} | Environment for this configuration. Validated again by the backend before execution. |
| default_role | Default invited role / select | True | "viewer" | {"options": ["viewer", "agent"]} | Default invited role for this configuration. Validated again by the backend before execution. |
| mfa_required | Require MFA / boolean | False | true | {} | Require MFA for this configuration. Validated again by the backend before execution. |
| session_idle_minutes | Idle session timeout (minutes) / number | True | 30 | {"min": 5, "max": 1440} | Idle session timeout (minutes) for this configuration. Validated again by the backend before execution. |
| identity_provider_ref | Identity provider reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Security & governance — `security-center`

Prepare policy changes with reason and evidence; UI permissions are not security enforcement.

Route: `/security-center`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §28.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Security policy name / text | True | "Workspace baseline" | {"maxLength": 120} | Security policy name for this configuration. Validated again by the backend before execution. |
| mfa_required | Require MFA / boolean | False | true | {} | Require MFA for this configuration. Validated again by the backend before execution. |
| retention_days | Retention (days) / number | True | 30 | {"min": 1, "max": 3650} | Retention (days) for this configuration. Validated again by the backend before execution. |
| data_use | AI data-use policy / select | True | "no_training" | {"options": ["no_training", "tenant_evaluation_only"]} | AI data-use policy for this configuration. Validated again by the backend before execution. |
| export_policy | Export policy / select | True | "admin_approval" | {"options": ["admin_approval", "disabled"]} | Export policy for this configuration. Validated again by the backend before execution. |
| pii_redaction | Redact diagnostic data / boolean | False | true | {} | Redact diagnostic data for this configuration. Validated again by the backend before execution. |
| change_reason | Change reason / textarea | True | "" | {"maxLength": 4000} | Change reason for this configuration. Validated again by the backend before execution. |
| approval_ref | Approval reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Retention & data requests — `data-lifecycle`

Prepare export or erasure requests and legal-hold checks. Nothing is deleted in this UI.

Route: `/data-lifecycle`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §27.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| request_type | Request type / select | True | "export" | {"options": ["export", "erasure", "disconnect", "retention_change"]} | Request type for this configuration. Validated again by the backend before execution. |
| subject_ref | Subject/resource reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| resources | Resource classes / multiselect | True | ["contacts"] | {"options": ["contacts", "messages", "media", "knowledge", "audit"]} | Resource classes for this configuration. Validated again by the backend before execution. |
| purpose | Purpose and authority / textarea | True | "" | {"maxLength": 4000} | Purpose and authority for this configuration. Validated again by the backend before execution. |
| legal_hold_reviewed | Legal hold reviewed / boolean | False | false | {} | Legal hold reviewed for this configuration. Validated again by the backend before execution. |
| retention_days | Requested retention (days) / number | True | 30 | {"min": 1, "max": 3650} | Requested retention (days) for this configuration. Validated again by the backend before execution. |
| approval_ref | Approval reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |

Integration: `POST /v1/data-requests` — **proposed, not called**.

## System health & operations — `operations`

Prepare a diagnostic view definition; do not label an unqueried system as healthy.

Route: `/operations`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §29–30.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| view | View / select | True | "channel_health" | {"options": ["channel_health", "execution_backlog", "delivery_failures", "audit", "incident", "release_gate"]} | View for this configuration. Validated again by the backend before execution. |
| correlation_ref | Correlation reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| from | From (with timezone) / datetime | False | "" | {} | From (with timezone) for this configuration. Validated again by the backend before execution. |
| to | To (with timezone) / datetime | False | "" | {} | To (with timezone) for this configuration. Validated again by the backend before execution. |
| limit | Maximum records / number | True | 50 | {"min": 1, "max": 200} | Maximum records for this configuration. Validated again by the backend before execution. |
| health | Evidence state / select | True | "unknown" | {"options": ["unknown", "degraded", "unavailable", "healthy"]} | Evidence state for this configuration. Validated again by the backend before execution. |
| reason | Diagnostic reason / textarea | True | "Review observed evidence before taking action." | {"maxLength": 4000} | Diagnostic reason for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Agency & marketplace — `agency-center`

Describe tenant memberships and package review while preserving explicit tenant boundaries.

Route: `/agency-center`. Owner: `src/features/studio/FeatureStudioPage.jsx`. Source: §36 ECO.

| Key | Label / type | Required | Default | Bounds / choices | Meaning |
|---|---|---|---|---|---|
| name | Agency/package name / text | True | "Customer operations agency" | {"maxLength": 120} | Agency/package name for this configuration. Validated again by the backend before execution. |
| mode | Operation / select | True | "tenant_membership" | {"options": ["tenant_membership", "branding", "package_submission", "reseller_plan"]} | Operation for this configuration. Validated again by the backend before execution. |
| tenant_ref | Authorized tenant reference / text | True | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| package_ref | Package reference / text | False | "" | {"maxLength": 128, "pattern": "^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"} | Opaque resource reference. Do not enter passwords, access tokens, API keys or personal data. |
| access_level | Access level / select | True | "read_only" | {"options": ["read_only", "delegated_management"]} | Access level for this configuration. Validated again by the backend before execution. |
| approval_required | Require tenant-owner approval / boolean | False | true | {} | Require tenant-owner approval for this configuration. Validated again by the backend before execution. |
| purpose | Delegation purpose / textarea | True | "" | {"maxLength": 4000} | Delegation purpose for this configuration. Validated again by the backend before execution. |

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.

## Implementation Center — `implementation`

All 262 exact work packages, dependencies, acceptance criteria, code locations and parameter contracts.

Route: `/implementation`. Owner: `src/features/implementation/ImplementationCenter.jsx`. Source: §36–37.

No new parameter schema added to this retained screen. Inspect its actual component/API signatures before changing its existing props or requests.

Integration: No new endpoint asserted. Existing integrations remain unverified; new modules await contract agreement.
