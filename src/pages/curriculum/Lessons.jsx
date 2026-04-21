import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { curriculumApi } from '../../services/api'
import {
  Card, Button, Badge, Modal, Input, SearchableSelect,
  SectionHeader, Spinner, EmptyState, Alert, Table, Tabs, FormGrid
} from '../../components/ui'
import {
  ClipboardList, Plus, Eye, Paperclip, CheckCircle2,
  Upload, Download, Trash2
} from 'lucide-react'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const STATUS_MAP = {
  draft:           { v:'default',  label:'Draft' },
  marks_submitted: { v:'pending',  label:'Marks Submitted' },
  pending_review:  { v:'pending',  label:'Pending Review' },
  approved:        { v:'approved', label:'Approved' },
  repeat_required: { v:'absent',   label:'Repeat Required' },
}

function WorkflowCheck({ flag, label }) {
  return (
    <div className={clsx('flex items-center gap-2 text-xs', flag ? 'text-emerald-600' : 'text-slate-400')}>
      <span className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
        flag ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400')}>
        {flag ? '✓' : '○'}
      </span>
      {label}
    </div>
  )
}

export default function LessonsPage() {
  const { token, schoolId } = useAuthStore()
  const { classOptions, termOptions, studentOptions, currentTerm } = useDataStore()

  const [selClass,  setSelClass]  = useState('')
  const [selTerm,   setSelTerm]   = useState('')
  const [lessons,   setLessons]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [tabStatus, setTabStatus] = useState('all')
  const [subjects,  setSubjects]  = useState([])
  const [topics,    setTopics]    = useState([])

  const [createModal, setCreateModal] = useState(false)
  const [form, setForm] = useState({
    class_id:'', subject_id:'', topic_id:'', subtopic_names:'',
    lesson_date: format(new Date(), 'yyyy-MM-dd'),
    period_no:'1', start_time:'08:00', end_time:'08:40', lesson_type:'normal',
  })
  const [saving, setSaving] = useState(false)

  const [detail,        setDetail]        = useState(null)
  const [detailTab,     setDetailTab]     = useState('marks')
  const [marks,         setMarks]         = useState([])
  const [attachments,   setAttachments]   = useState([])
  const [caseStudy,     setCaseStudy]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [markEntries, setMarkEntries] = useState({})
  const [maxMarks,    setMaxMarks]    = useState(10)
  const [savingMarks, setSavingMarks] = useState(false)
  const [uploading,   setUploading]   = useState(false)

  const [assessModal,  setAssessModal]  = useState(false)
  const [assess,       setAssess]       = useState({ strengths:'', weaknesses:'', recommendations:'', student_engagement:'', objectives_met:false, follow_up_required:false })
  const [savingAssess, setSavingAssess] = useState(false)

  useEffect(() => { const t = currentTerm(); if (t) setSelTerm(String(t.id)) }, [])

  const loadSubjects = async (classId, termId) => {
    if (!classId || !termId) { setSubjects([]); return }
    try {
      const d = await curriculumApi.subjects(schoolId, { class_id: classId, term_id: termId }, token)
      setSubjects(Array.isArray(d) ? d : [])
    } catch { setSubjects([]) }
  }

  const loadLessons = useCallback(async () => {
    setLoading(true)
    try {
      const p = {}
      if (selClass) p.class_id = selClass
      if (selTerm)  p.term_id  = selTerm
      if (tabStatus !== 'all') p.status = tabStatus
      const d = await curriculumApi.lessons(schoolId, p, token)
      setLessons(Array.isArray(d) ? d : [])
    } catch { setLessons([]) }
    finally { setLoading(false) }
  }, [schoolId, token, selClass, selTerm, tabStatus])

  useEffect(() => { loadLessons() }, [loadLessons])

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubjectChange = async (v) => {
    setForm(p => ({ ...p, subject_id: v, topic_id:'' }))
    setTopics([])
    if (!v) return
    try {
      const d = await curriculumApi.topics(schoolId, v, token)
      setTopics(Array.isArray(d) ? d : [])
    } catch { setTopics([]) }
  }

  const openCreate = async () => {
    setForm({ class_id: selClass||'', subject_id:'', topic_id:'', subtopic_names:'',
      lesson_date: format(new Date(), 'yyyy-MM-dd'),
      period_no:'1', start_time:'08:00', end_time:'08:40', lesson_type:'normal' })
    setTopics([])
    if (selClass && selTerm) await loadSubjects(selClass, selTerm)
    setCreateModal(true)
  }

  const handleCreate = async () => {
    if (!form.class_id)   return toast.error('Class is required')
    if (!form.subject_id) return toast.error('Subject is required')
    if (!selTerm)         return toast.error('Select a term first')
    setSaving(true)
    try {
      const subtopicNames = form.subtopic_names
        ? form.subtopic_names.split(',').map(s => s.trim()).filter(Boolean)
        : []
      await curriculumApi.createLesson(schoolId, {
        term_id:       parseInt(selTerm),
        class_id:      parseInt(form.class_id),
        subject_id:    parseInt(form.subject_id),
        topic_id:      form.topic_id ? parseInt(form.topic_id) : undefined,
        lesson_date:   form.lesson_date,
        period_no:     parseInt(form.period_no),
        start_time:    form.start_time,
        end_time:      form.end_time,
        lesson_type:   form.lesson_type || 'normal',
        subtopic_names: subtopicNames,    // fixed: was bare `subtopic_names` (undeclared)
        subtopic_id:   form.subtopic_id ? parseInt(form.subtopic_id) : undefined,
      }, token)
      toast.success('Lesson created')
      setCreateModal(false)
      loadLessons()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const openDetail = async (lesson) => {
    setDetail(lesson); setDetailTab('marks')
    setMarks([]); setAttachments([]); setCaseStudy(null); setMarkEntries({})
    setDetailLoading(true)
    try {
      const [m, a, cs] = await Promise.all([
        curriculumApi.getMarks(schoolId, lesson.id, token).catch(() => []),
        curriculumApi.listCaseStudyFiles(schoolId, lesson.id, token).catch(() => []),
        curriculumApi.getCaseStudyStudent(schoolId, lesson.id, token).catch(() => null),
      ])
      setMarks(Array.isArray(m) ? m : [])
      setAttachments(Array.isArray(a) ? a : [])
      setCaseStudy(cs)
    } catch {} finally { setDetailLoading(false) }
  }

  const handleSaveMarks = async () => {
    const studOpts = studentOptions(detail?.class_id || selClass)
    const records = studOpts
      .filter(s => markEntries[s.value]?.marks_scored !== undefined && markEntries[s.value]?.marks_scored !== '')
      .map(s => ({ student_id: parseInt(s.value), marks_scored: parseFloat(markEntries[s.value].marks_scored), max_marks: parseFloat(maxMarks) }))
    if (!records.length) return toast.error('Enter at least one mark')
    setSavingMarks(true)
    try {
      const result = await curriculumApi.submitMarks(schoolId, detail.id, { marks: records, max_marks: parseFloat(maxMarks) }, token)
      const msg = result?.case_study_student
        ? `Marks saved ✓  Case study: ${result.case_study_student.first_name} ${result.case_study_student.last_name}`
        : 'Marks saved ✓'
      toast.success(msg)
      // Reload all three independently so one failure doesn't block the others
      const [m, cs, updated] = await Promise.all([
        curriculumApi.getMarks(schoolId, detail.id, token).catch(() => []),
        curriculumApi.getCaseStudyStudent(schoolId, detail.id, token).catch(() => null),
        curriculumApi.getLesson(schoolId, detail.id, token).catch(() => detail),
      ])
      setMarks(Array.isArray(m) ? m : [])
      setCaseStudy(cs)
      setDetail(updated || detail)
      setMarkEntries({})
      loadLessons()
    } catch (e) { toast.error(e.message) }
    finally { setSavingMarks(false) }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !detail) return
    if (!detail.marks_submitted) {
      toast.error('Submit student marks first — the system selects the case study student automatically')
      e.target.value = ''; return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await curriculumApi.uploadCaseStudyFile(schoolId, detail.id, formData, token)
      toast.success(`${file.name} uploaded ✓`)
      const [a, updated] = await Promise.all([
        curriculumApi.listCaseStudyFiles(schoolId, detail.id, token).catch(() => []),
        curriculumApi.getLesson(schoolId, detail.id, token).catch(() => detail),
      ])
      setAttachments(Array.isArray(a) ? a : [])
      setDetail(updated || detail)
    } catch (err) { toast.error(`Upload failed: ${err.message}`) }
    finally { setUploading(false); e.target.value = '' }
  }

  const handleDeleteFile = async (attId) => {
    if (!confirm('Remove this file from R2?')) return
    try { await curriculumApi.deleteCaseStudyFile(schoolId, attId, token); setAttachments(p => p.filter(a => a.id !== attId)) }
    catch (e) { toast.error(e.message) }
  }

  const handleSaveAssessment = async () => {
    if (!assess.strengths || !assess.weaknesses || !assess.recommendations)
      return toast.error('Strengths, weaknesses and recommendations are required')
    setSavingAssess(true)
    try {
      await curriculumApi.submitTeacherAssessment(schoolId, detail.id, assess, token)
      toast.success('Assessment submitted')
      setAssessModal(false)
      const updated = await curriculumApi.getLesson(schoolId, detail.id, token)
      setDetail(updated); loadLessons()
    } catch (e) { toast.error(e.message) }
    finally { setSavingAssess(false) }
  }

  const handleApprove = async () => {
    try {
      await curriculumApi.approveLesson(schoolId, detail.id, {}, token)
      toast.success('Lesson approved ✓')
      loadLessons(); setDetail(null)
    } catch (e) { toast.error(e.message) }
  }

  const classOpts = classOptions()
  const termOpts  = termOptions()
  const subjOpts  = subjects.map(s => ({ value: s.id, label: s.name }))
  const topicOpts = topics.map(t => ({ value: t.id, label: t.name }))
  const studOpts  = studentOptions(detail?.class_id || selClass)

  const STATUS_TABS = [
    { key:'all', label:'All' }, { key:'draft', label:'Draft' },
    { key:'marks_submitted', label:'Marks Done' }, { key:'pending_review', label:'Pending Review' },
    { key:'approved', label:'Approved' }, { key:'repeat_required', label:'Repeat' },
  ]
  const DETAIL_TABS = [
    { key:'marks', label:'Student Marks' },
    { key:'attachments', label:'Student Work (R2)' },
    { key:'assessment', label:'Teacher Assessment' },
  ]

  const columns = [
    { key:'lesson_date', label:'Date',
      render: v => <span className="font-mono text-xs">{v ? format(new Date(v+'T00:00:00'),'EEE, d MMM yyyy') : '—'}</span> },
    { key:'subject_name', label:'Subject / Topic',
      render: (v,row) => <div><p className="text-sm font-semibold text-slate-900">{v||'—'}</p>{row.topic_name&&<p className="text-xs text-slate-400">{row.topic_name}</p>}</div> },
    { key:'class_name', label:'Class' },
    { key:'teacher_full_name', label:'Teacher', render: v => <span className="text-sm text-slate-600">{v||'—'}</span> },
    { key:'period_no', label:'Period', render: (v,row) => <span className="text-xs text-slate-500">P{v} · {row.start_time}–{row.end_time}</span> },
    { key:'status', label:'Status', render: v => <Badge variant={STATUS_MAP[v]?.v||'default'}>{STATUS_MAP[v]?.label||v||'draft'}</Badge> },
    { key:'average_percent', label:'Avg',
      render: v => v!=null ? <span className={clsx('font-bold text-xs', v>=70?'text-emerald-600':v>=50?'text-amber-600':'text-red-500')}>{v.toFixed(1)}%</span> : <span className="text-slate-300">—</span> },
    { key:'id', label:'', render: (_,row) => <Button size="xs" variant="secondary" icon={Eye} onClick={() => openDetail(row)}>View</Button> },
  ]

  return (
    <div className="page space-y-5">
      <SectionHeader title="Lessons" sub="Record lessons taught, enter marks, upload case study work via R2"
        breadcrumb="Curriculum" actions={<Button icon={Plus} onClick={openCreate}>Record Lesson</Button>} />

      <Alert type="info">A <strong>teacher must be allocated</strong> to the class/subject/term before creating a lesson. The teacher is auto-resolved — you don't pick them here.</Alert>

      <Card className="flex gap-3 flex-wrap items-end">
        <div className="w-52">
          <SearchableSelect label="Class" options={[{value:'',label:'All classes'},...classOpts]}
            value={selClass} onChange={v=>{setSelClass(v);loadSubjects(v,selTerm)}} placeholder="All classes…" />
        </div>
        <div className="w-44">
          <SearchableSelect label="Term" options={[{value:'',label:'All terms'},...termOpts]}
            value={selTerm} onChange={v=>{setSelTerm(v);loadSubjects(selClass,v)}} placeholder="All terms…" />
        </div>
      </Card>

      <Tabs tabs={STATUS_TABS} active={tabStatus} onChange={setTabStatus} />

      <Card noPad>
        <Table columns={columns} data={lessons} loading={loading}
          emptyState={<EmptyState icon={ClipboardList} title="No lessons yet"
            subtitle="Record a lesson after teaching to track curriculum coverage"
            action={<Button icon={Plus} onClick={openCreate}>Record Lesson</Button>} />} />
      </Card>

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Record a Lesson" width={620}
        footer={<div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setCreateModal(false)}>Cancel</Button><Button className="flex-1" loading={saving} onClick={handleCreate}>Save Lesson</Button></div>}>
        <div className="space-y-4">
          <Alert type="info">Topic must already exist. Teacher is auto-resolved from allocations.</Alert>
          <FormGrid cols={2}>
            <SearchableSelect label="Class *" options={classOpts} value={form.class_id}
              onChange={async v=>{setForm(p=>({...p,class_id:v,subject_id:'',topic_id:''}));await loadSubjects(v,selTerm)}} placeholder="Select class…" />
            <Input label="Date *" type="date" value={form.lesson_date} onChange={f('lesson_date')} />
          </FormGrid>
          <SearchableSelect label="Subject *" options={subjOpts} value={form.subject_id}
            onChange={handleSubjectChange} placeholder="Select subject…" />
          {topics.length > 0 ? (
            <SearchableSelect label="Topic *" options={topicOpts} value={form.topic_id}
              onChange={v=>setForm(p=>({...p,topic_id:v}))} placeholder="Select topic…" />
          ) : form.subject_id ? (
            <Alert type="warning">No topics for this subject. Add topics in Subjects &amp; Topics first.</Alert>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <label className="label">Subtopics covered (comma-separated, auto-created)</label>
            <input value={form.subtopic_names} onChange={f('subtopic_names')} className="input-base text-sm"
              placeholder="e.g. Adding fractions, Subtracting fractions" />
          </div>
          <FormGrid cols={3}>
            <Input label="Period No. *" type="number" min={1} value={form.period_no} onChange={f('period_no')} />
            <Input label="Start Time *" type="time" value={form.start_time} onChange={f('start_time')} />
            <Input label="End Time *"   type="time" value={form.end_time}   onChange={f('end_time')} />
          </FormGrid>
          <div className="flex flex-col gap-1.5">
            <label className="label">Lesson Type</label>
            <select value={form.lesson_type} onChange={f('lesson_type')} className="input-base">
              <option value="normal">Normal</option>
              <option value="extra">Extra Lesson</option>
              <option value="configurable">Configurable</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)}
        title={`${detail?.subject_name||'Lesson'} — ${detail?.class_name||''} · ${detail?.lesson_date||''}`}
        width={780}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {detail?.status !== 'approved' && (
                <Button icon={CheckCircle2} onClick={handleApprove}>Approve Lesson</Button>
              )}
              {detail?.marks_submitted===1 && !detail?.teacher_assessment_submitted && (
                <Button variant="secondary"
                  onClick={() => { setAssess({strengths:'',weaknesses:'',recommendations:'',student_engagement:'',objectives_met:false,follow_up_required:false}); setAssessModal(true) }}>
                  Post Assessment
                </Button>
              )}
            </div>
            <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
          </div>
        }>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              {[
                { l:'Date',    v: detail.lesson_date ? format(new Date(detail.lesson_date+'T00:00:00'),'EEE, d MMM yyyy') : '—' },
                { l:'Period',  v: `P${detail.period_no} · ${detail.start_time}–${detail.end_time}` },
                { l:'Teacher', v: detail.teacher_full_name||'—' },
                { l:'Avg',     v: detail.average_percent!=null ? `${detail.average_percent.toFixed(1)}%` : '—' },
              ].map(x => (
                <div key={x.l}>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{x.l}</p>
                  <p className="text-sm font-semibold text-slate-800">{x.v}</p>
                </div>
              ))}
            </div>

            {/* Workflow checklist */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <WorkflowCheck flag={detail.lesson_plan_submitted}        label="Lesson plan" />
              <WorkflowCheck flag={detail.lesson_plan_uploaded}         label="Plan file" />
              <WorkflowCheck flag={detail.marks_submitted}              label="Marks" />
              <WorkflowCheck flag={detail.case_study_uploaded}          label="Case study book" />
              <WorkflowCheck flag={detail.teacher_assessment_submitted} label="Teacher assessment" />
              <WorkflowCheck flag={detail.admin_analysis_submitted}     label="Admin analysis" />
            </div>

            {detail.status === 'repeat_required' && (
              <Alert type="error">{detail.repeat_reason||'Flagged for repeat.'}{detail.areas_to_improve && ` Areas: ${detail.areas_to_improve}`}</Alert>
            )}

            {detailLoading ? <div className="flex justify-center py-6"><Spinner /></div> : (
              <>
                <Tabs tabs={DETAIL_TABS} active={detailTab} onChange={setDetailTab} />

                {detailTab === 'marks' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="label text-xs">Max Marks:</label>
                      <input type="number" value={maxMarks} onChange={e=>setMaxMarks(e.target.value)}
                        className="input-base !py-1 w-20 text-center text-sm" min={1} />
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {studOpts.map(s => {
                        const saved = marks.find(m => String(m.student_id)===String(s.value))
                        const isCaseStudy = caseStudy?.student_id === (s.value)
                        return (
                          <div key={s.value}
                            className={clsx('grid items-center gap-2 px-3 py-2 rounded-xl border',
                              isCaseStudy ? 'border-blue-300 bg-blue-50' : 'border-slate-100 bg-slate-50')}
                            style={{ gridTemplateColumns:'1fr 90px' }}>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{s.label}
                                {isCaseStudy && <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 rounded">CASE STUDY</span>}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">{s.sub}</p>
                            </div>
                            <input type="number" min={0} max={9999}
                              value={markEntries[s.value]?.marks_scored ?? (saved?.marks_scored ?? '')}
                              onChange={e => setMarkEntries(p=>({...p,[s.value]:{marks_scored:e.target.value}}))}
                              placeholder={saved?.marks_scored ?? '—'} className="input-base !py-1 !text-sm text-center" />
                          </div>
                        )
                      })}
                    </div>
                    <Button loading={savingMarks} onClick={handleSaveMarks} size="sm" icon={CheckCircle2}>
                      Save Marks {Object.keys(markEntries).length > 0 ? `(${Object.keys(markEntries).length} edited)` : ''}
                    </Button>
                    {marks.length > 0 && (
                      <table className="w-full text-sm mt-2">
                        <thead><tr>{['Student','Score','Max','%'].map(h=><th key={h} className="table-head-cell">{h}</th>)}</tr></thead>
                        <tbody>
                          {marks.sort((a,b)=>b.percentage-a.percentage).map(m => (
                            <tr key={m.id} className="hover:bg-blue-50/30 border-b border-slate-50">
                              <td className="table-cell">{m.first_name} {m.last_name}</td>
                              <td className="table-cell text-center font-mono font-bold">{m.marks_scored}</td>
                              <td className="table-cell text-center text-slate-400">{m.max_marks}</td>
                              <td className="table-cell text-center">
                                <span className={clsx('font-bold text-xs', m.percentage>=70?'text-emerald-600':m.percentage>=50?'text-amber-600':'text-red-500')}>
                                  {Number(m.percentage).toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {caseStudy && (
                      <div className="p-3 rounded-xl border border-blue-200 bg-blue-50">
                        <p className="text-xs font-bold text-blue-600 mb-1">AUTO-SELECTED CASE STUDY STUDENT</p>
                        <p className="text-sm font-semibold text-blue-900">
                          {caseStudy.first_name} {caseStudy.last_name} — {caseStudy.marks_scored}/{caseStudy.max_marks} ({Number(caseStudy.percentage).toFixed(1)}%)
                        </p>
                        <p className="text-xs text-blue-600 mt-0.5">Upload their exercise book in the Student Work tab.</p>
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'attachments' && (
                  <div className="space-y-3">
                    {!detail.marks_submitted ? (
                      <Alert type="warning">Submit marks first. The system auto-selects the case study student, then you upload their book here.</Alert>
                    ) : (
                      <div className="flex items-center gap-3">
                        <label className={clsx('flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm font-medium',
                          uploading ? 'border-blue-300 bg-blue-50 text-blue-500' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-slate-600')}>
                          {uploading ? <Spinner size={16} /> : <Upload size={15} />}
                          {uploading ? 'Uploading to R2…' : 'Upload Case Study Book'}
                          <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading}
                            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif" />
                        </label>
                        <p className="text-xs text-slate-400">PDF or image · Goes to Cloudflare R2</p>
                      </div>
                    )}
                    {attachments.length === 0
                      ? <EmptyState icon={Paperclip} title="No files yet"
                          subtitle={detail.marks_submitted ? "Upload the case study student's exercise book" : "Submit marks first"} />
                      : attachments.map(a => (
                          <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <Paperclip size={14} className="text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{a.file_name}</p>
                              <p className="text-xs text-slate-400">
                                {a.student_full_name && `${a.student_full_name} · `}
                                {a.file_size ? `${(a.file_size/1024).toFixed(0)} KB` : ''}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {a.file_url && <a href={a.file_url} target="_blank" rel="noopener noreferrer"><Button size="xs" variant="ghost" icon={Download} /></a>}
                              <Button size="xs" variant="ghost" icon={Trash2} className="!text-red-400 hover:!bg-red-50" onClick={() => handleDeleteFile(a.id)} />
                            </div>
                          </div>
                        ))
                    }
                  </div>
                )}

                {detailTab === 'assessment' && (
                  <div className="space-y-3">
                    {!detail.marks_submitted ? (
                      <Alert type="warning">Submit marks first before posting the teacher assessment.</Alert>
                    ) : detail.teacher_assessment_submitted ? (
                      <Alert type="success">Teacher assessment already submitted ✓</Alert>
                    ) : (
                      <>
                        <Alert type="info">Post your reflection: strengths, weaknesses, recommendations.</Alert>
                        <Button onClick={() => { setAssess({strengths:'',weaknesses:'',recommendations:'',student_engagement:'',objectives_met:false,follow_up_required:false}); setAssessModal(true) }}>
                          Submit Teacher Assessment
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Teacher Assessment Modal */}
      <Modal open={assessModal} onClose={() => setAssessModal(false)} title="Teacher Lesson Assessment" width={560}
        footer={<div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setAssessModal(false)}>Cancel</Button><Button className="flex-1" loading={savingAssess} onClick={handleSaveAssessment}>Submit</Button></div>}>
        <div className="space-y-3">
          {[
            { k:'strengths',       l:'Strengths *',       ph:'What went well?' },
            { k:'weaknesses',      l:'Weaknesses *',      ph:'What challenges arose?' },
            { k:'recommendations', l:'Recommendations *', ph:'How will you improve? Any follow-up?' },
            { k:'student_engagement', l:'Student Engagement', ph:'How did students participate?' },
          ].map(x => (
            <div key={x.k} className="flex flex-col gap-1.5">
              <label className="label">{x.l}</label>
              <textarea value={assess[x.k]||''} onChange={e=>setAssess(p=>({...p,[x.k]:e.target.value}))}
                rows={2} className="input-base resize-y" placeholder={x.ph} />
            </div>
          ))}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={assess.objectives_met} onChange={e=>setAssess(p=>({...p,objectives_met:e.target.checked}))} className="accent-blue-600" />
              Objectives met
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={assess.follow_up_required} onChange={e=>setAssess(p=>({...p,follow_up_required:e.target.checked}))} className="accent-blue-600" />
              Follow-up lesson needed
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
