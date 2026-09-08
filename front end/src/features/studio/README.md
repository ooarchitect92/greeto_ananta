# studio frontend ownership

| Feature | Route | Component |
|---|---|---|
| Mission Studio | `/missions` | `src/features/studio/FeatureStudioPage.jsx` |
| Experience Studio | `/experiences` | `src/features/studio/FeatureStudioPage.jsx` |
| Journey Twin | `/journey-twin` | `src/features/studio/FeatureStudioPage.jsx` |
| Change Radar & Workflow Doctor | `/change-radar` | `src/features/studio/FeatureStudioPage.jsx` |
| Policy Studio | `/policy-studio` | `src/features/studio/FeatureStudioPage.jsx` |
| Approvals & human tasks | `/approvals` | `src/features/studio/FeatureStudioPage.jsx` |
| Action receipts | `/action-receipts` | `src/features/studio/FeatureStudioPage.jsx` |
| Channel Control Center | `/channel-center` | `src/features/studio/FeatureStudioPage.jsx` |
| Customer Graph & consent | `/customer-state` | `src/features/studio/FeatureStudioPage.jsx` |
| Audience & schedule controls | `/audiences` | `src/features/studio/FeatureStudioPage.jsx` |
| AI models & routing | `/ai-policy` | `src/features/studio/FeatureStudioPage.jsx` |
| Knowledge & retrieval | `/knowledge` | `src/features/studio/FeatureStudioPage.jsx` |
| AI evaluations | `/ai-evaluations` | `src/features/studio/FeatureStudioPage.jsx` |
| Connector Studio | `/connector-studio` | `src/features/studio/FeatureStudioPage.jsx` |
| Webhooks & deliveries | `/webhooks` | `src/features/studio/FeatureStudioPage.jsx` |
| Developer Center | `/developer-center` | `src/features/studio/FeatureStudioPage.jsx` |
| Forms, commerce & bookings | `/business-studio` | `src/features/studio/FeatureStudioPage.jsx` |
| Calling configuration | `/voice-studio` | `src/features/studio/FeatureStudioPage.jsx` |
| Support & diagnostics | `/support-center` | `src/features/studio/FeatureStudioPage.jsx` |
| Usage & budget controls | `/billing-controls` | `src/features/studio/FeatureStudioPage.jsx` |
| Workspace & access policies | `/workspace-access` | `src/features/studio/FeatureStudioPage.jsx` |
| Security & governance | `/security-center` | `src/features/studio/FeatureStudioPage.jsx` |
| Retention & data requests | `/data-lifecycle` | `src/features/studio/FeatureStudioPage.jsx` |
| System health & operations | `/operations` | `src/features/studio/FeatureStudioPage.jsx` |
| Agency & marketplace | `/agency-center` | `src/features/studio/FeatureStudioPage.jsx` |

Shared contracts live in `src/contracts/`; execution is owned by a separately authorized backend. Read the actual component signature before integrating another page.

See `docs/FEATURE_MAP.md`, `docs/PARAMETERS.md`, `docs/COMPONENT_INVENTORY.md`, and `docs/IMPLEMENTATION_ORDER.md` for exact ownership, parameters and source work packages.
