import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { curriculumApi } from '../../services/api'
import {
  Card, Button, Badge, SearchableSelect,
  SectionHeader, StatCard, Spinner, EmptyState, Alert, Divider
} from '../../components/ui'
import { User, Download, Search, BarChart2, BookOpen, ClipboardList } from 'lucide-react'
import { format } from 'date-fns'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function StudentReports() {
  const { token, schoolId } = useAuthStore()
  const { classOptions, termOptions, studentOptions, currentTerm } = useDataStore()
  const [selClass,   setSelClass]   = useState('')
  const [selStudent, setSelStudent] = useState('')
  const [selTerm,    setSelTerm]    = useState('')
  const [report,     setReport]     = useState(null)
  const [loading,    setLoading]    = useState(false)

  useEffect(() => { const t = currentTerm(); if (t) setSelTerm(String(t.id)) }, [])

  const load = async () => {
    if (!selStudent || !selTerm) return toast.error('Select student and term')
    setLoading(true)
    try {
      const data = await curriculumApi.studentReport(schoolId, selStudent, { term_id: selTerm }, token)
      setReport(data)
    } catch (e) { toast.error(e.message); setReport(null) }
    finally { setLoading(false) }
  }

  const printReport = () => {
    if (!report) return
    const doc = new jsPDF()
    doc.setFillColor(15,23,42); doc.rect(0,0,210,22,'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(255,255,255)
    doc.text('Student Academic Report', 14, 11)
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(190,210,255)
    const trm = termOptions().find(t => String(t.value) === String(selTerm))
    doc.text(`${report.student_name || ''} · ${trm?.label || ''} · ${format(new Date(), 'MMM d, yyyy')}`, 14, 17)

    // Summary stats
    const summaryRows = [
      ['Term', trm?.label || '—'],
      ['Class', report.class_name || '—'],
      ['Lessons Attended', String(report.lessons_attended || 0)],
      ['Total Marks Avg', report.avg_mark != null ? `${report.avg_mark.toFixed(1)}%` : '—'],
    ]
    autoTable(doc, {
      startY: 28,
      body: summaryRows,
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle:'bold', cellWidth: 50 } },
      theme: 'plain',
    })

    // Subject breakdown
    if (report.subjects?.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 4,
        head: [['Subject', 'Lessons', 'Avg Mark', 'Highest', 'Lowest', 'Topics Covered']],
        body: report.subjects.map(s => [
          s.subject_name || '—',
          s.lessons_count || 0,
          s.avg_mark != null ? `${s.avg_mark.toFixed(1)}%` : '—',
          s.highest_mark != null ? `${s.highest_mark}%` : '—',
          s.lowest_mark != null ? `${s.lowest_mark}%` : '—',
          s.topics_covered != null ? `${s.topics_covered}` : '—',
        ]),
        headStyles: { fillColor:[15,23,42], textColor:[255,255,255], fontStyle:'bold', fontSize:8 },
        bodyStyles: { fontSize:8 },
        alternateRowStyles: { fillColor:[248,250,252] },
        styles: { lineColor:[226,232,240], lineWidth:0.2 },
      })
    }

    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(100,116,139)
    doc.text(`Printed: ${new Date().toLocaleString('en-UG')}`, 14, doc.internal.pageSize.height - 6)
    doc.save(`student-academic-report-${report.student_number || selStudent}.pdf`)
  }

  const classOpts   = classOptions()
  const termOpts    = termOptions()
  const studentOpts = studentOptions(selClass)

  const radarData = (report?.subjects || []).map(s => ({
    subject: (s.subject_name || '').substring(0, 8),
    score:   s.avg_mark || 0,
  }))

  return (
    <div className="page space-y-5">
      <SectionHeader title="Student Academic Reports"
        sub="Per-student curriculum performance, lesson participation and marks summary"
        breadcrumb="Curriculum" />

      {/* Selectors */}
      <Card className="flex flex-wrap gap-3 items-end">
        <div className="w-52">
          <SearchableSelect label="Class (to filter students)"
            options={[{ value:'', label:'All classes' }, ...classOpts]}
            value={selClass} onChange={v => { setSelClass(v); setSelStudent('') }} placeholder="Filter by class…" />
        </div>
        <div className="w-64">
          <SearchableSelect label="Student *"
            options={studentOpts} value={selStudent}
            onChange={v => setSelStudent(v)} placeholder="Search student…" />
        </div>
        <div className="w-44">
          <SearchableSelect label="Term *"
            options={termOpts} value={selTerm}
            onChange={v => setSelTerm(v)} placeholder="Select term…" />
        </div>
        <Button icon={Search} loading={loading} onClick={load} className="self-end">Load Report</Button>
        {report && <Button variant="secondary" icon={Download} onClick={printReport} className="self-end">PDF</Button>}
      </Card>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      {report && !loading && (
        <div className="space-y-5">
          {/* Student header */}
          <Card className="bg-slate-800 text-white !border-0">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center font-display font-bold text-xl shrink-0">
                {(report.student_name || report.first_name || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-display font-bold text-lg">{report.student_name || `${report.first_name || ''} ${report.last_name || ''}`}</p>
                <p className="text-slate-300 text-sm">{report.student_number} · {report.class_name}</p>
                <p className="text-slate-400 text-xs mt-0.5">{termOptions().find(t=>String(t.value)===String(selTerm))?.label}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { l:'Lessons', v: report.lessons_attended || report.total_lessons || 0, c:'#60A5FA' },
                  { l:'Avg Mark', v: report.avg_mark != null ? `${report.avg_mark.toFixed(1)}%` : '—', c:'#34D399' },
                  { l:'Subjects', v: report.subjects?.length || 0, c:'#F59E0B' },
                ].map(x => (
                  <div key={x.l} className="p-3 rounded-xl bg-white/10">
                    <p className="font-display font-bold text-xl" style={{ color: x.c }}>{x.v}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{x.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Radar chart + subject table */}
          <div className="grid lg:grid-cols-[300px_1fr] gap-4">
            {radarData.length > 2 && (
              <Card>
                <p className="font-display font-semibold text-slate-900 text-sm mb-3">Performance by Subject</p>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E2E8F0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize:10, fill:'#94A3B8' }} />
                    <Radar name="Avg Mark" dataKey="score" stroke="#2563EB" fill="#2563EB" fillOpacity={0.2} />
                    <Tooltip formatter={v => [`${v}%`,'Avg Mark']} />
                  </RadarChart>
                </ResponsiveContainer>
              </Card>
            )}

            <Card noPad>
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-sm font-semibold text-slate-900">Subject Breakdown</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr>{['Subject','Lessons','Avg %','Best','Worst','Topics'].map(h =>
                    <th key={h} className="table-head-cell">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(report.subjects || []).map((s, i) => {
                    const avg = s.avg_mark || s.average_percentage || 0
                    const c   = avg>=70?'#059669':avg>=50?'#D97706':'#DC2626'
                    return (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50 last:border-0">
                        <td className="table-cell font-semibold text-slate-900 text-sm">{s.subject_name||'—'}</td>
                        <td className="table-cell text-center">{s.lessons_count||'—'}</td>
                        <td className="table-cell text-center font-bold text-sm" style={{ color:c }}>
                          {avg?`${avg.toFixed(1)}%`:'—'}
                        </td>
                        <td className="table-cell text-center text-emerald-600 text-xs">
                          {s.highest_mark!=null?`${s.highest_mark}%`:'—'}
                        </td>
                        <td className="table-cell text-center text-red-500 text-xs">
                          {s.lowest_mark!=null?`${s.lowest_mark}%`:'—'}
                        </td>
                        <td className="table-cell text-center text-slate-500 text-xs">
                          {s.topics_covered!=null?s.topics_covered:'—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Lesson-by-lesson history */}
          {report.lesson_history?.length > 0 && (
            <Card noPad>
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-sm font-semibold text-slate-900">Lesson History</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr>{['Date','Subject','Topic','Mark','%'].map(h=><th key={h} className="table-head-cell">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {report.lesson_history.map((l, i) => {
                    const pct = l.percentage || l.marks_percent
                    const c   = pct>=70?'#059669':pct>=50?'#D97706':'#DC2626'
                    return (
                      <tr key={i} className="hover:bg-blue-50/30 border-b border-slate-50 last:border-0">
                        <td className="table-cell font-mono text-xs">{l.lesson_date?format(new Date(l.lesson_date),'MMM d, yyyy'):'—'}</td>
                        <td className="table-cell text-sm text-slate-800">{l.subject_name||'—'}</td>
                        <td className="table-cell text-xs text-slate-500">{l.topic_name||'—'}</td>
                        <td className="table-cell text-center font-mono">{l.marks_scored!=null?l.marks_scored:'—'}/{l.max_marks||'—'}</td>
                        <td className="table-cell text-center font-bold text-sm" style={{ color:c }}>
                          {pct!=null?`${Number(pct).toFixed(1)}%`:'—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {!loading && !report && (
        <Card>
          <EmptyState icon={User} title="Select a student and term"
            subtitle="View curriculum participation, lesson marks and subject performance" />
        </Card>
      )}
    </div>
  )
}
