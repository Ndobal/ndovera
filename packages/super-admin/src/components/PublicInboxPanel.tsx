import React from 'react'

export type PublicInboxStatus = 'new' | 'reviewing' | 'resolved'

export type PublicContactInquiry = {
  id: string
  schoolId: string | null
  name: string | null
  email: string
  message: string
  enquiryPath: string
  enquiryLabel: string
  primaryResponsibleRole: string
  responsibleRoles: string[]
  routingNote: string
  status: PublicInboxStatus
  createdAt: string
  updatedAt?: string
  reviewedAt?: string | null
  reviewedBy?: string | null
}

export type GrowthPartnerApplication = {
  id: string
  schoolId: string | null
  name: string
  email: string
  phone: string
  city: string | null
  notes: string | null
  source: string | null
  primaryResponsibleRole: string
  responsibleRoles: string[]
  status: PublicInboxStatus
  createdAt: string
  updatedAt?: string
  reviewedAt?: string | null
  reviewedBy?: string | null
}

type Props = {
  contactInquiries: PublicContactInquiry[]
  growthApplications: GrowthPartnerApplication[]
  onUpdateStatus: (kind: 'contact' | 'growth', itemId: string, status: PublicInboxStatus) => Promise<void>
}

const statusOptions: PublicInboxStatus[] = ['new', 'reviewing', 'resolved']

function formatWhen(value?: string | null) {
  if (!value) return 'Not reviewed yet'
  return new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function StatusBadge({ status }: { status: PublicInboxStatus }) {
  const styles: Record<PublicInboxStatus, React.CSSProperties> = {
    new: { background: 'rgba(59, 130, 246, 0.18)', color: '#bfdbfe' },
    reviewing: { background: 'rgba(245, 158, 11, 0.18)', color: '#fde68a' },
    resolved: { background: 'rgba(16, 185, 129, 0.18)', color: '#bbf7d0' },
  }
  return <span className="pill" style={styles[status]}>{status}</span>
}

function InboxCard({
  title,
  subtitle,
  status,
  children,
}: {
  title: string
  subtitle: string
  status: PublicInboxStatus
  children: React.ReactNode
}) {
  return (
    <div className="panel" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{title}</div>
          <div className="muted" style={{ marginTop: 6 }}>{subtitle}</div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  )
}

export function PublicInboxPanel({ contactInquiries, growthApplications, onUpdateStatus }: Props) {
  const [busyKey, setBusyKey] = React.useState('')
  const newCount = contactInquiries.filter((item) => item.status === 'new').length + growthApplications.filter((item) => item.status === 'new').length

  const changeStatus = async (kind: 'contact' | 'growth', itemId: string, status: PublicInboxStatus) => {
    const key = `${kind}:${itemId}`
    setBusyKey(key)
    try {
      await onUpdateStatus(kind, itemId, status)
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="panel" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Public inbox</h2>
            <p className="muted" style={{ marginTop: 8, maxWidth: 860 }}>
              Review public messages and growth applications from the live landing pages. Keep updates simple so the next admin can see what happened.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill">New items: {newCount}</span>
            <span className="pill">Contact: {contactInquiries.length}</span>
            <span className="pill">Growth: {growthApplications.length}</span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Contact enquiries</h3>
        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          {contactInquiries.length ? contactInquiries.map((item) => {
            const busy = busyKey === `contact:${item.id}`
            return (
              <InboxCard
                key={item.id}
                title={item.name || item.email}
                subtitle={`${item.enquiryLabel} • ${formatWhen(item.createdAt)}`}
                status={item.status}
              >
                <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
                  <div><strong>Email:</strong> {item.email}</div>
                  <div><strong>Main owner:</strong> {item.primaryResponsibleRole}</div>
                  <div><strong>Other owners:</strong> {item.responsibleRoles.join(', ')}</div>
                  <div><strong>Routing note:</strong> {item.routingNote}</div>
                  {item.schoolId ? <div><strong>School:</strong> {item.schoolId}</div> : null}
                  <div><strong>Message:</strong> {item.message}</div>
                  <div><strong>Last update:</strong> {formatWhen(item.reviewedAt || item.updatedAt)}{item.reviewedBy ? ` by ${item.reviewedBy}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      className="btn"
                      disabled={busy || status === item.status}
                      onClick={() => changeStatus('contact', item.id, status)}
                      style={{
                        background: status === item.status ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                        color: 'white',
                        opacity: busy ? 0.7 : 1,
                      }}
                    >
                      {busy && status === item.status ? 'Saving…' : `Mark ${status}`}
                    </button>
                  ))}
                </div>
              </InboxCard>
            )
          }) : <p className="muted" style={{ margin: 0 }}>No public contact enquiries yet.</p>}
        </div>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Growth applications</h3>
        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          {growthApplications.length ? growthApplications.map((item) => {
            const busy = busyKey === `growth:${item.id}`
            return (
              <InboxCard
                key={item.id}
                title={item.name}
                subtitle={`Growth partner application • ${formatWhen(item.createdAt)}`}
                status={item.status}
              >
                <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
                  <div><strong>Email:</strong> {item.email}</div>
                  <div><strong>Phone:</strong> {item.phone}</div>
                  {item.city ? <div><strong>City:</strong> {item.city}</div> : null}
                  <div><strong>Main owner:</strong> {item.primaryResponsibleRole}</div>
                  <div><strong>Other owners:</strong> {item.responsibleRoles.join(', ')}</div>
                  {item.source ? <div><strong>Source:</strong> {item.source}</div> : null}
                  {item.notes ? <div><strong>Why they applied:</strong> {item.notes}</div> : null}
                  <div><strong>Last update:</strong> {formatWhen(item.reviewedAt || item.updatedAt)}{item.reviewedBy ? ` by ${item.reviewedBy}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      className="btn"
                      disabled={busy || status === item.status}
                      onClick={() => changeStatus('growth', item.id, status)}
                      style={{
                        background: status === item.status ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                        color: 'white',
                        opacity: busy ? 0.7 : 1,
                      }}
                    >
                      {busy && status === item.status ? 'Saving…' : `Mark ${status}`}
                    </button>
                  ))}
                </div>
              </InboxCard>
            )
          }) : <p className="muted" style={{ margin: 0 }}>No growth applications yet.</p>}
        </div>
      </div>
    </div>
  )
}