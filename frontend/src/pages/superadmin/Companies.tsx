import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  BuildingOffice2Icon, PlusIcon, MagnifyingGlassIcon,
  PencilSquareIcon, EyeIcon, TrashIcon, XMarkIcon,
  GlobeAltIcon, UsersIcon, RectangleStackIcon,
} from '@heroicons/react/24/outline'
import { adminAPI } from '../../api/client'

interface CompanyForm {
  name: string
  industry: string
  website: string
  plan: string
  max_brands: number
  max_users: number
}

const emptyForm: CompanyForm = {
  name: '',
  industry: '',
  website: '',
  plan: 'free',
  max_brands: 3,
  max_users: 5,
}

const PLAN_LIMITS: Record<string, { max_brands: number; max_users: number }> = {
  free: { max_brands: 1, max_users: 2 },
  basic: { max_brands: 3, max_users: 5 },
  pro: { max_brands: 10, max_users: 15 },
  enterprise: { max_brands: 50, max_users: 100 },
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-500/10 text-gray-400',
  basic: 'bg-sky-500/10 text-sky-400',
  pro: 'bg-primary-500/10 text-primary-400',
  enterprise: 'bg-amber-500/10 text-amber-400',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400',
  suspended: 'bg-amber-500/10 text-amber-400',
  cancelled: 'bg-rose-500/10 text-rose-400',
}

export default function Companies() {
  const [companies, setCompanies] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<CompanyForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  // Member management state
  const [members, setMembers] = useState<any[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberLimits, setMemberLimits] = useState<any>(null)
  const [inviteForm, setInviteForm] = useState({ email: '', first_name: '', last_name: '', role: 'analyst', password: '' })
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState(false)

  const load = () => {
    setLoading(true)
    adminAPI.getCompanies(search).then(r => {
      setCompanies(r.data.companies || [])
      setLoading(false)
    }).catch(() => {
      setLoading(false)
      toast.error('Failed to load companies')
    })
  }

  useEffect(() => { load() }, [search])

  // Open modal for create
  const openCreate = () => {
    setEditItem(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  // Open modal for edit
  const openEdit = (co: any) => {
    setEditItem(co)
    setForm({
      name: co.name || '',
      industry: co.industry || '',
      website: co.website || '',
      plan: co.plan || 'free',
      max_brands: co.max_brands || 3,
      max_users: co.max_users || 5,
    })
    setShowModal(true)
  }

  // Close modal
  const closeModal = () => {
    setShowModal(false)
    setEditItem(null)
    setForm(emptyForm)
  }

  // Handle form field change
  const updateField = (field: keyof CompanyForm, value: string | number) => {
    if (field === 'plan') {
      const planVal = value as string
      const limits = PLAN_LIMITS[planVal] || PLAN_LIMITS.free
      setForm(prev => ({ ...prev, plan: planVal, max_brands: limits.max_brands, max_users: limits.max_users }))
    } else {
      setForm(prev => ({ ...prev, [field]: value }))
    }
  }

  // Submit create or update
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Business name is required')
      return
    }

    setSaving(true)
    try {
      if (editItem) {
        // Update existing
        await adminAPI.updateCompany(editItem.id, {
          name: form.name.trim(),
          industry: form.industry.trim(),
          website: form.website.trim(),
          plan: form.plan,
          max_brands: form.max_brands,
          max_users: form.max_users,
        })
        toast.success(`"${form.name}" updated successfully`)
      } else {
        // Create new
        await adminAPI.createCompany({
          name: form.name.trim(),
          industry: form.industry.trim(),
          website: form.website.trim(),
          plan: form.plan,
          max_brands: form.max_brands,
          max_users: form.max_users,
        })
        toast.success(`"${form.name}" created successfully`)
      }
      closeModal()
      load() // Refresh list
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Operation failed'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Delete company
  const handleDelete = async (co: any) => {
    if (!window.confirm(`Are you sure you want to delete "${co.name}"? This action cannot be undone.`)) {
      return
    }
    setDeleting(co.id)
    try {
      await adminAPI.deleteCompany(co.id)
      toast.success(`"${co.name}" deleted`)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  // View company details
  const handleView = async (co: any) => {
    try {
      const res = await adminAPI.getCompany(co.id)
      setShowDetail(res.data)
      loadMembers(co.id)
    } catch {
      toast.error('Failed to load company details')
    }
  }

  // Load company members
  const loadMembers = async (companyId: number) => {
    setMembersLoading(true)
    try {
      const res = await adminAPI.getCompanyUsers(companyId)
      setMembers(res.data.users || [])
      setMemberLimits(res.data.limits || null)
    } catch {
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  // Invite user to company
  const handleInvite = async (companyId: number) => {
    if (!inviteForm.email.trim()) {
      toast.error('Email is required')
      return
    }
    setInviting(true)
    try {
      await adminAPI.inviteCompanyUser(companyId, {
        email: inviteForm.email.trim(),
        first_name: inviteForm.first_name.trim() || undefined,
        last_name: inviteForm.last_name.trim() || undefined,
        role: inviteForm.role,
        password: inviteForm.password.trim() || undefined,
      })
      toast.success(`Invited ${inviteForm.email}`)
      setInviteForm({ email: '', first_name: '', last_name: '', role: 'analyst', password: '' })
      setShowInvite(false)
      loadMembers(companyId)
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  // Remove user from company
  const handleRemoveUser = async (companyId: number, userId: number, email: string) => {
    if (!window.confirm(`Remove ${email} from this business?`)) return
    try {
      await adminAPI.removeCompanyUser(companyId, userId)
      toast.success(`${email} removed`)
      loadMembers(companyId)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove user')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Businesses</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage businesses and their subscriptions • {companies.length} total
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <PlusIcon className="w-4 h-4" /> Add Business
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search companies..." className="input w-full pl-10 text-sm" />
      </div>

      {/* Companies Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 rounded w-24" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="h-2.5 rounded w-16" style={{ background: 'var(--bg-elevated)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="h-16 rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
                <div className="h-16 rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : companies.length === 0 && !search ? (
        <div className="card p-12 text-center">
          <BuildingOffice2Icon className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No companies yet</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Create your first company to start organizing brands and users.</p>
          <button onClick={openCreate} className="btn-primary text-sm">
            <PlusIcon className="w-4 h-4 inline mr-1" /> Create Company
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((co, i) => (
            <motion.div key={co.id || co.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} className="card card-hover p-5 group">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm">
                    {co.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{co.name}</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {co.industry || 'No industry'}
                      {co.website && <> • <a href={co.website} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">{new URL(co.website).hostname}</a></>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${PLAN_COLORS[co.plan] || PLAN_COLORS.free}`}>
                    {co.plan?.toUpperCase()}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[co.status] || STATUS_COLORS.active}`}>
                    {co.status}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{co.brands_count || 0}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Brands</p>
                </div>
                <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{co.users_count || 0}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Users</p>
                </div>
                <div className="p-2 rounded-lg text-center" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{co.max_brands || 3}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Max</p>
                </div>
              </div>

              {/* Owner info */}
              {co.owner && (
                <div className="text-xs mb-3 px-2 py-1.5 rounded-lg flex items-center gap-2" style={{ background: 'var(--bg-elevated)' }}>
                  <UsersIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{co.owner.full_name || co.owner.email}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-1.5">
                <button onClick={() => handleView(co)}
                  className="btn-ghost text-xs flex-1 flex items-center justify-center gap-1 rounded-lg py-2"
                  style={{ background: 'var(--bg-elevated)' }}>
                  <EyeIcon className="w-3.5 h-3.5" /> View
                </button>
                <button onClick={() => openEdit(co)}
                  className="btn-ghost text-xs flex-1 flex items-center justify-center gap-1 rounded-lg py-2"
                  style={{ background: 'var(--bg-elevated)' }}>
                  <PencilSquareIcon className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => handleDelete(co)}
                  disabled={deleting === co.id}
                  className="text-xs flex items-center justify-center gap-1 rounded-lg py-2 px-3 text-rose-400 hover:bg-rose-500/10 transition-colors"
                  style={{ background: 'var(--bg-elevated)' }}>
                  {deleting === co.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <TrashIcon className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}

          {/* Add Company Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="card p-5 cursor-pointer flex flex-col items-center justify-center min-h-[200px] transition-colors hover:border-primary-500/30"
            style={{ border: '2px dashed var(--border-primary)' }}
            onClick={openCreate}>
            <BuildingOffice2Icon className="w-8 h-8 mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Add Company</p>
          </motion.div>
        </div>
      )}

      {/* ─── Create / Edit Modal ────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={closeModal}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {editItem ? 'Edit Business' : 'Create New Business'}
                </h3>
                <button onClick={closeModal} className="p-1 rounded-lg transition-colors hover:bg-gray-500/10">
                  <XMarkIcon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {/* Company Name */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Business Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => updateField('name', e.target.value)}
                    placeholder="Enter business name"
                    className="input w-full text-sm"
                    autoFocus
                  />
                </div>

                {/* Industry */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Industry
                  </label>
                  <input
                    type="text"
                    value={form.industry}
                    onChange={e => updateField('industry', e.target.value)}
                    placeholder="e.g., Technology, Healthcare, Finance"
                    className="input w-full text-sm"
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Website
                  </label>
                  <div className="relative">
                    <GlobeAltIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="url"
                      value={form.website}
                      onChange={e => updateField('website', e.target.value)}
                      placeholder="https://example.com"
                      className="input w-full text-sm pl-10"
                    />
                  </div>
                </div>

                {/* Plan */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Subscription Plan
                  </label>
                  <select
                    value={form.plan}
                    onChange={e => updateField('plan', e.target.value)}
                    className="input w-full text-sm"
                  >
                    <option value="free">Free -- Up to 1 brand</option>
                    <option value="basic">Basic -- Up to 3 brands</option>
                    <option value="pro">Pro -- Up to 10 brands</option>
                    <option value="enterprise">Enterprise -- Up to 50 brands</option>
                  </select>
                </div>

                {/* Plan Limits (auto-set from plan) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <RectangleStackIcon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Max Brands</span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{form.max_brands}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Based on {form.plan} plan</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <UsersIcon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Max Users</span>
                    </div>
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{form.max_users}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Based on {form.plan} plan</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-6 pt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !form.name.trim()}
                  className="btn-primary text-sm flex-1 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {editItem ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editItem ? 'Update Company' : 'Create Company'}
                    </>
                  )}
                </button>
                <button onClick={closeModal} className="btn-secondary text-sm px-5">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Detail View Modal ──────────────────────────────── */}
      <AnimatePresence>
        {showDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowDetail(null); setShowInvite(false) }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg">
                    {showDetail.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{showDetail.name}</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{showDetail.industry || 'No industry'}</p>
                  </div>
                </div>
                <button onClick={() => { setShowDetail(null); setShowInvite(false) }} className="p-1 rounded-lg hover:bg-gray-500/10">
                  <XMarkIcon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>

              {/* Status + Plan */}
              <div className="flex gap-2 mb-5">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[showDetail.status] || STATUS_COLORS.active}`}>
                  {showDetail.status}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${PLAN_COLORS[showDetail.plan] || PLAN_COLORS.free}`}>
                  {showDetail.plan?.toUpperCase()} Plan
                </span>
              </div>

              {/* Info grid */}
              <div className="space-y-2.5 mb-5">
                {[
                  { label: 'Website', value: showDetail.website || '--' },
                  { label: 'Owner', value: showDetail.owner ? `${showDetail.owner.full_name} (${showDetail.owner.email})` : 'No owner' },
                  { label: 'Brands', value: `${showDetail.brands_count || 0} / ${showDetail.max_brands}` },
                  { label: 'Users', value: `${showDetail.users_count || 0} / ${showDetail.max_users}` },
                  { label: 'Created', value: new Date(showDetail.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* ── Members Section ───────────────────── */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    <UsersIcon className="w-4 h-4" /> Members ({members.length})
                    {memberLimits && (
                      <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                        max {memberLimits.max_users}
                      </span>
                    )}
                  </h4>
                  <button
                    onClick={() => setShowInvite(!showInvite)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors"
                  >
                    <PlusIcon className="w-3 h-3 inline mr-0.5" /> Invite User
                  </button>
                </div>

                {/* Invite Form */}
                <AnimatePresence>
                  {showInvite && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 rounded-xl mb-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)' }}>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <input
                            type="email"
                            value={inviteForm.email}
                            onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                            placeholder="user@email.com *"
                            className="input text-xs"
                          />
                          <select
                            value={inviteForm.role}
                            onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                            className="input text-xs"
                          >
                            <option value="admin">Admin</option>
                            <option value="analyst">Analyst</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <input
                            type="text"
                            value={inviteForm.first_name}
                            onChange={e => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                            placeholder="First Name"
                            className="input text-xs"
                          />
                          <input
                            type="text"
                            value={inviteForm.last_name}
                            onChange={e => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                            placeholder="Last Name"
                            className="input text-xs"
                          />
                          <input
                            type="password"
                            value={inviteForm.password}
                            onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                            placeholder="Password (optional)"
                            className="input text-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleInvite(showDetail.id)}
                            disabled={inviting || !inviteForm.email.trim()}
                            className="btn-primary text-xs py-1.5 px-3"
                          >
                            {inviting ? 'Inviting...' : 'Send Invite'}
                          </button>
                          <button
                            onClick={() => setShowInvite(false)}
                            className="btn-secondary text-xs py-1.5 px-3"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Members List */}
                {membersLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)' }}>No members found</p>
                ) : (
                  <div className="space-y-1">
                    {members.map((m: any) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-500/5 transition-colors"
                        style={{ border: '1px solid transparent' }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                            {m.full_name?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {m.full_name || m.email}
                              {m.is_owner && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Owner</span>}
                            </p>
                            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                            {m.role}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {m.brands_count} brands
                          </span>
                          {!m.is_owner && (
                            <button
                              onClick={() => handleRemoveUser(showDetail.id, m.id, m.email)}
                              className="p-1 rounded hover:bg-rose-500/10 text-rose-400 transition-colors"
                              title="Remove from company"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <button onClick={() => { setShowDetail(null); setShowInvite(false); openEdit(showDetail) }}
                  className="btn-primary text-sm flex-1">
                  <PencilSquareIcon className="w-4 h-4 inline mr-1" /> Edit Company
                </button>
                <button onClick={() => { setShowDetail(null); setShowInvite(false); handleDelete(showDetail) }}
                  className="btn-danger text-sm px-4">
                  <TrashIcon className="w-4 h-4 inline mr-1" /> Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
