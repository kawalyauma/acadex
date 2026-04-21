import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { examApi } from '../../services/api'
import {
  Card, Button, Badge, Modal, SearchableSelect,
  Spinner, EmptyState, Alert, Tabs
} from '../../components/ui'
import {
  ArrowLeft, Plus, Trash2, CheckSquare, BookOpen,
  Users, ClipboardList, ChevronDown, Check
} from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const STATUS_BADGE  = { draft:'default', active:'blue', marking:'pending', published:'approved', archived:'inactive' }

// All valid statuses — any → any is allowed by the backend
const ALL_STATUSES = [
  { value:'draft',     label:'Draft',     desc:'Being set up — classes not yet enrolled',     color:'#64748B' },
  { value:'active',    label:'Active',    desc:'Open for class enrolment and subject setup',  color:'#2563EB' },
  { value:'marking',   label:'Marking',   desc:'Teachers are entering marks',                 color:'#D97706' },
  { value:'published', label:'Published', desc:'Results are visible and can be printed',      color:'#059669' },
  { value:'archived',  label:'Archived',  desc:'Exam closed and archived',                    color:'#94A3B8' },
]

// ── Status selector dropdown ────────────────────────────────
function StatusDropdown({ current, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const cur = ALL_STATUSES.find(s => s.value === current)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700">
        <span className="w-2 h-2 rounded-full" style={{ background: cur?.color || '#64748B' }} />
        {cur?.label || current}
        <ChevronDown size={13} className={clsx('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Set Exam Status</p>
          </div>
          {ALL_STATUSES.map(s => (
            <button key={s.value}
              onClick={() => { onChange(s.value); setOpen(false) }}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                s.value === current ? 'bg-blue-50' : 'hover:bg-slate-50'
              )}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <div className="flex-1 min-w-0">
                <p className={clsx('text-sm font-semibold', s.value === current ? 'text-blue-700' : 'text-slate-800')}>
                  {s.label}
                </p>
                <p className="text-xs text-slate-400 truncate">{s.desc}</p>
              </div>
              {s.value === current && <Check size={13} className="text-blue-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ExamDetail() {
  const { examId } = useParams()
  const { token, schoolId } = useAuthStore()
  const { classes, classOptions, studentOptions } = useDataStore()
  const navigate = useNavigate()

  const [exam,          setExam]          = useState(null)
  const [enrolledClasses, setEnrolled]    = useState([])
  const [tab,           setTab]           = useState('overview')
  const [loading,       setLoading]       = useState(true)
  const [changingStatus,setChangingStatus]= useState(false)

  // Class enrol modal
  const [classModal,  setClassModal]  = useState(false)
  const [selClass,    setSelClass]    = useState('')
  const [enrolling,   setEnrolling]   = useState(false)

  // Subject config modal
  const [subjModal,      setSubjModal]      = useState(null)
  const [schoolSubjects, setSchoolSubjects] = useState([])
  const [examSubjects,   setExamSubjects]   = useState([])
  const [selSubjects,    setSelSubjects]    = useState([])
  const [savingSubj,     setSavingSubj]     = useState(false)

  // Marksheet
  const [markClass,   setMarkClass]   = useState('')
  const [marksheet,   setMarksheet]   = useState(null)
  const [markLoading, setMarkLoading] = useState(false)
  const [activeSubj,  setActiveSubj]  = useState(null)
  const [editedMarks, setEditedMarks] = useState({})
  const [savingMarks, setSavingMarks] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId || !examId) return
    setLoading(true)
    try {
      const [examData, enrolled] = await Promise.all([
        examApi.getExam(schoolId, examId, token),
        examApi.examClasses(schoolId, examId, token),
      ])
      setExam(examData)
      setEnrolled(Array.isArray(enrolled) ? enrolled : [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [schoolId, examId, token])

  useEffect(() => { load() }, [load])

  // ── Status change (any → any) ─────────────────────────────
  const handleStatusChange = async (newStatus) => {
    if (newStatus === exam?.status) return
    if (!confirm(`Change exam status from "${exam.status}" to "${newStatus}"?`)) return
    setChangingStatus(true)
    try {
      await examApi.updateExamStatus(schoolId, examId, newStatus, token)
      toast.success(`Status changed to ${newStatus}`)
      load()
    } catch (e) { toast.error(e.message) }
    finally { setChangingStatus(false) }
  }

  // ── Class enrolment ───────────────────────────────────────
  const handleEnroll = async () => {
    if (!selClass) return toast.error('Select a class')
    setEnrolling(true)
    try {
      await examApi.enrollClass(schoolId, examId, { class_id: parseInt(selClass) }, token)
      toast.success('Class enrolled')
      setClassModal(false); setSelClass('')
      load()
    } catch (e) { toast.error(e.message) }
    finally { setEnrolling(false) }
  }

  const handleRemoveClass = async (classId) => {
    if (!confirm('Remove this class? All its marks will be deleted.')) return
    try {
      await examApi.removeClass(schoolId, examId, classId, token)
      toast.success('Class removed'); load()
    } catch (e) { toast.error(e.message) }
  }

  // ── Subject config ────────────────────────────────────────
  const openSubjModal = async (classId) => {
    setSubjModal(classId); setSelSubjects([])
    try {
      const [allSubjs, examSubjs] = await Promise.all([
        examApi.subjects(schoolId, { class_id: classId }, token),
        examApi.examSubjects(schoolId, examId, classId, token),
      ])
      setSchoolSubjects(Array.isArray(allSubjs) ? allSubjs : [])
      setExamSubjects(Array.isArray(examSubjs) ? examSubjs : [])
      setSelSubjects((Array.isArray(examSubjs) ? examSubjs : []).map(s => s.subject_id))
    } catch (e) { toast.error(e.message) }
  }

  const toggleSubject = id => setSelSubjects(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const saveSubjects = async () => {
    setSavingSubj(true)
    try {
      await examApi.bulkAddSubjects(schoolId, examId, { class_id: subjModal, subject_ids: selSubjects }, token)
      const toRemove = examSubjects.filter(s => !selSubjects.includes(s.subject_id))
      for (const s of toRemove) await examApi.removeExamSubj(schoolId, examId, s.subject_id, subjModal, token).catch(() => {})
      toast.success('Subjects saved'); setSubjModal(null)
    } catch (e) { toast.error(e.message) }
    finally { setSavingSubj(false) }
  }

  // ── Marksheet ─────────────────────────────────────────────
  const loadMarksheet = async (classId) => {
    if (!classId) return
    setMarkClass(classId); setMarkLoading(true); setMarksheet(null); setActiveSubj(null); setEditedMarks({})
    try {
      const data = await examApi.marksheet(schoolId, examId, classId, token)
      setMarksheet(data)
      if (data.subjects?.length > 0) setActiveSubj(data.subjects[0].subject_id)
    } catch (e) { toast.error(e.message) }
    finally { setMarkLoading(false) }
  }

  const saveMarks = async () => {
    if (!activeSubj || !marksheet) return
    const records = marksheet.students.map(s => ({
      student_id: s.id,
      marks_obtained: editedMarks[s.id] !== undefined
        ? (editedMarks[s.id] === '' ? null : parseFloat(editedMarks[s.id]))
        : s.marks[activeSubj]?.marks_obtained ?? null,
      is_absent: editedMarks[s.id] === 'ABS' ? 1 : 0,
    })).filter(r => r.marks_obtained !== null || r.is_absent)

    setSavingMarks(true)
    try {
      const res = await examApi.bulkMarks(schoolId, examId, { subject_id: activeSubj, records }, token)
      const errs = res.filter(r => !r.ok)
      if (errs.length) toast.error(`${errs.length} entries failed — ${errs[0]?.error || ''}`)
      else toast.success(`Marks saved for ${records.length} students`)
      setEditedMarks({}); loadMarksheet(markClass)
    } catch (e) { toast.error(e.message) }
    finally { setSavingMarks(false) }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner /></div>
  if (!exam)   return <EmptyState icon={ClipboardList} title="Exam not found" action={<Button onClick={() => navigate('/exams')}>← Back</Button>} />

  const classOpts       = classOptions()
  const enrolledIds     = new Set(enrolledClasses.map(c => String(c.class_id)))
  const availableToEnrol= classOpts.filter(c => !enrolledIds.has(String(c.value)))
  const activeSubjData  = marksheet?.subjects?.find(s => s.subject_id === activeSubj)
  const maxMark         = activeSubjData?.max_mark || 100
  const canEditMarks    = ['active','marking'].includes(exam.status)
  const GRADE_COLORS    = {D1:'#059669',D2:'#10B981',C3:'#1D4ED8',C4:'#3B82F6',C5:'#60A5FA',C6:'#93C5FD',P7:'#D97706',P8:'#F59E0B',F9:'#DC2626'}

  return (
    <div className="page space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/exams')} className="mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-xl text-slate-900 truncate">{exam.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {exam.exam_type?.replace(/_/g, ' ')} · {exam.term_name || 'No term'} · {exam.academic_year_name || ''}
          </p>
        </div>

        {/* Status selector — allows any → any including reverse */}
        <div className="flex items-center gap-2 shrink-0">
          {changingStatus && <Spinner size={16} />}
          <StatusDropdown current={exam.status} onChange={handleStatusChange} />
        </div>
      </div>

      {/* Status guidance */}
      {exam.status === 'draft' && (
        <Alert type="info">Exam is in <strong>Draft</strong>. Enrol classes and configure subjects, then advance to <strong>Active</strong>.</Alert>
      )}
      {exam.status === 'active' && (
        <Alert type="info">Exam is <strong>Active</strong>. Enrol classes and add subjects. When ready for mark entry, advance to <strong>Marking</strong>.</Alert>
      )}
      {exam.status === 'marking' && (
        <Alert type="warning">Exam is in <strong>Marking</strong> mode. Enter marks for each class, then go to Report Cards to compute results.</Alert>
      )}
      {exam.status === 'archived' && (
        <Alert type="warning">Exam is <strong>Archived</strong>. To make changes, use the status dropdown above to revert to an earlier status.</Alert>
      )}

      <Card className="!p-3">
        <Tabs tabs={[{ key:'overview', label:'Overview' }, { key:'marksheet', label:'Enter Marks' }]}
          active={tab} onChange={setTab} />
      </Card>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-display font-semibold text-slate-800 text-sm">
              Enrolled Classes ({enrolledClasses.length})
            </p>
            <Button size="sm" icon={Plus} onClick={() => setClassModal(true)}>Enrol Class</Button>
          </div>

          {enrolledClasses.length === 0 ? (
            <Card>
              <EmptyState icon={Users} title="No classes enrolled"
                subtitle="Enrol classes to configure subjects and enter marks"
                action={<Button icon={Plus} onClick={() => setClassModal(true)}>Enrol Class</Button>} />
            </Card>
          ) : (
            <div className="space-y-3">
              {enrolledClasses.map(ec => (
                <Card key={ec.id} className="!p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Users size={15} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {ec.class_name}{ec.stream_name ? ` — ${ec.stream_name}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="xs" variant="secondary" icon={BookOpen}    onClick={() => openSubjModal(ec.class_id)}>Subjects</Button>
                      <Button size="xs" variant="secondary" icon={CheckSquare} onClick={() => { setTab('marksheet'); loadMarksheet(ec.class_id) }}>Marks</Button>
                      <Button size="xs" variant="ghost" icon={Trash2}
                        className="!text-red-400 hover:!bg-red-50"
                        onClick={() => handleRemoveClass(ec.class_id)} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Quick link to report cards */}
          {enrolledClasses.length > 0 && (
            <Card className="flex items-center gap-3 bg-slate-50/50 !p-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">Ready to compute results?</p>
                <p className="text-xs text-slate-500 mt-0.5">Go to Report Cards to compute aggregates, rank students and print PDFs.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate(`/exams/${examId}/report-cards`)}>
                Report Cards →
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ── MARKSHEET TAB ── */}
      {tab === 'marksheet' && (
        <div className="space-y-4">
          <Card className="flex gap-3 items-end flex-wrap">
            <div className="w-64">
              <SearchableSelect label="Select class"
                options={enrolledClasses.map(c => ({ value: c.class_id, label: c.class_name }))}
                value={markClass} onChange={v => loadMarksheet(v)} placeholder="Choose a class…" />
            </div>
            {marksheet && canEditMarks && (
              <Button loading={savingMarks} onClick={saveMarks} className="self-end">
                Save Marks
              </Button>
            )}
            {!canEditMarks && marksheet && (
              <div className="self-end text-xs text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                Read-only — status is <strong>{exam.status}</strong>. Change to <strong>marking</strong> to edit.
              </div>
            )}
          </Card>

          {markLoading && <div className="flex justify-center py-12"><Spinner /></div>}

          {marksheet && !markLoading && (
            <>
              {/* Subject tabs */}
              <div className="flex gap-2 flex-wrap">
                {marksheet.subjects.map(s => (
                  <button key={s.subject_id}
                    onClick={() => { setActiveSubj(s.subject_id); setEditedMarks({}) }}
                    className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                      activeSubj === s.subject_id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
                    {s.subject_name}
                    {!s.is_gradable && <span className="ml-1.5 text-[10px] opacity-60 uppercase tracking-wide">NG</span>}
                  </button>
                ))}
              </div>

              {activeSubj && (
                <Card noPad>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{activeSubjData?.subject_name}</p>
                      <p className="text-xs text-slate-400">Max: {maxMark} · {activeSubjData?.is_gradable ? 'Gradable (D1–F9)' : 'Non-gradable'}</p>
                    </div>
                    <p className="text-xs text-slate-400">{marksheet.students.length} students</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-head-cell">#</th>
                          <th className="table-head-cell">Student</th>
                          <th className="table-head-cell">Adm. No.</th>
                          <th className="table-head-cell text-center">Marks / {maxMark}</th>
                          <th className="table-head-cell text-center">%</th>
                          <th className="table-head-cell text-center">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marksheet.students.map((s, idx) => {
                          const saved  = s.marks[activeSubj]
                          const edited = editedMarks[s.id]
                          const value  = edited !== undefined ? edited : (saved?.marks_obtained ?? '')
                          const grade  = saved?.grade
                          const gc     = GRADE_COLORS[grade]
                          return (
                            <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                              <td className="table-cell text-slate-400 text-xs">{idx + 1}</td>
                              <td className="table-cell font-medium text-slate-900">{s.first_name} {s.last_name}</td>
                              <td className="table-cell font-mono text-xs text-slate-400">{s.student_number || '—'}</td>
                              <td className="table-cell text-center">
                                {canEditMarks ? (
                                  <input type="number" min={0} max={maxMark} value={value}
                                    onChange={e => setEditedMarks(p => ({ ...p, [s.id]: e.target.value }))}
                                    placeholder="—"
                                    className="w-20 text-center input-base !py-1 !text-sm" />
                                ) : (
                                  <span className="font-mono text-sm">{saved?.marks_obtained ?? '—'}</span>
                                )}
                              </td>
                              <td className="table-cell text-center text-slate-500 text-sm">
                                {saved?.percentage != null ? `${saved.percentage}%` : '—'}
                              </td>
                              <td className="table-cell text-center">
                                {grade
                                  ? <span className="inline-flex items-center justify-center w-9 h-6 rounded-lg text-xs font-bold"
                                      style={{ background: (gc||'#64748B')+'18', color: gc||'#64748B' }}>
                                      {grade}
                                    </span>
                                  : <span className="text-slate-300">—</span>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {canEditMarks && (
                    <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                      <Button loading={savingMarks} onClick={saveMarks}>
                        Save {Object.keys(editedMarks).length > 0 ? `(${Object.keys(editedMarks).length} edited)` : 'Marks'}
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </>
          )}

          {!marksheet && !markLoading && (
            <Card><EmptyState icon={ClipboardList} title="Select a class to enter marks" /></Card>
          )}
        </div>
      )}

      {/* ── Enrol Class Modal ── */}
      <Modal open={classModal} onClose={() => setClassModal(false)} title="Enrol Class in Exam" width={460}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setClassModal(false)}>Cancel</Button>
            <Button className="flex-1" loading={enrolling} onClick={handleEnroll}>Enrol Class</Button>
          </div>
        }>
        {availableToEnrol.length === 0
          ? <Alert type="info">All classes have already been enrolled in this exam.</Alert>
          : <SearchableSelect label="Class *" options={availableToEnrol}
              value={selClass} onChange={v => setSelClass(v)} placeholder="Select a class…" />
        }
      </Modal>

      {/* ── Subjects Modal ── */}
      <Modal open={!!subjModal} onClose={() => setSubjModal(null)}
        title={`Subjects — ${classes.find(c => c.id === subjModal)?.name || 'Class'}`} width={500}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setSubjModal(null)}>Cancel</Button>
            <Button className="flex-1" loading={savingSubj} onClick={saveSubjects}>Save Subjects</Button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Select which subjects this class will sit in this exam.</p>
          {schoolSubjects.length === 0
            ? <Alert type="warning">No subjects found for this class. Go to <strong>Subjects</strong> to create them first.</Alert>
            : schoolSubjects.map(s => (
              <label key={s.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input type="checkbox" checked={selSubjects.includes(s.id)} onChange={() => toggleSubject(s.id)}
                  className="w-4 h-4 accent-blue-600 rounded" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-400">Max: {s.max_mark} marks · {s.is_gradable ? 'Gradable' : 'Non-gradable (NG)'}</p>
                </div>
                {!s.is_gradable && <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">NG</span>}
              </label>
            ))
          }
        </div>
      </Modal>
    </div>
  )
}
