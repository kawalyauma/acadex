import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { api } from '../../services/api'
import {
  Card, Button, Badge, Table, Modal, Input, Select,
  SearchableSelect, SectionHeader, FormGrid, Spinner, EmptyState, Alert
} from '../../components/ui'
import { CalendarCheck, Plus, Lock, CheckSquare, X } from 'lucide-react'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = ['present', 'absent', 'late', 'half_day', 'excused']
const STATUS_COLORS  = { present: '#059669', absent: '#DC2626', late: '#D97706', half_day: '#7C3AED', excused: '#0891B2' }
const STATUS_BG      = { present: '#ECFDF5', absent: '#FEF2F2', late: '#FFFBEB', half_day: '#F5F3FF', excused: '#ECFEFF' }

export default function Sessions() {
  const { token, schoolId }                             = useAuthStore()
  const { classOptions, studentOptions, loading: dL }   = useDataStore()

  const [sessions,      setSessions]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterClass,   setFilterClass]   = useState('')

  // New session modal
  const [openModal, setOpenModal] = useState(false)
  const [newSess,   setNewSess]   = useState({
    class_id: '', session_date: format(new Date(), 'yyyy-MM-dd'),
    session_type: 'full_day', period_name: '', period_number: ''
  })

  // Mark attendance modal
  const [markModal,  setMarkModal]  = useState(null)
  const [records,    setRecords]    = useState([])
  const [loadingRec, setLoadingRec] = useState(false)
  const [saving,     setSaving]     = useState(false)

  const loadSessions = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const data = await api.sessions(schoolId,
        { status: filterStatus || undefined, class_id: filterClass || undefined }, token)
      setSessions(Array.isArray(data) ? data : [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [schoolId, token, filterStatus, filterClass])

  useEffect(() => { loadSessions() }, [loadSessions])

  // Open session
  const handleOpen = async () => {
    if (!newSess.class_id) return toast.error('Select a class')
    try {
      await api.openSession(schoolId, {
        class_id:      parseInt(newSess.class_id),
        session_date:  newSess.session_date,
        session_type:  newSess.session_type,
        period_name:   newSess.period_name   || undefined,
        period_number: newSess.period_number ? parseInt(newSess.period_number) : undefined,
      }, token)
      toast.success('Session opened')
      setOpenModal(false)
      setNewSess({ class_id: '', session_date: format(new Date(), 'yyyy-MM-dd'), session_type: 'full_day', period_name: '', period_number: '' })
      loadSessions()
    } catch (e) { toast.error(e.message) }
  }

  // Close session
  const handleClose = async (sess) => {
    if (!confirm(`Close session for ${sess.class_name || 'this class'} on ${sess.session_date}?\nUnmarked students will be auto-flagged as absent.`)) return
    try {
      await api.closeSession(schoolId, sess.id, token)
      toast.success('Session closed — absentees flagged')
      loadSessions()
    } catch (e) { toast.error(e.message) }
  }

  // Open mark modal — pre-fill from existing records or from enrolled students
  const openMarkModal = async (sess) => {
    setMarkModal(sess)
    setLoadingRec(true)
    try {
      const existing = await api.sessionRecords(schoolId, sess.id, token)
      if (Array.isArray(existing) && existing.length > 0) {
        setRecords(existing.map(r => ({
          student_id:     r.student_id,
          name:           r.student_name  || `#${r.student_id}`,
          student_number: r.admission_number || '',
          status:         r.status        || 'present',
          check_in_time:  r.check_in_time  || '',
          check_out_time: r.check_out_time || '',
          remarks:        r.remarks        || '',
        })))
      } else {
        // Pre-fill from class students
        const classStudents = studentOptions(sess.class_id)
        setRecords(classStudents.map(s => ({
          student_id: s.value, name: s.label, student_number: s.sub || '',
          status: 'present', check_in_time: '', check_out_time: '', remarks: '',
        })))
      }
    } catch { setRecords([]) }
    finally { setLoadingRec(false) }
  }

  const addStudent = (v, opt) => {
    if (!v || records.find(r => String(r.student_id) === String(v))) return
    setRecords(r => [...r, { student_id: v, name: opt?.label || `#${v}`, student_number: opt?.sub || '', status: 'present', check_in_time: '', check_out_time: '', remarks: '' }])
  }
  const upd    = (i, k, v) => setRecords(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  const remove = (i)        => setRecords(r => r.filter((_, idx) => idx !== i))
  const markAll = (s)       => setRecords(r => r.map(row => ({ ...row, status: s })))

  const handleSave = async () => {
    const valid = records.filter(r => r.student_id)
    if (!valid.length) return toast.error('No records to save')
    setSaving(true)
    try {
      await api.markAttendance(schoolId, markModal.id, valid.map(r => ({
        student_id:    parseInt(r.student_id),
        status:        r.status,
        check_in_time:  r.check_in_time  || undefined,
        check_out_time: r.check_out_time || undefined,
        remarks:        r.remarks        || undefined,
      })), token)
      toast.success(`${valid.length} records saved`)
      setMarkModal(null)
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const statusCounts = records.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {})
  const classOpts    = classOptions()

  const columns = [
    { key: 'session_date', label: 'Date', render: v => <span className="font-mono text-xs text-slate-600">{format(new Date(v), 'EEE, MMM d yyyy')}</span> },
    { key: 'class_name',   label: 'Class', render: (v, row) => <span className="font-semibold text-slate-900">{v || `Class ${row.class_id}`}</span> },
    { key: 'session_type', label: 'Type',   render: v => <Badge variant="blue">{v.replace(/_/g, ' ')}</Badge> },
    { key: 'period_name',  label: 'Period', render: v => v || <span className="text-slate-300">—</span> },
    { key: 'status',       label: 'Status', render: v => <Badge variant={v}>{v}</Badge> },
    {
      key: 'id', label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <Button size="xs" variant="secondary" icon={CheckSquare} onClick={() => openMarkModal(row)}>
            {row.status === 'open' ? 'Mark' : 'View'}
          </Button>
          {row.status === 'open' && (
            <Button size="xs" variant="danger" icon={Lock} onClick={() => handleClose(row)}>Close</Button>
          )}
        </div>
      )
    },
  ]

  return (
    <div className="page space-y-5">
      <SectionHeader
        title="Attendance Sessions"
        sub="Open and manage daily class attendance sessions"
        breadcrumb="Attendance"
        actions={<Button icon={Plus} onClick={() => setOpenModal(true)}>New Session</Button>}
      />

      {/* Filters */}
      <Card className="flex flex-wrap gap-3 items-end">
        <div className="w-56">
          <SearchableSelect options={[{ value: '', label: 'All classes' }, ...classOpts]}
            value={filterClass} onChange={v => setFilterClass(v)} placeholder="Filter by class…" />
        </div>
        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} wrapClass="w-36">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </Select>
        <Button variant="secondary" size="sm" onClick={loadSessions}>Apply</Button>
      </Card>

      <Card noPad>
        <Table columns={columns} data={sessions} loading={loading}
          emptyState={
            <EmptyState icon={CalendarCheck} title="No sessions found"
              subtitle="Open a session to start marking attendance"
              action={<Button icon={Plus} onClick={() => setOpenModal(true)}>New Session</Button>} />
          } />
      </Card>

      {/* ── Open Session Modal ── */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Open New Attendance Session"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setOpenModal(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleOpen}>Open Session</Button>
          </div>
        }>
        <div className="space-y-4">
          <SearchableSelect label="Class *" options={classOpts}
            value={newSess.class_id}
            onChange={v => setNewSess(s => ({ ...s, class_id: v }))}
            placeholder="Select a class…" loading={dL.classes} />
          <FormGrid cols={2}>
            <Input label="Session Date *" type="date" value={newSess.session_date}
              onChange={e => setNewSess(s => ({ ...s, session_date: e.target.value }))} />
            <Select label="Session Type" value={newSess.session_type}
              onChange={e => setNewSess(s => ({ ...s, session_type: e.target.value }))}>
              <option value="full_day">Full Day</option>
              <option value="morning">Morning Only</option>
              <option value="afternoon">Afternoon Only</option>
              <option value="period">Period-Based</option>
            </Select>
          </FormGrid>
          {newSess.session_type === 'period' && (
            <FormGrid cols={2}>
              <Input label="Period Name" placeholder="Mathematics"
                value={newSess.period_name} onChange={e => setNewSess(s => ({ ...s, period_name: e.target.value }))} />
              <Input label="Period #" type="number" placeholder="2"
                value={newSess.period_number} onChange={e => setNewSess(s => ({ ...s, period_number: e.target.value }))} />
            </FormGrid>
          )}
          <Alert type="info">Students in the selected class will be pre-loaded in the attendance sheet.</Alert>
        </div>
      </Modal>

      {/* ── Mark Attendance Modal ── */}
      <Modal
        open={!!markModal} onClose={() => setMarkModal(null)}
        title={`Attendance — ${markModal?.class_name || `Class ${markModal?.class_id}`} · ${markModal?.session_date || ''}`}
        width={920}
        footer={
          markModal?.status === 'open' ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-3 text-xs flex-wrap">
                {STATUS_OPTIONS.map(s => statusCounts[s] ? (
                  <span key={s} className="font-semibold" style={{ color: STATUS_COLORS[s] }}>
                    {statusCounts[s]} {s.replace(/_/g, ' ')}
                  </span>
                ) : null)}
              </div>
              <div className="flex gap-3 shrink-0">
                <Button variant="secondary" onClick={() => setMarkModal(null)}>Cancel</Button>
                <Button loading={saving} onClick={handleSave}>Save {records.filter(r => r.student_id).length} Records</Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setMarkModal(null)}>Close</Button>
          )
        }>
        {loadingRec ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {/* Toolbar */}
            {markModal?.status === 'open' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Mark all:</span>
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => markAll(s)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors"
                    style={{ color: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] + '50', background: STATUS_BG[s] }}>
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
                <div className="ml-auto w-56">
                  <SearchableSelect options={studentOptions(markModal?.class_id)}
                    value="" onChange={(v, opt) => addStudent(v, opt)} placeholder="+ Add student…" />
                </div>
              </div>
            )}

            {records.length === 0 && (
              <Alert type="warning">
                No students loaded. Ensure students are enrolled in this class, or use the search above to add them.
              </Alert>
            )}

            {/* Records */}
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {records.map((rec, i) => (
                <div key={i}
                  className="grid items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200"
                  style={{ gridTemplateColumns: '1fr 140px 80px 80px 1fr 28px' }}>
                  {/* Student */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{rec.name}</p>
                    {rec.student_number && <p className="text-[10px] text-slate-400 font-mono">{rec.student_number}</p>}
                  </div>
                  {/* Status */}
                  <select value={rec.status}
                    onChange={e => upd(i, 'status', e.target.value)}
                    disabled={markModal?.status !== 'open'}
                    className="text-xs font-bold rounded-lg px-2 py-1.5 border outline-none disabled:opacity-60 cursor-pointer"
                    style={{
                      color:       STATUS_COLORS[rec.status],
                      borderColor: STATUS_COLORS[rec.status] + '40',
                      background:  STATUS_BG[rec.status],
                    }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                  {/* Times */}
                  <input type="time" value={rec.check_in_time}
                    onChange={e => upd(i, 'check_in_time', e.target.value)}
                    disabled={markModal?.status !== 'open'}
                    className="input-base !py-1.5 !text-xs disabled:opacity-60" />
                  <input type="time" value={rec.check_out_time}
                    onChange={e => upd(i, 'check_out_time', e.target.value)}
                    disabled={markModal?.status !== 'open'}
                    className="input-base !py-1.5 !text-xs disabled:opacity-60" />
                  <input placeholder="Remarks…" value={rec.remarks}
                    onChange={e => upd(i, 'remarks', e.target.value)}
                    disabled={markModal?.status !== 'open'}
                    className="input-base !py-1.5 !text-xs disabled:opacity-60" />
                  {markModal?.status === 'open' && (
                    <button onClick={() => remove(i)}
                      className="text-slate-300 hover:text-red-500 transition-colors flex items-center justify-center">
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
