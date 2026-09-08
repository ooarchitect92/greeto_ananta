# automation frontend ownership

| Feature | Route | Component |
|---|---|---|
| Workflow builder | `/workflows` | `src/features/automation/WorkflowsKanban.jsx` |
| Sequences | `/sequences` | `src/features/automation/SequencesPage.jsx` |
| Automation rules | `/rules` | `src/features/automation/RulesPage.jsx` |

Shared contracts live in `src/contracts/`; execution is owned by a separately authorized backend. `api.js` is the domain facade over the preserved adapter at `src/services/api/legacy.js`. Its functions are source-inventoried, not live-reverified.

See `docs/FEATURE_MAP.md`, `docs/PARAMETERS.md`, `docs/COMPONENT_INVENTORY.md`, and `docs/IMPLEMENTATION_ORDER.md` for exact ownership, parameters and source work packages.
