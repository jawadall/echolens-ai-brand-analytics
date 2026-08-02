import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  UsersIcon,
  ShieldCheckIcon,
  EyeIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { adminAPI } from '../../api/client'
import { useAuthStore } from '../../store/authStore'

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  analyst: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  viewer: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}
const ROLE_ICONS: Record<string, any> = {
  admin: ShieldCheckIcon,
  analyst: ChartBarIcon,
  viewer: EyeIcon,
}
const ROLE_DESC: Record<string, string> = {
  admin: 'Full access. Can manage team, brands, settings and billing.',
  analyst: 'Can create/edit brands, view analytics, manage alerts.',
  viewer: 'Read-only. Can view dashboards and analytics only.',
}

export default function CompanyMembers() {
  const { user } = useAuthStore()
  const companyId = user?.company_info?.id
  const [members, setMembers] = useState<any[]>([])
  const [limits, setLimits] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Invite modal
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', first_name: '', last_name: '', role: 'analyst', password: '' })
  const [inviting, setInviting] = useState(false)

  // Role edit modal
  const [editingUser, setEditingUser] = useState<any>(null)
  const [newRole, setNewRole] = useState('')

  useEffect(() => {
    if (companyId) loadMembers()
  }, [companyId])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getCompanyUsers(companyId!)
      setMembers(res.data.users || [])
      setLimits(res.data.limits || null)
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) {
      toast.error('Email address is required')
      return
    }
    setInviting(true)
    try {
      await adminAPI.inviteCompanyUser(companyId!, {
        email: inviteForm.email.trim(),
        first_name: inviteForm.first_name.trim() || undefined,
        last_name: inviteForm.last_name.trim() || undefined,
        role: inviteForm.role,
        password: inviteForm.password.trim() || undefined,
      })
      toast.success(`${inviteForm.email} has been invited to your team`)
      setInviteForm({ email: '', first_name: '', last_name: '', role: 'analyst', password: '' })
      setShowInvite(false)
      loadMembers()
    } catch {
      // handled by interceptor
    } finally {
      setInviting(false)
    }
  }

  const handleRoleUpdate = async () => {
    if (!editingUser || !newRole) return
    try {
      await adminAPI.updateCompanyUserRole(companyId!, editingUser.id, newRole)
      toast.success(`${editingUser.email} is now a${newRole === 'analyst' ? 'n' : ''} ${newRole}`)
      setEditingUser(null)
      loadMembers()
    } catch {
      // handled by interceptor
    }
  }

  const handleRemove = async (member: any) => {
    if (!window.confirm(`Are you sure you want to remove ${member.full_name || member.email} from your team? They will lose access to all company resources.`)) return
    try {
      await adminAPI.removeCompanyUser(companyId!, member.id)
      toast.success(`${member.email} has been removed from your team`)
      loadMembers()
    } catch {
      // handled by interceptor
    }
  }

  const usedSlots = members.length
  const maxSlots = limits?.max_users || user?.company_info?.users_limit || 2
  const canInvite = usedSlots < maxSlots

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Team Members</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {usedSlots} of {maxSlots} member slots used
          </p>
        </div>
        <button
          onClick={() => canInvite ? setShowInvite(true) : toast.error(`Your plan allows a maximum of ${maxSlots} team members. Please upgrade to add more.`)}
          className={`btn-primary flex items-center gap-2 ${!canInvite ? 'opacity-60' : ''}`}
        >
          <PlusIcon className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Slot usage bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Member Slots</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{usedSlots}/{maxSlots}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((usedSlots / maxSlots) * 100, 100)}%` }}
            className="h-full rounded-full"
            style={{ background: usedSlots >= maxSlots ? 'linear-gradient(90deg, #f43f5e, #fb923c)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
          />
        </div>
        {!canInvite && (
          <p className="mt-2 text-xs text-amber-400">
            You've reached your plan's member limit.{' '}
            <a href="/subscription" className="underline hover:text-amber-300">Upgrade your plan</a> to invite more members.
          </p>
        )}
      </div>

      {/* Role Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['admin', 'analyst', 'viewer'] as const).map((role) => {
          const Icon = ROLE_ICONS[role]
          return (
            <div key={role} className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{role}</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ROLE_DESC[role]}</p>
            </div>
          )
        })}
      </div>

      {/* Members Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Member', 'Role', 'Brands', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m: any, i: number) => (
                <motion.tr
                  key={m.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--border-primary)' }}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {m.full_name?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {m.full_name || m.email}
                          {m.is_owner && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">Owner</span>}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${ROLE_STYLES[m.role] || ROLE_STYLES.viewer}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{m.brands_count || 0}</td>
                  <td className="px-5 py-3.5">
                    {m.invite_pending ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Pending Invite
                      </span>
                    ) : m.is_active !== false ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {m.date_joined ? new Date(m.date_joined).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                  </td>
                  <td className="px-5 py-3.5">
                    {!m.is_owner && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingUser(m); setNewRole(m.role) }}
                          className="p-1.5 rounded-lg hover:bg-indigo-500/10 text-indigo-400 transition-colors"
                          title="Change role"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(m)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors"
                          title="Remove member"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {members.length === 0 && (
          <div className="p-12 text-center">
            <UsersIcon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No Team Members</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Invite your first team member to get started.</p>
          </div>
        )}
      </div>

      {/* ─── Invite Modal ───────────────────── */}
      <AnimatePresence>
        {showInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-6 w-full max-w-md mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Invite Team Member</h3>
                <button onClick={() => setShowInvite(false)} className="p-1 rounded-lg hover:bg-gray-500/10">
                  <XMarkIcon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email Address <span className="text-rose-400">*</span></label>
                  <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="user@example.com" className="input w-full text-sm" autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>First Name</label>
                    <input type="text" value={inviteForm.first_name} onChange={e => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                      placeholder="John" className="input w-full text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Last Name</label>
                    <input type="text" value={inviteForm.last_name} onChange={e => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                      placeholder="Doe" className="input w-full text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Role</label>
                  <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })} className="input w-full text-sm">
                    <option value="admin">Admin -- Full access</option>
                    <option value="analyst">Analyst -- Can manage brands & analytics</option>
                    <option value="viewer">Viewer -- Read-only access</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Password</label>
                  <input type="password" value={inviteForm.password} onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                    placeholder="Leave blank to auto-generate" className="input w-full text-sm" />
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>If blank, a secure password will be generated and the user can reset it.</p>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={handleInvite} disabled={inviting || !inviteForm.email.trim()} className="btn-primary flex-1">
                  {inviting ? 'Sending Invite...' : 'Send Invite'}
                </button>
                <button onClick={() => setShowInvite(false)} className="btn-secondary px-4">Cancel</button>
              </div>

              <p className="text-[11px] mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
                {usedSlots}/{maxSlots} member slots used on your plan
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Edit Role Modal ───────────────── */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setEditingUser(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-6 w-full max-w-sm mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Change Role</h3>
                <button onClick={() => setEditingUser(null)} className="p-1 rounded-lg hover:bg-gray-500/10">
                  <XMarkIcon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>

              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Update role for <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{editingUser.full_name || editingUser.email}</span>
              </p>

              <div className="space-y-2 mb-5">
                {(['admin', 'analyst', 'viewer'] as const).map((role) => {
                  const Icon = ROLE_ICONS[role]
                  return (
                    <label
                      key={role}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${newRole === role ? 'ring-2 ring-indigo-500' : ''}`}
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}
                    >
                      <input type="radio" name="role" value={role} checked={newRole === role} onChange={() => setNewRole(role)} className="sr-only" />
                      <Icon className={`w-5 h-5 ${newRole === role ? 'text-indigo-400' : ''}`} style={{ color: newRole === role ? undefined : 'var(--text-muted)' }} />
                      <div>
                        <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{role}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ROLE_DESC[role]}</p>
                      </div>
                    </label>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <button onClick={handleRoleUpdate} disabled={newRole === editingUser.role} className="btn-primary flex-1">
                  Update Role
                </button>
                <button onClick={() => setEditingUser(null)} className="btn-secondary px-4">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
