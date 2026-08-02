import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { adminAPI } from '../../api/client'

interface UserData {
  id: number
  email: string
  full_name: string
  role: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  subscription_plan: string
  company_id: number | null
  company_name: string | null
  company_plan: string | null
  brands_count: number
  login_count: number
  last_activity: string | null
  date_joined: string
}

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  analyst: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  viewer: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
}

export default function Users() {
  const [users, setUsers] = useState<UserData[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const load = () => {
    setLoading(true)
    adminAPI.getUsers(search).then(r => { setUsers(r.data.users || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [search])

  const doAction = async (id: number, action: string) => {
    try { await adminAPI.userAction(id, action); toast.success(`User ${action.replace('_', ' ')} done`); load() }
    catch { toast.error('Action failed') }
  }

  const toggleGroup = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  // Group users by business
  const grouped: Record<string, { name: string; plan: string | null; users: UserData[] }> = {}
  const superadmins: UserData[] = []

  users.forEach(u => {
    if (u.is_staff || u.is_superuser) {
      superadmins.push(u)
    }
    const key = u.company_id ? String(u.company_id) : '__none__'
    if (!grouped[key]) {
      grouped[key] = {
        name: u.company_name || 'No Business',
        plan: u.company_plan || null,
        users: [],
      }
    }
    grouped[key].users.push(u)
  })

  // Sort: businesses with users first, "No Business" last
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '__none__') return 1
    if (b === '__none__') return -1
    return (grouped[b].users.length - grouped[a].users.length)
  })

  const totalBusinesses = sortedKeys.filter(k => k !== '__none__').length

  const UserRow = ({ u, i }: { u: UserData; i: number }) => (
    <motion.tr
      key={u.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: i * 0.02 }}
      className="transition-colors"
      style={{ borderBottom: '1px solid var(--border-primary)' }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold">
            {u.full_name?.[0] || '?'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.full_name}</p>
              {(u.is_staff || u.is_superuser) && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold uppercase tracking-wider">
                  Super Admin
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_BADGE[u.role] || ROLE_BADGE.viewer}`}>
          {u.role}
        </span>
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{u.brands_count}</td>
      <td className="px-4 py-3">
        {u.is_active
          ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircleIcon className="w-3.5 h-3.5" />Active</span>
          : <span className="flex items-center gap-1 text-rose-400 text-xs"><XCircleIcon className="w-3.5 h-3.5" />Inactive</span>}
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {u.date_joined ? new Date(u.date_joined).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 flex-wrap">
          {u.is_active ? (
            <button onClick={() => doAction(u.id, 'deactivate')} className="px-2 py-1 text-[10px] rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-medium">Deactivate</button>
          ) : (
            <button onClick={() => doAction(u.id, 'activate')} className="px-2 py-1 text-[10px] rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-medium">Activate</button>
          )}
          <select
            onChange={e => { if (e.target.value) { doAction(u.id, e.target.value); e.target.value = '' } }}
            className="px-2 py-1 text-[10px] rounded-lg border text-xs"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
          >
            <option value="">Role</option>
            <option value="make_superadmin">Super Admin</option>
            <option value="make_admin">Admin</option>
            <option value="make_analyst">Analyst</option>
            <option value="make_viewer">Viewer</option>
            {(u.is_staff || u.is_superuser) && (
              <option value="remove_superadmin">Remove Super Admin</option>
            )}
          </select>
        </div>
      </td>
    </motion.tr>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>User Management</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {users.length} users across {totalBusinesses} businesses · {superadmins.length} super admin{superadmins.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: users.length, color: 'from-indigo-500 to-purple-500' },
          { label: 'Businesses', value: totalBusinesses, color: 'from-emerald-500 to-teal-500' },
          { label: 'Super Admins', value: superadmins.length, color: 'from-amber-500 to-orange-500' },
          { label: 'Active Users', value: users.filter(u => u.is_active).length, color: 'from-cyan-500 to-blue-500' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
          className="input w-full pl-10 text-sm" />
      </div>

      {loading ? (
        <div className="card p-8 text-center"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" /></div>
      ) : (
        <div className="space-y-4">
          {/* Super Admins Section */}
          {superadmins.length > 0 && (
            <div className="card overflow-hidden">
              <button
                onClick={() => toggleGroup('__superadmins__')}
                className="w-full flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: collapsed['__superadmins__'] ? 'none' : '1px solid var(--border-primary)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <ShieldCheckIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Platform Super Admins</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{superadmins.length} user{superadmins.length !== 1 ? 's' : ''} with full platform access</p>
                  </div>
                </div>
                {collapsed['__superadmins__']
                  ? <ChevronRightIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  : <ChevronDownIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
              </button>
              {!collapsed['__superadmins__'] && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        {['User', 'Role', 'Brands', 'Status', 'Joined', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {superadmins.map((u, i) => <UserRow key={u.id} u={u} i={i} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Business Groups */}
          {sortedKeys.map(key => {
            const group = grouped[key]
            const isNoBiz = key === '__none__'
            const isCollapsed = collapsed[key] ?? false

            return (
              <div key={key} className="card overflow-hidden">
                <button
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: isCollapsed ? 'none' : '1px solid var(--border-primary)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isNoBiz
                        ? 'bg-gray-500/20'
                        : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                    }`}>
                      {isNoBiz
                        ? <UsersIcon className="w-4 h-4 text-gray-400" />
                        : <BuildingOffice2Icon className="w-4 h-4 text-white" />}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{group.name}</p>
                        {group.plan && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary-500/10 text-primary-400 font-medium uppercase tracking-wider">
                            {group.plan}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {group.users.length} member{group.users.length !== 1 ? 's' : ''}
                        {!isNoBiz && ` · ${group.users.reduce((s, u) => s + u.brands_count, 0)} brands`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1.5">
                      {group.users.slice(0, 4).map(u => (
                        <div key={u.id} className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500/60 to-accent-500/60 flex items-center justify-center text-white text-[9px] font-bold border-2" style={{ borderColor: 'var(--bg-card)' }}>
                          {u.full_name?.[0] || '?'}
                        </div>
                      ))}
                      {group.users.length > 4 && (
                        <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-white text-[9px] font-bold border-2" style={{ borderColor: 'var(--bg-card)' }}>
                          +{group.users.length - 4}
                        </div>
                      )}
                    </div>
                    {isCollapsed
                      ? <ChevronRightIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      : <ChevronDownIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </button>

                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                              {['User', 'Role', 'Brands', 'Status', 'Joined', 'Actions'].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.users.map((u, i) => <UserRow key={u.id} u={u} i={i} />)}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
