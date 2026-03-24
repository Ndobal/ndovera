import React, { useEffect, useMemo, useState } from 'react'

type SchoolCounts = { students: number; staff: number; parents: number; admins: number; total: number }

type SchoolRecord = {
  id: string
  name: string
  subdomain: string
  liveClassQuota: number
  pageCount: number
  website: any
  createdAt: string
  counts?: SchoolCounts
}

type StudentRecord = {
  id: string
  schoolId: string
  schoolName: string
  userId: string
  name: string
  status: 'active' | 'transferred' | 'alumni'
}

type UserRecord = {
  id: string
  schoolId: string
  schoolName: string
  name: string
  email?: string | null
  phone?: string | null
  category: 'student' | 'staff' | 'parent' | 'admin' | 'alumni'
  status: 'active' | 'inactive'
  roles: string[]
  activeRole: string
  aliases: string[]
}

type LifecycleEventRecord = {
  id: string
  userId: string
  action: 'deactivated' | 'reactivated'
  actorId?: string
  actorName?: string
  actorRole?: string
  reason?: string
  createdAt: string
}

type DirectoryResponse = { users: UserRecord[]; students: StudentRecord[]; includeInactive?: boolean; lifecycleEvents?: LifecycleEventRecord[] }
type ProvisionResponse = { user: UserRecord; temporaryPassword?: string | null }
type CreateSchoolResponse = { school: { id: string; name: string; subdomain: string; createdAt: string }; owner: UserRecord; temporaryPassword?: string | null }
type UpdateUserResponse = { user: UserRecord; lifecycleEvent?: LifecycleEventRecord | null }
type TransferResponse = { student: StudentRecord; user: UserRecord; transfer: { fromSchoolId: string; toSchoolId: string; fromUserId: string; toUserId: string } }

type PanelProps = {
  schools: SchoolRecord[]
  selectedSchoolId: string
  onSelectSchool: (schoolId: string) => void
  onMessage: (message: string) => void
  onError: (message: string) => void
  onSchoolsChanged: () => Promise<void> | void
}

const env = ((import.meta as any)?.env || {}) as Record<string, string | undefined>
const SCHOOL_API_BASE = (env.VITE_SUPER_ADMIN_API_URL || '').replace(/\/$/, '')

function buildUrl(path: string) {
  if (!SCHOOL_API_BASE) return path
  return `${SCHOOL_API_BASE}${path}`
}

async function fetchJson<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {})
  const method = (options.method || 'GET').toUpperCase()
  const mutating = !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)
  if (mutating && !headers.has('X-CSRF-Token')) {
    try {
      const csrfResponse = await fetch(buildUrl('/csrf-token'), { credentials: 'include' })
      const csrfPayload = await csrfResponse.json().catch(() => ({})) as { csrfToken?: string }
      if (csrfPayload.csrfToken) headers.set('X-CSRF-Token', csrfPayload.csrfToken)
    } catch {
      // Let server-side CSRF handling decide.
    }
  }
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(buildUrl(path), { ...options, headers, credentials: 'include' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Request failed')
  return payload as T
}

function blankUserForm() {
  return {
    name: '',
    email: '',
    phone: '',
    password: '',
    roles: '',
    activeRole: '',
    category: 'staff' as UserRecord['category'],
    status: 'active' as UserRecord['status'],
  }
}

export function IdentityOperationsPanel({ schools, selectedSchoolId, onSelectSchool, onMessage, onError, onSchoolsChanged }: PanelProps) {
  const [directory, setDirectory] = useState<DirectoryResponse>({ users: [], students: [] })
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [creatingSchool, setCreatingSchool] = useState(false)
  const [updatingUser, setUpdatingUser] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [category, setCategory] = useState<'student' | 'staff' | 'parent' | 'admin' | 'alumni'>('student')
  const [provisionName, setProvisionName] = useState('')
  const [provisionEmail, setProvisionEmail] = useState('')
  const [provisionPhone, setProvisionPhone] = useState('')
  const [provisionPassword, setProvisionPassword] = useState('')
  const [provisionRoles, setProvisionRoles] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolSubdomain, setSchoolSubdomain] = useState('')
  const [schoolOwnerName, setSchoolOwnerName] = useState('')
  const [schoolOwnerEmail, setSchoolOwnerEmail] = useState('')
  const [schoolOwnerPhone, setSchoolOwnerPhone] = useState('')
  const [schoolOwnerPassword, setSchoolOwnerPassword] = useState('')
  const [transferStudentId, setTransferStudentId] = useState('')
  const [transferTargetSchoolId, setTransferTargetSchoolId] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [provisionResult, setProvisionResult] = useState<ProvisionResponse | null>(null)
  const [createSchoolResult, setCreateSchoolResult] = useState<CreateSchoolResponse | null>(null)
  const [transferResult, setTransferResult] = useState<TransferResponse | null>(null)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [userForm, setUserForm] = useState(blankUserForm)

  const selectedSchool = useMemo(() => schools.find((school) => school.id === selectedSchoolId) || null, [schools, selectedSchoolId])
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredUsers = useMemo(() => {
    if (!normalizedSearch) return directory.users
    return directory.users.filter((user) => [user.id, user.name, user.email || '', user.phone || '', user.activeRole, user.roles.join(' ')].some((value) => value.toLowerCase().includes(normalizedSearch)))
  }, [directory.users, normalizedSearch])
  const filteredStudents = useMemo(() => {
    if (!normalizedSearch) return directory.students
    return directory.students.filter((student) => [student.id, student.userId, student.name, student.schoolName, student.status].some((value) => value.toLowerCase().includes(normalizedSearch)))
  }, [directory.students, normalizedSearch])
  const selectedUser = useMemo(() => directory.users.find((user) => user.id === selectedUserId) || null, [directory.users, selectedUserId])
  const selectedUserLifecycleEvents = useMemo(() => {
    if (!selectedUserId) return []
    return (directory.lifecycleEvents || []).filter((event) => event.userId === selectedUserId).slice(0, 6)
  }, [directory.lifecycleEvents, selectedUserId])
  const latestLifecycleEventByUserId = useMemo(() => {
    const next = new Map<string, LifecycleEventRecord>()
    for (const event of directory.lifecycleEvents || []) {
      if (!next.has(event.userId)) next.set(event.userId, event)
    }
    return next
  }, [directory.lifecycleEvents])
  const inactiveUserCount = useMemo(() => directory.users.filter((user) => user.status === 'inactive').length, [directory.users])
  const systemTotals = useMemo(() => schools.reduce((totals, school) => ({
    students: totals.students + (school.counts?.students || 0),
    staff: totals.staff + (school.counts?.staff || 0),
    parents: totals.parents + (school.counts?.parents || 0),
    admins: totals.admins + (school.counts?.admins || 0),
    total: totals.total + (school.counts?.total || 0),
  }), { students: 0, staff: 0, parents: 0, admins: 0, total: 0 }), [schools])

  const loadDirectory = async (schoolId: string) => {
    if (!schoolId) return
    const payload = await fetchJson<DirectoryResponse>(`/api/super/users/directory?schoolId=${encodeURIComponent(schoolId)}${showInactive ? '&includeInactive=1' : ''}`)
    setDirectory({ users: payload.users || [], students: payload.students || [], lifecycleEvents: payload.lifecycleEvents || [] })
    setTransferStudentId((current) => current || payload.students?.[0]?.userId || '')
    setTransferTargetSchoolId((current) => current || schools.find((school) => school.id !== schoolId)?.id || '')
    setSelectedUserId((current) => current || payload.users?.[0]?.id || '')
  }

  useEffect(() => {
    if (!selectedSchoolId) return
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const payload = await fetchJson<DirectoryResponse>(`/api/super/users/directory?schoolId=${encodeURIComponent(selectedSchoolId)}${showInactive ? '&includeInactive=1' : ''}`)
        if (!mounted) return
        setDirectory({ users: payload.users || [], students: payload.students || [], lifecycleEvents: payload.lifecycleEvents || [] })
        setTransferStudentId((current) => current || payload.students?.[0]?.userId || '')
        setTransferTargetSchoolId((current) => current || schools.find((school) => school.id !== selectedSchoolId)?.id || '')
        setSelectedUserId((current) => current || payload.users?.[0]?.id || '')
      } catch (error) {
        if (!mounted) return
        onError(error instanceof Error ? error.message : 'Failed to load directory')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [selectedSchoolId, schools, onError, showInactive])

  useEffect(() => {
    if (!selectedUser) {
      setUserForm(blankUserForm())
      return
    }
    setUserForm({
      name: selectedUser.name || '',
      email: selectedUser.email || '',
      phone: selectedUser.phone || '',
      password: '',
      roles: selectedUser.roles.join(', '),
      activeRole: selectedUser.activeRole || '',
      category: selectedUser.category,
      status: selectedUser.status,
    })
  }, [selectedUserId, selectedUser])

  const handleProvision = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedSchool) {
      onError('Select a school first.')
      return
    }
    setSaving(true)
    try {
      const payload = await fetchJson<ProvisionResponse>('/api/super/users/provision', {
        method: 'POST',
        body: JSON.stringify({
          category,
          schoolId: selectedSchool.id,
          schoolName: selectedSchool.name,
          name: provisionName,
          email: provisionEmail || undefined,
          phone: provisionPhone || undefined,
          password: provisionPassword || undefined,
          roles: provisionRoles.split(',').map((role) => role.trim()).filter(Boolean),
        }),
      })
      setProvisionResult(payload)
      onMessage(`Provisioned ${payload.user.id}`)
      setProvisionName('')
      setProvisionEmail('')
      setProvisionPhone('')
      setProvisionPassword('')
      setProvisionRoles('')
      await loadDirectory(selectedSchool.id)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Provisioning failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateSchool = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreatingSchool(true)
    try {
      const payload = await fetchJson<CreateSchoolResponse>('/api/super/schools', {
        method: 'POST',
        body: JSON.stringify({
          schoolName,
          subdomain: schoolSubdomain,
          ownerName: schoolOwnerName,
          ownerEmail: schoolOwnerEmail || undefined,
          ownerPhone: schoolOwnerPhone || undefined,
          ownerPassword: schoolOwnerPassword || undefined,
        }),
      })
      setCreateSchoolResult(payload)
      await Promise.resolve(onSchoolsChanged())
      onSelectSchool(payload.school.id)
      onMessage(`Created ${payload.school.name} with owner ${payload.owner.id}`)
      setSchoolName('')
      setSchoolSubdomain('')
      setSchoolOwnerName('')
      setSchoolOwnerEmail('')
      setSchoolOwnerPhone('')
      setSchoolOwnerPassword('')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'School creation failed')
    } finally {
      setCreatingSchool(false)
    }
  }

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedUser) {
      onError('Select a user to edit.')
      return
    }
    setUpdatingUser(true)
    try {
      const payload = await fetchJson<UpdateUserResponse>(`/api/super/users/${encodeURIComponent(selectedUser.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          schoolId: selectedUser.schoolId,
          name: userForm.name,
          email: userForm.email || null,
          phone: userForm.phone || null,
          password: userForm.password || undefined,
          roles: userForm.roles.split(',').map((role) => role.trim()).filter(Boolean),
          activeRole: userForm.activeRole,
          category: userForm.category,
          status: userForm.status,
        }),
      })
      onMessage(`Updated ${payload.user.id}`)
      await loadDirectory(selectedUser.schoolId)
      setSelectedUserId(payload.user.id)
      setUserForm((current) => ({ ...current, password: '' }))
    } catch (error) {
      onError(error instanceof Error ? error.message : 'User update failed')
    } finally {
      setUpdatingUser(false)
    }
  }

  const handleTransfer = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!transferStudentId || !transferTargetSchoolId) {
      onError('Choose a student and a target school.')
      return
    }
    setTransferring(true)
    try {
      const payload = await fetchJson<TransferResponse>(`/api/super/students/${encodeURIComponent(transferStudentId)}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ targetSchoolId: transferTargetSchoolId, reason: transferReason }),
      })
      setTransferResult(payload)
      onMessage(`Transferred to ${payload.transfer.toUserId}`)
      await loadDirectory(selectedSchoolId)
      await Promise.resolve(onSchoolsChanged())
      setTransferReason('')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Transfer failed')
    } finally {
      setTransferring(false)
    }
  }

  const handleToggleUserStatus = async (nextStatus: UserRecord['status']) => {
    if (!selectedUser) {
      onError('Select a user first.')
      return
    }
    setTogglingStatus(true)
    try {
      const payload = await fetchJson<UpdateUserResponse>(`/api/super/users/${encodeURIComponent(selectedUser.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          schoolId: selectedUser.schoolId,
          status: nextStatus,
        }),
      })
      onMessage(`${nextStatus === 'inactive' ? 'Deactivated' : 'Reactivated'} ${payload.user.id}`)
      await loadDirectory(selectedUser.schoolId)
      setSelectedUserId(payload.user.id)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Status update failed')
    } finally {
      setTogglingStatus(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="panel" style={{ padding: 22 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Identity operations</h2>
        <p className="muted" style={{ marginTop: 8 }}>Create schools, create owners, provision users, reset passwords, and edit directory records without touching code.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
          <div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Students</div><div style={{ fontSize: 28, fontWeight: 900 }}>{systemTotals.students}</div></div>
          <div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Staff</div><div style={{ fontSize: 28, fontWeight: 900 }}>{systemTotals.staff}</div></div>
          <div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Admins</div><div style={{ fontSize: 28, fontWeight: 900 }}>{systemTotals.admins}</div></div>
          <div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>System total</div><div style={{ fontSize: 28, fontWeight: 900 }}>{systemTotals.total}</div></div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <form className="panel" onSubmit={handleCreateSchool} style={{ padding: 22, display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Create school and owner</h3>
          <input className="field" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="School name" />
          <input className="field" value={schoolSubdomain} onChange={(event) => setSchoolSubdomain(event.target.value)} placeholder="Subdomain" />
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <input className="field" value={schoolOwnerName} onChange={(event) => setSchoolOwnerName(event.target.value)} placeholder="Owner full name" />
            <input className="field" value={schoolOwnerEmail} onChange={(event) => setSchoolOwnerEmail(event.target.value)} placeholder="Owner email" />
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <input className="field" value={schoolOwnerPhone} onChange={(event) => setSchoolOwnerPhone(event.target.value)} placeholder="Owner phone" />
            <input className="field" value={schoolOwnerPassword} onChange={(event) => setSchoolOwnerPassword(event.target.value)} placeholder="Owner password (optional)" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={creatingSchool}>{creatingSchool ? 'Creating…' : 'Create school and owner'}</button>
          {createSchoolResult ? (
            <div className="panel" style={{ padding: 14, background: 'rgba(16,185,129,0.08)' }}>
              <div style={{ fontWeight: 900 }}>{createSchoolResult.school.name}</div>
              <div className="muted" style={{ marginTop: 6 }}>{createSchoolResult.school.subdomain}.ndovera.com</div>
              <div className="muted" style={{ marginTop: 6 }}>Owner: {createSchoolResult.owner.name} • {createSchoolResult.owner.id}</div>
              {createSchoolResult.temporaryPassword ? <div className="muted" style={{ marginTop: 6 }}>Temporary password: {createSchoolResult.temporaryPassword}</div> : null}
            </div>
          ) : null}
        </form>

        <form className="panel" onSubmit={handleProvision} style={{ padding: 22, display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Provision user</h3>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <select className="select" value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="parent">Parent</option>
              <option value="admin">Admin</option>
              <option value="alumni">Alumni</option>
            </select>
            <select className="select" value={selectedSchoolId} onChange={(event) => onSelectSchool(event.target.value)}>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          </div>
          <input className="field" value={provisionName} onChange={(event) => setProvisionName(event.target.value)} placeholder="Full name" />
          <input className="field" value={provisionEmail} onChange={(event) => setProvisionEmail(event.target.value)} placeholder="Email (optional)" />
          <input className="field" value={provisionPhone} onChange={(event) => setProvisionPhone(event.target.value)} placeholder="Phone number (optional)" />
          <input className="field" value={provisionPassword} onChange={(event) => setProvisionPassword(event.target.value)} placeholder="Password (optional, autogenerated if empty)" />
          <input className="field" value={provisionRoles} onChange={(event) => setProvisionRoles(event.target.value)} placeholder="Roles comma separated" />
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Provisioning…' : 'Provision user'}</button>
          {provisionResult ? (
            <div className="panel" style={{ padding: 14, background: 'rgba(16,185,129,0.08)' }}>
              <div style={{ fontWeight: 900 }}>{provisionResult.user.id}</div>
              <div className="muted" style={{ marginTop: 6 }}>{provisionResult.user.name}</div>
              {provisionResult.temporaryPassword ? <div className="muted" style={{ marginTop: 6 }}>Temporary password: {provisionResult.temporaryPassword}</div> : null}
            </div>
          ) : null}
        </form>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1.15fr 0.85fr' }}>
        <div className="panel" style={{ padding: 22 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Current school users</h3>
          <p className="muted" style={{ marginTop: 8 }}>{loading ? 'Loading directory…' : `${filteredUsers.length} of ${directory.users.length} users and ${filteredStudents.length} of ${directory.students.length} students shown.`}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span className="pill">Active: {directory.users.length - inactiveUserCount}</span>
            <span className="pill" style={{ background: 'rgba(244,63,94,0.18)', color: '#fecdd3' }}>Inactive: {inactiveUserCount}</span>
          </div>
          <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Show inactive users
          </label>
          <input className="field" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by name, ID, email, phone, role, or student status" style={{ marginTop: 16 }} />
          <div style={{ display: 'grid', gap: 12, marginTop: 16, maxHeight: 520, overflow: 'auto' }}>
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                className="btn"
                onClick={() => setSelectedUserId(user.id)}
                style={{ textAlign: 'left', background: selectedUserId === user.id ? 'rgba(16,185,129,0.18)' : user.status === 'inactive' ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.03)', color: 'white', padding: 14 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{user.name}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{user.id}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{user.email || 'No email'} • {user.phone || 'No phone'}</div>
                    {latestLifecycleEventByUserId.get(user.id) ? <div className="muted" style={{ marginTop: 4 }}>{latestLifecycleEventByUserId.get(user.id)?.action === 'deactivated' ? 'Deactivated' : 'Reactivated'} by {latestLifecycleEventByUserId.get(user.id)?.actorName || latestLifecycleEventByUserId.get(user.id)?.actorId || 'System'}</div> : null}
                  </div>
                  <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                    <span className="pill">{user.activeRole}</span>
                    <span className="pill">{user.status}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <form className="panel" onSubmit={handleUpdateUser} style={{ padding: 22, display: 'grid', gap: 12, alignSelf: 'start' }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Edit selected user</h3>
          <select className="select" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
            <option value="">Select user</option>
            {filteredUsers.map((user) => <option key={user.id} value={user.id}>{user.name} - {user.id}</option>)}
          </select>
          <input className="field" value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" />
          <input className="field" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" />
          <input className="field" value={userForm.phone} onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" />
          <input className="field" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} placeholder="New password (leave blank to keep current)" />
          <input className="field" value={userForm.roles} onChange={(event) => setUserForm((current) => ({ ...current, roles: event.target.value }))} placeholder="Roles comma separated" />
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <input className="field" value={userForm.activeRole} onChange={(event) => setUserForm((current) => ({ ...current, activeRole: event.target.value }))} placeholder="Active role" />
            <select className="select" value={userForm.category} onChange={(event) => setUserForm((current) => ({ ...current, category: event.target.value as UserRecord['category'] }))}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="parent">Parent</option>
              <option value="admin">Admin</option>
              <option value="alumni">Alumni</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" disabled={togglingStatus || !selectedUserId || selectedUser?.status === 'active'} onClick={() => handleToggleUserStatus('active')}>{togglingStatus && selectedUser?.status === 'inactive' ? 'Reactivating…' : 'Reactivate user'}</button>
            <button type="button" className="btn" disabled={togglingStatus || !selectedUserId || selectedUser?.status === 'inactive'} onClick={() => handleToggleUserStatus('inactive')} style={{ background: 'rgba(244,63,94,0.18)', color: '#fecdd3' }}>{togglingStatus && selectedUser?.status === 'active' ? 'Deactivating…' : 'Deactivate user'}</button>
          </div>
          <button type="submit" className="btn btn-primary" disabled={updatingUser || !selectedUserId}>{updatingUser ? 'Saving…' : 'Save user changes'}</button>
          {selectedUser ? (
            <div className="panel" style={{ padding: 14, background: 'rgba(6,182,212,0.08)' }}>
              <div style={{ fontWeight: 900 }}>{selectedUser.schoolName}</div>
              <div className="muted" style={{ marginTop: 6 }}>Status: {selectedUser.status}</div>
              <div className="muted" style={{ marginTop: 6 }}>Aliases: {selectedUser.aliases.length ? selectedUser.aliases.join(', ') : 'None'}</div>
              <div className="muted" style={{ marginTop: 10, fontWeight: 700 }}>Lifecycle audit</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {selectedUserLifecycleEvents.length ? selectedUserLifecycleEvents.map((event) => (
                  <div key={event.id} className="panel" style={{ padding: 10, background: 'rgba(15,23,42,0.28)' }}>
                    <div style={{ fontWeight: 700 }}>{event.action === 'deactivated' ? 'Deactivated' : 'Reactivated'}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{event.actorName || event.actorId || 'System'}{event.actorRole ? ` • ${event.actorRole}` : ''}</div>
                    <div className="muted" style={{ marginTop: 4 }}>{new Date(event.createdAt).toLocaleString()}</div>
                    {event.reason ? <div className="muted" style={{ marginTop: 4 }}>{event.reason}</div> : null}
                  </div>
                )) : <div className="muted">No lifecycle events recorded yet.</div>}
              </div>
            </div>
          ) : null}
        </form>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <form className="panel" onSubmit={handleTransfer} style={{ padding: 22, display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Transfer student</h3>
          <select className="select" value={transferStudentId} onChange={(event) => setTransferStudentId(event.target.value)}>
            <option value="">Select student</option>
            {filteredStudents.map((student) => <option key={student.userId} value={student.userId}>{student.name} - {student.userId}</option>)}
          </select>
          <select className="select" value={transferTargetSchoolId} onChange={(event) => setTransferTargetSchoolId(event.target.value)}>
            <option value="">Select target school</option>
            {schools.filter((school) => school.id !== selectedSchoolId).map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
          <textarea className="textarea" value={transferReason} onChange={(event) => setTransferReason(event.target.value)} placeholder="Transfer reason" />
          <button type="submit" className="btn btn-primary" disabled={transferring}>{transferring ? 'Transferring…' : 'Transfer student'}</button>
          {transferResult ? (
            <div className="panel" style={{ padding: 14, background: 'rgba(6,182,212,0.08)' }}>
              <div style={{ fontWeight: 900 }}>{transferResult.student.name}</div>
              <div className="muted" style={{ marginTop: 6 }}>New ID: {transferResult.user.id}</div>
              <div className="muted" style={{ marginTop: 6 }}>Moved from {transferResult.transfer.fromSchoolId} to {transferResult.transfer.toSchoolId}</div>
            </div>
          ) : null}
        </form>

        <div className="panel" style={{ padding: 22 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Students in selected school</h3>
          <div style={{ display: 'grid', gap: 12, marginTop: 16, maxHeight: 340, overflow: 'auto' }}>
            {filteredStudents.map((student) => (
              <div key={student.id} className="panel" style={{ padding: 16 }}>
                <div style={{ fontWeight: 900 }}>{student.name}</div>
                <div className="muted" style={{ marginTop: 6 }}>{student.userId}</div>
                <div className="muted" style={{ marginTop: 6 }}>{student.schoolName}</div>
                <div style={{ marginTop: 10 }} className="pill">{student.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
