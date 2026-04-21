import { useState, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { api } from '../../services/api'
import {
  Card, Button, Badge, Table, Modal, Input, Select,
  SearchableSelect, SectionHeader, FormGrid, Spinner,
  EmptyState, Avatar, ConfirmModal, Alert, Tabs
} from '../../components/ui'
import { exportStudentReportPDF } from '../../lib/pdf'
import { GraduationCap, Plus, Search, Download, Edit2, Trash2, Eye, History } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const EMPTY = {
  student_number: '', first_name: '', last_name: '', middle_name: '',
  date_of_birth: '', gender: '', admission_date: format(new Date(), 'yyyy-MM-dd'),
  current_class_id: '', current_stream_id: '',
  parent_guardian_name: '', parent_guardian_phone: '', parent_guardian_email: '',
  address: '',
}

export default function Students() {
  const { token, schoolId }                     = useAuthStore()
  const { students, setStudents: setStore, classes,
          classOptions, streamOptions, studentOptions,
          loading: dataLoading }                = useDataStore()

  const [search,      setSearch]      = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [createModal, setCreateModal] = useState(false)
  const [editModal,   setEditModal]   = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [reportModal, setReportModal] = useState(null)
  const [histModal,   setHistModal]   = useState(null)
  const [form,        setForm]        = useState(EMPTY)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [reportFrom,  setReportFrom]  = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [reportTo,    setReportTo]    = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [reportData,  setReportData]  = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [history,     setHistory]     = useState([])

  // Refresh students from server
  const reload = useCallback(async () => {
    if (!schoolId) return
    const data = await api.students(schoolId, { limit: 2000 }, token).catch(() => [])
    setStore(Array.isArray(data) ? data : [])
  }, [schoolId, token])

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  // Visible students after filter
  const visible = students.filter(s => {
    const cls  = !filterClass || String(s.current_class_id) === String(filterClass)
    const srch = !search || `${s.first_name} ${s.last_name} ${s.student_number || ''}`.toLowerCase().includes(search.toLowerCase())
    return cls && srch
  })

  const openCreate = () => { setForm(EMPTY); setCreateModal(true) }
  const openEdit   = (s)  => { setForm({ ...s, current_class_id: s.current_class_id || '', current_stream_id: s.current_stream_id || '' }); setEditModal(s) }

  const handleSave = async (isEdit) => {
    if (!form.first_name.trim() || !form.last_name.trim()) return toast.error('First and last name required')
    if (!form.current_class_id) return toast.error('Please select a class')
    setSaving(true)
    try {
      const body = {
        ...form,
        current_class_id:  form.current_class_id  ? parseInt(form.current_class_id)  : undefined,
        current_stream_id: form.current_stream_id ? parseInt(form.current_stream_id) : null,
      }
      if (isEdit) {
        await api.updateStudent(schoolId, editModal.id, body, token)
        toast.success('Student updated')
        setEditModal(null)
      } else {
        await api.createStudent(schoolId, body, token)
        toast.success('Student created')
        setCreateModal(false)
      }
      reload()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.withdrawStudent(schoolId, deleteModal.id, { notes: 'Withdrawn from system' }, token)
      toast.success('Student withdrawn')
      setDeleteModal(null)
      reload()
    } catch (e) { toast.error(e.message) }
    finally { setDeleting(false) }
  }

  const loadReport = async (student) => {
    setReportModal(student)
    setReportData(null)
    setReportLoading(true)
    try {
      const r = await api.studentReport(schoolId, student.id, reportFrom, reportTo, token)
      setReportData(r)
    } catch (e) { toast.error(e.message) }
    finally { setReportLoading(false) }
  }

  const loadHistory = async (student) => {
    setHistModal(student)
    setHistory([])
    try {
      const h = await api.studentHistory(schoolId, student.id, token)
      setHistory(Array.isArray(h) ? h : [])
    } catch (e) { toast.error(e.message) }
  }

  const classOpts  = classOptions()
  const streamOpts = form.current_class_id ? streamOptions(form.current_class_id) : []

  const statusColor = { active: 'active', withdrawn: 'withdrawn', graduated: 'graduated', inactive: 'inactive' }

  const columns = [
    {
      key: 'first_name', label: 'Student',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.first_name} ${row.last_name}`} size="sm" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{row.first_name} {row.last_name}</p>
            <p className="text-xs text-slate-400 font-mono">{row.student_number || '—'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'current_class_id', label: 'Class',
      render: (v, row) => {
        const cls    = classes.find(c => String(c.id) === String(v))
        const stream = cls?.streams?.find(s => String(s.id) === String(row.current_stream_id))
        return cls
          ? <span className="text-sm text-slate-700">{cls.name}{stream ? ` / ${stream.name}` : ''}</span>
          : <span className="text-slate-300">—</span>
      }
    },
    { key: 'gender', label: 'Gender', render: v => v ? <span className="capitalize text-sm text-slate-600">{v}</span> : <span className="text-slate-300">—</span> },
    {
      key: 'parent_guardian_name', label: 'Parent/Guardian',
      render: (v, row) => (
        <div>
          <p className="text-sm text-slate-700">{v || '—'}</p>
          {row.parent_guardian_phone && <p className="text-xs text-slate-400">{row.parent_guardian_phone}</p>}
        </div>
      )
    },
    { key: 'status', label: 'Status', render: v => <Badge variant={statusColor[v] || 'default'}>{v || 'active'}</Badge> },
    {
      key: 'id', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <Button size="xs" variant="ghost" icon={Eye}     onClick={() => loadReport(row)} />
          <Button size="xs" variant="ghost" icon={History} onClick={() => loadHistory(row)} />
          <Button size="xs" variant="ghost" icon={Edit2}   onClick={() => openEdit(row)} />
          <Button size="xs" variant="ghost" icon={Trash2}
            className="!text-red-400 hover:!text-red-600 hover:!bg-red-50"
            onClick={() => setDeleteModal(row)} />
        </div>
      )
    },
  ]

  const StudentForm = () => (
    <div className="space-y-4">
      <FormGrid cols={3}>
        <Input label="First Name *"   placeholder="John"   value={form.first_name}   onChange={f('first_name')} />
        <Input label="Middle Name"    placeholder="Paul"   value={form.middle_name}  onChange={f('middle_name')} />
        <Input label="Last Name *"    placeholder="Doe"    value={form.last_name}    onChange={f('last_name')} />
      </FormGrid>
      <FormGrid cols={3}>
        <Input label="Student Number" placeholder="S1/001" value={form.student_number} onChange={f('student_number')} />
        <Input label="Date of Birth"  type="date"          value={form.date_of_birth}  onChange={f('date_of_birth')} />
        <Input label="Admission Date" type="date"          value={form.admission_date} onChange={f('admission_date')} />
      </FormGrid>
      <FormGrid cols={2}>
        <Select label="Gender" value={form.gender} onChange={f('gender')}>
          <option value="">Select…</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </Select>
        <SearchableSelect label="Class *" options={classOpts}
          value={form.current_class_id}
          onChange={v => setForm(p => ({ ...p, current_class_id: v, current_stream_id: '' }))}
          placeholder="Select class…" />
      </FormGrid>
      {streamOpts.length > 0 && (
        <SearchableSelect label="Stream (optional)" options={[{ value: '', label: 'No stream' }, ...streamOpts]}
          value={form.current_stream_id}
          onChange={v => setForm(p => ({ ...p, current_stream_id: v }))}
          placeholder="Select stream…" />
      )}
      <hr className="border-slate-100" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Parent / Guardian</p>
      <FormGrid cols={2}>
        <Input label="Parent Name"  placeholder="Jane Doe"        value={form.parent_guardian_name}  onChange={f('parent_guardian_name')} />
        <Input label="Parent Phone" placeholder="+256 700 000000" value={form.parent_guardian_phone} onChange={f('parent_guardian_phone')} />
      </FormGrid>
      <FormGrid cols={2}>
        <Input label="Parent Email" type="email" placeholder="parent@email.com" value={form.parent_guardian_email} onChange={f('parent_guardian_email')} />
        <Input label="Home Address" placeholder="Village, District"             value={form.address}               onChange={f('address')} />
      </FormGrid>
    </div>
  )

  return (
    <div className="page space-y-5">
      <SectionHeader
        title="Students"
        sub={`${students.length} enrolled`}
        breadcrumb="Academic"
        actions={<Button icon={Plus} onClick={openCreate}>Add Student</Button>}
      />

      {/* Filters */}
      <Card className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input-base pl-9" placeholder="Search by name or student number…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="w-56">
          <SearchableSelect options={[{ value: '', label: 'All classes' }, ...classOpts]}
            value={filterClass} onChange={v => setFilterClass(v)} placeholder="Filter by class…" />
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap self-center">
          {visible.length} of {students.length}
        </span>
      </Card>

      {/* Table */}
      <Card noPad>
        {dataLoading.students ? (
          <div className="p-8 flex justify-center"><Spinner /></div>
        ) : visible.length === 0 ? (
          <EmptyState icon={GraduationCap}
            title={students.length === 0 ? 'No students enrolled yet' : 'No students match your filter'}
            subtitle={students.length === 0 ? 'Add your first student to get started' : 'Try adjusting the search or class filter'}
            action={students.length === 0 ? <Button icon={Plus} onClick={openCreate}>Add Student</Button> : undefined} />
        ) : (
          <Table columns={columns} data={visible} />
        )}
      </Card>

      {/* Create modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Enrol New Student" width={680}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={() => handleSave(false)}>Create Student</Button>
          </div>
        }>
        <StudentForm />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Student" width={680}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setEditModal(null)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={() => handleSave(true)}>Save Changes</Button>
          </div>
        }>
        <StudentForm />
      </Modal>

      {/* Withdraw confirm */}
      <ConfirmModal open={!!deleteModal} onClose={() => setDeleteModal(null)} onConfirm={handleDelete}
        loading={deleting} title="Withdraw Student"
        message={`Withdraw ${deleteModal?.first_name} ${deleteModal?.last_name}? Their attendance records are preserved. You can re-enrol them later.`}
        confirmLabel="Withdraw Student" variant="danger" />

      {/* History modal */}
      <Modal open={!!histModal} onClose={() => setHistModal(null)}
        title={`Class History — ${histModal?.first_name || ''} ${histModal?.last_name || ''}`} width={620}>
        {history.length === 0
          ? <EmptyState icon={History} title="No class history found" />
          : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 capitalize">{h.action_type}</span>
                      <span className="text-xs text-slate-500">→ {h.class_name}{h.stream_name ? ` / ${h.stream_name}` : ''}</span>
                      {h.academic_year_name && <Badge variant="blue">{h.academic_year_name}</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{h.effective_date} · By {h.created_by_name || '—'}</p>
                    {h.notes && <p className="text-xs text-slate-500 mt-1 italic">{h.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </Modal>

      {/* Attendance Report modal */}
      <Modal open={!!reportModal} onClose={() => { setReportModal(null); setReportData(null) }}
        title={`Attendance Report — ${reportModal?.first_name || ''} ${reportModal?.last_name || ''}`} width={720}
        footer={
          reportData && (
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => { setReportModal(null); setReportData(null) }}>Close</Button>
              <Button icon={Download} className="flex-1"
                onClick={() => exportStudentReportPDF(
                  { name: `${reportModal.first_name} ${reportModal.last_name}`, admission_number: reportModal.student_number },
                  reportData.summary, reportData.daily, reportFrom, reportTo
                )}>Export PDF</Button>
            </div>
          )
        }>
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <Input label="From" type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} wrapClass="flex-1" />
            <Input label="To"   type="date" value={reportTo}   onChange={e => setReportTo(e.target.value)}   wrapClass="flex-1" />
            <Button onClick={() => loadReport(reportModal)} loading={reportLoading} size="sm">Load</Button>
          </div>

          {reportLoading && <div className="py-10 flex justify-center"><Spinner /></div>}

          {reportData && !reportLoading && (() => {
            const s    = reportData.summary || {}
            const rate = s.attendance_percent ?? 0
            const rc   = rate >= 80 ? '#059669' : rate >= 60 ? '#D97706' : '#DC2626'
            return (
              <>
                <div className="flex items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0">
                    <circle cx="38" cy="38" r="30" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                    <circle cx="38" cy="38" r="30" fill="none" stroke={rc} strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 30 * rate / 100} ${2 * Math.PI * 30}`}
                      strokeLinecap="round" transform="rotate(-90 38 38)"
                      style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                    <text x="38" y="43" textAnchor="middle" fill={rc} fontSize="13" fontWeight="700"
                      fontFamily="Plus Jakarta Sans,sans-serif">{rate}%</text>
                  </svg>
                  <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {[
                      { l: 'Total',    v: s.total_days,   c: '#2563EB' },
                      { l: 'Present',  v: s.present_days, c: '#059669' },
                      { l: 'Absent',   v: s.absent_days,  c: '#DC2626' },
                      { l: 'Late',     v: s.late_days,    c: '#D97706' },
                      { l: 'Half-Day', v: s.half_days,    c: '#7C3AED' },
                      { l: 'Excused',  v: s.excused_days, c: '#0891B2' },
                    ].map(x => (
                      <div key={x.l}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{x.l}</p>
                        <p className="font-display font-bold text-lg leading-none" style={{ color: x.c }}>{x.v ?? 0}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        {['Date', 'Status', 'Check-In', 'Check-Out', 'Remarks'].map(h =>
                          <th key={h} className="table-head-cell">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.daily || []).map((d, i) => (
                        <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                          <td className="table-cell font-mono text-xs">{format(new Date(d.attendance_date), 'EEE, MMM d yyyy')}</td>
                          <td className="table-cell"><Badge variant={d.status}>{d.status}</Badge></td>
                          <td className="table-cell text-slate-500">{d.check_in_time  || '—'}</td>
                          <td className="table-cell text-slate-500">{d.check_out_time || '—'}</td>
                          <td className="table-cell text-slate-500">{d.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          })()}
        </div>
      </Modal>
    </div>
  )
}
