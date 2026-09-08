# Public, authentication and admin surfaces

These existing routes are retained separately from the 55 tenant-workspace entries. An inventory is not live verification.

| Surface | Route | Label | Actual component / router |
|---|---|---|---|
| public_and_auth | / | Marketing landing | src/features/marketing/LandingPage.jsx |
| public_and_auth | /login | Customer login | src/features/auth/LoginPage.jsx |
| public_and_auth | /customer/login | Customer login alias | src/features/auth/LoginPage.jsx |
| public_and_auth | /admin/login | Admin login | src/features/auth/LoginPage.jsx |
| public_and_auth | /signup | Signup | src/features/auth/SignupPage.jsx |
| public_and_auth | /reset-password | Password reset | src/features/auth/ResetPasswordPage.jsx |
| public_and_auth | /verify-email | Email verification | src/features/auth/VerifyEmailPage.jsx |
| public_and_auth | /accept-invite | Invitation acceptance | src/features/auth/InviteAcceptancePage.jsx |
| public_and_auth | /privacy | Privacy policy | src/features/marketing/PrivacyPolicyPage.jsx |
| public_and_auth | /terms | Terms | src/features/marketing/TermsPage.jsx |
| admin | /admin/dashboard | Dashboard | src/features/admin/AdminPortal.jsx |
| admin | /admin/getting-started | Getting Started | src/features/admin/AdminPortal.jsx |
| admin | /admin/workspaces | Workspaces | src/features/admin/AdminPortal.jsx |
| admin | /admin/inbox-monitor | Inbox Monitor | src/features/admin/AdminPortal.jsx |
| admin | /admin/workflows | Workflow Monitor | src/features/admin/AdminPortal.jsx |
| admin | /admin/integrations | Integrations | src/features/admin/AdminPortal.jsx |
| admin | /admin/subscriptions | Subscriptions | src/features/admin/AdminPortal.jsx |
| admin | /admin/team-management | Team Management | src/features/admin/AdminPortal.jsx |
| admin | /admin/access-control | Access Control | src/features/admin/AdminPortal.jsx |
| admin | /admin/audit-logs | Audit Logs | src/features/admin/AdminPortal.jsx |
| admin | /admin/reports | Reports | src/features/admin/AdminPortal.jsx |
| admin | /admin/settings | Admin settings | src/features/admin/AdminSettingsPage.jsx |

Root `/` is context-sensitive: marketing for visitors, inbox for authenticated workspace users. Admin access remains with the existing auth/admin system. Production authorization and MFA were not certified by this frontend-only increment.
