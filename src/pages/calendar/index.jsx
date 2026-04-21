import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { api } from '../../services/api'
import { Card, Button, Badge, Table, Modal, Input, Select, SearchableSelect, SectionHeader, FormGrid, Spinner, Alert, Tabs } from '../../components/ui'
import { Plus, BookOpen, CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function CalendarPage() {
  const { token, schoolId } = useAuthStore()
  const [tab, setTab] = useState('calendars')
  const [calendars, setCalendars]   = useState([])
  const [holidays,  setHolidays]    = useState([])
  const [loadingCal, setLoadingCal] = useState(true)
  const [loadingHol, setLoadingHol] = useState(false)
  const [selCal, setSelCal]         = useState('')
  const [calModal, setCalModal]     = useState(false)
  const [holModal, setHolModal]     = useState(false)
  const [calForm, setCalForm] = useState({ name: '', term: '1', academic_year: '', start_date: '', end_date: '', is_active: '0' })
  const [holForm, setHolForm] = useState({ name: '', holiday_date: '', holiday_type: 'holiday', calendar_id: '' })
  const [saving, setSaving]         = useState(false)

  const loadCals = useCallback(async () => {
    if (!schoolId) return
    setLoadingCal(true)
    try { setCalendars(await api.attCalendars(schoolId, token).then(d => Array.isArray(d) ? d : [])) }
    catch (e) { toast.error(e.message) }
    finally { setLoadingCal(false) }
  }, [schoolId, token])

  const loadHols = useCallback(async () => {
    if (!schoolId) return
    setLoadingHol(true)
    try { setHolidays(await api.holidays(schoolId, selCal || null, token).then(d => Array.isArray(d) ? d : [])) }
    catch (e) { toast.error(e.message) }
    finally { setLoadingHol(false) }
  }, [schoolId, token, selCal])

  useEffect(() => { loadCals() }, [loadCals])
  useEffect(() => { if (tab === 'holidays') loadHols() }, [tab, loadHols])

  const cf = k => e => setCalForm(p => ({ ...p, [k]: e.target.value }))
  const hf = k => e => setHolForm(p => ({ ...p, [k]: e.target.value }))

  const saveCal = async () => {
    if (!calForm.name || !calForm.academic_year || !calForm.start_date || !calForm.end_date) return toast.error('All fields required')
    setSaving(true)
    try {
      await api.createAttCalendar(schoolId, { ...calForm, term: parseInt(calForm.term), is_active: parseInt(calForm.is_active) }, token)
      toast.success('Calendar created')
      setCalModal(false)
      loadCals()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const saveHol = async () => {
    if (!holForm.name || !holForm.holiday_date) return toast.error('Name and date required')
    setSaving(true)
    try {
      await api.addHoliday(schoolId, { ...holForm, calendar_id: holForm.calendar_id ? parseInt(holForm.calendar_id) : undefined }, token)
      toast.success('Holiday added')
      setHolModal(false)
      loadHols()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const calOpts  = calendars.map(c => ({ value: c.id, label: c.name, sub: `Term ${c.term} · ${c.academic_year}` }))
  const calCols  = [
    { key: 'name',          label: 'Calendar', render: v => <span className="font-semibold text-slate-900">{v}</span> },
    { key: 'term',          label: 'Term',     render: v => <Badge variant="blue">Term {v}</Badge> },
    { key: 'academic_year', label: 'Year' },
    { key: 'start_date',    label: 'Starts',   render: v => <span className="font-mono text-xs">{format(new Date(v), 'MMM d, yyyy')}</span> },
    { key: 'end_date',      label: 'Ends',     render: v => <span className="font-mono text-xs">{format(new Date(v), 'MMM d, yyyy')}</span> },
    { key: 'is_active',     label: 'Status',   render: v => <Badge variant={v ? 'active' : 'inactive'}>{v ? 'Active' : 'Inactive'}</Badge> },
  ]
  const holCols  = [
    { key: 'name',         label: 'Name', render: v => <span className="font-semibold text-slate-900">{v}</span> },
    { key: 'holiday_date', label: 'Date', render: v => <span className="font-mono text-xs">{format(new Date(v), 'EEE, MMM d yyyy')}</span> },
    { key: 'holiday_type', label: 'Type', render: v => <Badge variant="blue">{v}</Badge> },
  ]
  const TABS = [{ key: 'calendars', label: 'Calendars', icon: BookOpen }, { key: 'holidays', label: 'Holidays', icon: CalendarDays }]

  return (
    <div className="page space-y-5">
      <SectionHeader title="Academic Calendar" sub="Terms, school days and public holidays" breadcrumb="Attendance"
        actions={tab === 'calendars'
          ? <Button icon={Plus} onClick={() => setCalModal(true)}>New Calendar</Button>
          : <Button icon={Plus} onClick={() => setHolModal(true)}>Add Holiday</Button>} />

      <Card className="!p-3"><Tabs tabs={TABS} active={tab} onChange={setTab} /></Card>

      {tab === 'calendars' && (
        <Card noPad>
          {loadingCal ? <div className="p-8 flex justify-center"><Spinner /></div>
            : <Table columns={calCols} data={calendars} emptyState="No calendars yet" />}
        </Card>
      )}

      {tab === 'holidays' && (
        <>
          <Card className="flex gap-3 items-end flex-wrap">
            <SearchableSelect label="Filter by calendar" wrapClass="w-64"
              options={[{ value: '', label: 'All calendars' }, ...calOpts]}
              value={selCal} onChange={v => setSelCal(v)} placeholder="All calendars…" />
            <Button variant="secondary" size="sm" onClick={loadHols} className="self-end">Apply</Button>
          </Card>
          <Card noPad>
            {loadingHol ? <div className="p-8 flex justify-center"><Spinner /></div>
              : <Table columns={holCols} data={holidays} emptyState="No holidays found" />}
          </Card>
        </>
      )}

      <Modal open={calModal} onClose={() => setCalModal(false)} title="New Attendance Calendar"
        footer={<div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setCalModal(false)}>Cancel</Button><Button className="flex-1" loading={saving} onClick={saveCal}>Create</Button></div>}>
        <div className="space-y-4">
          <Input label="Calendar Name *" placeholder="Term 1 2025" value={calForm.name} onChange={cf('name')} />
          <FormGrid cols={2}>
            <Select label="Term" value={calForm.term} onChange={cf('term')}>
              {[1,2,3].map(n => <option key={n} value={n}>Term {n}</option>)}
            </Select>
            <Input label="Academic Year *" placeholder="2024/2025" value={calForm.academic_year} onChange={cf('academic_year')} />
          </FormGrid>
          <FormGrid cols={2}>
            <Input label="Start Date *" type="date" value={calForm.start_date} onChange={cf('start_date')} />
            <Input label="End Date *"   type="date" value={calForm.end_date}   onChange={cf('end_date')} />
          </FormGrid>
          <Select label="Status" value={calForm.is_active} onChange={cf('is_active')}>
            <option value="0">Inactive</option>
            <option value="1">Active — use for attendance</option>
          </Select>
        </div>
      </Modal>

      <Modal open={holModal} onClose={() => setHolModal(false)} title="Add Holiday / Non-School Day"
        footer={<div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setHolModal(false)}>Cancel</Button><Button className="flex-1" loading={saving} onClick={saveHol}>Add</Button></div>}>
        <div className="space-y-4">
          <Input label="Name *" placeholder="Independence Day" value={holForm.name} onChange={hf('name')} />
          <Input label="Date *" type="date" value={holForm.holiday_date} onChange={hf('holiday_date')} />
          <Select label="Type" value={holForm.holiday_type} onChange={hf('holiday_type')}>
            <option value="holiday">Public Holiday</option>
            <option value="event">School Event</option>
            <option value="closure">School Closure</option>
          </Select>
          <SearchableSelect label="Linked Calendar (optional)"
            options={[{ value: '', label: 'None' }, ...calOpts]}
            value={holForm.calendar_id} onChange={v => setHolForm(p => ({ ...p, calendar_id: v }))} placeholder="Select calendar…" />
        </div>
      </Modal>
    </div>
  )
}
