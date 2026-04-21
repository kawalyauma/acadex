import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { api } from '../../services/api'
import { Card, Button, Badge, Table, Modal, Input, Select, SectionHeader, Tabs, EmptyState, Alert, Avatar } from '../../components/ui'
import { ClipboardCheck, Plus, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_OPTS = ['present', 'absent', 'late', 'half_day', 'excused']
const TABS = [
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all',      label: 'All' },
]

export default function Corrections() {
  const { token, schoolId }         = useAuthStore()
  const [corrections, setCorrections] = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('pending')
  const [requestModal, setRequestModal] = useState(false)
  const [reviewModal,  setReviewModal]  = useState(null)
  const [form, setForm] = useState({ attendance_id: '', requested_status: 'excused', reason: '', supporting_doc_url: '' })
  const [reviewNotes, setReviewNotes] = useState('')
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const data = await api.corrections(schoolId, { status: tab === 'all' ? undefined : tab }, token)
      setCorrections(Array.isArray(data) ? data : [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [schoolId, token, tab])

  useEffect(() => { load() }, [load])

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleRequest = async () => {
    if (!form.attendance_id || !form.reason) return toast.error('Attendance ID and reason required')
    setSaving(true)
    try {
      await api.requestCorrection(schoolId, {
        attendance_id:    parseInt(form.attendance_id),
        requested_status: form.requested_status,
        reason:           form.reason,
        supporting_doc_url: form.supporting_doc_url || undefined,
      }, token)
      toast.success('Correction request submitted')
      setRequestModal(false)
      setForm({ attendance_id: '', requested_status: 'excused', reason: '', supporting_doc_url: '' })
      load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleReview = async (decision) => {
    setSaving(true)
    try {
      await api.reviewCorrection(schoolId, reviewModal.id, decision, reviewNotes, token)
      toast.success(`Correction ${decision}`)
      setReviewModal(null)
      setReviewNotes('')
      load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const pending = corrections.filter(c => c.status === 'pending').length

  const cols = [
    { key: 'id', label: '#', render: v => <span className="font-mono text-xs text-slate-400">#{v}</span> },
    { key: 'student_name', label: 'Student', render: (v, row) => (
      <div className="flex items-center gap-2">
        <Avatar name={v || 'S'} size="sm" />
        <span className="text-sm font-medium text-slate-900">{v || `Student #${row.student_id}`}</span>
      </div>
    )},
    { key: 'original_status',  label: 'Was',      render: v => <Badge variant={v}>{v}</Badge> },
    { key: 'requested_status', label: 'Requested', render: v => <Badge variant={v}>{v}</Badge> },
    { key: 'reason',           label: 'Reason',   render: v => <span className="text-xs text-slate-500 max-w-[180px] truncate block">{v}</span>, wrap: true },
    { key: 'requested_by_name', label: 'By',      render: v => <span className="text-xs text-slate-500">{v || '—'}</span> },
    { key: 'requested_at',     label: 'Date',     render: v => <span className="font-mono text-xs">{format(new Date(v), 'MMM d, yyyy')}</span> },
    { key: 'status',           label: 'Status',   render: v => <Badge variant={v}>{v}</Badge> },
    { key: 'id',               label: '',         render: (_, row) =>
      row.status === 'pending'
        ? <Button size="xs" variant="secondary" onClick={() => { setReviewModal(row); setReviewNotes('') }}>Review</Button>
        : <span className="text-xs text-slate-400">{row.reviewed_at ? format(new Date(row.reviewed_at), 'MMM d') : '—'}</span>
    },
  ]

  return (
    <div className="page space-y-5">
      <SectionHeader title="Correction Requests" sub="Review and approve attendance corrections" breadcrumb="Attendance"
        actions={<Button icon={Plus} onClick={() => setRequestModal(true)}>New Request</Button>} />

      {pending > 0 && (
        <Alert type="warning">{pending} correction request{pending !== 1 ? 's' : ''} awaiting your review.</Alert>
      )}

      <Tabs tabs={TABS.map(t => ({ ...t, count: t.key === 'pending' ? pending : undefined }))} active={tab} onChange={setTab} />

      <Card noPad>
        <Table columns={cols} data={corrections} loading={loading}
          emptyState={<EmptyState icon={ClipboardCheck} title={`No ${tab === 'all' ? '' : tab} corrections`} />} />
      </Card>

      {/* Request modal */}
      <Modal open={requestModal} onClose={() => setRequestModal(false)} title="Submit Correction Request"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setRequestModal(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleRequest}>Submit</Button>
          </div>
        }>
        <div className="space-y-4">
          <Alert type="info">Enter the attendance record ID you want to correct. Find it in the session records view.</Alert>
          <Input label="Attendance Record ID *" type="number" placeholder="e.g. 142" value={form.attendance_id} onChange={f('attendance_id')} />
          <Select label="Correct Status To *" value={form.requested_status} onChange={f('requested_status')}>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </Select>
          <div className="flex flex-col gap-1">
            <label className="label">Reason *</label>
            <textarea value={form.reason} onChange={f('reason')}
              placeholder="Explain why this correction is needed…"
              rows={3} className="input-base resize-y" />
          </div>
          <Input label="Supporting Document URL (optional)" placeholder="https://drive.google.com/…"
            value={form.supporting_doc_url} onChange={f('supporting_doc_url')} />
        </div>
      </Modal>

      {/* Review modal */}
      <Modal open={!!reviewModal} onClose={() => setReviewModal(null)} title="Review Correction" width={500}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setReviewModal(null)}>Cancel</Button>
            <Button variant="danger"  className="flex-1" loading={saving} icon={X}     onClick={() => handleReview('rejected')}>Reject</Button>
            <Button variant="success" className="flex-1" loading={saving} icon={Check} onClick={() => handleReview('approved')}>Approve</Button>
          </div>
        }>
        {reviewModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              {[
                { l: 'Student',        v: reviewModal.student_name || `#${reviewModal.student_id}` },
                { l: 'Submitted By',   v: reviewModal.requested_by_name || '—' },
                { l: 'Original',       v: <Badge variant={reviewModal.original_status}>{reviewModal.original_status}</Badge> },
                { l: 'Requested',      v: <Badge variant={reviewModal.requested_status}>{reviewModal.requested_status}</Badge> },
              ].map(r => (
                <div key={r.l}>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{r.l}</p>
                  <div className="text-sm text-slate-800">{r.v}</div>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reason</p>
              <p className="text-sm text-slate-700 leading-relaxed">{reviewModal.reason}</p>
            </div>
            {reviewModal.supporting_doc_url && (
              <a href={reviewModal.supporting_doc_url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline">View supporting document →</a>
            )}
            <div className="flex flex-col gap-1">
              <label className="label">Review Notes (optional)</label>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                placeholder="Add a note…" rows={2} className="input-base resize-y" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
