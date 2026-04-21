import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { api } from '../../services/api'
import { Card, StatCard, Badge, Button, Spinner, EmptyState, SectionHeader } from '../../components/ui'
import { format, subDays } from 'date-fns'
import {
  GraduationCap, CalendarCheck, AlertTriangle, TrendingUp,
  CheckCircle2, XCircle, RefreshCw, BookOpen
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { clsx } from 'clsx'

const today  = format(new Date(), 'yyyy-MM-dd')
const from30 = format(subDays(new Date(), 30), 'yyyy-MM-dd')

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-500 mb-1">{label}</p>
      <p className="font-bold text-blue-600">{payload[0]?.value ?? 0}%</p>
    </div>
  )
}

export default function Dashboard() {
  const { token, schoolId, school } = useAuthStore()
  const { classes, students, currentTerm } = useDataStore()
  const navigate = useNavigate()

  const [daily,    setDaily]    = useState([])
  const [trends,   setTrends]   = useState([])
  const [flags,    setFlags]    = useState([])
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  const load = () => {
    if (!schoolId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      api.dailyReport(schoolId, today, null, token).catch(() => []),
      api.trends(schoolId, from30, today, null, token).catch(() => []),
      api.absenteeFlags(schoolId, { unresolved: true, from: from30, to: today }, token).catch(() => []),
      api.sessions(schoolId, { from: from30, to: today }, token).catch(() => []),
    ]).then(([d, t, f, s]) => {
      setDaily(Array.isArray(d) ? d : [])
      setTrends(Array.isArray(t) ? t : [])
      setFlags(Array.isArray(f) ? f : [])
      setSessions(Array.isArray(s) ? s : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [schoolId, token])

  const totalPresent = daily.reduce((s, r) => s + (r.present || 0), 0)
  const totalAbsent  = daily.reduce((s, r) => s + (r.absent  || 0), 0)
  const avgRate = daily.length
    ? (daily.reduce((s, r) => s + (r.attendance_rate || 0), 0) / daily.length).toFixed(1)
    : null

  const trendData    = trends.map(r => ({ date: format(new Date(r.attendance_date), 'MMM d'), rate: r.rate || 0 }))
  const openSessions = sessions.filter(s => s.status === 'open')
  const term         = currentTerm()

  if (!schoolId) return (
    <div className="page space-y-5">
      <SectionHeader title="Dashboard" sub="Select a school to begin" />
      <Card>
        <EmptyState icon={GraduationCap} title="No school selected"
          subtitle="Go to school selection to start managing attendance."
          action={<Button onClick={() => navigate('/onboarding')}>Select School →</Button>} />
      </Card>
    </div>
  )

  return (
    <div className="page space-y-5">
      <SectionHeader
        title="Dashboard"
        sub={`${school?.name} · ${format(new Date(), 'EEEE, d MMMM yyyy')}${term ? ` · ${term.name}` : ''}`}
        actions={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>}
      />

      {/* Open sessions alert */}
      {openSessions.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{openSessions.length} session{openSessions.length > 1 ? 's' : ''} still open.</strong>
            {' '}Close them to auto-flag unmarked students as absent.
          </p>
          <Button variant="ghost" size="xs" className="ml-auto !text-amber-700 hover:!bg-amber-100"
            onClick={() => navigate('/sessions')}>View →</Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Students"  value={loading ? null : (students.length || '—')} icon={GraduationCap} color="#2563EB" loading={loading} />
        <StatCard label="Present Today"   value={loading ? null : (totalPresent || '—')}    icon={CheckCircle2}  color="#059669" loading={loading} />
        <StatCard label="Absent Today"    value={loading ? null : (totalAbsent  || '—')}    icon={XCircle}       color="#DC2626" loading={loading} />
        <StatCard label="Avg Rate (30d)"  value={loading ? null : (avgRate ? `${avgRate}%` : '—')} icon={TrendingUp} color="#7C3AED" loading={loading} />
      </div>

      {/* Chart row */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        {/* Trend chart */}
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-display font-semibold text-slate-900 text-sm">Attendance Trend</p>
              <p className="text-xs text-slate-400 mt-0.5">30-day daily rate</p>
            </div>
            <Button variant="ghost" size="xs" onClick={() => navigate('/reports')}>Full report →</Button>
          </div>
          {loading ? (
            <div className="h-44 flex items-center justify-center"><Spinner /></div>
          ) : trendData.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No trend data yet" subtitle="Close a session to see chart data" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData} margin={{ top: 2, right: 2, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={5} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2}
                  fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Today by class */}
        <Card>
          <p className="font-display font-semibold text-slate-900 text-sm mb-4">
            Today by Class <span className="text-slate-400 font-normal text-xs">{format(new Date(), 'MMM d')}</span>
          </p>
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="shimmer h-7 rounded" />)}</div>
          ) : daily.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No sessions today" subtitle="Open a session to start" />
          ) : (
            <div className="space-y-3">
              {daily.slice(0, 7).map(r => {
                const rate  = r.attendance_rate ?? 0
                const color = rate >= 80 ? '#059669' : rate >= 60 ? '#D97706' : '#DC2626'
                return (
                  <div key={r.class_id}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-medium text-slate-600 truncate">{r.class_name || `Class ${r.class_id}`}</span>
                      <span className="text-xs font-bold ml-2 shrink-0" style={{ color }}>{rate}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${rate}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom lists */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent sessions */}
        <Card noPad>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <p className="font-display font-semibold text-slate-900 text-sm">Recent Sessions</p>
            <Button variant="ghost" size="xs" onClick={() => navigate('/sessions')}>All →</Button>
          </div>
          {loading
            ? <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="shimmer h-10 rounded" />)}</div>
            : sessions.length === 0
              ? <EmptyState icon={CalendarCheck} title="No sessions yet" />
              : sessions.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <span className={clsx('w-2 h-2 rounded-full shrink-0', s.status === 'open' ? 'bg-emerald-400' : 'bg-slate-300')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.class_name || `Class ${s.class_id}`}</p>
                    <p className="text-xs text-slate-400">{format(new Date(s.session_date), 'MMM d, yyyy')} · {s.session_type?.replace('_', ' ')}</p>
                  </div>
                  <Badge variant={s.status}>{s.status}</Badge>
                </div>
              ))
          }
        </Card>

        {/* Flags */}
        <Card noPad>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <p className="font-display font-semibold text-slate-900 text-sm">Absentee Flags</p>
            <Button variant="ghost" size="xs" onClick={() => navigate('/flags')}>All →</Button>
          </div>
          {loading
            ? <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="shimmer h-10 rounded" />)}</div>
            : flags.length === 0
              ? <EmptyState icon={AlertTriangle} title="No unresolved flags" subtitle="All students are accounted for ✓" />
              : flags.slice(0, 5).map(f => (
                <div key={f.id} className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <AlertTriangle size={14} className={f.consecutive_days >= 3 ? 'text-red-500' : 'text-amber-500'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{f.student_name || `Student #${f.student_id}`}</p>
                    <p className="text-xs text-slate-400">
                      {f.consecutive_days > 0 ? `${f.consecutive_days} consecutive days` : f.flag_type?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{format(new Date(f.flag_date), 'MMM d')}</span>
                </div>
              ))
          }
        </Card>
      </div>

      {/* Platform summary pills */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Classes',     value: classes.length  || '—', color: '#7C3AED' },
          { label: 'Students',    value: students.length || '—', color: '#2563EB' },
          { label: 'Open Flags',  value: flags.length    || 0,   color: '#D97706' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: s.color + '12' }}>
              <span className="font-display font-bold text-base" style={{ color: s.color }}>{s.value}</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
