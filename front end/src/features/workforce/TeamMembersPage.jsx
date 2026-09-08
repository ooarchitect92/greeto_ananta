'use strict';
import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, Shield, ShieldCheck, Mail, Search, ChevronLeft, ChevronRight, Filter, X, Edit2, Check, User, Trash2, UserPlus, Database, Activity, ArrowLeft, KeyRound, BookOpen, Languages, UsersRound, Building2, Copy, Link2 } from 'lucide-react';
import {
  createDepartment, createOrganizationTeam, createTeamUser, deleteDepartment,
  deleteOrganizationTeam, deleteTeamUser, getLocalTeamUsers, getTeamOrganization,
  getTeamUsers, updateDepartment, updateOrganizationTeam, updateTeamUser,
  createWorkspaceInvite, resendWorkspaceInvite, revokeWorkspaceInvite,
  updateWorkspaceMemberRole, updateWorkspaceMemberStatus, getWorkspaceMembers, getWorkspaceInvites,
  getWorkspaceLoginPolicy, updateWorkspaceLoginPolicy,
} from './api.js';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import ViewToggle from '../../components/ui/ViewToggle.jsx';

export default function TeamMembersPage({ onNavigate, adminMode = false }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamSource, setTeamSource] = useState('local'); // 'xolox' | 'local'

  // Edit State
  const [editingUser, setEditingUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    course: '',
    language: '',
    location: ''
  });

  // Create State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    role: 'agent',
    courses: '',
    languages: '',
    locations: ''
  });

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [activeTab, setActiveTab] = useState('members');
  const [organization, setOrganization] = useState({ departments: [], teams: [] });
  const [organizationModal, setOrganizationModal] = useState(null);
  const [organizationForm, setOrganizationForm] = useState({ name: '', code: '', description: '', departmentId: '' });
  const [organizationBusy, setOrganizationBusy] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', workspaceRoleKey: 'member' });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [activeAccessMembers, setActiveAccessMembers] = useState([]);
  const [inactiveAccessMembers, setInactiveAccessMembers] = useState([]);
  const [activeAccessPagination, setActiveAccessPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [inactiveAccessPagination, setInactiveAccessPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [activeAccessSearch, setActiveAccessSearch] = useState('');
  const [inactiveAccessSearch, setInactiveAccessSearch] = useState('');
  const [activeAccessRole, setActiveAccessRole] = useState('all');
  const [inactiveAccessRole, setInactiveAccessRole] = useState('all');
  const [accessMemberView, setAccessMemberView] = useState('active');
  const [accessLoading, setAccessLoading] = useState(false);
  const [workspaceInvites, setWorkspaceInvites] = useState([]);
  const [invitePagination, setInvitePagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [inviteStatus, setInviteStatus] = useState('pending');
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [loginPolicy, setLoginPolicy] = useState({ loginSource: 'local', xoloxConnected: false });
  const [loginPolicyBusy, setLoginPolicyBusy] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        setError(null);
        const fetcher = teamSource === 'xolox' ? getTeamUsers : getLocalTeamUsers;
        const res = await fetcher();
        // Handle response format: { success: true, data: { count: 57, data: [...] } }
        let data = [];
        if (res && res.data && Array.isArray(res.data.data)) {
            data = res.data.data;
        } else if (res && Array.isArray(res.data)) {
            data = res.data;
        } else if (Array.isArray(res)) {
            data = res;
        }
        setUsers(data);
      } catch (err) {
        console.error('Failed to load team users:', err);
        setUsers([]);
        setError(err.message || 'Failed to load team members.');
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [teamSource]);

  const loadOrganization = async () => {
    try {
      const res = await getTeamOrganization();
      if (res.success) setOrganization(res.data || { departments: [], teams: [] });
    } catch (err) {
      setError(err.message || 'Failed to load teams and departments.');
    }
  };

  useEffect(() => { loadOrganization(); }, []);

  const loadLoginPolicy = async () => {
    try {
      const result = await getWorkspaceLoginPolicy();
      if (result.success) {
        const policy = result.data || { loginSource: 'local', xoloxConnected: false };
        setLoginPolicy(policy);
        setTeamSource(policy.loginSource === 'xolox' ? 'xolox' : 'local');
      }
    } catch (err) {
      setError(err.message || 'Unable to load workspace sign-in policy.');
    }
  };

  useEffect(() => { loadLoginPolicy(); }, []);

  const changeLoginPolicy = async (loginSource) => {
    if (loginSource === loginPolicy.loginSource || loginPolicyBusy) return;
    if (loginSource === 'xolox' && !loginPolicy.xoloxConnected) {
      setError('Connect XOLOX CRM before enabling XOLOX sign-in.');
      return;
    }
    const confirmed = await confirmAction({
      title: loginSource === 'xolox' ? 'Use XOLOX sign-in?' : 'Use local sign-in?',
      message: loginSource === 'xolox'
        ? 'Local password sign-in will be disabled for this workspace. Members will sign in through the connected XOLOX CRM.'
        : 'XOLOX sign-in will be disabled for this workspace. Local Greeto password accounts can sign in again.',
      confirmLabel: loginSource === 'xolox' ? 'Enable XOLOX sign-in' : 'Use local sign-in',
      tone: loginSource === 'xolox' ? 'warning' : 'default',
    });
    if (!confirmed) return;
    try {
      setLoginPolicyBusy(true);
      const result = await updateWorkspaceLoginPolicy(loginSource);
      if (!result.success) throw new Error(result.message || 'Unable to update sign-in policy.');
      setLoginPolicy((current) => ({ ...current, loginSource: result.data.loginSource }));
      setTeamSource(loginSource === 'xolox' ? 'xolox' : 'local');
    } catch (err) {
      setError(err.message || 'Unable to update workspace sign-in policy.');
    } finally { setLoginPolicyBusy(false); }
  };

  const loadAccessMembers = async (status, page = 1) => {
    try {
      setAccessLoading(true);
      const search = status === 'active' ? activeAccessSearch : inactiveAccessSearch;
      const role = status === 'active' ? activeAccessRole : inactiveAccessRole;
      const result = await getWorkspaceMembers({ page, limit: 10, status, search, role });
      if (!result.success) throw new Error(result.message || 'Unable to load workspace members.');
      if (status === 'active') {
        setActiveAccessMembers(result.data || []);
        setActiveAccessPagination(result.pagination || { page, limit: 10, total: 0, totalPages: 1 });
      } else {
        setInactiveAccessMembers(result.data || []);
        setInactiveAccessPagination(result.pagination || { page, limit: 10, total: 0, totalPages: 1 });
      }
    } catch (err) {
      setError(err.message || 'Unable to load workspace members.');
    } finally { setAccessLoading(false); }
  };

  const loadWorkspaceInvites = async (page = 1) => {
    try {
      setInviteLoading(true);
      const result = await getWorkspaceInvites({ page, limit: 10, status: inviteStatus, search: inviteSearch });
      if (!result.success) throw new Error(result.message || 'Unable to load invitations.');
      setWorkspaceInvites(result.data || []);
      setInvitePagination(result.pagination || { page, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Unable to load invitations.');
    } finally { setInviteLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'roles') {
      loadAccessMembers('active', 1);
      loadWorkspaceInvites(1);
    }
  }, [activeTab, inviteStatus]);

  useEffect(() => {
    if (activeTab === 'roles' && accessMemberView === 'inactive' && !inactiveAccessMembers.length) {
      loadAccessMembers('inactive', 1);
    }
  }, [activeTab, accessMemberView]);

  const openOrganizationForm = (type, item = null) => {
    setOrganizationModal({ type, item });
    setOrganizationForm({
      name: item?.name || '',
      code: item?.department_code || '',
      description: item?.description || '',
      departmentId: item?.department_id || '',
    });
  };

  const saveOrganization = async (event) => {
    event.preventDefault();
    if (!organizationForm.name.trim()) return;
    setOrganizationBusy(true);
    setError(null);
    try {
      const { type, item } = organizationModal;
      const payload = type === 'department'
        ? { name: organizationForm.name, departmentCode: organizationForm.code, description: organizationForm.description }
        : { name: organizationForm.name, departmentId: organizationForm.departmentId || null, description: organizationForm.description };
      const res = type === 'department'
        ? (item ? await updateDepartment(item.id, payload) : await createDepartment(payload))
        : (item ? await updateOrganizationTeam(item.id, payload) : await createOrganizationTeam(payload));
      if (!res.success) throw new Error(res.message || `Unable to save ${type}`);
      setOrganizationModal(null);
      await loadOrganization();
      await loadWorkspaceInvites(1);
    } catch (err) {
      setError(err.message || 'Unable to save organization record.');
    } finally {
      setOrganizationBusy(false);
    }
  };

  const removeOrganization = async (type, item) => {
    if (!(await confirmAction({
      title: `Delete ${type}?`,
      message: `${item.name} will be removed. Existing members are not deleted.`,
      confirmLabel: `Delete ${type}`,
      tone: 'danger',
    }))) return;
    try {
      const res = type === 'department' ? await deleteDepartment(item.id) : await deleteOrganizationTeam(item.id);
      if (!res.success) throw new Error(res.message || `Unable to delete ${type}`);
      await loadOrganization();
      await loadWorkspaceInvites(1);
    } catch (err) {
      setError(err.message || `Unable to delete ${type}.`);
    }
  };

  // Filter Logic
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = (
        (user.firstname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.lastname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.role || '').toLowerCase().includes(searchTerm.toLowerCase())
      );

      const matchesRole = roleFilter === 'all' || (user.role || '') === roleFilter;
      
      const userStatus = user.isBlocked ? 'blocked' : (user.status || 'logout');
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'blocked' && user.isBlocked) ||
        (statusFilter === 'active' && userStatus === 'active') ||
        (statusFilter === 'logout' && userStatus === 'logout');

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  const uniqueRoles = useMemo(() => {
    const roles = new Set(users.map(u => u.role).filter(Boolean));
    return Array.from(roles);
  }, [users]);

  const uniqueDepartments = useMemo(() => {
    const departments = new Set(users.map(u => u.department).filter(Boolean));
    return Array.from(departments);
  }, [users]);

  const groupedBy = (field, fallback) => Array.from(users.reduce((groups, member) => {
    const rawValue = typeof field === 'function' ? field(member) : member[field];
    const label = String(rawValue || fallback).trim() || fallback;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(member);
    return groups;
  }, new Map()), ([name, members]) => ({ name, members }));

  const derivedTeamGroups = useMemo(() => groupedBy(
    member => member.teamName || member.team_name || member.team || member.department,
    teamSource === 'local' ? 'Primary team' : 'XOLOX CRM team',
  ), [users, teamSource]);

  const teamGroups = organization.teams?.length
    ? organization.teams.map((team) => ({ ...team, members: users.filter((member) => String(member.teamId || member.team_id || '') === String(team.id)) }))
    : derivedTeamGroups;

  const roleGroups = useMemo(() => groupedBy('role', 'Agent'), [users]);
  const derivedDepartmentGroups = useMemo(() => groupedBy('department', 'Unassigned department'), [users]);
  const departmentGroups = organization.departments?.length
    ? organization.departments.map((department) => ({ ...department, members: users.filter((member) => String(member.department || '') === department.name) }))
    : derivedDepartmentGroups;

  const saveInvite = async (event) => {
    event.preventDefault();
    setInviteBusy(true);
    setError(null);
    try {
      const result = await createWorkspaceInvite(inviteForm);
      if (!result.success) throw new Error(result.message || 'Unable to create invite.');
      setInviteModalOpen(false);
      setInviteForm({ name: '', email: '', workspaceRoleKey: 'member' });
      setInviteLink(result.data?.link ? { url: result.data.link, email: result.data.email } : null);
      setInviteLinkCopied(false);
      await loadOrganization();
    } catch (err) {
      setError(err.message || 'Unable to create invite.');
    } finally {
      setInviteBusy(false);
    }
  };

  const updateInvite = async (invite, action) => {
    try {
      const result = action === 'resend' ? await resendWorkspaceInvite(invite.id) : await revokeWorkspaceInvite(invite.id);
      if (!result.success) throw new Error(result.message || `Unable to ${action} invite.`);
      if (action === 'resend' && result.data?.link) {
        setInviteLink({ url: result.data.link, email: result.data.email || invite.email });
        setInviteLinkCopied(false);
      }
      await loadOrganization();
    } catch (err) {
      setError(err.message || `Unable to ${action} invite.`);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink?.url) return;
    try {
      await navigator.clipboard.writeText(inviteLink.url);
      setInviteLinkCopied(true);
    } catch {
      setError('Unable to copy automatically. Select and copy the invitation link manually.');
    }
  };

  const changeMemberAccess = async (member, payload) => {
    if (payload.active !== undefined) {
      const action = payload.active ? 'activate' : 'deactivate';
      const confirmed = await confirmAction({
        title: `${payload.active ? 'Activate' : 'Deactivate'} member?`,
        message: payload.active
          ? `${member.name || member.email} will regain workspace access immediately.`
          : `${member.name || member.email} will lose workspace access and cannot sign in until reactivated.`,
        confirmLabel: `${action[0].toUpperCase()}${action.slice(1)} member`,
        tone: payload.active ? 'default' : 'danger',
      });
      if (!confirmed) return;
    }
    try {
      const result = payload.workspaceRoleKey
        ? await updateWorkspaceMemberRole(member.id, payload.workspaceRoleKey)
        : await updateWorkspaceMemberStatus(member.id, payload.active);
      if (!result.success) throw new Error(result.message || 'Unable to update member access.');
      await loadOrganization();
      await loadAccessMembers('active', activeAccessPagination.page);
      await loadAccessMembers('inactive', inactiveAccessPagination.page);
      if (payload.active !== undefined) {
        setUsers((current) => current.map((user) => String(user.id) === String(member.id) ? { ...user, status: payload.active ? 'active' : 'logout' } : user));
      }
    } catch (err) {
      setError(err.message || 'Unable to update member access.');
    }
  };

  const handleEditClick = (user) => {
    const attrs = user.attributes || {};
    setEditingUser(user);
    
    // Normalize to strings for editing
    let courseText = '';
    if (Array.isArray(attrs.courses)) courseText = attrs.courses.join(', ');
    else if (attrs.course) courseText = attrs.course;

    let langText = '';
    if (Array.isArray(attrs.languages)) langText = attrs.languages.join(', ');
    else if (attrs.language) langText = attrs.language;

    let locationText = '';
    if (Array.isArray(attrs.cities)) locationText = attrs.cities.join(', ');
    else if (Array.isArray(attrs.locations)) locationText = attrs.locations.join(', ');
    else if (attrs.city || attrs.location) locationText = attrs.city || attrs.location;

    setEditFormData({
        course: courseText,
        language: langText,
        location: locationText
    });
    setIsEditModalOpen(true);
  };

  const handleSaveAttributes = async () => {
    if (!editingUser) return;
    try {
        const attributes = {
            courses: editFormData.course.split(',').map(s => s.trim()).filter(Boolean),
            languages: editFormData.language.split(',').map(s => s.trim()).filter(Boolean),
            cities: editFormData.location.split(',').map(s => s.trim()).filter(Boolean)
        };
        const res = await updateTeamUser(editingUser.id, { attributes });
        if (res.success) {
            // Update local state
            setUsers(users.map(u => u.id === editingUser.id ? { ...u, attributes } : u));
            setIsEditModalOpen(false);
            setEditingUser(null);
        } else {
            alert('Failed to update user attributes');
        }
    } catch (err) {
        console.error('Failed to update user:', err);
        alert('Error updating user');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!(await confirmAction({
      title: 'Delete team member?',
      message: 'Are you sure you want to delete this local user? This action cannot be undone.',
      confirmLabel: 'Delete member',
      tone: 'danger',
    }))) return;
    try {
        const res = await deleteTeamUser(id);
        if (res.success) {
            setUsers(users.filter(u => u.id !== id));
        } else {
            alert(res.error || 'Failed to delete user');
        }
    } catch (err) {
        console.error('Delete failed:', err);
        alert('Error deleting user');
    }
  };

  if (loading) {
    return (
      <GreetoLoader fullScreen label="Loading team members..." sublabel="Fetching workspace team members" />
    );
  }


  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        firstname: createFormData.firstname,
        lastname: createFormData.lastname,
        email: createFormData.email,
        password: createFormData.password,
        role: createFormData.role,
        attributes: {
          courses: createFormData.courses ? createFormData.courses.split(',').map(s => s.trim()).filter(Boolean) : [],
          languages: createFormData.languages ? createFormData.languages.split(',').map(s => s.trim()).filter(Boolean) : [],
          cities: createFormData.locations ? createFormData.locations.split(',').map(s => s.trim()).filter(Boolean) : []
        }
      };
      const res = await createTeamUser(payload);
      if (res.success) {
        setUsers([...users, res.user]);
        setIsCreateModalOpen(false);
        setCreateFormData({ firstname: '', lastname: '', email: '', password: '', role: 'agent', courses: '', languages: '', locations: '' });
      } else {
        alert(res.error || 'Failed to create user');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating user');
    }
  };

  const teamStats = {
    total: users.length,
    visible: filteredUsers.length,
    active: users.filter(u => !u.isBlocked && u.status === 'active').length,
    blocked: users.filter(u => u.isBlocked).length,
  };

  const teamTabs = [
    { id: 'members', label: 'Members', description: 'People and invitations', icon: User, count: teamStats.total },
    { id: 'teams', label: 'Teams', description: 'Working groups', icon: UsersRound, count: organization.teams?.length || (uniqueDepartments.length || 0) },
    { id: 'roles', label: 'Roles & Permissions', description: 'Access control', icon: ShieldCheck, count: uniqueRoles.length || 0 },
    { id: 'departments', label: 'Departments', description: 'Business functions', icon: Building2, count: organization.departments?.length || (uniqueDepartments.length || 0) },
  ];

  const readinessCards = [
    {
      title: 'Internal team readiness',
      value: teamStats.active,
      caption: `${teamStats.total} total members`,
      status: teamStats.active > 0 ? 'Ready' : 'Pending',
      icon: User,
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    },
    {
      title: 'Assignment capacity',
      value: teamStats.visible,
      caption: `${teamSource === 'local' ? 'Local native' : 'XOLOX CRM'} source visible`,
      status: teamStats.visible > 0 ? 'Ready' : 'Review',
      icon: Activity,
      tone: 'text-purple-700 bg-purple-50 border-purple-100',
    },
    {
      title: 'Permission model',
      value: uniqueRoles.length,
      caption: 'Roles detected from team records',
      status: uniqueRoles.length > 0 ? 'Ready' : 'Pending',
      icon: ShieldCheck,
      tone: 'text-indigo-700 bg-indigo-50 border-indigo-100',
    },
  ];

  if (isCreateModalOpen) {
    const previewName = `${createFormData.firstname || 'New'} ${createFormData.lastname || 'Member'}`.trim();
    const previewCourses = createFormData.courses.split(',').map(s => s.trim()).filter(Boolean);
    const previewLanguages = createFormData.languages.split(',').map(s => s.trim()).filter(Boolean);

    return (
      <div className="flex-1 overflow-y-auto bg-[#f5f4fb] px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-[1440px] space-y-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Back to Team Members"
                title="Back to Team Members"
                className="h-10 w-10 rounded-lg border-gray-200 p-0 text-purple-700 hover:bg-purple-50"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">People operations</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">Add local member</h1>
                <p className="mt-1 text-sm text-gray-500">Create a native Greeto user for inbox assignment, workflow ownership and internal operations.</p>
              </div>
            </div>
            <Badge className="border-purple-200 bg-purple-50 text-purple-700 shadow-sm">
              Local native account
            </Badge>
          </div>

        <form onSubmit={handleCreateUser}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <Card className="overflow-hidden rounded-2xl border-gray-200 bg-white shadow-sm">
                <CardHeader className="border-b border-gray-100 bg-white">
                  <CardTitle className="flex items-center gap-2 text-slate-950">
                    <UserPlus className="h-5 w-5 text-purple-600" />
                    Member Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">First Name <span className="text-red-500">*</span></label>
                      <Input
                        placeholder="John"
                        required
                        value={createFormData.firstname}
                        onChange={(e) => setCreateFormData({ ...createFormData, firstname: e.target.value })}
                        className="h-11 rounded-lg border-gray-200 bg-white focus-visible:ring-purple-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Last Name</label>
                      <Input
                        placeholder="Doe"
                        value={createFormData.lastname}
                        onChange={(e) => setCreateFormData({ ...createFormData, lastname: e.target.value })}
                        className="h-11 rounded-lg border-gray-200 bg-white focus-visible:ring-purple-100"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Email Address <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="email"
                          required
                          placeholder="john@example.com"
                          value={createFormData.email}
                          onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                          className="h-11 rounded-lg border-gray-200 bg-white pl-11 focus-visible:ring-purple-100"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="password"
                          required
                          placeholder="Enter a strong password"
                          value={createFormData.password}
                          onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                          className="h-11 rounded-lg border-gray-200 bg-white pl-11 focus-visible:ring-purple-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Role <span className="text-red-500">*</span></label>
                    <select
                      required
                      className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-slate-900 capitalize focus:outline-none focus:ring-2 focus:ring-purple-100"
                      value={createFormData.role}
                      onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
                    >
                      <option value="agent">Agent</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="quality_manager">Quality Manager</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-2xl border-gray-200 bg-white shadow-sm">
                <CardHeader className="border-b border-gray-100 bg-white">
                  <CardTitle className="flex items-center gap-2 text-slate-950">
                    <Shield className="h-5 w-5 text-purple-600" />
                    Routing Skills
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Courses</label>
                      <div className="relative">
                        <BookOpen className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="CPA, CMA, ACCA"
                          value={createFormData.courses}
                          onChange={(e) => setCreateFormData({ ...createFormData, courses: e.target.value })}
                          className="h-11 rounded-lg border-gray-200 bg-white pl-11 focus-visible:ring-purple-100"
                        />
                      </div>
                      <p className="text-xs text-slate-500">Comma separated course skills for assignment rules.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Languages</label>
                      <div className="relative">
                        <Languages className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="English, Hindi"
                          value={createFormData.languages}
                          onChange={(e) => setCreateFormData({ ...createFormData, languages: e.target.value })}
                          className="h-11 rounded-lg border-gray-200 bg-white pl-11 focus-visible:ring-purple-100"
                        />
                      </div>
                      <p className="text-xs text-slate-500">Used by workflow and inbox routing logic.</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-semibold text-slate-700">Cities / Locations</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="Bangalore, Delhi, Hyderabad"
                          value={createFormData.locations}
                          onChange={(e) => setCreateFormData({ ...createFormData, locations: e.target.value })}
                          className="h-11 rounded-lg border-gray-200 bg-white pl-11 focus-visible:ring-purple-100"
                        />
                      </div>
                      <p className="text-xs text-slate-500">Only matching city/location leads are selected from this role pool.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border-gray-200 px-6 text-slate-700 hover:bg-purple-50"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-lg bg-[#7928ca] px-6 text-white hover:bg-[#6821ad]">
                  <Check className="h-4 w-4 mr-2" />
                  Create Member
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="overflow-hidden rounded-2xl border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 bg-purple-50 p-6 text-gray-950">
                  <div className="h-14 w-14 rounded-2xl bg-[#7928ca] flex items-center justify-center text-xl font-bold text-white">
                    {(createFormData.firstname?.[0] || createFormData.email?.[0] || 'N').toUpperCase()}
                  </div>
                  <h2 className="mt-4 text-xl font-bold">{previewName}</h2>
                  <p className="text-sm text-gray-500">{createFormData.email || 'member@example.com'}</p>
                </div>
                <CardContent className="p-6 space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Role</p>
                    <Badge className="mt-2 border-purple-100 bg-purple-50 text-purple-700 capitalize">
                      {createFormData.role.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Courses</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(previewCourses.length ? previewCourses : ['Not set']).map(course => (
                        <span key={course} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          {course}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Languages</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(previewLanguages.length ? previewLanguages : ['Not set']).map(language => (
                        <span key={language} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          {language}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-slate-900">Where this member is used</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex gap-3">
                    <span className="mt-0.5 h-6 w-6 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-xs font-bold">1</span>
                    <p>Inbox assignment and reassignment lists.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="mt-0.5 h-6 w-6 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-xs font-bold">2</span>
                    <p>Workflow routing based on course and language skills.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="mt-0.5 h-6 w-6 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-xs font-bold">3</span>
                    <p>Local team operations continue without a CRM connection.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-[#f5f4fb] px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
      <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-5">
        <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600">People operations</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">Team management</h1>
            <p className="mt-1 text-sm text-gray-500">Manage local members, optional XOLOX CRM users, routing skills, roles, and assignment readiness.</p>
          </div>
          <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2 2xl:w-auto 2xl:min-w-[680px] 2xl:grid-cols-4">
            {teamTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                  activeTab === tab.id
                    ? 'border-purple-200 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-purple-100 hover:bg-purple-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em]">{tab.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-900 shadow-sm">{tab.count}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{tab.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 gap-3 lg:grid-cols-3">
          {readinessCards.map((item) => (
            <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${item.tone}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${item.tone}`}>{item.status}</span>
              </div>
              <p className="mt-4 text-2xl font-bold text-gray-950">{item.value}</p>
              <p className="text-sm font-semibold text-gray-700">{item.title}</p>
              <p className="mt-1 text-xs text-gray-500">{item.caption}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {teamTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                  activeTab === tab.id
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
                  <tab.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{tab.label}</span>
                  <span className="block truncate text-xs text-gray-500">{tab.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'members' && (
          <>
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Workspace sign-in</p>
                <p className="mt-1 text-xs text-slate-500">Turn XOLOX sign-in on to use CRM users and CRM credentials. Turn it off to use local Greeto users.</p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Workspace sign-in source">
                <button type="button" disabled={loginPolicyBusy} onClick={() => changeLoginPolicy('local')} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${loginPolicy.loginSource === 'local' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Local Greeto</button>
                <button type="button" aria-pressed={loginPolicy.loginSource === 'xolox'} disabled={loginPolicyBusy || !loginPolicy.xoloxConnected} onClick={() => changeLoginPolicy('xolox')} className={`rounded-md px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${loginPolicy.loginSource === 'xolox' ? 'bg-purple-700 text-white shadow-sm' : 'text-slate-500 hover:text-purple-700'}`}>XOLOX sign-in</button>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTeamSource('xolox')}
                  className={`h-10 rounded-lg border px-4 text-sm font-semibold transition ${
                    teamSource === 'xolox'
                      ? 'border-purple-200 bg-purple-700 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  XOLOX CRM Users
                </button>
                <button
                  type="button"
                  onClick={() => setTeamSource('local')}
                  className={`h-10 rounded-lg border px-4 text-sm font-semibold transition ${
                    teamSource === 'local'
                      ? 'border-purple-200 bg-purple-700 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                  }`}
                >
                  Local Native Users
                </button>
                {teamSource === 'local' && (
                  <>
                    <Button onClick={() => setInviteModalOpen(true)} className="h-10 rounded-lg bg-[#7928ca] px-4 text-white hover:bg-[#6821ad]">
                      <UserPlus className="mr-2 h-4 w-4" /> Invite Member
                    </Button>
                    <Button onClick={() => setIsCreateModalOpen(true)} variant="outline" className="h-10 rounded-lg border-purple-200 px-4 text-purple-700 hover:bg-purple-50">
                      Add Local Member
                    </Button>
                  </>
                )}
              </div>
              <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap 2xl:w-auto 2xl:flex-nowrap">
                <div className="relative min-w-0 flex-1 sm:min-w-[240px] 2xl:w-80 2xl:flex-none">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, or role..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 rounded-lg border-gray-200 bg-white pl-9 focus-visible:ring-purple-100"
                  />
                </div>
                <ViewToggle value={viewMode} onChange={setViewMode} className="shrink-0" />
                <select
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  {uniqueRoles.map(role => (
                    <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Available</option>
                  <option value="logout">Logged Out</option>
                  <option value="blocked">Blocked</option>
                </select>
                {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSearchTerm('');
                      setRoleFilter('all');
                      setStatusFilter('all');
                    }}
                    title="Clear filters"
                    className="h-10 w-10 rounded-lg"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </Button>
                )}
              </div>
            </div>

        <Card className="overflow-hidden rounded-2xl border-gray-200 bg-white shadow-sm">
          <CardHeader className="border-b border-gray-100 bg-white">
            <CardTitle className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-purple-600" />
                <span>{filteredUsers.length} Members</span>
              </div>
              <div className="text-sm font-normal text-slate-500">
                Page {currentPage} of {totalPages || 1}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-12 text-center">
                <Database className="h-8 w-8 text-amber-400" />
                <p className="max-w-md text-sm font-semibold text-amber-800">
                  {teamSource === 'xolox' && /not connected/i.test(error)
                    ? "XOLOX CRM is connected with a base URL only — an API key hasn't been added yet, so live XOLOX users can't be fetched."
                    : error}
                </p>
                {teamSource === 'xolox' && /not connected/i.test(error) ? (
                  <p className="max-w-md text-xs text-amber-700">
                    Add an API key under Settings → Integrations → XOLOX CRM to view live users here, or switch to Local Native Users below.
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => setTeamSource('local')}
                  className="mt-1 h-9 rounded-lg border-amber-200 text-amber-800 hover:bg-amber-100"
                >
                  View Local Native Users
                </Button>
              </div>
            )}
            {!error && viewMode === 'board' && (
              <div className="grid min-h-[400px] min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {paginatedUsers.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-slate-500">
                    <Filter className="h-8 w-8 text-slate-300" />
                    <p>No team members found matching your filters.</p>
                    <Button
                      variant="link"
                      onClick={() => {
                        setSearchTerm('');
                        setRoleFilter('all');
                        setStatusFilter('all');
                      }}
                    >
                      Clear all filters
                    </Button>
                  </div>
                ) : paginatedUsers.map((user) => {
                  const isBlocked = user.isBlocked;
                  const status = user.status;
                  const statusText = isBlocked ? 'Blocked' : status === 'active' ? 'Available' : status === 'logout' ? 'Logged Out' : (status || 'Unknown');
                  const badgeClass = isBlocked
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : status === 'logout'
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : 'text-slate-500 border-slate-200';
                  const displayName = `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.name || 'Unknown';

                  return (
                    <div key={user._id || user.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-100 hover:shadow-md">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-purple-200 bg-purple-100 text-base font-bold text-purple-700">
                          {(displayName?.[0] || user.email?.[0] || '?').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-bold text-slate-950">{displayName}</p>
                          <p className="truncate text-xs font-semibold text-slate-400">{user.email}</p>
                        </div>
                        <Badge variant="outline" className={`capitalize ${badgeClass}`}>{statusText}</Badge>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</p>
                          <p className="mt-1 truncate text-sm font-bold capitalize text-slate-800">{user.role?.replace(/_/g, ' ') || 'Member'}</p>
                        </div>
                        <div className="rounded-2xl bg-purple-50 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Department</p>
                          <p className="mt-1 truncate text-sm font-bold capitalize text-purple-800">{user.department || 'General'}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1">
                        {Array.isArray(user.attributes?.courses) && user.attributes.courses.slice(0, 4).map(c => (
                          <Badge key={c} variant="outline" className="border-purple-200 bg-purple-50 text-[10px] text-purple-700">{c}</Badge>
                        ))}
                        {Array.isArray(user.attributes?.languages) && user.attributes.languages.slice(0, 4).map(l => (
                          <Badge key={l} variant="outline" className="border-indigo-200 bg-indigo-50 text-[10px] text-indigo-700">{l}</Badge>
                        ))}
                        {!user.attributes?.courses?.length && !user.attributes?.languages?.length && (
                          <span className="text-xs italic text-slate-400">No skills set</span>
                        )}
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-xs font-semibold text-slate-400">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-500 hover:text-purple-700" onClick={() => handleEditClick(user)}>
                            <Edit2 className="mr-1 h-3 w-3" /> Edit
                          </Button>
                          {teamSource === 'local' && (
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-500 hover:text-red-600" onClick={() => handleDeleteUser(user.id)}>
                              <Trash2 className="mr-1 h-3 w-3" /> Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!error && viewMode === 'table' && <div className="overflow-x-auto min-h-[400px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-purple-50/50">
                    <th className="py-3 px-4 font-medium rounded-tl-lg">User</th>
                    <th className="py-3 px-4 font-medium">Role</th>
                    <th className="py-3 px-4 font-medium">Skills</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium rounded-tr-lg">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedUsers.map((user) => {
                    const isBlocked = user.isBlocked;
                    const status = user.status;
                    let badgeVariant = "outline";
                    let badgeClass = "text-slate-500 border-slate-200";
                    let statusText = status || "Unknown";

                    if (isBlocked) {
                        badgeClass = "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
                        statusText = "Blocked";
                        badgeVariant = "secondary";
                    } else if (status === 'active') {
                        badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
                        statusText = "Available";
                        badgeVariant = "secondary";
                    } else if (status === 'logout') {
                        badgeClass = "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100";
                        statusText = "Logged Out";
                        badgeVariant = "secondary";
                    }

                    return (
                        <tr key={user._id || user.id} className="hover:bg-purple-50/50 transition-colors">
                        <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700 border border-purple-200">
                                {(user.firstname?.[0] || user.name?.[0] || user.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium text-slate-900">
                                {user.firstname} {user.lastname} {(!user.firstname && !user.lastname) && (user.name || 'Unknown')}
                                </div>
                                <div className="text-slate-500 text-xs flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {user.email}
                                </div>
                                {user.mobile && (
                                    <div className="text-slate-400 text-xs mt-0.5 ml-4">
                                        {user.countryCode} {user.mobile}
                                    </div>
                                )}
                            </div>
                            </div>
                        </td>
                        <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                                <span className="capitalize font-medium text-slate-700">
                                    {user.role?.replace(/_/g, ' ') || 'Member'}
                                </span>
                                {user.department && (
                                    <span className="text-xs text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                                        {user.department}
                                    </span>
                                )}
                            </div>
                        </td>
                        <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                                {user.attributes && (user.attributes.course || user.attributes.language || user.attributes.courses || user.attributes.languages) ? (
                                    <div className="flex flex-wrap gap-1">
                                        {/* Plural Courses */}
                                        {Array.isArray(user.attributes.courses) && user.attributes.courses.map(c => (
                                            <Badge key={c} variant="outline" className="text-[10px] py-0 h-5 border-purple-200 bg-purple-50 text-purple-700">
                                                {c}
                                            </Badge>
                                        ))}
                                        {/* Singular Course (Legacy) */}
                                        {!user.attributes.courses && user.attributes.course && (
                                            <Badge variant="outline" className="text-[10px] py-0 h-5 border-purple-200 bg-purple-50 text-purple-700">
                                                {user.attributes.course}
                                            </Badge>
                                        )}
                                        {/* Plural Languages */}
                                        {Array.isArray(user.attributes.languages) && user.attributes.languages.map(l => (
                                            <Badge key={l} variant="outline" className="text-[10px] py-0 h-5 border-purple-200 bg-purple-50 text-purple-700">
                                                {l}
                                            </Badge>
                                        ))}
                                        {/* Singular Language (Legacy) */}
                                        {!user.attributes.languages && user.attributes.language && (
                                            <Badge variant="outline" className="text-[10px] py-0 h-5 border-purple-200 bg-purple-50 text-purple-700">
                                                {user.attributes.language}
                                            </Badge>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">No skills set</span>
                                )}
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-[10px] text-slate-400 hover:text-purple-700 -ml-2"
                                    onClick={() => handleEditClick(user)}
                                >
                                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                                </Button>
                                {teamSource === 'local' && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-[10px] text-slate-400 hover:text-red-600 -ml-2"
                                        onClick={() => handleDeleteUser(user.id)}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                                    </Button>
                                )}
                            </div>
                        </td>
                        <td className="py-3 px-4">
                            <Badge variant={badgeVariant} className={`capitalize ${badgeClass}`}>
                                {statusText}
                            </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                        </td>
                        </tr>
                    );
                  })}
                  {paginatedUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <Filter className="h-8 w-8 text-slate-300" />
                            <p>No team members found matching your filters.</p>
                            <Button 
                                variant="link" 
                                onClick={() => {
                                    setSearchTerm('');
                                    setRoleFilter('all');
                                    setStatusFilter('all');
                                }}
                            >
                                Clear all filters
                            </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="gap-1"
                    >
                        <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <div className="flex gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            // Simple logic to show first 5 pages or sliding window could be better but sticking to simple for now
                            // Actually let's do a simple sliding window if needed, or just 1..N if small.
                            // Given N=57/10 = 6 pages, simple mapping is fine.
                            let pageNum = i + 1;
                            if (totalPages > 5 && currentPage > 3) {
                                pageNum = currentPage - 2 + i;
                                if (pageNum > totalPages) pageNum = i + (totalPages - 4); // clamp to end
                            }
                            
                            return (
                                <Button
                                    key={pageNum}
                                    variant={currentPage === pageNum ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setCurrentPage(pageNum)}
                                    className="w-8 h-8 p-0"
                                >
                                    {pageNum}
                                </Button>
                            );
                        })}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="gap-1"
                    >
                        Next <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>
          </>
        )}

        {activeTab === 'teams' && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-950">Working teams</h2>
                <p className="mt-0.5 text-sm text-gray-500">Create workspace teams and map them to departments.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border-purple-100 bg-purple-50 text-purple-700">{teamGroups.length} teams</Badge>
                <Button onClick={() => openOrganizationForm('team')} className="h-10 rounded-lg bg-[#7928ca] px-4 text-white hover:bg-[#6821ad]">
                  <UserPlus className="mr-2 h-4 w-4" /> Add Team
                </Button>
              </div>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {teamGroups.map(group => (
                <article key={group.id || group.name} className="rounded-lg border border-gray-200 p-4 transition hover:border-purple-200 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700"><UsersRound size={18} /></span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openOrganizationForm('team', group)} className="rounded-lg p-2 text-gray-400 hover:bg-purple-50 hover:text-purple-700" title="Edit team"><Edit2 size={15} /></button>
                      {group.id && <button type="button" onClick={() => removeOrganization('team', group)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete team"><Trash2 size={15} /></button>}
                    </div>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-gray-950">{group.name}</h3>
                  <p className="mt-1 text-xs text-gray-500">{group.department_name || group.departmentName || 'No department'}</p>
                  <p className="mt-2 line-clamp-2 min-h-8 text-xs text-gray-500">{group.description || group.members?.slice(0, 3).map(member => member.name || member.email).join(', ') || 'No description'}</p>
                  <Badge className={`mt-3 ${group.active === false ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{group.active === false ? 'Inactive' : 'Active'}</Badge>
                </article>
              ))}
              {!teamGroups.length && <div className="col-span-full rounded-xl border border-dashed border-purple-200 bg-purple-50/40 p-10 text-center text-sm text-gray-500">No teams yet. Use Add Team to create the first working group.</div>}
            </div>
          </section>
        )}

        {activeTab === 'roles' && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-950">Roles & permissions</h2>
                <p className="mt-0.5 text-sm text-gray-500">Role distribution across the currently loaded team members.</p>
              </div>
              <Button onClick={() => setInviteModalOpen(true)} className="h-10 rounded-lg bg-[#7928ca] px-4 text-white hover:bg-[#6821ad]">
                <UserPlus className="mr-2 h-4 w-4" /> Invite member
              </Button>
            </div>
            <div className="divide-y divide-gray-100">
              {roleGroups.map(group => (
                <div key={group.name} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"><Shield size={18} /></span>
                    <div><p className="text-sm font-bold capitalize text-gray-950">{group.name.replaceAll('_', ' ')}</p><p className="text-xs text-gray-500">{group.members.length} assigned members</p></div>
                  </div>
                  <div className="flex -space-x-2">
                    {group.members.slice(0, 5).map(member => <span key={member.id || member.email} title={member.name || member.email} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-purple-100 text-[10px] font-bold text-purple-700">{String(member.name || member.email || '?').slice(0, 1).toUpperCase()}</span>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Workspace role assignments</p>
                  <p className="mt-1 text-xs text-gray-500">Manage access by workspace role. Changes apply only to this workspace.</p>
                </div>
              </div>
              {(() => {
                const group = accessMemberView === 'active'
                  ? { key: 'active', title: 'Active users', members: activeAccessMembers, pagination: activeAccessPagination, tone: 'emerald', search: activeAccessSearch, role: activeAccessRole, setSearch: setActiveAccessSearch, setRole: setActiveAccessRole }
                  : { key: 'inactive', title: 'Inactive users', members: inactiveAccessMembers, pagination: inactiveAccessPagination, tone: 'amber', search: inactiveAccessSearch, role: inactiveAccessRole, setSearch: setInactiveAccessSearch, setRole: setInactiveAccessRole };
                const isActiveView = group.key === 'active';
                return <section className={`mt-3 overflow-hidden rounded-xl border ${isActiveView ? 'border-emerald-100' : 'border-amber-100'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/80 px-3 py-3">
                    <div className="flex rounded-lg border border-gray-200 bg-white p-1">
                      <button type="button" onClick={() => setAccessMemberView('active')} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${accessMemberView === 'active' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'}`}>Active users <span className="ml-1 opacity-80">{activeAccessPagination.total}</span></button>
                      <button type="button" onClick={() => setAccessMemberView('inactive')} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${accessMemberView === 'inactive' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'}`}>Inactive users <span className="ml-1 opacity-80">{inactiveAccessPagination.total}</span></button>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isActiveView ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{group.title}</span>
                  </div>
                  <div className="grid gap-2 border-b border-gray-100 p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                    <Input value={group.search} onChange={(event) => group.setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') loadAccessMembers(group.key, 1); }} placeholder="Search name or email..." className="h-9 rounded-lg border-gray-200 text-xs" />
                    <select value={group.role} onChange={(event) => group.setRole(event.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700"><option value="all">All roles</option>{(organization.roles || []).map((role) => <option key={role.id} value={role.key}>{role.name}</option>)}</select>
                    <Button variant="outline" size="sm" onClick={() => loadAccessMembers(group.key, 1)} className="h-9 rounded-lg border-gray-200 text-xs">Filter</Button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {accessLoading && <div className="flex items-center gap-2 px-3 py-5 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading users...</div>}
                    {!accessLoading && group.members.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{member.name || member.email}</p><p className="truncate text-xs text-gray-500">{member.email}</p></div><div className="flex items-center gap-2"><select value={member.workspace_role_key || 'member'} onChange={(event) => changeMemberAccess(member, { workspaceRoleKey: event.target.value })} className="h-9 max-w-[130px] rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700">{(organization.roles || []).map((role) => <option key={role.id} value={role.key}>{role.name}</option>)}</select><button type="button" onClick={() => changeMemberAccess(member, { active: !member.active })} className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${member.active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{member.active ? 'Deactivate' : 'Activate'}</button></div></div>)}
                    {!accessLoading && !group.members.length && <p className="px-3 py-6 text-center text-sm text-gray-500">No {isActiveView ? 'active' : 'inactive'} users found.</p>}
                  </div>
                  {group.pagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-xs text-gray-500"><Button variant="outline" size="sm" disabled={group.pagination.page <= 1 || accessLoading} onClick={() => loadAccessMembers(group.key, group.pagination.page - 1)}>Previous</Button><span>Page {group.pagination.page} of {group.pagination.totalPages}</span><Button variant="outline" size="sm" disabled={group.pagination.page >= group.pagination.totalPages || accessLoading} onClick={() => loadAccessMembers(group.key, group.pagination.page + 1)}>Next</Button></div>}
                </section>;
              })()}
            </div>
            <div className="border-t border-gray-100 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Invitations</p><p className="mt-1 text-xs text-gray-500">Resend a pending invitation or revoke access before it is accepted.</p></div><select value={inviteStatus} onChange={(event) => setInviteStatus(event.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700"><option value="pending">Pending</option><option value="expired">Expired</option><option value="accepted">Accepted</option><option value="revoked">Revoked</option></select></div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={inviteSearch} onChange={(event) => setInviteSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') loadWorkspaceInvites(1); }} placeholder="Search invitee name or email..." className="h-9 max-w-md rounded-lg border-gray-200 text-xs" /><Button variant="outline" size="sm" onClick={() => loadWorkspaceInvites(1)} className="h-9 rounded-lg border-gray-200">Search</Button></div>
              <div className="mt-3 space-y-2">
                {inviteLoading && <div className="flex items-center gap-2 py-5 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading invitations...</div>}
                {!inviteLoading && workspaceInvites.map((invite) => (
                  <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5">
                    <div><p className="text-sm font-semibold text-gray-900">{invite.name || invite.email}</p><p className="text-xs text-gray-500">{invite.email} - {invite.workspace_role_name || 'Member'} - {invite.status}</p></div>
                    {invite.status === 'pending' && <div className="flex gap-2"><button type="button" onClick={() => updateInvite(invite, 'resend')} className="text-xs font-semibold text-purple-700 hover:underline">Resend</button><button type="button" onClick={() => updateInvite(invite, 'revoke')} className="text-xs font-semibold text-red-600 hover:underline">Revoke</button></div>}
                  </div>
                ))}
                {!inviteLoading && !workspaceInvites.length && <p className="py-5 text-sm text-gray-500">No {inviteStatus} invitations found.</p>}
              </div>
              {invitePagination.totalPages > 1 && <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500"><span>{invitePagination.total} invitations</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={invitePagination.page <= 1 || inviteLoading} onClick={() => loadWorkspaceInvites(invitePagination.page - 1)}>Previous</Button><span className="self-center">Page {invitePagination.page} of {invitePagination.totalPages}</span><Button variant="outline" size="sm" disabled={invitePagination.page >= invitePagination.totalPages || inviteLoading} onClick={() => loadWorkspaceInvites(invitePagination.page + 1)}>Next</Button></div></div>}
            </div>
          </section>
        )}

        {activeTab === 'departments' && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div><h2 className="text-base font-bold text-gray-950">Departments</h2><p className="mt-0.5 text-sm text-gray-500">Business functions from live member records.</p></div>
              <div className="flex items-center gap-2">
                <Badge className="border-purple-100 bg-purple-50 text-purple-700">{departmentGroups.length} departments</Badge>
                <Button onClick={() => openOrganizationForm('department')} className="h-10 rounded-lg bg-[#7928ca] px-4 text-white hover:bg-[#6821ad]">
                  <Building2 className="mr-2 h-4 w-4" /> Add Department
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-400"><tr><th className="px-5 py-3">Department</th><th className="px-5 py-3">Code</th><th className="px-5 py-3">Teams</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {departmentGroups.map(group => {
                    return <tr key={group.id || group.name} className="hover:bg-gray-50/70"><td className="px-5 py-4"><span className="flex items-center gap-3 text-sm font-bold text-gray-950"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700"><Building2 size={17} /></span><span><span className="block">{group.name}</span><span className="block max-w-xs truncate text-xs font-normal text-gray-500">{group.description || 'No description'}</span></span></span></td><td className="px-5 py-4 text-sm font-semibold text-gray-700">{group.department_code || '-'}</td><td className="px-5 py-4 text-sm text-gray-600">{Number(group.team_count || 0)}</td><td className="px-5 py-4"><Badge className={group.active === false ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}>{group.active === false ? 'Inactive' : 'Active'}</Badge></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" onClick={() => openOrganizationForm('department', group)} className="rounded-lg p-2 text-gray-400 hover:bg-purple-50 hover:text-purple-700"><Edit2 size={15} /></button>{group.id && <button type="button" onClick={() => removeOrganization('department', group)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}</div></td></tr>;
                  })}
                  {!departmentGroups.length && <tr><td colSpan="5" className="px-5 py-12 text-center text-sm text-gray-500">No departments yet. Use Add Department to create one.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Agent Skills">
        <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-600 mb-4">
                Assign skills to <strong>{editingUser?.name}</strong>. These attributes are used by automation rules for "Round Robin" assignment.
            </div>
            
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Course</label>
                <Input 
                    placeholder="e.g. CPA, CMA, ACCA" 
                    value={editFormData.course}
                    onChange={(e) => setEditFormData({...editFormData, course: e.target.value})}
                />
            </div>
            
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Language</label>
                <Input 
                    placeholder="e.g. English, Spanish, Hindi" 
                    value={editFormData.language}
                    onChange={(e) => setEditFormData({...editFormData, language: e.target.value})}
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Cities / Locations</label>
                <Input
                    placeholder="e.g. Bangalore, Delhi, Hyderabad"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                />
                <p className="text-xs text-slate-500">Comma-separated routing locations used with course and role assignment rules.</p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveAttributes}>
                    <Check className="h-4 w-4 mr-2" />
                    Save Changes
                </Button>
            </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(organizationModal)}
        onClose={() => !organizationBusy && setOrganizationModal(null)}
        title={`${organizationModal?.item ? 'Edit' : 'Create'} ${organizationModal?.type === 'department' ? 'Department' : 'Team'}`}
      >
        <form onSubmit={saveOrganization} className="space-y-5">
          <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-purple-600">Workspace organization</p>
            <p className="mt-1 text-sm text-gray-600">This record is isolated to the current workspace.</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Name <span className="text-red-500">*</span></label>
            <Input required value={organizationForm.name} onChange={(event) => setOrganizationForm((current) => ({ ...current, name: event.target.value }))} placeholder={organizationModal?.type === 'department' ? 'Customer Success' : 'Tier 1 Support'} className="h-11 rounded-xl" />
          </div>
          {organizationModal?.type === 'department' ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Department code</label>
              <Input value={organizationForm.code} onChange={(event) => setOrganizationForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="CS" className="h-11 rounded-xl" />
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Department</label>
              <select value={organizationForm.departmentId} onChange={(event) => setOrganizationForm((current) => ({ ...current, departmentId: event.target.value }))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-purple-100">
                <option value="">No department</option>
                {organization.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Description</label>
            <textarea value={organizationForm.description} onChange={(event) => setOrganizationForm((current) => ({ ...current, description: event.target.value }))} rows="4" placeholder="Describe ownership and responsibilities" className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-100" />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setOrganizationModal(null)} disabled={organizationBusy}>Cancel</Button>
            <Button type="submit" disabled={organizationBusy || !organizationForm.name.trim()} className="bg-[#7928ca] text-white hover:bg-[#6821ad]">
              {organizationBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save {organizationModal?.type === 'department' ? 'Department' : 'Team'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={inviteModalOpen} onClose={() => !inviteBusy && setInviteModalOpen(false)} title="Invite workspace member">
        <form onSubmit={saveInvite} className="space-y-5">
          <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4 text-sm text-gray-600">
            The member receives a time-limited link to set a password and join only this workspace.
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Name</label>
            <Input value={inviteForm.name} onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))} placeholder="Member name" className="h-11 rounded-xl" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Email <span className="text-red-500">*</span></label>
            <Input type="email" required value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="member@company.com" className="h-11 rounded-xl" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Workspace role</label>
            <select value={inviteForm.workspaceRoleKey} onChange={(event) => setInviteForm((current) => ({ ...current, workspaceRoleKey: event.target.value }))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-purple-100">
              {(organization.roles || []).map((role) => <option key={role.id} value={role.key}>{role.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)} disabled={inviteBusy}>Cancel</Button>
            <Button type="submit" disabled={inviteBusy || !inviteForm.email.trim()} className="bg-[#7928ca] text-white hover:bg-[#6821ad]">
              {inviteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send invite
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(inviteLink)} onClose={() => setInviteLink(null)} title="Invitation link ready">
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            A secure invitation link was created for <strong>{inviteLink?.email}</strong>. It expires in 7 days. Share it only with the invited person.
          </div>
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700"><Link2 className="h-4 w-4 text-purple-700" /> Invitation link</label>
            <textarea readOnly value={inviteLink?.url || ''} rows="3" className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs text-gray-700 outline-none" />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setInviteLink(null)}>Close</Button>
            <Button type="button" onClick={copyInviteLink} className="bg-[#7928ca] text-white hover:bg-[#6821ad]">
              {inviteLinkCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {inviteLinkCopied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      </Modal>

      {false && (
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Local Member">
        <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-600 mb-4">
                This creates a native user account bypassing the external team sync. 
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">First Name <span className="text-red-500">*</span></label>
                    <Input 
                        placeholder="John" 
                        required
                        value={createFormData.firstname}
                        onChange={(e) => setCreateFormData({...createFormData, firstname: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Last Name</label>
                    <Input 
                        placeholder="Doe" 
                        value={createFormData.lastname}
                        onChange={(e) => setCreateFormData({...createFormData, lastname: e.target.value})}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email Address <span className="text-red-500">*</span></label>
                <Input 
                    type="email"
                    required
                    placeholder="john@example.com" 
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({...createFormData, email: e.target.value})}
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
                    <Input 
                        type="password"
                        required
                        placeholder="••••••••" 
                        value={createFormData.password}
                        onChange={(e) => setCreateFormData({...createFormData, password: e.target.value})}
                    />
                </div>
                <div className="space-y-2 flex flex-col justify-start mt-0.5">
                    <label className="text-sm font-medium text-slate-700 mb-1">Role <span className="text-red-500">*</span></label>
                    <select 
                        required
                        className="h-9 px-3 py-1 rounded-md border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 capitalize"
                        value={createFormData.role}
                        onChange={(e) => setCreateFormData({...createFormData, role: e.target.value})}
                    >
                        <option value="agent">Agent</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="quality_manager">Quality Manager</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 text-slate-500">Courses (Comma separated)</label>
                    <Input 
                        placeholder="e.g. CPA, CMA, ACCA" 
                        value={createFormData.courses}
                        onChange={(e) => setCreateFormData({...createFormData, courses: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 text-slate-500">Languages (Comma separated)</label>
                    <Input 
                        placeholder="e.g. English, Spanish" 
                        value={createFormData.languages}
                        onChange={(e) => setCreateFormData({...createFormData, languages: e.target.value})}
                    />
                </div>
                <div className="space-y-2 col-span-2">
                    <label className="text-sm font-medium text-slate-700 text-slate-500">Cities / Locations (Comma separated)</label>
                    <Input
                        placeholder="e.g. Bangalore, Delhi, Hyderabad"
                        value={createFormData.locations}
                        onChange={(e) => setCreateFormData({...createFormData, locations: e.target.value})}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                <Button type="submit">
                    <Check className="h-4 w-4 mr-2" />
                    Create Member
                </Button>
            </div>
        </form>
      </Modal>
      )}
    </div>
  );
}

