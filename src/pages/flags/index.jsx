import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { api } from '../../services/api'
import { Card, Button, Badge, Table, Input, SearchableSelect, SectionHeader, StatCard, Alert, EmptyState, Spinner } from '../../components/ui'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

export default function AbsenteeFlags() {
  const { token, schoolId }    = useAuthStore()
  const { classOptions }       = useDataStore()
  const [flags, setFlags]      = useState([])
  const [loading, setLoading]  = useState(true)
  const [filterClass, setFilterClass]   = useState('')
  const [unresolvedOnly, setUnresolved] = useState(true)
  const [from, setFrom] = useState(format(subDays(new Date(), 14), 'yyyy-MM-dd'))
  const [to,   setTo]   = useState(format(new Date(), 'yyyy-MM-dd'))

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const data = await api.absenteeFlags(schoolId, { from, to, unresolved: unresolvedOnly || undefined, class_id: filterClass || undefined }, token)
      setFlags(Array.isArray(data) ? data : [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [schoolId, token, from, to, unresolvedOnly, filterClass])

  useEffect(() => { load() }, [load])

  const consec3  = flags.filter(f => f.consecutive_days >= 3).length
  const chronic  = flags.filter(f => f.consecutive_days >= 5).length
  const resolved = flags.filter(f => f.resolved).length

  const cols = [
    { key: 'student_name', label: 'Student', render: (v, row) => <span className="text-sm font-semibold text-slate-900">{v || `Student #${row.student_id}`}</span> },
    { key: 'flag_date',    label: 'Date',    render: v => <span className="font-mono text-xs">{format(new Date(v), 'EEE, MMM d yyyy')}</span> },
    { key: 'flag_type',    label: 'Flag',    render: v => <Badge variant={v === 'consecutive_absent' ? 'absent' : 'pending'}>{v?.replace(/_/g, ' ')}</Badge> },
    { key: 'consecutive_days', label: 'Days', align: 'center', render: v => (
      <span className={clsx('font-bold text-sm', v >= 5 ? 'text-red-600' : v >= 3 ? 'text-amber-600' : 'text-slate-400')}>
        {v > 0 ? `${v}d` : '—'}
      </span>
    )},
    { key: 'resolved', label: 'Resolved', align: 'center', render: v => <Badge variant={v ? 'present' : 'absent'}>{v ? 'Yes' : 'No'}</Badge> },
  ]

  return (
    <div className="page space-y-5">
      <SectionHeader title="Absentee Flags" sub="Auto-detected absenteeism patterns" breadcrumb="Attendance"
        actions={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>} />

      {chronic > 0 && <Alert type="danger"><strong>{chronic}</strong> student{chronic !== 1 ? 's' : ''} have 5+ consecutive absences — immediate intervention needed.</Alert>}
      {consec3 > 0 && !chronic && <Alert type="warning"><strong>{consec3}</strong> student{consec3 !== 1 ? 's' : ''} have 3+ consecutive absences.</Alert>}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Flags"     value={flags.length} icon={AlertTriangle} color="#D97706" />
        <StatCard label="3+ Consec. Days" value={consec3}                           color="#DC2626" />
        <StatCard label="Resolved"        value={resolved}                          color="#059669" />
      </div>

      <Card className="flex flex-wrap gap-3 items-end">
        <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} wrapClass="w-40" />
        <Input label="To"   type="date" value={to}   onChange={e => setTo(e.target.value)}   wrapClass="w-40" />
        <div className="w-52">
          <SearchableSelect label="Class (optional)"
            options={[{ value: '', label: 'All classes' }, ...classOptions()]}
            value={filterClass} onChange={v => setFilterClass(v)} placeholder="All classes…" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 self-end pb-0.5">
          <input type="checkbox" checked={unresolvedOnly} onChange={e => setUnresolved(e.target.checked)} className="accent-blue-600 rounded" />
          Unresolved only
        </label>
        <Button icon={Search} variant="secondary" size="sm" onClick={load} className="self-end">Filter</Button>
      </Card>

      <Card noPad>
        {loading
          ? <div className="p-8 flex justify-center"><Spinner /></div>
          : <Table columns={cols} data={flags}
              emptyState={<EmptyState icon={AlertTriangle} title="No flags found"
                subtitle="Flags appear automatically when sessions are closed with absent students." />} />
        }
      </Card>
    </div>
  )
}
