import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { examApi } from '../../services/api'
import {
  Card, Button, Badge, Table, Modal, Input, Select, SearchableSelect,
  SectionHeader, FormGrid, Spinner, EmptyState, Alert, Tabs
} from '../../components/ui'
import { ClipboardList, Plus, Settings2, ChevronRight, BookOpen, Check } from 'lucide-react'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const EXAM_TYPES = [
  { value: 'end_of_term', label: 'End of Term' },
  { value: 'mid_term',    label: 'Mid Term' },
  { value: 'mock',        label: 'Mock Exam' },
  { value: 'internal',    label: 'Internal Assessment' },
]

const STATUS_FLOW = ['draft', 'active', 'marking', 'published', 'archived']
const STATUS_BADGE = { draft:'default', active:'blue', marking:'pending', published:'approved', archived:'inactive' }
const STATUS_LABELS = { draft:'Draft', active:'Active', marking:'Marking', published:'Published', archived:'Archived' }

export default function Exams() {
  const { token, schoolId } = useAuthStore()
  const { yearOptions, termOptions, currentYear, currentTerm } = useDataStore()
  const navigate = useNavigate()

  const [exams,   setExams]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [tab,     setTab]     = useState('all')

  const [form, setForm] = useState({
    name: '', exam_type: 'end_of_term',
    term_id: '', academic_year_id: '',
    start_date: '', end_date: '', remarks: ''
  })

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const data = await examApi.exams(schoolId, tab !== 'all' ? { status: tab } : {}, token)
      setExams(Array.isArray(data) ? data : [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [schoolId, token, tab])

  useEffect(() => { load() }, [load])

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const openCreate = () => {
    const yr = currentYear()
    const tm = currentTerm()
    setForm({
      name: '', exam_type: 'end_of_term',
      term_id:          tm?.id  || '',
      academic_year_id: yr?.id  || '',
      start_date: '', end_date: '', remarks: ''
    })
    setModal(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Exam name is required')
    setSaving(true)
    try {
      const exam = await examApi.createExam(schoolId, {
        ...form,
        term_id:          form.term_id          ? parseInt(form.term_id)          : null,
        academic_year_id: form.academic_year_id ? parseInt(form.academic_year_id) : null,
      }, token)
      toast.success('Exam created')
      setModal(false)
      navigate(`/exams/${exam.id}`)
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleSetStatus = async (exam, newStatus) => {
    if (newStatus === exam.status) return
    if (!confirm(`Change "${exam.name}" status to "${newStatus}"?`)) return
    try {
      await examApi.updateExamStatus(schoolId, exam.id, newStatus, token)
      toast.success(`Status set to ${newStatus}`)
      load()
    } catch (e) { toast.error(e.message) }
  }

  const TABS = [
    { key: 'all',       label: 'All' },
    { key: 'draft',     label: 'Draft' },
    { key: 'active',    label: 'Active' },
    { key: 'marking',   label: 'Marking' },
    { key: 'published', label: 'Published' },
  ]

  const yOpts = yearOptions()
  const tOpts = termOptions()

  const columns = [
    {
      key: 'name', label: 'Exam',
      render: (v, row) => (
        <div>
          <p className="text-sm font-semibold text-slate-900">{v}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {row.exam_type?.replace(/_/g, ' ')} · {row.term_name || '—'}
          </p>
        </div>
      )
    },
    { key: 'academic_year_name', label: 'Year', render: v => v || <span className="text-slate-300">—</span> },
    {
      key: 'start_date', label: 'Dates',
      render: (v, row) => v
        ? <span className="text-xs font-mono">{format(new Date(v), 'MMM d')} – {row.end_date ? format(new Date(row.end_date), 'MMM d yyyy') : '?'}</span>
        : <span className="text-slate-300">—</span>
    },
    { key: 'status', label: 'Status', render: (v, row) => (
      <select value={v}
        onChange={e => handleSetStatus(row, e.target.value)}
        onClick={e => e.stopPropagation()}
        className="text-xs font-semibold rounded-lg px-2 py-1 border outline-none cursor-pointer bg-white transition-colors"
        style={{ color: {draft:'#64748B',active:'#1D4ED8',marking:'#D97706',published:'#059669',archived:'#94A3B8'}[v] || '#64748B',
                 borderColor: {draft:'#CBD5E0',active:'#BFDBFE',marking:'#FDE68A',published:'#A7F3D0',archived:'#E2E8F0'}[v] || '#E2E8F0' }}>
        {['draft','active','marking','published','archived'].map(s =>
          <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
      </select>
    )},
    {
      key: 'id', label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <Button size="xs" variant="secondary" icon={Settings2}
            onClick={() => navigate(`/exams/${row.id}`)}>
            Manage
          </Button>

        </div>
      )
    },
  ]

  return (
    <div className="page space-y-5">
      <SectionHeader
        title="Examinations"
        sub="Create and manage exams, enrol classes, enter marks, generate report cards"
        breadcrumb="Exams"
        actions={<Button icon={Plus} onClick={openCreate}>New Exam</Button>}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: ClipboardList, label: 'Subjects',     desc: 'Manage school subjects',     to: '/exams/subjects',  color: '#2563EB' },
          { icon: BookOpen,      label: 'Grading Scale', desc: 'Uganda PLE D1–F9 bands',    to: '/exams/grading',   color: '#059669' },
          { icon: Check,         label: 'Comments',     desc: 'CT & HM comment rules',       to: '/exams/comments',  color: '#7C3AED' },
          { icon: ChevronRight,  label: 'All Exams',    desc: `${exams.length} created`,     to: null,               color: '#D97706' },
        ].map(q => (
          <div key={q.label}
            className={clsx('card p-4 flex items-start gap-3', q.to && 'cursor-pointer hover:border-slate-300 transition-colors')}
            onClick={() => q.to && navigate(q.to)}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: q.color + '15' }}>
              <q.icon size={17} style={{ color: q.color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{q.label}</p>
              <p className="text-xs text-slate-400">{q.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <Card noPad>
        <Table columns={columns} data={exams} loading={loading}
          emptyState={<EmptyState icon={ClipboardList} title="No exams found"
            subtitle="Create your first exam to get started"
            action={<Button icon={Plus} onClick={openCreate}>New Exam</Button>} />}
        />
      </Card>

      {/* Create Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Create New Exam" width={580}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleCreate}>Create Exam</Button>
          </div>
        }>
        <div className="space-y-4">
          <Input label="Exam Name *" placeholder="End of Term 1 Examinations 2025"
            value={form.name} onChange={f('name')} autoFocus />
          <FormGrid cols={2}>
            <Select label="Exam Type" value={form.exam_type} onChange={f('exam_type')}>
              {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <SearchableSelect label="Academic Year" options={yOpts}
              value={form.academic_year_id}
              onChange={v => setForm(p => ({ ...p, academic_year_id: v }))}
              placeholder="Select year…" />
          </FormGrid>
          <SearchableSelect label="Term" options={tOpts}
            value={form.term_id}
            onChange={v => setForm(p => ({ ...p, term_id: v }))}
            placeholder="Select term…" />
          <FormGrid cols={2}>
            <Input label="Start Date" type="date" value={form.start_date} onChange={f('start_date')} />
            <Input label="End Date"   type="date" value={form.end_date}   onChange={f('end_date')} />
          </FormGrid>
          <div className="flex flex-col gap-1">
            <label className="label">Remarks (optional)</label>
            <textarea value={form.remarks} onChange={f('remarks')} rows={2}
              className="input-base resize-none" placeholder="Any notes about this exam…" />
          </div>
        </div>
      </Modal>
    </div>
  )
}
