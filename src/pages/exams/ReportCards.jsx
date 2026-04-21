import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { examApi } from '../../services/api'
import { curriculumApi } from '../../services/api'
import {
  Card, Button, Badge, Table, Modal, SearchableSelect,
  SectionHeader, Spinner, EmptyState, Alert, StatCard, Divider, Avatar
} from '../../components/ui'
import { ArrowLeft, FileText, RefreshCw, Download, Edit2, Send, Eye, AlertTriangle, Check, BookOpen } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import { printReportCard, printClassReportCards, printClassMarksheet } from '../../lib/examPdf'

const GRADE_COLORS = {
  D1:'#059669',D2:'#10B981',C3:'#1D4ED8',C4:'#3B82F6',
  C5:'#60A5FA',C6:'#93C5FD',P7:'#D97706',P8:'#F59E0B',F9:'#DC2626',NG:'#94A3B8'
}
const AGG_CLR = (a) => {
  if (a==null) return '#64748B'
  if (a<=8)  return '#059669'
  if (a<=14) return '#1D4ED8'
  if (a<=20) return '#7C3AED'
  if (a<=28) return '#D97706'
  return '#DC2626'
}

export default function ReportCards() {
  const { examId }    = useParams()
  const { token, schoolId, school } = useAuthStore()
  const { classes }   = useDataStore()
  const navigate      = useNavigate()

  const [examName,    setExamName]    = useState('')
  const [examStatus,  setExamStatus]  = useState('')
  const [selClass,    setSelClass]    = useState('')
  const [cards,       setCards]       = useState(null)   // null = not loaded yet
  const [loading,     setLoading]     = useState(false)
  const [computing,   setComputing]   = useState(false)
  const [publishing,  setPublishing]  = useState(false)

  // Comment edit
  const [commentModal, setCommentModal] = useState(null)
  const [ctComment,    setCtComment]    = useState('')
  const [htComment,    setHtComment]    = useState('')
  const [savingComment,setSavingComment]= useState(false)

  // Preview
  const [previewCard,  setPreviewCard]  = useState(null)
  const [cardLoading,  setCardLoading]  = useState(false)

  // Subjects for marksheet
  const [examSubjects, setExamSubjects] = useState([])

  const classOpts = classes.map(c => ({ value: c.id, label: c.name }))

  const loadCards = useCallback(async (classId) => {
    if (!classId || !examId) return
    setLoading(true)
    setCards(null)
    try {
      const [cardData, examData, subjects] = await Promise.all([
        examApi.reportCards(schoolId, examId, classId, token),
        examApi.getExam(schoolId, examId, token).catch(() => null),
        examApi.examSubjects(schoolId, examId, classId, token).catch(() => []),
      ])
      setCards(Array.isArray(cardData) ? cardData : [])
      if (examData?.name)   setExamName(examData.name)
      if (examData?.status) setExamStatus(examData.status)
      setExamSubjects(Array.isArray(subjects) ? subjects : [])
    } catch (e) { toast.error(e.message); setCards([]) }
    finally { setLoading(false) }
  }, [schoolId, examId, token])

  // ── Compute ──────────────────────────────────────────────
  const handleCompute = async () => {
    if (!selClass) return toast.error('Select a class first')
    setComputing(true)
    try {
      const result = await examApi.compute(schoolId, examId, selClass, token)
      toast.success(`✓ Computed ${result.computed} report cards — ${result.total_in_class} students ranked`)
      loadCards(selClass)
    } catch (e) { toast.error(e.message) }
    finally { setComputing(false) }
  }

  // ── Publish ───────────────────────────────────────────────
  const handlePublish = async () => {
    if (!selClass) return toast.error('Select a class first')
    if (!confirm('Publish results for this class?')) return
    setPublishing(true)
    try {
      await examApi.publish(schoolId, examId, selClass, token)
      toast.success('Results published')
      loadCards(selClass)
    } catch (e) { toast.error(e.message) }
    finally { setPublishing(false) }
  }

  // ── Comments ──────────────────────────────────────────────
  const openComment = (card) => {
    setCommentModal(card)
    setCtComment(card.class_teacher_comment || '')
    setHtComment(card.head_teacher_comment  || '')
  }
  const saveComments = async () => {
    setSavingComment(true)
    try {
      await examApi.updateComments(schoolId, examId, commentModal.student_id,
        { class_teacher_comment: ctComment, head_teacher_comment: htComment }, token)
      toast.success('Comments saved')
      setCommentModal(null)
      loadCards(selClass)
    } catch (e) { toast.error(e.message) }
    finally { setSavingComment(false) }
  }

  // ── Preview ───────────────────────────────────────────────
  const openPreview = async (card) => {
    setPreviewCard('loading')
    setCardLoading(true)
    try {
      const [full, currProfile] = await Promise.all([
        examApi.studentCard(schoolId, examId, card.student_id, token),
        // Load curriculum academic profile for the same term
        examName
          ? curriculumApi.studentAcademicProfile(schoolId, card.student_id, {}, token).catch(() => null)
          : Promise.resolve(null),
      ])
      setPreviewCard({ ...full, _curriculum: currProfile })
    } catch (e) { toast.error(e.message); setPreviewCard(null) }
    finally { setCardLoading(false) }
  }

  // ── Print helpers ─────────────────────────────────────────
  const printOne = async (card) => {
    try {
      const [full, curriculum] = await Promise.all([
        examApi.studentCard(schoolId, examId, card.student_id, token),
        curriculumApi.studentAcademicProfile(schoolId, card.student_id, {}, token).catch(() => null),
      ])
      await printReportCard({ ...full, _curriculum: curriculum }, school?.name, school?.logo_url || null, null)
    } catch (e) { toast.error(e.message) }
  }

  const printAll = async () => {
    if (!cards?.length) return
    toast.loading('Generating PDFs…', { id: 'pdf' })
    try {
      const full = []
      for (const c of cards) {
        const [fc, curriculum] = await Promise.all([
          examApi.studentCard(schoolId, examId, c.student_id, token).catch(() => c),
          curriculumApi.studentAcademicProfile(schoolId, c.student_id, {}, token).catch(() => null),
        ])
        full.push({ ...fc, _curriculum: curriculum })
      }
      const cls = classes.find(c => String(c.id) === String(selClass))
      await printClassReportCards(full, examName, cls?.name || 'Class', school?.name, school?.logo_url || null, {})
      toast.success(`${full.length} report cards downloaded`, { id: 'pdf' })
    } catch (e) { toast.error(e.message, { id: 'pdf' }) }
  }

  const printSheet = () => {
    if (!cards?.length) return
    const cls = classes.find(c => String(c.id) === String(selClass))
    // Enrich cards with marks from preview if available
    printClassMarksheet(cards, examName, cls?.name || 'Class', school?.name, examSubjects)
    toast.success('Marksheet downloaded')
  }

  const pubCount = cards?.filter(c => c.is_published).length ?? 0

  const columns = [
    {
      key: 'position_in_class', label: 'Pos.',
      render: v => v
        ? <span className={clsx('font-display font-bold text-base',
            v===1?'text-yellow-600':v===2?'text-slate-400':v===3?'text-amber-700':'text-slate-600')}>
            {v}{v===1?'st':v===2?'nd':v===3?'rd':'th'}
          </span>
        : <span className="text-slate-300">—</span>
    },
    {
      key: 'first_name', label: 'Student',
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={`${row.first_name||''} ${row.last_name||''}`} size="sm" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{row.first_name} {row.last_name}</p>
            <p className="text-xs text-slate-400 font-mono">{row.student_number}</p>
          </div>
        </div>
      )
    },
    {
      key: 'aggregate', label: 'Agg.', align: 'center',
      render: v => v != null
        ? <span className="font-display font-bold text-xl" style={{ color: AGG_CLR(v) }}>{v}</span>
        : <span className="text-slate-300 text-sm">—</span>
    },
    {
      key: 'division', label: 'Division', align: 'center',
      render: (v, row) => {
        const DIV_COLORS = { '1':'#059669','2':'#1D4ED8','3':'#7C3AED','4':'#D97706','U':'#DC2626' }
        const div = v || (row.aggregate == null ? null : 'U')
        if (!div) return <span className="text-slate-300 text-sm">—</span>
        const color = DIV_COLORS[div] || '#94A3B8'
        const label = div === 'U' ? 'U' : `Div ${div}`
        return (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg text-xs font-bold"
            style={{ background: color + '18', color }}>
            {label}
          </span>
        )
      }
    },
    { key: 'subjects_sat', label: 'Subjs', align: 'center' },
    {
      key: 'is_published', label: 'Published', align: 'center',
      render: v => <Badge variant={v ? 'approved' : 'default'}>{v ? 'Yes' : 'No'}</Badge>
    },
    {
      key: 'student_id', label: '',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button size="xs" variant="ghost" icon={Eye}      onClick={() => openPreview(row)} title="Preview" />
          <Button size="xs" variant="ghost" icon={Edit2}    onClick={() => openComment(row)}  title="Edit comments" />
          <Button size="xs" variant="ghost" icon={Download} onClick={() => printOne(row)}     title="Download PDF" />
        </div>
      )
    },
  ]

  return (
    <div className="page space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate(`/exams/${examId}`)} />
        <div>
          <h1 className="font-display font-bold text-xl text-slate-900">Report Cards</h1>
          <p className="text-sm text-slate-500">{examName || `Exam #${examId}`}{examStatus ? ` · ${examStatus}` : ''}</p>
        </div>
      </div>

      {/* Class selector + action bar */}
      <Card className="flex flex-wrap gap-3 items-end">
        <div className="w-60">
          <SearchableSelect label="Select Class"
            options={classOpts} value={selClass}
            onChange={v => { setSelClass(v); loadCards(v) }}
            placeholder="Choose a class…" />
        </div>

        {/* COMPUTE — the key step users miss */}
        <Button icon={RefreshCw} loading={computing} onClick={handleCompute}
          disabled={!selClass} className="self-end"
          variant={cards === null || cards?.length === 0 ? 'primary' : 'secondary'}>
          Compute &amp; Rank
        </Button>

        {cards?.length > 0 && (
          <>
            <Button variant="secondary" icon={Send}     loading={publishing} onClick={handlePublish} className="self-end">Publish</Button>
            <Button variant="secondary" icon={FileText} onClick={printSheet}  className="self-end">Marksheet PDF</Button>
            <Button variant="secondary" icon={Download} onClick={printAll}    className="self-end">All Report Cards</Button>
          </>
        )}
      </Card>

      {/* Guidance banner — shown before compute */}
      {selClass && cards !== null && cards.length === 0 && !loading && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">No report cards yet for this class</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Report cards are generated on demand. Click <strong>Compute &amp; Rank</strong> above to:
              <br />① Calculate each student's aggregate from their marks
              <br />② Rank students by aggregate (lower = better in Uganda PLE)
              <br />③ Auto-assign Class Teacher &amp; Head Teacher comments from your comment rules
            </p>
            <Button size="sm" icon={Check} loading={computing} onClick={handleCompute} className="mt-3">
              Compute & Rank Now
            </Button>
          </div>
        </div>
      )}

      {!selClass && (
        <Card>
          <EmptyState icon={FileText} title="Select a class to begin"
            subtitle="Choose an enrolled class from the dropdown to view or generate report cards" />
        </Card>
      )}

      {loading && <div className="p-12 flex justify-center"><Spinner /></div>}

      {/* Stats */}
      {cards?.length > 0 && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Students"    value={cards.length}                                             color="#2563EB" />
          <StatCard label="Published"   value={pubCount}                                                color="#059669" />
          <StatCard label="Best Agg."   value={Math.min(...cards.filter(c=>c.aggregate!=null).map(c=>c.aggregate)) || '—'} color="#7C3AED" />
          <StatCard label="Avg Agg."    value={(() => {
            const w = cards.filter(c=>c.aggregate!=null)
            return w.length ? (w.reduce((s,c)=>s+c.aggregate,0)/w.length).toFixed(1) : '—'
          })()} color="#D97706" />
        </div>
      )}

      {/* Table */}
      {cards?.length > 0 && !loading && (
        <Card noPad>
          <Table columns={columns} data={cards}
            emptyState={<EmptyState icon={FileText} title="No report cards" />} />
        </Card>
      )}

      {/* ── Edit Comments Modal ── */}
      <Modal open={!!commentModal} onClose={() => setCommentModal(null)}
        title={`Comments — ${commentModal?.first_name||''} ${commentModal?.last_name||''}`} width={580}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCommentModal(null)}>Cancel</Button>
            <Button className="flex-1" loading={savingComment} onClick={saveComments}>Save Comments</Button>
          </div>
        }>
        {commentModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-display font-bold text-3xl" style={{ color: AGG_CLR(commentModal.aggregate) }}>
                {commentModal.aggregate ?? '—'}
              </span>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Aggregate</p>
                <p className="text-xs text-slate-400">
                  Position {commentModal.position_in_class ?? '—'} of {commentModal.total_students_in_class ?? '—'}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label">Class Teacher Comment</label>
              <textarea value={ctComment} onChange={e => setCtComment(e.target.value)}
                rows={3} className="input-base resize-y" placeholder="Enter class teacher's comment…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label">Head Teacher Comment</label>
              <textarea value={htComment} onChange={e => setHtComment(e.target.value)}
                rows={3} className="input-base resize-y" placeholder="Enter head teacher's comment…" />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Preview Modal ── */}
      <Modal open={!!previewCard} onClose={() => setPreviewCard(null)}
        title="Report Card Preview" width={700}
        footer={
          previewCard && previewCard !== 'loading' && (
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setPreviewCard(null)}>Close</Button>
              <Button icon={Download} className="flex-1"
                onClick={() => printReportCard(previewCard, school?.name, school?.logo_url || null, null)}>
                Download PDF
              </Button>
            </div>
          )
        }>
        {previewCard === 'loading' || cardLoading
          ? <div className="py-12 flex justify-center"><Spinner /></div>
          : previewCard && <CardPreview card={previewCard} />
        }
      </Modal>
    </div>
  )
}

function CardPreview({ card }) {
  const agg = card.aggregate
  const div = card.division || (agg == null ? null : 'U')
  const DIV_COLORS = { '1':'#059669','2':'#1D4ED8','3':'#7C3AED','4':'#D97706','U':'#DC2626' }
  const ac  = DIV_COLORS[div] || '#64748B'

  if (card._not_computed) {
    return (
      <div className="p-6 text-center space-y-3">
        <AlertTriangle size={32} className="text-amber-500 mx-auto" />
        <p className="font-semibold text-slate-800">Report card not computed yet</p>
        <p className="text-sm text-slate-500">Click "Compute & Rank" first to generate this student's report card.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      {/* Student header */}
      <div className="p-4 bg-slate-800 rounded-xl flex items-center gap-4 text-white">
        <Avatar name={`${card.first_name||''} ${card.last_name||''}`} size="lg" />
        <div className="flex-1">
          <p className="font-display font-bold text-base">{card.first_name} {card.last_name}</p>
          <p className="text-xs text-slate-300">{card.student_number} · {card.class_name}{card.stream_name?' / '+card.stream_name:''}</p>
          <p className="text-xs text-slate-400">{card.exam_name} · {card.term_name}</p>
        </div>
        <div className="text-right">
          {/* Division — the headline result */}
          <div className="inline-flex items-center justify-center w-20 h-10 rounded-xl mb-1"
            style={{ background: ac + '22', border: `2px solid ${ac}` }}>
            <span className="font-display font-bold text-sm" style={{ color: ac }}>
              {div === 'U' ? 'UNGRADED' : `DIV ${div}`}
            </span>
          </div>
          <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
            <span className="font-display font-bold text-3xl" style={{ color: ac }}>{agg??'—'}</span>
            <span className="text-xs text-slate-400">agg</span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            {card.position_in_class ? `${card.position_in_class} / ${card.total_students_in_class}` : '—'}
          </p>
        </div>
      </div>

      {/* Marks table */}
      {card.marks?.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              {['Subject','Max','Score','%','Grade','Pts'].map(h =>
                <th key={h} className="table-head-cell text-center first:text-left">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {card.marks.map(m => {
              const gc = GRADE_COLORS[m.grade]
              return (
                <tr key={m.subject_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="table-cell font-medium">{m.subject_name}</td>
                  <td className="table-cell text-center text-slate-400">{m.exam_max_mark??'—'}</td>
                  <td className="table-cell text-center font-mono font-bold">{m.is_absent?<span className="text-red-500">ABS</span>:m.marks_obtained??'—'}</td>
                  <td className="table-cell text-center text-slate-500">{m.percentage!=null?`${m.percentage}%`:'—'}</td>
                  <td className="table-cell text-center">
                    {m.grade
                      ? <span className="inline-flex items-center justify-center w-10 h-6 rounded-lg text-xs font-bold"
                          style={{ background:(gc||'#64748B')+'18', color:gc||'#64748B' }}>{m.grade}</span>
                      : '—'}
                  </td>
                  <td className="table-cell text-center text-slate-500">
                    {m.is_gradable&&m.grade_points!=null?m.grade_points:'—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-slate-400 text-center py-4">No marks entered yet.</p>
      )}

      {/* Comments */}
      <Divider label="Teacher Comments" />
      <div className="grid grid-cols-2 gap-3">
        {[
          { label:"Class Teacher's Comment", text: card.class_teacher_comment },
          { label:"Head Teacher's Comment",  text: card.head_teacher_comment  },
        ].map(c => (
          <div key={c.label} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{c.label}</p>
            <p className="text-xs text-slate-700 leading-relaxed">{c.text || '—'}</p>
          </div>
        ))}
      </div>

      {/* Curriculum performance summary */}
      {card._curriculum && (
        <>
          <Divider label="Curriculum Performance (This Term)" />
          <div className="space-y-2">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { l:'Lessons Attended', v: card._curriculum.lessons_attended || card._curriculum.total_lessons || 0, c:'#2563EB' },
                { l:'Avg Lesson Mark',  v: card._curriculum.avg_mark != null ? `${Number(card._curriculum.avg_mark).toFixed(1)}%` : '—', c:'#059669' },
                { l:'Subjects',         v: card._curriculum.subjects?.length || 0, c:'#7C3AED' },
              ].map(x => (
                <div key={x.l} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <p className="font-display font-bold text-lg" style={{ color: x.c }}>{x.v}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{x.l}</p>
                </div>
              ))}
            </div>

            {/* Per-subject breakdown */}
            {card._curriculum.subjects?.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    {['Subject','Lessons','Avg Mark','Topics'].map(h =>
                      <th key={h} className="table-head-cell">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {card._curriculum.subjects.map((s, i) => {
                    const avg = s.avg_mark || s.average_percentage || 0
                    const c = avg>=70?'#059669':avg>=50?'#D97706':'#DC2626'
                    return (
                      <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="table-cell font-medium text-slate-800">{s.subject_name||'—'}</td>
                        <td className="table-cell text-center text-slate-500">{s.lessons_count||'—'}</td>
                        <td className="table-cell text-center font-bold" style={{ color: c }}>
                          {avg?`${avg.toFixed(1)}%`:'—'}
                        </td>
                        <td className="table-cell text-center text-slate-400">{s.topics_covered??'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
