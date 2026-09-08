import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, UserPlus, ChevronRight, Shield, Plus,
  Trash2, CreditCard, Eye, X, Pencil,
  Clock, Activity, Check, XCircle, RefreshCw, ScanSearch, Info,
} from "lucide-react";
import { confirmAction } from "../../components/ui/confirmAction.jsx";
import GreetoLoader from "../../components/ui/GreetoLoader.jsx";
import {
  getAccessControlRoles,
  createAccessControlRole,
  updateAccessControlRole,
  deleteAccessControlRole,
  getAccessControlPermissions,
  addRolePermission,
  removeRolePermission,
  syncInternalRolePresets,
  getAccessControlAdmins,
  assignAdminRole,
  revokeAdminRole,
  grantAdminPermission,
  revokeAdminPermission,
  getApprovalRequests,
  createApprovalRequest,
  resolveApprovalRequest,
  getAdminAuditLogs,
  runSecurityAudit,
} from "./api.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_ICONS = {
  "Super Admin": <Shield size={16} />,
  "Support Admin": <ShieldCheck size={16} />,
  "Finance Admin": <CreditCard size={16} />,
  "Security Admin": <Eye size={16} />,
  "Operations Manager": <Activity size={16} />,
  "Support Agent": <UserPlus size={16} />,
  "Template Reviewer": <Check size={16} />,
  "Workflow Operator": <RefreshCw size={16} />,
  "Integration Monitor": <ScanSearch size={16} />,
};

const CATEGORY_COLORS = {
  tenant: "bg-blue-50 text-blue-700",
  subscription: "bg-purple-50 text-purple-700",
  revenue: "bg-green-50 text-green-700",
  audit: "bg-amber-50 text-amber-700",
  "access-control": "bg-red-50 text-red-700",
  impersonation: "bg-gray-100 text-gray-600",
  internal: "bg-slate-100 text-slate-600",
  operations: "bg-sky-50 text-sky-700",
  conversation: "bg-teal-50 text-teal-700",
  workflow: "bg-indigo-50 text-indigo-700",
  integration: "bg-cyan-50 text-cyan-700",
  template: "bg-pink-50 text-pink-700",
  role: "bg-fuchsia-50 text-fuchsia-700",
  permission: "bg-violet-50 text-violet-700",
  user: "bg-orange-50 text-orange-700",
};

// Derives a two-letter initials string from a name or email for avatar display
function initials(name, email) {
  const s = name || email || "?";
  return s.split(/[\s@]/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

// Joins first/last name into a display string, falling back to email
function displayName(firstName, lastName, email) {
  const n = [firstName, lastName].filter(Boolean).join(" ");
  return n || email || "";
}

const BG_COLORS = ["bg-purple-500", "bg-sky-500", "bg-teal-500", "bg-orange-400", "bg-rose-400", "bg-indigo-500", "bg-emerald-500"];
// Deterministically picks an avatar background color from a string hash
function bgColor(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return BG_COLORS[h % BG_COLORS.length];
}

// Renders a color-coded pill badge for approval request status values
function StatusBadge({ status }) {
  const map = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-600 border-red-200",
    expired: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={`inline-block text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${map[status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
      {status}
    </span>
  );
}

// Converts an ISO date string to a human-readable relative time label
function relTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

// Displays a temporary notification banner that auto-dismisses after 3 seconds
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
      {msg}
    </div>
  );
}

// ─── Confirm modal (reason-required delete) ───────────────────────────────────

function ConfirmModal({ title, message, onConfirm, onCancel, requireReason = false }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-4">{message}</p>
        {requireReason && (
          <textarea
            placeholder="Reason (required)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-purple-300 mb-4 resize-none h-20"
          />
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(requireReason ? reason : undefined)}
            disabled={requireReason && !reason.trim()}
            className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Roles & Permissions ─────────────────────────────────────────────────

// Tab panel for browsing roles, managing permissions per role, and creating/deleting roles
function RolesTab({ roles, permissions, onRefresh, toast }) {
  const [selected, setSelected] = useState(roles[0] ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => { if (!selected && roles.length) setSelected(roles[0]); }, [roles, selected]);

  const grouped = permissions.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  // Posts a new role to the API and refreshes the role list
  async function createRole() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createAccessControlRole({ name: newName.trim(), description: newDesc.trim() || undefined });
      toast(`Role "${newName}" created`);
      setShowCreate(false);
      setNewName(""); setNewDesc("");
      onRefresh();
    } catch (e) {
      toast(e.message);
    } finally { setSaving(false); }
  }

  // Deletes a role with an audit reason and clears selection if it was active
  async function deleteRole(role, reason) {
    try {
      await deleteAccessControlRole(role.id, reason);
      toast(`Role "${role.name}" deleted`);
      setDeleteTarget(null);
      if (selected?.id === role.id) setSelected(null);
      onRefresh();
    } catch (e) { toast(e.message); }
  }

  function beginEditRole(role) {
    setEditTarget(role);
    setEditName(role.name || "");
    setEditDescription(role.description || "");
  }

  async function saveRole() {
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    try {
      await updateAccessControlRole(editTarget.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      toast(`Role "${editName.trim()}" updated`);
      setEditTarget(null);
      await onRefresh();
    } catch (e) {
      toast(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Grants or revokes a single permission on a role via the API
  async function togglePermission(role, perm, has) {
    try {
      if (has) await removeRolePermission(role.id, perm.id);
      else await addRolePermission(role.id, perm.id);
      toast(`${has ? "Removed" : "Granted"} ${perm.key}`);
      onRefresh();
    } catch (e) { toast(e.message); }
  }

  async function confirmTogglePermission(role, perm, has) {
    const ok = await confirmAction({
      title: `${has ? "Remove" : "Grant"} role permission?`,
      message: `${perm.name} will be ${has ? "removed from" : "granted to"} ${role.name}.`,
      confirmLabel: has ? "Remove" : "Grant",
      tone: has ? "danger" : "toggle",
    });
    if (ok) await togglePermission(role, perm, has);
  }

  const currentRole = selected ? roles.find(r => r.id === selected.id) ?? selected : null;
  const hasPermId = new Set(currentRole?.permissions.map(p => p.id) ?? []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Roles list */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Roles</span>
          <span className="text-[10px] bg-purple-50 text-purple-700 py-0.5 px-2.5 rounded-full font-bold border border-purple-100">{roles.length}</span>
        </div>

        <div className="space-y-1.5">
          {roles.map((role) => {
            const active = selected?.id === role.id;
            return (
              <button key={role.id} onClick={() => setSelected(role)}
                className={`w-full p-3.5 rounded-xl flex items-center justify-between text-left transition-all border ${active ? "bg-purple-50 border-purple-200" : "bg-white border-transparent hover:border-gray-100 hover:bg-gray-50/50"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${active ? "bg-[#8B2CF5] text-white" : "bg-gray-100 text-gray-400"}`}>
                    {ROLE_ICONS[role.name] ?? <Shield size={16} />}
                  </div>
                  <div>
                    <p className={`text-xs font-bold leading-none ${active ? "text-[#8B2CF5]" : "text-gray-800"}`}>{role.name}</p>
                    <p className="text-[10px] text-gray-400 mt-1.5">{role.description}</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">{role.memberCount} member{role.memberCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <ChevronRight size={14} className={active ? "text-[#8B2CF5]" : "text-gray-300"} />
                  {!role.isSystem && (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}
                      className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {showCreate ? (
          <div className="space-y-2 border border-purple-200 rounded-xl p-3">
            <input autoFocus placeholder="Role name" value={newName} onChange={e => setNewName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-300" />
            <input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-300" />
            <div className="flex gap-2">
              <button onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}
                className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs text-gray-500">Cancel</button>
              <button onClick={createRole} disabled={!newName.trim() || saving}
                className="flex-1 bg-[#8B2CF5] text-white rounded-lg py-1.5 text-xs font-bold disabled:opacity-40">
                {saving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowCreate(true)}
            className="w-full py-3 border border-dashed border-gray-200 hover:border-[#8B2CF5]/50 hover:text-[#8B2CF5] rounded-xl text-xs text-gray-400 font-bold transition-all flex items-center justify-center gap-1.5">
            <Plus size={13} /> Define New Role
          </button>
        )}
      </div>

      {/* Permission matrix for selected role */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {!currentRole ? (
          <p className="text-sm text-gray-400 text-center py-12">Select a role to manage permissions</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  {ROLE_ICONS[currentRole.name] ?? <Shield size={15} />}
                  {currentRole.name} Permissions
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">{currentRole.permissions.length} permissions granted</p>
              </div>
              {currentRole.isSystem && (
                <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2.5 py-1 rounded-full">SYSTEM</span>
              )}
              {!currentRole.isSystem && (
                <button
                  type="button"
                  onClick={() => beginEditRole(currentRole)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-100 px-3 py-2 text-[11px] font-bold text-purple-700 transition hover:bg-purple-50"
                >
                  <Pencil size={12} /> Edit role
                </button>
              )}
            </div>

            <div className="space-y-5">
              {Object.entries(grouped).map(([cat, perms]) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{cat}</p>
                  <div className="space-y-1.5">
                    {perms.map(perm => {
                      const has = hasPermId.has(perm.id);
                      return (
                        <div key={perm.id} className={`flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${has ? "bg-purple-50 border border-purple-100" : "bg-gray-50 border border-gray-100"}`}>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => confirmTogglePermission(currentRole, perm, has)}
                              className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${has ? "bg-[#8B2CF5] border-[#8B2CF5]" : "bg-white border-gray-300 hover:border-gray-400"}`}>
                              {has && <Check size={11} color="white" strokeWidth={3} />}
                            </button>
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{perm.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{perm.key}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {perm.isHighRisk && (
                              <span className="text-[9px] font-bold bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full uppercase">HIGH RISK</span>
                            )}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-500"}`}>{cat}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title={`Delete role "${deleteTarget.name}"?`}
          message="This will permanently remove the role. Admins assigned this role will lose its permissions."
          requireReason
          onConfirm={(reason) => deleteRole(deleteTarget, reason)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Edit role</h3>
                <p className="mt-1 text-sm text-gray-500">Update the role label and description. Existing permission grants remain unchanged.</p>
              </div>
              <button type="button" onClick={() => setEditTarget(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close edit role"><X size={16} /></button>
            </div>
            <div className="mt-5 space-y-3">
              <label className="block text-xs font-bold text-gray-600">Role name
                <input value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200" />
              </label>
              <label className="block text-xs font-bold text-gray-600">Description
                <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} className="mt-1.5 h-24 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200" />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setEditTarget(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600">Cancel</button>
              <button type="button" onClick={saveRole} disabled={saving || !editName.trim()} className="flex-1 rounded-xl bg-[#8B2CF5] py-2.5 text-sm font-bold text-white disabled:opacity-40">{saving ? "Saving..." : "Save changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Admins ──────────────────────────────────────────────────────────────

// Tab panel listing all admin users with single-role assignment and per-user permission grants
function AdminsTab({ admins, roles, onRefresh, toast }) {
  const [search, setSearch] = useState("");
  const [roleTarget, setRoleTarget] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [permTarget, setPermTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = admins.filter(a =>
    !search || a.email.toLowerCase().includes(search.toLowerCase()) ||
    displayName(a.firstName, a.lastName).toLowerCase().includes(search.toLowerCase())
  );

  // Sets (or replaces) the selected RBAC role on the target admin via the API
  async function setRole() {
    if (!roleTarget || !selectedRoleId) return;
    setSaving(true);
    try {
      await assignAdminRole(roleTarget.id, selectedRoleId);
      toast("Role assigned successfully");
      setRoleTarget(null);
      setSelectedRoleId("");
      onRefresh();
    } catch (e) { toast(e.message); }
    finally { setSaving(false); }
  }

  // Clears the admin's currently assigned role (and any permissions granted under it)
  async function clearRole(admin) {
    if (!admin.assignedRole) return;
    try {
      await revokeAdminRole(admin.id, admin.assignedRole.id);
      toast("Role revoked");
      onRefresh();
    } catch (e) { toast(e.message); }
  }

  async function confirmClearRole(admin) {
    const ok = await confirmAction({
      title: "Revoke admin role?",
      message: `${admin.assignedRole?.name} will be removed from ${admin.email}.`,
      confirmLabel: "Revoke",
      tone: "danger",
    });
    if (ok) await clearRole(admin);
  }

  // Grants or revokes a single explicit permission on an admin, constrained to their role's permission set
  async function togglePermission(admin, permId, has) {
    try {
      if (has) await revokeAdminPermission(admin.id, permId);
      else await grantAdminPermission(admin.id, permId);
      onRefresh();
    } catch (e) { toast(e.message); }
  }

  async function confirmTogglePermission(admin, perm, has) {
    const ok = await confirmAction({
      title: `${has ? "Remove" : "Grant"} admin permission?`,
      message: `${perm.name} will be ${has ? "removed from" : "granted to"} ${admin.email}.`,
      confirmLabel: has ? "Remove" : "Grant",
      tone: has ? "danger" : "toggle",
    });
    if (ok) await togglePermission(admin, perm.id, has);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">Admin Users</h3>
        <input
          placeholder="Search admins…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-300 w-48"
        />
      </div>

      <div className="grid grid-cols-[2fr_1.2fr_1.5fr_1.5fr_auto] gap-4 px-6 py-2.5 border-b border-gray-50 bg-gray-50/40">
        {["ADMIN", "SYSTEM ROLE", "RBAC ROLE", "PERMISSIONS", "ACTIONS"].map(h => (
          <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{h}</span>
        ))}
      </div>

      <div className="divide-y divide-gray-50">
        {filtered.map(admin => (
          <div key={admin.id} className="grid grid-cols-[2fr_1.2fr_1.5fr_1.5fr_auto] gap-4 items-center px-6 py-4 hover:bg-gray-50/30">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${bgColor(admin.id)}`}>
                {initials(displayName(admin.firstName, admin.lastName), admin.email)}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">{displayName(admin.firstName, admin.lastName, admin.email)}</p>
                <p className="text-[10px] text-gray-400">{admin.firstName || admin.lastName ? admin.email : ""}</p>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold bg-purple-50 text-[#8B2CF5] border border-purple-100 px-2.5 py-1 rounded-full">
                {String(admin.role || "").replace("_", " ")}
              </span>
            </div>

            <div>
              {admin.assignedRole ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {admin.assignedRole.name}
                  <button
                    onClick={() => confirmClearRole(admin)}
                    className="text-gray-400 hover:text-red-400 transition-colors ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 italic">No role assigned</span>
              )}
            </div>

            <div>
              {admin.assignedRole ? (
                <button onClick={() => setPermTarget(admin)}
                  className="text-[10px] font-bold text-[#8B2CF5] bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-full transition-colors">
                  {admin.assignedPermissions.length} / {admin.assignedRole.permissions.length} granted
                </button>
              ) : (
                <span className="text-[10px] text-gray-300">—</span>
              )}
            </div>

            <button onClick={() => { setRoleTarget(admin); setSelectedRoleId(admin.assignedRole?.id ?? ""); }}
              className="text-[#8B2CF5] hover:bg-purple-50 p-2 rounded-xl transition-colors">
              <UserPlus size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Set role modal */}
      {roleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-1">Set Role</h3>
            <p className="text-xs text-gray-500 mb-4">Assign a single RBAC role to <strong>{displayName(roleTarget.firstName, roleTarget.lastName, roleTarget.email)}</strong></p>
            <select value={selectedRoleId} onChange={e => setSelectedRoleId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-300 mb-4">
              <option value="">Select role…</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setRoleTarget(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700">Cancel</button>
              <button onClick={setRole} disabled={!selectedRoleId || selectedRoleId === roleTarget.assignedRole?.id || saving}
                className="flex-1 bg-[#8B2CF5] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#6F00D2] disabled:opacity-40">
                {saving ? "Saving…" : "Set Role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage per-user permissions modal — checklist is scoped to the admin's role permissions */}
      {permTarget && permTarget.assignedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPermTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-1">Manage Permissions</h3>
            <p className="text-xs text-gray-500 mb-4">
              Grants for <strong>{displayName(permTarget.firstName, permTarget.lastName, permTarget.email)}</strong> — limited to the {permTarget.assignedRole.name} role's permissions.
            </p>
            <div className="space-y-1.5">
              {permTarget.assignedRole.permissions.map(perm => {
                const current = admins.find(a => a.id === permTarget.id) ?? permTarget;
                const has = current.assignedPermissions.some(p => p.id === perm.id);
                return (
                  <div key={perm.id} className={`flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${has ? "bg-purple-50 border border-purple-100" : "bg-gray-50 border border-gray-100"}`}>
                    <button
                      onClick={() => confirmTogglePermission(permTarget, perm, has)}
                      className="flex items-center gap-3 text-left"
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-all ${has ? "bg-[#8B2CF5] border-[#8B2CF5]" : "bg-white border-gray-300 hover:border-gray-400"}`}>
                        {has && <Check size={11} color="white" strokeWidth={3} />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{perm.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{perm.key}</p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setPermTarget(null)} className="w-full mt-4 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Approvals ───────────────────────────────────────────────────────────

// Tab panel for viewing pending/resolved approval requests with approve/reject actions
function ApprovalsTab({ onRefresh, toast }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [resolving, setResolving] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({ action: "", reason: "", targetName: "" });

  // Fetches approval requests filtered by the current status tab
  const load = useCallback(async () => {
    setLoading(true);
    try { setApprovals(await getApprovalRequests(filter)); }
    catch { setApprovals([]); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Approves or rejects an approval request and reloads the list
  async function resolve(id, type, note) {
    setResolving(id);
    try {
      await resolveApprovalRequest(id, type, note);
      toast(`Request ${type}d`);
      load();
      onRefresh();
    } catch (e) { toast(e.message); }
    finally { setResolving(null); }
  }

  // Submits a new approval request and refreshes the approval list
  async function createRequest() {
    if (!newForm.action.trim() || !newForm.reason.trim()) return;
    try {
      await createApprovalRequest(newForm);
      toast("Approval request submitted");
      setShowCreate(false);
      setNewForm({ action: "", reason: "", targetName: "" });
      load();
    } catch (e) { toast(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
          {["pending", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filter === s ? "bg-white text-[#8B2CF5] shadow-sm" : "text-gray-500"}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-[#8B2CF5] text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-[#6F00D2]">
            <Plus size={13} /> New Request
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-5 py-8"><GreetoLoader label="Loading approval requests..." sublabel="Checking access review queue" /></div>
        ) : approvals.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No {filter} approval requests</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {approvals.map(req => (
              <div key={req.id} className="px-6 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={req.status} />
                    <span className="text-xs font-mono text-gray-500">{req.action}</span>
                  </div>
                  {req.targetName && <p className="text-xs text-gray-700 font-medium truncate">{req.targetName}</p>}
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{req.reason}</p>
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    By {displayName(req.requester.firstName, req.requester.lastName, req.requester.email)} · {relTime(req.createdAt)}
                    {" · Expires "}{relTime(req.expiresAt)}
                  </p>
                </div>
                {req.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => resolve(req.id, "approve")}
                      disabled={resolving === req.id}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl hover:bg-emerald-100 disabled:opacity-40"
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      onClick={() => resolve(req.id, "reject")}
                      disabled={resolving === req.id}
                      className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl hover:bg-red-100 disabled:opacity-40"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create request modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-4">Request Approval</h3>
            <div className="space-y-3">
              <input placeholder="Action (e.g. tenant.suspend)" value={newForm.action}
                onChange={e => setNewForm(f => ({ ...f, action: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-300" />
              <input placeholder="Target (optional)" value={newForm.targetName}
                onChange={e => setNewForm(f => ({ ...f, targetName: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-300" />
              <textarea placeholder="Reason (required)" value={newForm.reason}
                onChange={e => setNewForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-300 resize-none h-24" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700">Cancel</button>
              <button onClick={createRequest} disabled={!newForm.action.trim() || !newForm.reason.trim()}
                className="flex-1 bg-[#8B2CF5] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#6F00D2] disabled:opacity-40">
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Audit Logs ──────────────────────────────────────────────────────────

// Tab panel displaying paginated audit log events with optional action keyword filter
function AuditTab({ toast }) {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  // Fetches a page of audit events, optionally filtered by action keyword
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminAuditLogs({ page, limit: 30, action: actionFilter });
      if (res?.success === false) throw new Error(res.message || "Unable to load audit logs");
      setEvents(Array.isArray(res?.events) ? res.events : []);
      setTotal(Number(res?.total ?? 0));
    } catch (e) { toast(e instanceof Error ? e.message : "Unable to load audit logs"); }
    finally { setLoading(false); }
  }, [page, actionFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const ACTION_COLOR = {
    "role.created": "bg-green-50 text-green-700",
    "role.deleted": "bg-red-50 text-red-600",
    "role.assigned": "bg-blue-50 text-blue-700",
    "role.revoked": "bg-amber-50 text-amber-700",
    "permission.assigned": "bg-purple-50 text-purple-700",
    "permission.revoked": "bg-orange-50 text-orange-700",
    "approval.approved": "bg-emerald-50 text-emerald-700",
    "approval.rejected": "bg-red-50 text-red-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          placeholder="Filter by action…"
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-300 w-56"
        />
        <button onClick={load} className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100">
          <RefreshCw size={14} />
        </button>
        <span className="text-xs text-gray-400 ml-auto">{total} events total</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr] gap-4 px-6 py-2.5 border-b border-gray-100 bg-gray-50/40">
          {["ADMIN", "ACTION", "TARGET", "IP", "TIME"].map(h => (
            <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="px-5 py-8"><GreetoLoader label="Loading audit trail..." sublabel="Reviewing access-control activity" /></div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No audit events found</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {events.map(ev => {
              const admin = ev.admin || {};
              return (
                <div key={ev.id} className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr] gap-4 items-center px-6 py-3.5 hover:bg-gray-50/30">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${bgColor(admin.id || "system")}`}>
                      {initials(displayName(admin.firstName, admin.lastName, admin.name), admin.email)}
                    </div>
                    <span className="text-xs text-gray-700 truncate">{displayName(admin.firstName, admin.lastName, admin.name || admin.email) || "System"}</span>
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ACTION_COLOR[ev.action] ?? "bg-gray-100 text-gray-600"}`}>
                      {ev.action}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 truncate">{ev.targetName ?? ev.targetEntity ?? "—"}</div>
                  <div className="text-[10px] text-gray-400 font-mono">{ev.ipAddress ?? "—"}</div>
                  <div className="text-[10px] text-gray-400">{relTime(ev.createdAt)}</div>
                </div>
              );
            })}
          </div>
        )}

        {total > 30 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="text-xs font-bold text-[#8B2CF5] disabled:text-gray-300">← Prev</button>
            <span className="text-xs text-gray-400">Page {page} of {Math.ceil(total / 30)}</span>
            <button disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(p => p + 1)}
              className="text-xs font-bold text-[#8B2CF5] disabled:text-gray-300">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Security Audit Modal (informational — configures & launches a manual review checklist) ─

const PROTOCOLS = [
  { id: "iam", label: "IAM Role Permissions Audit", badge: "CRUCIAL", badgeColor: "bg-emerald-400 text-white" },
  { id: "db", label: "Database Encryption Verification", badge: "CRUCIAL", badgeColor: "bg-emerald-400 text-white" },
  { id: "api", label: "Third-party API Entropy Check", badge: "STANDARD", badgeColor: "bg-orange-200 text-orange-700" },
];

const FINDING_STYLE = {
  pass: { icon: <Check size={14} />, badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "PASS" },
  warn: { icon: <ScanSearch size={14} />, badge: "bg-amber-50 text-amber-700 border-amber-200", label: "REVIEW" },
  fail: { icon: <XCircle size={14} />, badge: "bg-red-50 text-red-600 border-red-200", label: "FAIL" },
  info: { icon: <Info size={14} />, badge: "bg-gray-100 text-gray-600 border-gray-200", label: "INFO" },
};

// Modal that runs a real, live security audit against system state (roles, secrets, DB TLS, payment config)
function SecurityAuditModal({ onClose }) {
  const [checked, setChecked] = useState({ iam: true, db: true, api: true });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function startAudit() {
    setRunning(true);
    setError("");
    try {
      const res = await runSecurityAudit();
      if (res?.success === false) throw new Error(res.message || "Audit failed");
      setResult(res);
    } catch (e) {
      setError(e.message || "Unable to run security audit.");
    } finally {
      setRunning(false);
    }
  }

  const findings = result?.findings || [];
  const failCount = findings.filter((f) => f.status === "fail").length;
  const warnCount = findings.filter((f) => f.status === "warn").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-[#8B2CF5] px-7 py-5 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Security Audit</h2>
            <p className="text-sm text-purple-200 mt-0.5">
              {result ? `Ran just now — ${failCount} failing, ${warnCount} to review` : "Live checks against roles, secrets, database and payment config"}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={20} /></button>
        </div>

        <div className="px-7 py-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
          )}

          {!result && !running && (
            <>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Checks that will run</p>
                <div className="bg-gray-50/70 border border-gray-100 rounded-xl divide-y divide-gray-100/80">
                  {PROTOCOLS.map(proto => (
                    <label key={proto.id} className="flex items-center justify-between px-4 py-3.5 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div onClick={() => setChecked(p => ({ ...p, [proto.id]: !p[proto.id] }))}
                          className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 cursor-pointer transition-all ${checked[proto.id] ? "bg-[#8B2CF5] border-[#8B2CF5]" : "bg-white border-gray-300"}`}>
                          {checked[proto.id] && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{proto.label}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${proto.badgeColor}`}>{proto.badge}</span>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-gray-400 flex items-center gap-1.5"><Info size={11} /> Reads live user/role/permission/config state — makes no changes.</p>
            </>
          )}

          {running && (
            <div className="py-16 text-center">
              <RefreshCw size={22} className="mx-auto mb-3 animate-spin text-[#8B2CF5]" />
              <p className="text-sm font-bold text-gray-600">Running live checks…</p>
            </div>
          )}

          {result && !running && (
            <div className="space-y-2">
              {findings.map((f) => {
                const style = FINDING_STYLE[f.status] || FINDING_STYLE.info;
                return (
                  <div key={f.id} className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${style.badge}`}>{style.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{f.detail}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded-full border uppercase tracking-wider ${style.badge}`}>{style.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-7 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock size={14} />
            <span>{result ? `Completed at ${new Date(result.ranAt).toLocaleTimeString()}` : "Not run yet this session"}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600">Close</button>
            <button
              onClick={startAudit}
              disabled={running}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#8B2CF5] text-white text-sm font-bold rounded-xl disabled:opacity-50"
            >
              {result ? "Run Again" : "Start Audit"} {!running && <ChevronRight size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function AccessControlPage() {
  const [tab, setTab] = useState("roles");
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [syncingPresets, setSyncingPresets] = useState(false);

  // Shows a temporary toast notification and auto-clears it after 3.5 seconds
  function toast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  // Fetches roles, permissions, admins, and pending approvals in parallel on mount and refresh
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p, a, approvals] = await Promise.allSettled([
        getAccessControlRoles(),
        getAccessControlPermissions(),
        getAccessControlAdmins(),
        getApprovalRequests("pending"),
      ]);
      if (r.status === "fulfilled") setRoles(r.value);
      if (p.status === "fulfilled") setPermissions(p.value);
      if (a.status === "fulfilled") setAdmins(a.value);
      if (approvals.status === "fulfilled") setPendingCount(approvals.value.length);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleSyncInternalRolePresets() {
    setSyncingPresets(true);
    try {
      const result = await syncInternalRolePresets();
      toast(`Synced ${result.roles?.length || 0} internal role presets`);
      await loadAll();
    } catch (e) {
      toast(e.message);
    } finally {
      setSyncingPresets(false);
    }
  }

  const TABS = [
    { key: "roles", label: "Roles & Permissions" },
    { key: "admins", label: "Admins" },
    { key: "approvals", label: "Approvals", badge: pendingCount > 0 ? pendingCount : undefined },
    { key: "audit", label: "Audit Logs" },
  ];

  const mfaOk = admins.filter(a => a.isActive).length;
  const mfaPct = admins.length > 0 ? Math.round((mfaOk / admins.length) * 100) : 0;

  return (
    <>
      {showAuditModal && <SecurityAuditModal onClose={() => setShowAuditModal(false)} />}
      {toastMsg && <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />}

      <div className="min-h-full bg-[#f4f1fb] space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-500">Admin Control Room</p>
            <h1 className="text-3xl font-bold text-slate-950 tracking-tight mt-2">Access &amp; Permissions</h1>
            <p className="text-sm text-gray-500 mt-1">RBAC control for administrative hierarchy and internal user privileges.</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button onClick={handleSyncInternalRolePresets} disabled={syncingPresets} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 hover:bg-purple-100 rounded-xl transition-all disabled:opacity-50">
              <ShieldCheck size={14} /> {syncingPresets ? "Syncing..." : "Sync Internal Roles"}
            </button>
            <button onClick={loadAll} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-all">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => setShowAuditModal(true)} className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-all">
              <Clock size={14} /> Security Audit
            </button>
            <button onClick={() => setTab("admins")} className="flex items-center gap-1.5 bg-[#8B2CF5] hover:bg-[#6F00D2] text-white font-bold py-2.5 px-4 rounded-xl text-xs">
              <UserPlus size={15} /> Invite Admin
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${tab === t.key ? "bg-white text-[#8B2CF5] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t.label}
              {t.badge && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <GreetoLoader fullScreen label="Loading access control..." sublabel="Preparing roles, administrators, and permissions" />
        ) : tab === "roles" ? (
          <RolesTab roles={roles} permissions={permissions} onRefresh={loadAll} toast={toast} />
        ) : tab === "admins" ? (
          <AdminsTab admins={admins} roles={roles} onRefresh={loadAll} toast={toast} />
        ) : tab === "approvals" ? (
          <ApprovalsTab onRefresh={loadAll} toast={toast} />
        ) : (
          <AuditTab toast={toast} />
        )}

        {/* Security enforcement banner */}
        <div className="bg-purple-50 border border-purple-100 rounded-2xl px-6 py-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center shrink-0">
              {[...Array(Math.min(4, admins.length))].map((_, i) => (
                <div key={i} className={`w-9 h-9 rounded-full border-2 border-white ${BG_COLORS[i % BG_COLORS.length]} ${i > 0 ? "-ml-3" : ""} flex items-center justify-center text-white text-[9px] font-bold`}>
                  {initials(displayName(admins[i]?.firstName, admins[i]?.lastName), admins[i]?.email)}
                </div>
              ))}
              {admins.length > 4 && (
                <div className="-ml-3 w-9 h-9 rounded-full border-2 border-white bg-gray-700 flex items-center justify-center text-white text-[9px] font-bold">
                  +{admins.length - 4}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Security Enforcement</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {admins.length} admin{admins.length !== 1 ? "s" : ""} across {roles.length} roles · {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-gray-700">{mfaPct}% Active Admins</p>
              <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-[#8B2CF5] rounded-full" style={{ width: `${mfaPct}%` }} />
              </div>
            </div>
            <button onClick={() => setShowAuditModal(true)}
              className="shrink-0 px-5 py-2.5 border border-[#8B2CF5] text-[#8B2CF5] hover:bg-[#8B2CF5] hover:text-white font-bold text-xs rounded-xl transition-all">
              Run Security Audit
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
