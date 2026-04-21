import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { api } from '../../services/api'
import {
  Button, Input, Select, FormGrid, Steps, Alert, Badge,
  Card, SectionHeader, Spinner, EmptyState, Divider, Modal
} from '../../components/ui'
import { Plus, Check, Calendar, BookOpen, Users, ChevronRight, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

export default function SchoolSetup() {
  const { token, schoolId, school } = useAuthStore()
  const { set, academicYears, terms, classes, loading } = useDataStore()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const STEPS = ['Academic Year', 'Terms', 'Classes & Streams']

  // Academic Year form
  const [yearForm, setYearForm]   = useState({ name: '', start_date: '', end_date: '', is_current: '1' })
  const [yearSaving, setYearSaving] = useState(false)

  // Term form
  const [termForm, setTermForm]   = useState({ name: '', academic_year_id: '', start_date: '', end_date: '', is_current: '0' })
  const [termSaving, setTermSaving] = useState(false)

  // Class form
  const [classForm, setClassForm] = useState({ name: '', code: '', level: '', description: '' })
  const [classSaving, setClassSaving] = useState(false)

  // Stream form
  const [streamModal, setStreamModal]   = useState(null) // classId
  const [streamForm, setStreamForm]     = useState({ name: '', code: '' })
  const [streamSaving, setStreamSaving] = useState(false)

  // Refresh from server
  const reload = async () => {
    if (!schoolId) return
    const [yrs, trms, clss] = await Promise.all([
      api.academicYears(schoolId, token).catch(() => []),
      api.terms(schoolId, token).catch(() => []),
      api.classes(schoolId, token).catch(() => []),
    ])
    set('academicYears', yrs)
    set('terms', trms)
    set('classes', clss)
  }

  useEffect(() => { reload() }, [schoolId])

  // Helpers
  const yf = k => e => setYearForm(p => ({ ...p, [k]: e.target.value }))
  const tf = k => e => setTermForm(p => ({ ...p, [k]: e.target.value }))
  const cf = k => e => setClassForm(p => ({ ...p, [k]: e.target.value }))
  const sf = k => e => setStreamForm(p => ({ ...p, [k]: e.target.value }))

  const saveYear = async () => {
    if (!yearForm.name || !yearForm.start_date || !yearForm.end_date) return toast.error('Name and dates are required')
    setYearSaving(true)
    try {
      await api.createAcademicYear(schoolId, { ...yearForm, is_current: parseInt(yearForm.is_current) }, token)
      toast.success('Academic year created')
      setYearForm({ name: '', start_date: '', end_date: '', is_current: '0' })
      reload()
    } catch (e) { toast.error(e.message) }
    finally { setYearSaving(false) }
  }

  const saveTerm = async () => {
    if (!termForm.name || !termForm.start_date || !termForm.end_date || !termForm.academic_year_id)
      return toast.error('All term fields are required')
    setTermSaving(true)
    try {
      await api.createTerm(schoolId, { ...termForm, academic_year_id: parseInt(termForm.academic_year_id), is_current: parseInt(termForm.is_current) }, token)
      toast.success('Term created')
      setTermForm({ name: '', academic_year_id: '', start_date: '', end_date: '', is_current: '0' })
      reload()
    } catch (e) { toast.error(e.message) }
    finally { setTermSaving(false) }
  }

  const saveClass = async () => {
    if (!classForm.name) return toast.error('Class name is required')
    setClassSaving(true)
    try {
      await api.createClass(schoolId, { ...classForm, level: classForm.level ? parseInt(classForm.level) : undefined }, token)
      toast.success('Class created')
      setClassForm({ name: '', code: '', level: '', description: '' })
      reload()
    } catch (e) { toast.error(e.message) }
    finally { setClassSaving(false) }
  }

  const saveStream = async () => {
    if (!streamForm.name || !streamModal) return toast.error('Stream name required')
    setStreamSaving(true)
    try {
      await api.createStream(schoolId, streamModal, streamForm, token)
      toast.success('Stream added')
      setStreamForm({ name: '', code: '' })
      setStreamModal(null)
      reload()
    } catch (e) { toast.error(e.message) }
    finally { setStreamSaving(false) }
  }

  const canProceed = [
    academicYears.length > 0,
    terms.length > 0,
    classes.length > 0,
  ]

  return (
    <div className="page max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <span className="font-medium text-blue-600">{school?.name || 'School'}</span>
          <ChevronRight size={14} />
          <span>Setup Wizard</span>
        </div>
        <h1 className="font-display font-bold text-2xl text-slate-900">School Setup</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your academic structure before tracking attendance.</p>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <Steps steps={STEPS} current={step} />
      </div>

      {/* ── STEP 0: Academic Year ── */}
      {step === 0 && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-display font-semibold text-slate-900 mb-1">Academic Years</h3>
            <p className="text-xs text-slate-500 mb-4">Define your school year periods (e.g. 2024/2025).</p>

            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <FormGrid cols={2}>
                <Input label="Year Name *" placeholder="2024/2025" value={yearForm.name} onChange={yf('name')} />
                <Select label="Set as Current?" value={yearForm.is_current} onChange={yf('is_current')}>
                  <option value="1">Yes — current year</option>
                  <option value="0">No</option>
                </Select>
              </FormGrid>
              <FormGrid cols={2}>
                <Input label="Start Date *" type="date" value={yearForm.start_date} onChange={yf('start_date')} />
                <Input label="End Date *"   type="date" value={yearForm.end_date}   onChange={yf('end_date')} />
              </FormGrid>
              <Button icon={Plus} loading={yearSaving} onClick={saveYear} size="sm">Add Academic Year</Button>
            </div>
          </Card>

          {/* Existing years */}
          {academicYears.length > 0 && (
            <Card noPad>
              <div className="p-4 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Created Academic Years ({academicYears.length})</p>
              </div>
              <div className="divide-y divide-slate-50">
                {academicYears.map(y => (
                  <div key={y.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Calendar size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{y.name}</p>
                      <p className="text-xs text-slate-400">{y.start_date} → {y.end_date}</p>
                    </div>
                    {y.is_current ? <Badge variant="current">Current</Badge> : null}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => navigate('/onboarding')}>← Back to Schools</Button>
            <Button disabled={!canProceed[0]} onClick={() => setStep(1)} className="ml-auto">
              Next: Terms →
            </Button>
          </div>
          {!canProceed[0] && <p className="text-xs text-slate-400">Create at least one academic year to continue.</p>}
        </div>
      )}

      {/* ── STEP 1: Terms ── */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-display font-semibold text-slate-900 mb-1">Terms</h3>
            <p className="text-xs text-slate-500 mb-4">Define your school terms within each academic year.</p>

            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <FormGrid cols={2}>
                <Input label="Term Name *" placeholder="Term 1" value={termForm.name} onChange={tf('name')} />
                <Select label="Academic Year *" value={termForm.academic_year_id} onChange={tf('academic_year_id')}>
                  <option value="">Select year…</option>
                  {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </Select>
              </FormGrid>
              <FormGrid cols={2}>
                <Input label="Start Date *" type="date" value={termForm.start_date} onChange={tf('start_date')} />
                <Input label="End Date *"   type="date" value={termForm.end_date}   onChange={tf('end_date')} />
              </FormGrid>
              <Select label="Set as Current?" value={termForm.is_current} onChange={tf('is_current')}>
                <option value="0">No</option>
                <option value="1">Yes — current term</option>
              </Select>
              <Button icon={Plus} loading={termSaving} onClick={saveTerm} size="sm">Add Term</Button>
            </div>
          </Card>

          {terms.length > 0 && (
            <Card noPad>
              <div className="p-4 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Created Terms ({terms.length})</p>
              </div>
              <div className="divide-y divide-slate-50">
                {terms.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <BookOpen size={14} className="text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-400">{t.start_date} → {t.end_date}</p>
                    </div>
                    {t.is_current ? <Badge variant="current">Current</Badge> : null}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
            <Button disabled={!canProceed[1]} onClick={() => setStep(2)} className="ml-auto">
              Next: Classes →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Classes & Streams ── */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-display font-semibold text-slate-900 mb-1">Classes & Streams</h3>
            <p className="text-xs text-slate-500 mb-4">Create classes (e.g. S1, S2, P3) and their streams (e.g. West, East).</p>

            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <FormGrid cols={3}>
                <Input label="Class Name *" placeholder="Senior 1" value={classForm.name} onChange={cf('name')} />
                <Input label="Class Code"   placeholder="S1"       value={classForm.code} onChange={cf('code')} />
                <Input label="Level / Order" type="number" placeholder="1" value={classForm.level} onChange={cf('level')} />
              </FormGrid>
              <Button icon={Plus} loading={classSaving} onClick={saveClass} size="sm">Add Class</Button>
            </div>
          </Card>

          {classes.length > 0 && (
            <div className="space-y-3">
              {classes.map(cls => (
                <Card key={cls.id} className="!p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                      <Users size={14} className="text-violet-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">{cls.name}</p>
                      {cls.code && <p className="text-xs text-slate-400">Code: {cls.code}</p>}
                    </div>
                    <Button size="xs" variant="secondary" icon={Plus} onClick={() => { setStreamModal(cls.id); setStreamForm({ name: '', code: '' }) }}>
                      Add Stream
                    </Button>
                  </div>
                  {cls.streams?.length > 0 && (
                    <div className="flex flex-wrap gap-2 ml-11">
                      {cls.streams.map(s => (
                        <span key={s.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 border border-violet-200 rounded-lg text-xs font-semibold text-violet-700">
                          {s.name}
                          {s.code && <span className="text-violet-400">({s.code})</span>}
                        </span>
                      ))}
                    </div>
                  )}
                  {!cls.streams?.length && (
                    <p className="text-xs text-slate-400 ml-11">No streams yet — streams are optional</p>
                  )}
                </Card>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
            <Button disabled={!canProceed[2]} onClick={() => navigate('/dashboard')} className="ml-auto" icon={Check}>
              Done — Go to Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* Stream modal */}
      <Modal open={!!streamModal} onClose={() => setStreamModal(null)} title={`Add Stream to ${classes.find(c => c.id === streamModal)?.name || 'Class'}`} width={420}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStreamModal(null)}>Cancel</Button>
            <Button className="flex-1" loading={streamSaving} onClick={saveStream}>Add Stream</Button>
          </div>
        }>
        <FormGrid cols={2}>
          <Input label="Stream Name *" placeholder="West" value={streamForm.name} onChange={sf('name')} />
          <Input label="Code" placeholder="W" value={streamForm.code} onChange={sf('code')} />
        </FormGrid>
      </Modal>
    </div>
  )
}
