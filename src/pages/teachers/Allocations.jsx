import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { teacherApi, curriculumApi } from '../../services/api'
import {
  Card, Button, Badge, Modal, SearchableSelect,
  SectionHeader, Spinner, EmptyState, Alert, StatCard, Tabs
} from '../../components/ui'
import { Link2, Plus, Trash2, Users, BookOpen, RefreshCw, CheckCircle2 } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const TABS = [
  { key:'allocations', label:'Subject Allocations' },
  { key:'load',        label:'Teacher Load' },
]

// ── Allocations Tab ─────────────────────────────────────────
function AllocationsTab() {
  const { token, schoolId } = useAuthStore()
  const { classOptions, termOptions, currentTerm } = useDataStore()

  const [selTerm,  setSelTerm]  = useState('')
  const [selClass, setSelClass] = useState('')
  const [allocs,   setAllocs]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [deleting, setDeleting] = useState(null)

  // Modal
  const [modal,    setModal]    = useState(false)
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [form,     setForm]     = useState({ teacher_user_id:'', class_id:'', subject_id:'' })
  const [saving,   setSaving]   = useState(false)

  // Bulk modal
  const [bulkModal,    setBulkModal]    = useState(false)
  const [bulkTeacher,  setBulkTeacher]  = useState('')
  const [bulkSlots,    setBulkSlots]    = useState([]) // [{ class_id, subject_id, label }]
  const [savingBulk,   setSavingBulk]   = useState(false)
  const [allSubjects,  setAllSubjects]  = useState([])

  useEffect(() => {
    const t = currentTerm(); if (t) setSelTerm(String(t.id))
  }, [])

  useEffect(() => { if (selTerm) load() }, [selTerm])

  const load = useCallback(async () => {
    if (!selTerm) return
    setLoading(true)
    try {
      const p = { term_id: selTerm }
      if (selClass) p.class_id = selClass
      const data = await teacherApi.allocations(schoolId, p, token)
      setAllocs(Array.isArray(data) ? data : [])
    } catch { setAllocs([]) }
    finally { setLoading(false) }
  }, [schoolId, token, selTerm, selClass])

  useEffect(() => { load() }, [load])

  const openModal = async () => {
    if (!selTerm) return toast.error('Select a term first')
    setForm({ teacher_user_id:'', class_id: selClass || '', subject_id:'' })
    setSubjects([])
    // Load teachers and subjects
    try {
      const [t, s] = await Promise.all([
        teacherApi.list(schoolId, { is_active: 1 }, token),
        curriculumApi.subjects(schoolId, { term_id: selTerm }, token),
      ])
      setTeachers(Array.isArray(t) ? t : [])
      setSubjects(Array.isArray(s) ? s : [])
    } catch (e) { toast.error(e.message) }
    setModal(true)
  }

  const handleAllocate = async () => {
    if (!form.teacher_user_id || !form.class_id || !form.subject_id)
      return toast.error('Teacher, class and subject are all required')
    setSaving(true)
    try {
      await teacherApi.allocate(schoolId, {
        teacher_user_id: parseInt(form.teacher_user_id),
        term_id:   parseInt(selTerm),
        class_id:  parseInt(form.class_id),
        subject_id:parseInt(form.subject_id),
      }, token)
      toast.success('Teacher allocated')
      setModal(false); load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleRemove = async (id) => {
    if (!confirm('Remove this allocation?')) return
    setDeleting(id)
    try {
      await teacherApi.removeAlloc(schoolId, id, token)
      toast.success('Allocation removed')
      load()
    } catch (e) { toast.error(e.message) }
    finally { setDeleting(null) }
  }

  // Bulk allocation setup
  const openBulk = async () => {
    if (!selTerm) return toast.error('Select a term first')
    setBulkTeacher(''); setBulkSlots([])
    try {
      const [t, s] = await Promise.all([
        teacherApi.list(schoolId, { is_active:1 }, token),
        curriculumApi.subjects(schoolId, { term_id: selTerm }, token),
      ])
      setTeachers(Array.isArray(t) ? t : [])
      setAllSubjects(Array.isArray(s) ? s : [])
    } catch {}
    setBulkModal(true)
  }

  const toggleSlot = (classId, subjId, label) => {
    const key = `${classId}_${subjId}`
    setBulkSlots(p => {
      const exists = p.find(s => `${s.class_id}_${s.subject_id}` === key)
      return exists ? p.filter(s => `${s.class_id}_${s.subject_id}` !== key) : [...p, { class_id: classId, subject_id: subjId, label }]
    })
  }

  const handleBulkSave = async () => {
    if (!bulkTeacher) return toast.error('Select a teacher')
    if (bulkSlots.length === 0) return toast.error('Select at least one slot')
    setSavingBulk(true)
    try {
      const results = await teacherApi.bulkAllocate(schoolId, {
        teacher_user_id: parseInt(bulkTeacher),
        term_id: parseInt(selTerm),
        slots: bulkSlots,
      }, token)
      const ok = results.filter(r => r.ok).length
      const fail = results.filter(r => !r.ok)
      toast.success(`${ok} allocation${ok!==1?'s':''} saved${fail.length?` (${fail.length} failed)`:''} `)
      setBulkModal(false); load()
    } catch (e) { toast.error(e.message) }
    finally { setSavingBulk(false) }
  }

  const classOpts   = classOptions()
  const termOpts    = termOptions()
  const teacherOpts = teachers.map(t => ({ value: t.user_id, label: t.full_name, sub: t.specialization || t.role_name }))
  const classSubjMap= {}
  allSubjects.forEach(s => {
    const cid = String(s.class_id)
    if (!classSubjMap[cid]) classSubjMap[cid] = { class_name: s.class_name, subjects: [] }
    classSubjMap[cid].subjects.push(s)
  })

  const filteredSubjectOpts = subjects
    .filter(s => !form.class_id || String(s.class_id) === String(form.class_id))
    .map(s => ({ value: s.id, label: s.name, sub: s.class_name }))

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="flex flex-wrap gap-3 items-end">
        <div className="w-44">
          <SearchableSelect label="Term *" options={termOpts} value={selTerm}
            onChange={v => setSelTerm(v)} placeholder="Select term…" />
        </div>
        <div className="w-52">
          <SearchableSelect label="Class (optional)"
            options={[{ value:'', label:'All classes' }, ...classOpts]}
            value={selClass} onChange={v => setSelClass(v)} placeholder="All classes…" />
        </div>
        <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={load} className="self-end">
          Refresh
        </Button>
        <div className="flex-1" />
        <Button variant="secondary" icon={Users} onClick={openBulk} className="self-end">Bulk Allocate</Button>
        <Button icon={Plus} onClick={openModal} className="self-end">Allocate Teacher</Button>
      </Card>

      {!selTerm && <Alert type="info">Select a term above to view and manage teacher allocations.</Alert>}

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {allocs.length === 0 && !loading && selTerm && (
        <Card>
          <EmptyState icon={Link2} title="No allocations for this term"
            subtitle="Allocate teachers to subjects and classes so lessons can be recorded"
            action={<Button icon={Plus} onClick={openModal}>Allocate Teacher</Button>} />
        </Card>
      )}

      {allocs.length > 0 && !loading && (
        <Card noPad>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>{['Teacher','Subject','Class','Effective From',''].map(h =>
                  <th key={h} className="table-head-cell">{h}</th>)}</tr>
              </thead>
              <tbody>
                {allocs.map((a, i) => (
                  <tr key={a.id || i} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-0">
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900 text-sm">{a.teacher_full_name}</p>
                      <p className="text-xs text-slate-400">{a.teacher_email}</p>
                    </td>
                    <td className="table-cell">
                      <p className="text-sm font-medium text-slate-800">{a.subject_name}</p>
                      {a.subject_code && <p className="text-xs text-slate-400">{a.subject_code}</p>}
                    </td>
                    <td className="table-cell">
                      <p className="text-sm text-slate-700">{a.class_name}</p>
                      {a.term_name && <p className="text-xs text-slate-400">{a.term_name}</p>}
                    </td>
                    <td className="table-cell text-sm text-slate-500">
                      {a.effective_from || '—'}
                    </td>
                    <td className="table-cell">
                      <Button size="xs" variant="ghost" icon={Trash2}
                        loading={deleting === a.id}
                        className="!text-red-400 hover:!bg-red-50"
                        onClick={() => handleRemove(a.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Single Allocation Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Allocate Teacher" width={520}
        footer={<div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
          <Button className="flex-1" loading={saving} onClick={handleAllocate}>Allocate</Button>
        </div>}>
        <div className="space-y-4">
          <Alert type="info">
            This links a teacher to a specific subject and class for the selected term.
            Lessons for that slot will be auto-assigned to this teacher.
          </Alert>
          <SearchableSelect label="Teacher *" options={teacherOpts} value={form.teacher_user_id}
            onChange={v => setForm(p => ({ ...p, teacher_user_id: v }))} placeholder="Select teacher…" />
          <SearchableSelect label="Class *"
            options={classOpts} value={form.class_id}
            onChange={v => setForm(p => ({ ...p, class_id: v, subject_id:'' }))} placeholder="Select class…" />
          <SearchableSelect label="Subject *"
            options={filteredSubjectOpts} value={form.subject_id}
            onChange={v => setForm(p => ({ ...p, subject_id: v }))} placeholder="Select subject…" />
          {filteredSubjectOpts.length === 0 && form.class_id && (
            <Alert type="warning">No subjects found for this class in the selected term. Add subjects first under Curriculum → Subjects.</Alert>
          )}
        </div>
      </Modal>

      {/* Bulk Allocation Modal */}
      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Allocate Teacher" width={640}
        footer={<div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setBulkModal(false)}>Cancel</Button>
          <Button className="flex-1" loading={savingBulk} onClick={handleBulkSave}>
            Save {bulkSlots.length > 0 ? `(${bulkSlots.length} slots)` : ''}
          </Button>
        </div>}>
        <div className="space-y-4">
          <SearchableSelect label="Teacher *" options={teacherOpts} value={bulkTeacher}
            onChange={v => setBulkTeacher(v)} placeholder="Select teacher to allocate…" />
          <Alert type="info">Tick the class–subject combinations to assign to this teacher.</Alert>
          <div className="max-h-80 overflow-y-auto space-y-3">
            {Object.entries(classSubjMap).map(([cid, { class_name, subjects }]) => (
              <div key={cid}>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{class_name}</p>
                <div className="space-y-1">
                  {subjects.map(s => {
                    const key = `${cid}_${s.id}`
                    const checked = !!bulkSlots.find(sl => `${sl.class_id}_${sl.subject_id}` === key)
                    // Show existing allocation owner if any
                    const existing = allocs.find(a => String(a.class_id)===cid && String(a.subject_id)===String(s.id))
                    return (
                      <label key={s.id}
                        className={clsx(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all',
                          checked ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
                        )}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSlot(parseInt(cid), s.id, `${class_name} — ${s.name}`)}
                          className="w-4 h-4 accent-blue-600 rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                          {existing && (
                            <p className="text-xs text-amber-600">Currently: {existing.teacher_full_name} (will be replaced)</p>
                          )}
                        </div>
                        {checked && <CheckCircle2 size={14} className="text-blue-500 shrink-0" />}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
            {Object.keys(classSubjMap).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">
                No subjects found for the selected term. Add subjects under Curriculum → Subjects first.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Teacher Load Tab ────────────────────────────────────────
function LoadTab() {
  const { token, schoolId } = useAuthStore()
  const { termOptions, currentTerm } = useDataStore()
  const [selTerm, setSelTerm] = useState('')
  const [load,    setLoad]    = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { const t = currentTerm(); if (t) setSelTerm(String(t.id)) }, [])

  const fetchLoad = useCallback(async () => {
    if (!selTerm) return
    setLoading(true)
    try {
      const data = await teacherApi.load(schoolId, { term_id: selTerm }, token)
      setLoad(Array.isArray(data) ? data : [])
    } catch { setLoad([]) }
    finally { setLoading(false) }
  }, [schoolId, token, selTerm])

  useEffect(() => { fetchLoad() }, [fetchLoad])

  const termOpts = termOptions()

  return (
    <div className="space-y-4">
      <div className="w-52">
        <SearchableSelect label="Term" options={termOpts} value={selTerm}
          onChange={v => setSelTerm(v)} placeholder="Select term…" />
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {load.length > 0 && !loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Teachers Allocated" value={load.length} color="#2563EB" />
            <StatCard label="Total Slots" value={load.reduce((s,t)=>s+t.total_slots,0)} color="#059669" />
            <StatCard label="Avg Slots/Teacher" value={load.length ? (load.reduce((s,t)=>s+t.total_slots,0)/load.length).toFixed(1) : '—'} color="#7C3AED" />
          </div>

          <Card noPad>
            <table className="w-full">
              <thead>
                <tr>{['Teacher','Classes','Subjects','Total Slots','Subjects Teaching'].map(h =>
                  <th key={h} className="table-head-cell">{h}</th>)}</tr>
              </thead>
              <tbody>
                {load.sort((a,b) => b.total_slots - a.total_slots).map((t,i) => (
                  <tr key={t.user_id||i} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-0">
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900 text-sm">{t.teacher_full_name}</p>
                      <p className="text-xs text-slate-400">{t.email}</p>
                    </td>
                    <td className="table-cell text-center">
                      <span className="font-bold text-slate-700">{t.classes_count}</span>
                    </td>
                    <td className="table-cell text-center">
                      <span className="font-bold text-slate-700">{t.subjects_count}</span>
                    </td>
                    <td className="table-cell text-center">
                      <span className={clsx('font-bold text-lg',
                        t.total_slots >= 8 ? 'text-red-500' : t.total_slots >= 5 ? 'text-amber-600' : 'text-emerald-600')}>
                        {t.total_slots}
                      </span>
                    </td>
                    <td className="table-cell">
                      <p className="text-xs text-slate-500 leading-relaxed">{t.subjects || '—'}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {!loading && load.length === 0 && selTerm && (
        <Card><EmptyState icon={Users} title="No allocations found for this term" /></Card>
      )}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────
export default function TeacherAllocations() {
  const [tab, setTab] = useState('allocations')
  const COMP = { allocations: AllocationsTab, load: LoadTab }
  const Comp = COMP[tab]
  return (
    <div className="page space-y-5">
      <SectionHeader
        title="Teacher Allocations"
        sub="Assign teachers to subjects and classes per term. Required before lessons can be recorded."
        breadcrumb="Teachers"
      />
      <Card className="!p-3"><Tabs tabs={TABS} active={tab} onChange={setTab} /></Card>
      <Comp />
    </div>
  )
}
