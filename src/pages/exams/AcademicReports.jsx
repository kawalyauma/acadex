import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { examApi, api } from '../../services/api'
import {
  Card, Button, Badge, SearchableSelect, Input, Select,
  SectionHeader, StatCard, Spinner, EmptyState, Alert, Tabs
} from '../../components/ui'
import {
  printReportCard, printClassReportCards,
  printClassMarksheet, printAttendanceReport
} from '../../lib/examPdf'
import {
  FileText, Download, Users, User, BookOpen,
  CalendarCheck, Layers, RefreshCw, Printer
} from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'reportcards',  label: 'Report Cards',       icon: FileText },
  { key: 'marksheets',   label: 'Assessment Sheets',  icon: BookOpen },
  { key: 'attendance',   label: 'Attendance Reports', icon: CalendarCheck },
]

// ── Shared helpers ──────────────────────────────────────────
function ScopeSelector({ label, scope, setScope, selClass, setSelClass, selStudent, setSelStudent, classOpts, studentOpts }) {
  return (
    <Card className="space-y-4">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      <div className="flex gap-3 flex-wrap">
        {[
          { k:'school', icon: Layers, l:'Whole School' },
          { k:'class',  icon: Users,  l:'Single Class' },
          { k:'student',icon: User,   l:'Single Student' },
        ].map(s => (
          <button key={s.k} onClick={() => setScope(s.k)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${scope===s.k?'bg-blue-600 text-white border-blue-600 shadow-sm':'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
            <s.icon size={15} />
            {s.l}
          </button>
        ))}
      </div>

      {scope === 'class' && (
        <div className="w-72">
          <SearchableSelect label="Select Class" options={classOpts}
            value={selClass} onChange={v => setSelClass(v)} placeholder="Choose class…" />
        </div>
      )}
      {scope === 'student' && (
        <div className="grid grid-cols-2 gap-3 max-w-lg">
          <SearchableSelect label="Class (to filter students)"
            options={[{ value:'', label:'All classes' }, ...classOpts]}
            value={selClass} onChange={v => { setSelClass(v); setSelStudent('') }} placeholder="Filter by class…" />
          <SearchableSelect label="Student *"
            options={studentOpts(selClass)}
            value={selStudent} onChange={v => setSelStudent(v)} placeholder="Search student…" />
        </div>
      )}
    </Card>
  )
}

// ── Report Cards tab ────────────────────────────────────────
function ReportCardsTab() {
  const { token, schoolId, school } = useAuthStore()
  const { classes, classOptions, studentOptions } = useDataStore()
  const [exams,      setExams]     = useState([])
  const [selExam,    setSelExam]   = useState('')
  const [scope,      setScope]     = useState('class')
  const [selClass,   setSelClass]  = useState('')
  const [selStudent, setSelStudent]= useState('')
  const [loading,    setLoading]   = useState(false)
  const [cards,      setCards]     = useState([])
  const [generating, setGenerating]= useState(false)

  // Load published exams
  useEffect(() => {
    if (!schoolId) return
    examApi.exams(schoolId, {}, token)
      .then(d => setExams(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [schoolId, token])

  const examOpts = exams.map(e => ({ value: e.id, label: e.name, sub: e.status }))
  const classOpts = classOptions()

  const loadCards = useCallback(async () => {
    if (!selExam) return toast.error('Select an exam')
    if (scope === 'class'   && !selClass)   return toast.error('Select a class')
    if (scope === 'student' && !selStudent) return toast.error('Select a student')
    setLoading(true)
    setCards([])
    try {
      if (scope === 'student') {
        const card = await examApi.studentCard(schoolId, selExam, selStudent, token)
        setCards([card])
      } else if (scope === 'class') {
        const data = await examApi.reportCards(schoolId, selExam, selClass, token)
        setCards(Array.isArray(data) ? data : [])
      } else {
        // whole school — load for each enrolled class
        const enrolledCls = await examApi.examClasses(schoolId, selExam, token)
        const all = []
        for (const ec of (enrolledCls || [])) {
          const cls = await examApi.reportCards(schoolId, selExam, ec.class_id, token).catch(() => [])
          all.push(...(Array.isArray(cls) ? cls : []))
        }
        setCards(all)
      }
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [schoolId, token, selExam, scope, selClass, selStudent])

  const printAll = async () => {
    if (!cards.length) return toast.error('Load report cards first')
    setGenerating(true)
    const logoUrl = school?.logo_url || null
    toast.loading('Generating PDFs…', { id: 'gen' })
    try {
      if (scope === 'student') {
        // Single card — need full data
        const full = cards[0].marks ? cards[0] : await examApi.studentCard(schoolId, selExam, selStudent, token)
        await printReportCard(full, school?.name || 'School', logoUrl, null)
        toast.success('Report card downloaded', { id: 'gen' })
      } else {
        // Need full data for each card (marks included)
        const exam = exams.find(e => String(e.id) === String(selExam))
        const byClass = {}
        cards.forEach(c => {
          const cls = classes.find(cl => String(cl.id) === String(c.class_id))
          const key = c.class_id
          if (!byClass[key]) byClass[key] = { cards: [], name: cls?.name || `Class ${c.class_id}` }
          byClass[key].cards.push(c)
        })
        for (const [classId, { cards: cls, name }] of Object.entries(byClass)) {
          // Fetch full cards with marks
          const full = []
          for (const c of cls) {
            try {
              const fc = await examApi.studentCard(schoolId, selExam, c.student_id, token)
              full.push(fc)
            } catch { full.push(c) }
          }
          await printClassReportCards(full, exam?.name || '', name, school?.name || 'School', logoUrl, {})
          await new Promise(r => setTimeout(r, 300))
        }
        toast.success(`Generated ${cards.length} report cards`, { id: 'gen' })
      }
    } catch (e) { toast.error(e.message, { id: 'gen' }) }
    finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4">
      <Alert type="info">
        Report cards include: student details, barcode, marks table with Uganda PLE grades, attendance summary, class teacher &amp; head teacher comments, signature lines.
      </Alert>

      <Card className="space-y-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Exam</p>
        <div className="w-80">
          <SearchableSelect options={examOpts} value={selExam}
            onChange={v => { setSelExam(v); setCards([]) }} placeholder="Choose exam…" />
        </div>
      </Card>

      <ScopeSelector label="Report Scope"
        scope={scope} setScope={v => { setScope(v); setCards([]) }}
        selClass={selClass} setSelClass={setSelClass}
        selStudent={selStudent} setSelStudent={setSelStudent}
        classOpts={classOpts} studentOpts={studentOptions} />

      <div className="flex gap-3">
        <Button icon={RefreshCw} variant="secondary" loading={loading} onClick={loadCards} disabled={!selExam}>
          Load Report Cards
        </Button>
        {cards.length > 0 && (
          <Button icon={Printer} loading={generating} onClick={printAll}>
            Print / Download PDF ({cards.length} student{cards.length !== 1 ? 's' : ''})
          </Button>
        )}
      </div>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      {cards.length > 0 && !loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Report Cards"  value={cards.length}                                  color="#2563EB" />
            <StatCard label="Published"     value={cards.filter(c => c.is_published).length}      color="#059669" />
            <StatCard label="Best Aggregate" value={Math.min(...cards.filter(c=>c.aggregate!=null).map(c=>c.aggregate)) || '—'} color="#7C3AED" />
          </div>

          <Card noPad>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Pos','Student','Class','Agg.','Division','Published',''].map(h =>
                      <th key={h} className="table-head-cell">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {cards.map((c, i) => {
                    const DIV_COLORS = { '1':'#059669','2':'#1D4ED8','3':'#7C3AED','4':'#D97706','U':'#DC2626' }
                    const div = c.division || (c.aggregate != null ? 'U' : null)
                    const divColor = DIV_COLORS[div] || '#94A3B8'
                    return (
                    <tr key={c.student_id || i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="table-cell font-bold text-slate-600 text-sm">{c.position_in_class ?? '—'}</td>
                      <td className="table-cell">
                        <p className="text-sm font-semibold text-slate-900">{c.first_name} {c.last_name}</p>
                        <p className="text-xs text-slate-400 font-mono">{c.student_number}</p>
                      </td>
                      <td className="table-cell text-sm text-slate-600">{c.class_name || '—'}</td>
                      <td className="table-cell">
                        {c.aggregate != null
                          ? <span className="font-display font-bold text-lg" style={{ color: AGG_CLR_INLINE(c.aggregate) }}>{c.aggregate}</span>
                          : '—'}
                      </td>
                      <td className="table-cell">
                        {div ? (
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg text-xs font-bold"
                            style={{ background: divColor + '18', color: divColor }}>
                            {div === 'U' ? 'Ungraded' : `Div ${div}`}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="table-cell"><Badge variant={c.is_published ? 'approved' : 'default'}>{c.is_published ? 'Yes' : 'No'}</Badge></td>
                      <td className="table-cell">
                        <Button size="xs" variant="ghost" icon={Download}
                          onClick={async () => {
                            try {
                              const full = await examApi.studentCard(schoolId, selExam, c.student_id, token)
                              await printReportCard(full, school?.name, null, null)
                            } catch (e) { toast.error(e.message) }
                          }} />
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!loading && !cards.length && selExam && (
        <Card>
          <EmptyState icon={FileText} title="No report cards loaded"
            subtitle="Select scope, then click 'Load Report Cards'" />
        </Card>
      )}
    </div>
  )
}

function AGG_CLR_INLINE(a) {
  if (!a) return '#64748B'
  if (a<=8) return '#059669'; if (a<=14) return '#1D4ED8'
  if (a<=20) return '#7C3AED'; if (a<=28) return '#D97706'
  return '#DC2626'
}

// ── Assessment sheets tab ───────────────────────────────────
function MarksheetTab() {
  const { token, schoolId, school } = useAuthStore()
  const { classOptions, studentOptions } = useDataStore()
  const [exams,      setExams]     = useState([])
  const [selExam,    setSelExam]   = useState('')
  const [selClass,   setSelClass]  = useState('')
  const [loading,    setLoading]   = useState(false)
  const [data,       setData]      = useState(null)
  const [generating, setGenerating]= useState(false)

  useEffect(() => {
    if (!schoolId) return
    examApi.exams(schoolId, {}, token).then(d => setExams(Array.isArray(d) ? d : [])).catch(() => {})
  }, [schoolId, token])

  const examOpts  = exams.map(e => ({ value: e.id, label: e.name }))
  const classOpts = classOptions()

  const loadMarksheet = async () => {
    if (!selExam || !selClass) return toast.error('Select exam and class')
    setLoading(true); setData(null)
    try {
      const [ms, cards] = await Promise.all([
        examApi.marksheet(schoolId, selExam, selClass, token),
        examApi.reportCards(schoolId, selExam, selClass, token).catch(() => []),
      ])
      setData({ marksheet: ms, cards: Array.isArray(cards) ? cards : [] })
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const printSheet = () => {
    if (!data) return
    const exam  = exams.find(e => String(e.id) === String(selExam))
    const { classOptions: co } = { classOptions }
    const cls   = classOptions().find(c => String(c.value) === String(selClass))

    // Merge card data (has position/agg) with marksheet students
    const cardMap = {}
    data.cards.forEach(c => { cardMap[c.student_id] = c })

    const enrichedStudents = (data.marksheet?.students || []).map(s => ({
      ...s, first_name: s.first_name, last_name: s.last_name,
      student_number: s.student_number,
      aggregate:        cardMap[s.id]?.aggregate,
      position_in_class:cardMap[s.id]?.position_in_class,
      grade_summary:    cardMap[s.id]?.grade_summary,
      marks: Object.values(s.marks || {}).filter(Boolean),
    }))

    setGenerating(true)
    try {
      printClassMarksheet(
        enrichedStudents,
        exam?.name || 'Exam',
        cls?.label || `Class ${selClass}`,
        school?.name || 'School',
        data.marksheet?.subjects || []
      )
      toast.success('Marksheet downloaded')
    } catch (e) { toast.error(e.message) }
    finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4">
      <Alert type="info">
        Assessment marksheets show all students × all subjects in a landscape grid with grades, aggregate and class position.
      </Alert>
      <Card className="space-y-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Exam & Class</p>
        <div className="grid grid-cols-2 gap-3 max-w-xl">
          <SearchableSelect label="Exam *" options={examOpts} value={selExam}
            onChange={v => { setSelExam(v); setData(null) }} placeholder="Choose exam…" />
          <SearchableSelect label="Class *" options={classOpts} value={selClass}
            onChange={v => { setSelClass(v); setData(null) }} placeholder="Choose class…" />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={loadMarksheet}>
            Load Marksheet
          </Button>
          {data && (
            <Button icon={Printer} loading={generating} onClick={printSheet}>
              Print Assessment Sheet (PDF)
            </Button>
          )}
        </div>
      </Card>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      {data && !loading && (
        <Card noPad>
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">
              {data.marksheet?.students?.length || 0} students · {data.marksheet?.subjects?.length || 0} subjects
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="table-head-cell">#</th>
                  <th className="table-head-cell">Student</th>
                  {(data.marksheet?.subjects || []).map(s => (
                    <th key={s.subject_id} className="table-head-cell text-center text-[9px]">
                      {s.subject_name}<br />
                      <span className="text-slate-300 font-normal">{s.max_mark}</span>
                    </th>
                  ))}
                  <th className="table-head-cell text-center">Agg</th>
                  <th className="table-head-cell text-center">Pos</th>
                </tr>
              </thead>
              <tbody>
                {(data.marksheet?.students || []).map((s, i) => {
                  const card = data.cards.find(c => c.student_id === s.id) || {}
                  return (
                    <tr key={s.id} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50">
                      <td className="table-cell text-slate-400 text-xs">{i+1}</td>
                      <td className="table-cell">
                        <p className="font-semibold text-slate-900">{s.first_name} {s.last_name}</p>
                        <p className="text-xs font-mono text-slate-400">{s.student_number}</p>
                      </td>
                      {(data.marksheet?.subjects || []).map(subj => {
                        const m = s.marks?.[subj.subject_id]
                        const GRADE_CLR = {D1:'#059669',D2:'#10B981',C3:'#1D4ED8',C4:'#3B82F6',C5:'#60A5FA',C6:'#93C5FD',P7:'#D97706',P8:'#F59E0B',F9:'#DC2626'}
                        const gc = m?.grade ? GRADE_CLR[m.grade] : null
                        return (
                          <td key={subj.subject_id} className="table-cell text-center">
                            {m ? (
                              <span className="font-mono text-xs">{m.marks_obtained ?? '—'}{' '}
                                {m.grade && <span style={{ color: gc || '#64748B' }} className="font-bold">{m.grade}</span>}
                              </span>
                            ) : <span className="text-slate-200">—</span>}
                          </td>
                        )
                      })}
                      <td className="table-cell text-center font-bold" style={{ color: AGG_CLR_INLINE(card.aggregate) }}>
                        {card.aggregate ?? '—'}
                      </td>
                      <td className="table-cell text-center text-slate-500 text-xs">
                        {card.position_in_class ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Attendance Reports tab ──────────────────────────────────
function AttendanceTab() {
  const { token, schoolId, school } = useAuthStore()
  const { classOptions, studentOptions } = useDataStore()
  const [scope,      setScope]      = useState('class')
  const [selClass,   setSelClass]   = useState('')
  const [selStudent, setSelStudent] = useState('')
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to,   setTo]   = useState(format(endOfMonth(new Date()),   'yyyy-MM-dd'))
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [generating, setGenerating] = useState(false)

  const classOpts = classOptions()

  const loadData = async () => {
    if (scope === 'class'   && !selClass)   return toast.error('Select a class')
    if (scope === 'student' && !selStudent) return toast.error('Select a student')
    setLoading(true); setData(null)
    try {
      if (scope === 'student') {
        const r = await api.studentReport(schoolId, selStudent, from, to, token)
        setData({ type:'student', ...r })
      } else if (scope === 'class') {
        const r = await api.dailyReport(schoolId, from, selClass, token)
        // Also get trend
        const trend = await api.trends(schoolId, from, to, selClass, token).catch(() => [])
        setData({ type:'class', classes: Array.isArray(r) ? r : [], trend: Array.isArray(trend) ? trend : [] })
      } else {
        const r = await api.dailyReport(schoolId, from, null, token)
        setData({ type:'school', classes: Array.isArray(r) ? r : [] })
      }
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const printReport = () => {
    if (!data) return
    setGenerating(true)
    try {
      let title = 'Attendance Report'
      if (scope === 'student') {
        const s = studentOptions('').find(o => String(o.value) === String(selStudent))
        title = `Attendance Report — ${s?.label || 'Student'}`
        printAttendanceReport({ summary: data.summary, daily: data.daily }, title, school?.name)
      } else if (scope === 'class') {
        const cls = classOpts.find(c => String(c.value) === String(selClass))
        title = `Attendance Report — ${cls?.label || 'Class'} (${from} to ${to})`
        printAttendanceReport({ classes: data.classes }, title, school?.name)
      } else {
        printAttendanceReport({ classes: data.classes }, `School Attendance Report (${from} to ${to})`, school?.name)
      }
      toast.success('Attendance report downloaded')
    } catch (e) { toast.error(e.message) }
    finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4">
      <Alert type="info">
        Attendance reports include daily records, summary statistics (present/absent/late/rate), colour-coded by status.
      </Alert>

      <ScopeSelector label="Report Scope"
        scope={scope} setScope={v => { setScope(v); setData(null) }}
        selClass={selClass} setSelClass={setSelClass}
        selStudent={selStudent} setSelStudent={setSelStudent}
        classOpts={classOpts} studentOpts={studentOptions} />

      <Card className="flex flex-wrap gap-3 items-end">
        <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} wrapClass="w-40" />
        <Input label="To"   type="date" value={to}   onChange={e => setTo(e.target.value)}   wrapClass="w-40" />
        <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={loadData} className="self-end">
          Load Data
        </Button>
        {data && (
          <Button icon={Printer} loading={generating} onClick={printReport} className="self-end">
            Print Attendance PDF
          </Button>
        )}
      </Card>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      {data && !loading && (
        <Card>
          {data.type === 'student' && data.summary && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { l:'Total', v: data.summary.total_days,   c:'#1D4ED8' },
                { l:'Present',v:data.summary.present_days, c:'#059669' },
                { l:'Absent', v:data.summary.absent_days,  c:'#DC2626' },
                { l:'Late',   v:data.summary.late_days,    c:'#D97706' },
                { l:'Half-Day',v:data.summary.half_days,   c:'#7C3AED' },
                { l:'Rate',   v:`${data.summary.attendance_percent??0}%`,c:'#0891B2' },
              ].map(x => (
                <div key={x.l} className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="font-display font-bold text-2xl" style={{ color: x.c }}>{x.v??'—'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{x.l}</p>
                </div>
              ))}
            </div>
          )}
          {(data.type === 'class' || data.type === 'school') && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>{['Class','Total','Present','Absent','Late','Half-Day','Excused','Rate'].map(h =>
                    <th key={h} className="table-head-cell">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.classes.map((r, i) => (
                    <tr key={i} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50">
                      <td className="table-cell font-semibold">{r.class_name||`Class ${r.class_id}`}</td>
                      <td className="table-cell text-center">{r.total}</td>
                      <td className="table-cell text-center text-emerald-600 font-semibold">{r.present}</td>
                      <td className="table-cell text-center text-red-500 font-semibold">{r.absent}</td>
                      <td className="table-cell text-center text-amber-600">{r.late}</td>
                      <td className="table-cell text-center text-violet-600">{r.half_day}</td>
                      <td className="table-cell text-center text-cyan-600">{r.excused}</td>
                      <td className="table-cell text-center font-bold" style={{ color: r.attendance_rate>=80?'#059669':'#DC2626' }}>
                        {r.attendance_rate??0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────
export default function AcademicReports() {
  const [tab, setTab] = useState('reportcards')
  const COMP = { reportcards: ReportCardsTab, marksheets: MarksheetTab, attendance: AttendanceTab }
  const Comp = COMP[tab]
  return (
    <div className="page space-y-5">
      <SectionHeader
        title="Academic Reports"
        sub="Generate and print report cards, assessment sheets and attendance reports"
        breadcrumb="Exams"
      />
      <Card className="!p-3"><Tabs tabs={TABS} active={tab} onChange={setTab} /></Card>
      <Comp />
    </div>
  )
}
