import { useState } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { api } from '../../services/api'
import {
  Card, Button, Badge, Table, SearchableSelect, Input,
  SectionHeader, StatCard, EmptyState, Spinner, Tabs, Alert
} from '../../components/ui'
import { exportDailyReportPDF, exportStudentReportPDF, exportChronicAbsenteesPDF, exportTrendsPDF } from '../../lib/pdf'
import { FileBarChart2, Download, TrendingUp, AlertTriangle, User, CalendarDays, Search } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import toast from 'react-hot-toast'

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-500 mb-1">{label}</p>
      <p className="font-bold text-blue-600">{payload[0]?.value}%</p>
    </div>
  )
}

// ── Daily ──────────────────────────────────────────────────
function DailyReport() {
  const { token, schoolId } = useAuthStore()
  const { classOptions }    = useDataStore()
  const [date, setDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [classId, setClassId] = useState('')
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const r = await api.dailyReport(schoolId, date, classId || null, token)
      setData(Array.isArray(r) ? r : [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const total   = data?.reduce((s, r) => s + (r.total   || 0), 0) || 0
  const present = data?.reduce((s, r) => s + (r.present || 0), 0) || 0
  const absent  = data?.reduce((s, r) => s + (r.absent  || 0), 0) || 0

  const cols = [
    { key: 'class_name', label: 'Class', render: (v, row) => <span className="font-semibold text-slate-900">{v || `Class ${row.class_id}`}</span> },
    { key: 'total',      label: 'Total', align: 'center' },
    { key: 'present',    label: 'Present',  align: 'center', render: v => <span className="text-emerald-600 font-bold">{v}</span> },
    { key: 'absent',     label: 'Absent',   align: 'center', render: v => <span className="text-red-600 font-bold">{v}</span> },
    { key: 'late',       label: 'Late',     align: 'center', render: v => <span className="text-amber-600 font-semibold">{v}</span> },
    { key: 'half_day',   label: 'Half-Day', align: 'center', render: v => <span className="text-violet-600">{v}</span> },
    { key: 'excused',    label: 'Excused',  align: 'center', render: v => <span className="text-cyan-600">{v}</span> },
    { key: 'attendance_rate', label: 'Rate', align: 'right', render: v => {
      const p = v ?? 0
      const c = p >= 80 ? '#059669' : '#DC2626'
      return (
        <div className="flex items-center justify-end gap-2">
          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${p}%`, background: c }} />
          </div>
          <span className="font-bold text-xs" style={{ color: c }}>{p}%</span>
        </div>
      )
    }},
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} wrapClass="w-44" />
        <div className="w-56">
          <SearchableSelect label="Class (optional)"
            options={[{ value: '', label: 'All classes' }, ...classOptions()]}
            value={classId} onChange={v => setClassId(v)} placeholder="All classes…" />
        </div>
        <Button icon={Search} onClick={run} loading={loading} className="self-end">Generate</Button>
        {data?.length > 0 && (
          <Button variant="secondary" icon={Download} className="self-end" onClick={() => exportDailyReportPDF(data, date)}>PDF</Button>
        )}
      </div>
      {data !== null && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total"   value={total}   color="#2563EB" />
            <StatCard label="Present" value={present} color="#059669" />
            <StatCard label="Absent"  value={absent}  color="#DC2626" />
          </div>
          <Card noPad>
            {loading ? <div className="p-8 flex justify-center"><Spinner /></div>
              : <Table columns={cols} data={data} emptyState="No data for this date" />}
          </Card>
        </>
      )}
    </div>
  )
}

// ── Student Report ─────────────────────────────────────────
function StudentReport() {
  const { token, schoolId } = useAuthStore()
  const { studentOptions }  = useDataStore()
  const [studentId,  setStudentId] = useState('')
  const [selStudent, setSelStudent] = useState(null)
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to,   setTo]   = useState(format(endOfMonth(new Date()),   'yyyy-MM-dd'))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!studentId) return toast.error('Select a student')
    setLoading(true)
    try { setData(await api.studentReport(schoolId, studentId, from, to, token)) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const { summary, daily } = data || {}
  const rate  = summary?.attendance_percent ?? 0
  const rc    = rate >= 80 ? '#059669' : rate >= 60 ? '#D97706' : '#DC2626'
  const SC    = { present: '#059669', absent: '#DC2626', late: '#D97706', half_day: '#7C3AED', excused: '#0891B2' }

  const cols = [
    { key: 'attendance_date', label: 'Date',    render: v => <span className="font-mono text-xs">{format(new Date(v), 'EEE, MMM d yyyy')}</span> },
    { key: 'status',          label: 'Status',  render: v => <Badge variant={v}>{v}</Badge> },
    { key: 'check_in_time',   label: 'In',      render: v => v || <span className="text-slate-300">—</span> },
    { key: 'check_out_time',  label: 'Out',     render: v => v || <span className="text-slate-300">—</span> },
    { key: 'remarks',         label: 'Remarks', render: v => v ? <span className="text-xs text-slate-500">{v}</span> : <span className="text-slate-300">—</span>, wrap: true },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-72">
          <SearchableSelect label="Student *" options={studentOptions()}
            value={studentId} onChange={(v, opt) => { setStudentId(v); setSelStudent(opt) }}
            placeholder="Search student by name…" />
        </div>
        <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} wrapClass="w-40" />
        <Input label="To"   type="date" value={to}   onChange={e => setTo(e.target.value)}   wrapClass="w-40" />
        <Button icon={Search} onClick={run} loading={loading} className="self-end">Generate</Button>
        {data && (
          <Button variant="secondary" icon={Download} className="self-end"
            onClick={() => exportStudentReportPDF({ name: selStudent?.label, admission_number: selStudent?.sub }, summary, daily, from, to)}>PDF</Button>
        )}
      </div>

      {loading && <div className="py-12 flex justify-center"><Spinner /></div>}

      {summary && !loading && (
        <>
          <div className="flex items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0">
              <circle cx="38" cy="38" r="30" fill="none" stroke="#E2E8F0" strokeWidth="6" />
              <circle cx="38" cy="38" r="30" fill="none" stroke={rc} strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 30 * rate / 100} ${2 * Math.PI * 30}`}
                strokeLinecap="round" transform="rotate(-90 38 38)"
                style={{ transition: 'stroke-dasharray 0.8s ease' }} />
              <text x="38" y="43" textAnchor="middle" fill={rc} fontSize="13" fontWeight="700"
                fontFamily="Plus Jakarta Sans,sans-serif">{rate}%</text>
            </svg>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 flex-1">
              {[
                { l: 'Total',    v: summary.total_days,   c: '#2563EB' },
                { l: 'Present',  v: summary.present_days, c: '#059669' },
                { l: 'Absent',   v: summary.absent_days,  c: '#DC2626' },
                { l: 'Late',     v: summary.late_days,    c: '#D97706' },
                { l: 'Half-Day', v: summary.half_days,    c: '#7C3AED' },
                { l: 'Excused',  v: summary.excused_days, c: '#0891B2' },
              ].map(x => (
                <div key={x.l}>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{x.l}</p>
                  <p className="font-display font-bold text-xl leading-none" style={{ color: x.c }}>{x.v ?? 0}</p>
                </div>
              ))}
            </div>
          </div>

          {daily?.length > 0 && (
            <Card>
              <p className="font-display font-semibold text-sm text-slate-900 mb-4">Daily Attendance</p>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={daily.map(d => ({ date: format(new Date(d.attendance_date), 'MMM d'), s: d.status }))}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false}
                    interval={Math.max(0, Math.floor(daily.length / 10))} />
                  <Bar dataKey={() => 1} radius={[3, 3, 0, 0]}>
                    {daily.map((d, i) => <Cell key={i} fill={SC[d.status] || '#E2E8F0'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
          <Card noPad><Table columns={cols} data={daily || []} emptyState="No records in this period" /></Card>
        </>
      )}
    </div>
  )
}

// ── Chronic ────────────────────────────────────────────────
function ChronicAbsentees() {
  const { token, schoolId } = useAuthStore()
  const [from, setFrom]     = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to, setTo]         = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [threshold, setThreshold] = useState('20')
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try { setData(await api.chronicAbsentees(schoolId, from, to, threshold, token).then(r => Array.isArray(r) ? r : [])) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const cols = [
    { key: 'student_name', label: 'Student', render: (v, row) => (
      <div>
        <p className="text-sm font-semibold text-slate-900">{v}</p>
        <p className="text-xs text-slate-400 font-mono">{row.admission_number || '—'}</p>
      </div>
    )},
    { key: 'class_name',     label: 'Class',  render: (v, r) => v || `Class ${r.class_id}` },
    { key: 'total_days',     label: 'Total',  align: 'center' },
    { key: 'absent_days',    label: 'Absent', align: 'center', render: v => <span className="text-red-600 font-bold">{v}</span> },
    { key: 'absence_percent', label: 'Absence %', render: v => <Badge variant="absent">{v}%</Badge> },
  ]

  return (
    <div className="space-y-4">
      <Alert type="warning">Students whose absence rate exceeds the threshold need follow-up intervention.</Alert>
      <div className="flex flex-wrap gap-3 items-end">
        <Input label="From"      type="date"   value={from}      onChange={e => setFrom(e.target.value)}      wrapClass="w-40" />
        <Input label="To"        type="date"   value={to}        onChange={e => setTo(e.target.value)}        wrapClass="w-40" />
        <Input label="Threshold %" type="number" value={threshold} onChange={e => setThreshold(e.target.value)} wrapClass="w-32" />
        <Button icon={Search} onClick={run} loading={loading} className="self-end">Generate</Button>
        {data?.length > 0 && (
          <Button variant="secondary" icon={Download} className="self-end" onClick={() => exportChronicAbsenteesPDF(data, from, to)}>PDF</Button>
        )}
      </div>
      {data !== null && (
        <Card noPad>
          {data.length > 0 && (
            <div className="px-5 py-3 border-b border-slate-100 bg-red-50">
              <span className="text-xs font-bold text-red-600">⚠ {data.length} student{data.length !== 1 ? 's' : ''} flagged</span>
            </div>
          )}
          <Table columns={cols} data={data} loading={loading} emptyState="No chronic absentees found." />
        </Card>
      )}
    </div>
  )
}

// ── Trends ─────────────────────────────────────────────────
function Trends() {
  const { token, schoolId } = useAuthStore()
  const { classOptions }    = useDataStore()
  const [from, setFrom]     = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [classId, setClassId] = useState('')
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try { setData(await api.trends(schoolId, from, to, classId || null, token).then(r => Array.isArray(r) ? r : [])) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const avg       = data?.length ? (data.reduce((s, r) => s + (r.rate || 0), 0) / data.length).toFixed(1) : null
  const chartData = (data || []).map(r => ({ date: format(new Date(r.attendance_date), 'MMM d'), rate: r.rate || 0 }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} wrapClass="w-40" />
        <Input label="To"   type="date" value={to}   onChange={e => setTo(e.target.value)}   wrapClass="w-40" />
        <div className="w-56">
          <SearchableSelect label="Class (optional)"
            options={[{ value: '', label: 'All classes' }, ...classOptions()]}
            value={classId} onChange={v => setClassId(v)} placeholder="All classes…" />
        </div>
        <Button icon={Search} onClick={run} loading={loading} className="self-end">Generate</Button>
        {data?.length > 0 && (
          <Button variant="secondary" icon={Download} className="self-end" onClick={() => exportTrendsPDF(data, from, to)}>PDF</Button>
        )}
      </div>

      {avg && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Average Rate"  value={`${avg}%`} color="#2563EB" />
          <StatCard label="Days Tracked"  value={data?.length ?? 0} color="#059669" />
          <StatCard label="Lowest Rate"   value={data ? `${Math.min(...data.map(d => d.rate || 0))}%` : '—'} color="#D97706" />
        </div>
      )}

      {chartData.length > 0 && (
        <Card>
          <p className="font-display font-semibold text-slate-900 text-sm mb-5">Rate Over Time</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 2, right: 2, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false}
                interval={Math.max(1, Math.floor(chartData.length / 12))} />
              <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2}
                fill="url(#tg)" dot={false} activeDot={{ r: 5, fill: '#2563EB', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {data !== null && data.length === 0 && (
        <EmptyState icon={TrendingUp} title="No trend data" subtitle="Adjust the date range or class filter" />
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────
const TABS = [
  { key: 'daily',   label: 'Daily',    icon: CalendarDays },
  { key: 'student', label: 'Student',  icon: User },
  { key: 'chronic', label: 'Chronic',  icon: AlertTriangle },
  { key: 'trends',  label: 'Trends',   icon: TrendingUp },
]

export default function Reports() {
  const [tab, setTab] = useState('daily')
  const COMP = { daily: DailyReport, student: StudentReport, chronic: ChronicAbsentees, trends: Trends }
  const Comp = COMP[tab]
  return (
    <div className="page space-y-5">
      <SectionHeader title="Reports & Analytics" sub="Generate and export attendance reports" breadcrumb="Insights" />
      <Card className="!p-3"><Tabs tabs={TABS} active={tab} onChange={setTab} /></Card>
      <Comp />
    </div>
  )
}
