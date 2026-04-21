import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { curriculumApi } from '../../services/api'
import {
  Card, Button, Badge, SearchableSelect, Input,
  SectionHeader, StatCard, Spinner, EmptyState, Alert, Tabs
} from '../../components/ui'
import { BarChart2, BookOpen, Users, Download, RefreshCw, Search } from 'lucide-react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const TABS = [
  { key:'term',    label:'Term Coverage',      icon: BookOpen },
  { key:'weekly',  label:'Weekly Report',      icon: BarChart2 },
  { key:'class',   label:'Class Performance',  icon: Users },
]

// ── Term Coverage ───────────────────────────────────────────
function TermCoverage() {
  const { token, schoolId } = useAuthStore()
  const { classOptions, termOptions, currentTerm } = useDataStore()
  const [selClass, setSelClass] = useState('')
  const [selTerm,  setSelTerm]  = useState('')
  const [report,   setReport]   = useState(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => { const t = currentTerm(); if (t) setSelTerm(String(t.id)) }, [])

  const load = async () => {
    if (!selClass || !selTerm) return toast.error('Select class and term')
    setLoading(true)
    try {
      const data = await curriculumApi.termCompletionReport(schoolId, { term_id: selTerm, class_id: selClass }, token)
      setReport(data)
    } catch (e) { toast.error(e.message); setReport(null) }
    finally { setLoading(false) }
  }

  const printReport = () => {
    if (!report) return
    const doc = new jsPDF()
    doc.setFillColor(15,23,42); doc.rect(0,0,210,22,'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(255,255,255)
    doc.text('Curriculum Coverage Report', 14, 11)
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(190,210,255)
    const cls = classOptions().find(c => String(c.value) === String(selClass))
    const trm = termOptions().find(t => String(t.value) === String(selTerm))
    doc.text(`${cls?.label || ''} · ${trm?.label || ''} · Generated ${format(new Date(), 'MMM d, yyyy')}`, 14, 17)

    const subjects = report.subjects || report || []
    autoTable(doc, {
      startY: 28,
      head: [['Subject', 'Teacher', 'Lessons Taught', 'Planned', 'Topics Done', 'Coverage %']],
      body: subjects.map(s => [
        s.subject_name || s.name || '—',
        s.teacher_name || '—',
        s.lessons_taught || s.completed_lessons || 0,
        s.total_lessons  || s.planned_lessons  || 0,
        s.topics_completed != null ? `${s.topics_completed}/${s.total_topics}` : '—',
        `${Math.round(((s.lessons_taught || s.completed_lessons || 0) / Math.max(s.total_lessons || s.planned_lessons || 1, 1)) * 100)}%`,
      ]),
      headStyles: { fillColor:[15,23,42], textColor:[255,255,255], fontStyle:'bold', fontSize:8 },
      bodyStyles: { fontSize:8 },
      alternateRowStyles: { fillColor:[248,250,252] },
      styles: { lineColor:[226,232,240], lineWidth:0.2 },
    })
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(100,116,139)
    doc.text(`Printed: ${new Date().toLocaleString('en-UG')}`, 14, doc.internal.pageSize.height - 6)
    doc.save(`curriculum-coverage-${cls?.label||'class'}.pdf`)
  }

  const classOpts = classOptions()
  const termOpts  = termOptions()
  const subjects  = report ? (report.subjects || report || []) : []

  // Normalize the API response shape — the backend returns subtopic completion data
  // not lesson counts, so we map it to what the UI expects
  const normalizedSubjects = subjects.map(s => ({
    ...s,
    subject_name:        s.subject_name || s.name || '—',
    completed_lessons:   s.completed_subtopics ?? s.completed_lessons ?? 0,
    total_lessons:       s.total_subtopics     ?? s.total_lessons     ?? 0,
    completion_pct:      s.completion_percent  ?? 0,
    topics_completed:    s.completed_subtopics ?? null,
    total_topics:        s.total_subtopics     ?? null,
    teacher_name:        s.teacher_name        || '—',
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-56"><SearchableSelect label="Class *" options={classOpts} value={selClass} onChange={v => setSelClass(v)} placeholder="Select class…" /></div>
        <div className="w-44"><SearchableSelect label="Term *" options={termOpts} value={selTerm} onChange={v => setSelTerm(v)} placeholder="Select term…" /></div>
        <Button icon={Search} loading={loading} onClick={load} className="self-end">Load Report</Button>
        {report && <Button variant="secondary" icon={Download} onClick={printReport} className="self-end">PDF</Button>}
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {normalizedSubjects.length > 0 && !loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Subjects" value={normalizedSubjects.length} color="#2563EB" />
            <StatCard label="Subtopics Completed" value={normalizedSubjects.reduce((s,x) => s+(x.completed_lessons||0),0)} color="#059669" />
            <StatCard label="Avg Coverage"
              value={`${Math.round(normalizedSubjects.reduce((s,x) => s+(x.completion_pct||0),0) / normalizedSubjects.length)}%`}
              color="#7C3AED" />
          </div>

          <Card>
            <p className="font-display font-semibold text-slate-900 text-sm mb-4">Coverage by Subject</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={normalizedSubjects.map(s => ({
                name: s.subject_name.substring(0,12),
                pct:  Math.round(s.completion_pct || 0)
              }))} margin={{ top:2, right:2, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0,100]} tick={{ fontSize:10, fill:'#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={v => [`${v}%`,'Coverage']} />
                <Bar dataKey="pct" radius={[4,4,0,0]}>
                  {normalizedSubjects.map((s,i) => (
                    <Cell key={i} fill={s.completion_pct>=80?'#059669':s.completion_pct>=50?'#D97706':'#DC2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card noPad>
            <table className="w-full">
              <thead>
                <tr>{['Subject','Subtopics Done','Repeat Lessons','Coverage'].map(h => <th key={h} className="table-head-cell">{h}</th>)}</tr>
              </thead>
              <tbody>
                {normalizedSubjects.map((s,i) => {
                  const pct   = Math.round(s.completion_pct || 0)
                  const color = pct>=80?'#059669':pct>=50?'#D97706':'#DC2626'
                  return (
                    <tr key={i} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-0">
                      <td className="table-cell font-semibold text-slate-900">{s.subject_name}</td>
                      <td className="table-cell text-center">{s.completed_lessons}/{s.total_lessons}</td>
                      <td className="table-cell text-center text-amber-600 font-semibold">
                        {s.repeat_lessons_count || 0}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width:`${pct}%`, background:color }} />
                          </div>
                          <span className="text-xs font-bold w-10 text-right" style={{ color }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {!loading && !report && <Card><EmptyState icon={BookOpen} title="Select a class and term to view coverage" /></Card>}
    </div>
  )
}

// ── Weekly Report ───────────────────────────────────────────
function WeeklyReport() {
  const { token, schoolId } = useAuthStore()
  const { classOptions, termOptions, currentTerm } = useDataStore()
  const [selClass,   setSelClass]   = useState('')
  const [selTerm,    setSelTerm]    = useState('')
  const [weekStart,  setWeekStart]  = useState(format(startOfWeek(new Date(),{weekStartsOn:1}), 'yyyy-MM-dd'))
  const [weekEnd,    setWeekEnd]    = useState(format(endOfWeek(new Date(),{weekStartsOn:1}), 'yyyy-MM-dd'))
  const [report,     setReport]     = useState(null)
  const [loading,    setLoading]    = useState(false)

  useEffect(() => { const t = currentTerm(); if (t) setSelTerm(String(t.id)) }, [])

  const load = async () => {
    setLoading(true)
    try {
      const p = { week_start: weekStart, week_end: weekEnd }
      if (selClass) p.class_id = selClass
      if (selTerm)  p.term_id  = selTerm
      const data = await curriculumApi.weeklyReport(schoolId, p, token)
      setReport(data)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const lessons = report?.data || report?.lessons || []
  const classOpts = classOptions()
  const termOpts  = termOptions()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Input label="Week Start" type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} wrapClass="w-40" />
        <Input label="Week End"   type="date" value={weekEnd}   onChange={e => setWeekEnd(e.target.value)}   wrapClass="w-40" />
        <div className="w-52"><SearchableSelect label="Class (optional)" options={[{ value:'', label:'All classes' },...classOpts]} value={selClass} onChange={v => setSelClass(v)} placeholder="All classes…" /></div>
        <Button icon={Search} loading={loading} onClick={load} className="self-end">Load</Button>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {lessons.length > 0 && !loading && (
        <Card noPad>
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-sm font-semibold text-slate-900">{lessons.length} lesson{lessons.length!==1?'s':''} this week</p>
          </div>
          <table className="w-full">
            <thead><tr>{['Date','Subject','Class','Topic','Teacher','Status'].map(h=><th key={h} className="table-head-cell">{h}</th>)}</tr></thead>
            <tbody>
              {lessons.map((l,i) => (
                <tr key={l.id||i} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50">
                  <td className="table-cell font-mono text-xs">{l.lesson_date?format(new Date(l.lesson_date),'EEE, MMM d'):'—'}</td>
                  <td className="table-cell font-semibold text-slate-900">{l.subject_name||'—'}</td>
                  <td className="table-cell text-slate-600">{l.class_name||'—'}</td>
                  <td className="table-cell text-slate-500 text-xs">{l.topic_name||'—'}</td>
                  <td className="table-cell text-slate-500 text-sm">{l.teacher_name||'—'}</td>
                  <td className="table-cell"><Badge variant={l.status==='approved'?'approved':l.status==='pending'?'pending':'default'}>{l.status||'draft'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {!loading && !report && <Card><EmptyState icon={BarChart2} title="Select a date range and click Load" /></Card>}
    </div>
  )
}

// ── Class Performance ───────────────────────────────────────
function ClassPerformance() {
  const { token, schoolId } = useAuthStore()
  const { classOptions, termOptions, currentTerm } = useDataStore()
  const [selClass, setSelClass] = useState('')
  const [selTerm,  setSelTerm]  = useState('')
  const [report,   setReport]   = useState(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => { const t = currentTerm(); if (t) setSelTerm(String(t.id)) }, [])

  const load = async () => {
    if (!selClass || !selTerm) return toast.error('Select class and term')
    setLoading(true)
    try {
      const data = await curriculumApi.classPerformance(schoolId, { term_id: selTerm, class_id: selClass }, token)
      setReport(data)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const classOpts = classOptions()
  const termOpts  = termOptions()
  const subjects  = report?.subjects || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-56"><SearchableSelect label="Class *" options={classOpts} value={selClass} onChange={v => setSelClass(v)} placeholder="Select class…" /></div>
        <div className="w-44"><SearchableSelect label="Term *" options={termOpts} value={selTerm} onChange={v => setSelTerm(v)} placeholder="Select term…" /></div>
        <Button icon={Search} loading={loading} onClick={load} className="self-end">Load</Button>
      </div>

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {students.length > 0 && !loading && (
        <Card noPad>
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{students.length} students</p>
          </div>
          <table className="w-full">
            <thead>
              <tr>{['Student','Lessons Attended','Avg Mark','Highest','Lowest'].map(h=><th key={h} className="table-head-cell">{h}</th>)}</tr>
            </thead>
            <tbody>
              {students.sort((a,b) => (b.avg_mark||0)-(a.avg_mark||0)).map((s,i) => {
                const avg = s.avg_mark || s.average_percentage || 0
                const c = avg>=70?'#059669':avg>=50?'#D97706':'#DC2626'
                return (
                  <tr key={s.student_id||i} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50">
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900 text-sm">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{s.student_number||'—'}</p>
                    </td>
                    <td className="table-cell text-center">{s.lessons_attended||s.lessons_count||'—'}</td>
                    <td className="table-cell text-center font-bold text-sm" style={{ color:c }}>{avg?`${avg.toFixed(1)}%`:'—'}</td>
                    <td className="table-cell text-center text-emerald-600">{s.highest_mark!=null?`${s.highest_mark}%`:'—'}</td>
                    <td className="table-cell text-center text-red-500">{s.lowest_mark!=null?`${s.lowest_mark}%`:'—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
      {!loading && !report && <Card><EmptyState icon={Users} title="Select a class and term to view performance" /></Card>}
    </div>
  )
}

export default function CurriculumReports() {
  const [tab, setTab] = useState('term')
  const COMP = { term: TermCoverage, weekly: WeeklyReport, class: ClassPerformance }
  const Comp = COMP[tab]
  return (
    <div className="page space-y-5">
      <SectionHeader title="Coverage & Performance Reports" sub="Term completion, weekly progress and student academic performance"
        breadcrumb="Curriculum" />
      <Card className="!p-3"><Tabs tabs={TABS} active={tab} onChange={setTab} /></Card>
      <Comp />
    </div>
  )
}
