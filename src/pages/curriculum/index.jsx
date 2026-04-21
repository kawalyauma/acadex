import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { curriculumApi } from '../../services/api'
import { Card, Button, Badge, SectionHeader, Spinner, StatCard, SearchableSelect, Select } from '../../components/ui'
import {
  BookOpen, ClipboardList, Users, BarChart2, ChevronRight,
  CheckCircle2, Clock, AlertCircle, BookMarked
} from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

export default function CurriculumHub() {
  const { token, schoolId } = useAuthStore()
  const { classOptions, termOptions, currentTerm } = useDataStore()
  const navigate = useNavigate()

  const [selClass, setSelClass] = useState('')
  const [selTerm,  setSelTerm]  = useState('')
  const [report,   setReport]   = useState(null)
  const [loading,  setLoading]  = useState(false)

  // Auto-select current term
  useEffect(() => {
    const t = currentTerm()
    if (t) setSelTerm(String(t.id))
  }, [])

  const loadReport = async () => {
    if (!selClass || !selTerm) return
    setLoading(true)
    try {
      const data = await curriculumApi.termCompletionReport(schoolId, { term_id: selTerm, class_id: selClass }, token)
      setReport(data)
    } catch { setReport(null) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (selClass && selTerm) loadReport() }, [selClass, selTerm])

  const classOpts = classOptions()
  const termOpts  = termOptions()

  const SECTIONS = [
    {
      icon: BookMarked, color: '#2563EB',
      title: 'Curriculum',
      desc: 'Manage subjects, topics and subtopics',
      to: '/curriculum/subjects',
    },
    {
      icon: ClipboardList, color: '#059669',
      title: 'Lessons',
      desc: 'Record lessons taught, attach student work',
      to: '/curriculum/lessons',
    },
    {
      icon: BarChart2, color: '#7C3AED',
      title: 'Coverage Reports',
      desc: 'Subject completion and term progress',
      to: '/curriculum/reports',
    },
    {
      icon: Users, color: '#D97706',
      title: 'Student Reports',
      desc: 'Academic performance per student per term',
      to: '/curriculum/student-reports',
    },
  ]

  return (
    <div className="page space-y-5">
      <SectionHeader
        title="Curriculum Management"
        sub="Track teaching, lesson coverage, student work and academic performance"
        breadcrumb="Academic"
      />

      {/* Quick navigation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SECTIONS.map(s => (
          <div key={s.title}
            onClick={() => navigate(s.to)}
            className="card-hover p-5 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: s.color + '15' }}>
              <s.icon size={19} style={{ color: s.color }} />
            </div>
            <p className="font-display font-semibold text-slate-900 text-sm">{s.title}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.desc}</p>
            <div className="flex items-center gap-1 mt-3 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: s.color }}>
              Open <ChevronRight size={12} />
            </div>
          </div>
        ))}
      </div>

      {/* Term completion snapshot */}
      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p className="font-display font-semibold text-slate-900 text-sm">Term Curriculum Coverage</p>
            <p className="text-xs text-slate-400 mt-0.5">Select a class and term to see progress</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="w-52">
              <SearchableSelect options={classOpts} value={selClass}
                onChange={v => setSelClass(v)} placeholder="Select class…" />
            </div>
            <div className="w-44">
              <SearchableSelect options={termOpts} value={selTerm}
                onChange={v => setSelTerm(v)} placeholder="Select term…" />
            </div>
          </div>
        </div>

        {loading && <div className="flex justify-center py-8"><Spinner /></div>}

        {report && !loading && (
          <div className="space-y-3">
            {(report.subjects || report || []).map((subj, i) => {
              const done = subj.lessons_taught || subj.completed_lessons || 0
              const total = subj.total_lessons || subj.planned_lessons || 0
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              const color = pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626'
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {subj.subject_name || subj.name || `Subject ${i+1}`}
                      </p>
                      {subj.teacher_name && (
                        <span className="text-xs text-slate-400">· {subj.teacher_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{done}/{total} lessons</span>
                      <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && !report && selClass && selTerm && (
          <p className="text-sm text-slate-400 text-center py-4">No curriculum data found for this class and term.</p>
        )}
        {!loading && !selClass && (
          <p className="text-sm text-slate-400 text-center py-6">Select a class and term above to view coverage.</p>
        )}
      </Card>
    </div>
  )
}
