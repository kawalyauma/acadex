import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { teacherApi } from '../../services/api'
import {
  Card, Button, Badge, Modal, Input, Select, SearchableSelect,
  SectionHeader, Spinner, EmptyState, Avatar, Alert, Divider,
  ConfirmModal, Tabs, StatCard
} from '../../components/ui'
import {
  Users, Plus, Edit2, Eye, UserCheck, UserX,
  BookOpen, Phone, Mail, Calendar, Trash2, GraduationCap, Briefcase
} from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const EMP_TYPES = [
  { value:'permanent',  label:'Permanent' },
  { value:'contract',   label:'Contract' },
  { value:'part_time',  label:'Part-time' },
  { value:'volunteer',  label:'Volunteer' },
]

const GENDER_OPTS = [
  { value:'', label:'Not specified' },
  { value:'male', label:'Male' },
  { value:'female', label:'Female' },
  { value:'other', label:'Other' },
]

export default function TeachersPage() {
  const { token, schoolId } = useAuthStore()
  const navigate = useNavigate()

  const [teachers,  setTeachers]  = useState([])
  const [roles,     setRoles]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')

  // Create modal
  const [createModal, setCreateModal] = useState(false)
  const [form,        setForm]        = useState(defaultForm())
  const [saving,      setSaving]      = useState(false)

  // Detail / edit modal
  const [detailTeacher, setDetailTeacher] = useState(null)
  const [detailTab,     setDetailTab]     = useState('profile')
  const [editForm,      setEditForm]      = useState({})
  const [editSaving,    setEditSaving]    = useState(false)
  const [quals,         setQuals]         = useState([])
  const [qualForm,      setQualForm]      = useState({ qualification:'', institution:'', year_obtained:'', grade:'' })
  const [addingQual,    setAddingQual]    = useState(false)
  const [savingQual,    setSavingQual]    = useState(false)

  // Status confirm
  const [statusModal,   setStatusModal]   = useState(null)

  function defaultForm() {
    return {
      first_name:'', last_name:'', email:'', phone:'',
      employee_number:'', gender:'', employment_type:'permanent',
      role_id:'',
      join_date: new Date().toISOString().split('T')[0],
      department:'', specialization:'', bio:'',
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, roleData] = await Promise.all([
        teacherApi.list(schoolId, {}, token),
        teacherApi.roles(schoolId, token).catch(() => []),
      ])
      setTeachers(Array.isArray(data) ? data : [])
      setRoles(Array.isArray(roleData) ? roleData : [])
    } catch { setTeachers([]) }
    finally { setLoading(false) }
  }, [schoolId, token])

  useEffect(() => { load() }, [load])

  const f  = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const ef = k => e => setEditForm(p => ({ ...p, [k]: e.target.value }))
  const qf = k => e => setQualForm(p => ({ ...p, [k]: e.target.value }))

  // Create
  const handleCreate = async () => {
    if (!form.first_name || !form.last_name || !form.email) return toast.error('Name and email are required')
    if (!form.role_id) return toast.error('Please select a role')
    setSaving(true)
    try {
      await teacherApi.create(schoolId, form, token)
      toast.success('Teacher added')
      setCreateModal(false); setForm(defaultForm()); load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // Open detail
  const openDetail = async (t) => {
    setDetailTeacher(t)
    setDetailTab('profile')
    setEditForm({
      first_name: t.first_name, last_name: t.last_name, email: t.email,
      phone:            t.phone            || '',
      employee_number:  t.employee_number  || '',
      gender:           t.gender           || '',
      employment_type:  t.employment_type  || 'permanent',
      join_date:        t.join_date        || '',
      department:       t.department       || '',
      specialization:   t.specialization   || '',
      bio:              t.bio              || '',
    })
    // Load qualifications
    try {
      const q = await teacherApi.quals(schoolId, t.user_id, token)
      setQuals(Array.isArray(q) ? q : [])
    } catch { setQuals([]) }
  }

  // Save profile
  const saveProfile = async () => {
    setEditSaving(true)
    try {
      const updated = await teacherApi.update(schoolId, detailTeacher.user_id, editForm, token)
      toast.success('Profile saved')
      setDetailTeacher(updated)
      load()
    } catch (e) { toast.error(e.message) }
    finally { setEditSaving(false) }
  }

  // Add qualification
  const handleAddQual = async () => {
    if (!qualForm.qualification) return toast.error('Qualification name required')
    setSavingQual(true)
    try {
      await teacherApi.addQual(schoolId, detailTeacher.user_id, qualForm, token)
      toast.success('Qualification added')
      setQualForm({ qualification:'', institution:'', year_obtained:'', grade:'' })
      setAddingQual(false)
      const q = await teacherApi.quals(schoolId, detailTeacher.user_id, token)
      setQuals(Array.isArray(q) ? q : [])
    } catch (e) { toast.error(e.message) }
    finally { setSavingQual(false) }
  }

  const deleteQual = async (qualId) => {
    try {
      await teacherApi.delQual(schoolId, qualId, token)
      setQuals(p => p.filter(q => q.id !== qualId))
      toast.success('Removed')
    } catch (e) { toast.error(e.message) }
  }

  // Status toggle
  const handleStatusToggle = async () => {
    try {
      const newStatus = !statusModal.is_active
      await teacherApi.setStatus(schoolId, statusModal.user_id, { is_active: newStatus }, token)
      toast.success(newStatus ? 'Teacher activated' : 'Teacher deactivated')
      setStatusModal(null); load()
    } catch (e) { toast.error(e.message) }
  }

  const filtered = teachers.filter(t =>
    !search ||
    `${t.full_name} ${t.email} ${t.employee_number || ''} ${t.specialization || ''}`.toLowerCase().includes(search.toLowerCase())
  )
  const active   = teachers.filter(t => t.is_active !== 0).length
  const inactive = teachers.length - active

  const DETAIL_TABS = [
    { key:'profile',  label:'Profile' },
    { key:'quals',    label:'Qualifications' },
  ]

  return (
    <div className="page space-y-5">
      <SectionHeader
        title="Teacher Management"
        sub="Manage teacher profiles, qualifications and subject allocations"
        breadcrumb="Teachers"
        actions={<Button icon={Plus} onClick={() => setCreateModal(true)}>Add Teacher</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Teachers" value={teachers.length} color="#2563EB" />
        <StatCard label="Active"          value={active}          color="#059669" />
        <StatCard label="Inactive"        value={inactive}        color="#94A3B8" />
      </div>

      {/* Search */}
      <Card>
        <Input placeholder="Search by name, email, specialization…" value={search}
          onChange={e => setSearch(e.target.value)} wrapClass="max-w-md" />
      </Card>

      {/* Teacher grid */}
      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      {!loading && filtered.length === 0 && (
        <Card>
          <EmptyState icon={Users} title="No teachers found"
            subtitle="Add teachers to assign them subjects and classes"
            action={<Button icon={Plus} onClick={() => setCreateModal(true)}>Add Teacher</Button>} />
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <Card key={t.user_id} className="!p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Avatar name={t.full_name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-slate-900 text-sm truncate">{t.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{t.email}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={t.role_name === 'head_teacher' ? 'blue' : 'default'}>
                      {t.role_name || 'teacher'}
                    </Badge>
                    <Badge variant={t.is_active !== 0 ? 'approved' : 'inactive'}>
                      {t.is_active !== 0 ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              {t.specialization && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <BookOpen size={12} />
                  <span className="truncate">{t.specialization}</span>
                </div>
              )}
              {t.employee_number && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Briefcase size={11} />
                  <span>{t.employee_number}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1 border-t border-slate-100">
                <Button size="xs" variant="secondary" icon={Eye} className="flex-1"
                  onClick={() => openDetail(t)}>Profile</Button>
                <Button size="xs" variant="secondary" icon={t.is_active !== 0 ? UserX : UserCheck}
                  onClick={() => setStatusModal(t)}
                  className={clsx('shrink-0', t.is_active !== 0 ? 'hover:!text-red-500' : 'hover:!text-emerald-600')}>
                  {t.is_active !== 0 ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Modal ── */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Add Teacher" width={620}
        footer={<div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setCreateModal(false)}>Cancel</Button>
          <Button className="flex-1" loading={saving} onClick={handleCreate}>Add Teacher</Button>
        </div>}>
        <div className="space-y-4">
          <Alert type="info">If the email already exists in the system, the user account will be reused and assigned to this school.</Alert>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name *" value={form.first_name} onChange={f('first_name')} autoFocus />
            <Input label="Last Name *"  value={form.last_name}  onChange={f('last_name')}  />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email *" type="email" value={form.email} onChange={f('email')} />
            <Input label="Phone"               value={form.phone} onChange={f('phone')} placeholder="+256 7XX XXX XXX" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Employee Number"     value={form.employee_number} onChange={f('employee_number')} placeholder="TCH-001" />
            <Select label="Gender" value={form.gender} onChange={f('gender')}>
              {GENDER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Employment Type" value={form.employment_type} onChange={f('employment_type')}>
              {EMP_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Input label="Join Date" type="date" value={form.join_date} onChange={f('join_date')} />
          </div>
          <Input label="Department"     value={form.department}    onChange={f('department')}   placeholder="e.g. Sciences" />
          <Input label="Specialization" value={form.specialization} onChange={f('specialization')} placeholder="e.g. Mathematics, Physics" />
        </div>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal open={!!detailTeacher} onClose={() => setDetailTeacher(null)}
        title={detailTeacher ? `${detailTeacher.full_name || `${detailTeacher.first_name} ${detailTeacher.last_name}`}` : ''}
        width={680}
        footer={
          detailTab === 'profile' ? (
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDetailTeacher(null)}>Close</Button>
              <Button className="flex-1" loading={editSaving} onClick={saveProfile}>Save Changes</Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setDetailTeacher(null)}>Close</Button>
          )
        }>
        {detailTeacher && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Avatar name={`${detailTeacher.first_name} ${detailTeacher.last_name}`} size="lg" />
              <div>
                <p className="font-display font-bold text-slate-900">{detailTeacher.first_name} {detailTeacher.last_name}</p>
                <p className="text-sm text-slate-400">{detailTeacher.email}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="default">{detailTeacher.role_name || 'teacher'}</Badge>
                  <Badge variant={detailTeacher.is_active !== 0 ? 'approved' : 'inactive'}>
                    {detailTeacher.is_active !== 0 ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <Tabs tabs={DETAIL_TABS} active={detailTab} onChange={setDetailTab} />

            {/* Profile tab */}
            {detailTab === 'profile' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="First Name" value={editForm.first_name || ''} onChange={ef('first_name')} />
                  <Input label="Last Name"  value={editForm.last_name  || ''} onChange={ef('last_name')}  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Phone"           value={editForm.phone          || ''} onChange={ef('phone')} />
                  <Input label="Employee Number" value={editForm.employee_number|| ''} onChange={ef('employee_number')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Gender" value={editForm.gender || ''} onChange={ef('gender')}>
                    {GENDER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                  <Select label="Employment Type" value={editForm.employment_type || 'permanent'} onChange={ef('employment_type')}>
                    {EMP_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Department"    value={editForm.department    || ''} onChange={ef('department')} />
                  <Input label="Join Date" type="date" value={editForm.join_date || ''} onChange={ef('join_date')} />
                </div>
                <Input label="Specialization" value={editForm.specialization || ''} onChange={ef('specialization')} placeholder="e.g. Mathematics, Physics" />
                <div className="flex flex-col gap-1">
                  <label className="label">Bio / Notes</label>
                  <textarea value={editForm.bio || ''} onChange={ef('bio')} rows={3}
                    className="input-base resize-y" placeholder="Brief biography or notes about this teacher…" />
                </div>
              </div>
            )}

            {/* Qualifications tab */}
            {detailTab === 'quals' && (
              <div className="space-y-3">
                {quals.length === 0 && !addingQual && (
                  <EmptyState icon={GraduationCap} title="No qualifications recorded"
                    subtitle="Add academic qualifications for this teacher"
                    action={<Button size="sm" icon={Plus} onClick={() => setAddingQual(true)}>Add Qualification</Button>} />
                )}

                {quals.length > 0 && (
                  <div className="space-y-2">
                    {quals.map(q => (
                      <div key={q.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <GraduationCap size={16} className="text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{q.qualification}</p>
                          <p className="text-xs text-slate-400">
                            {q.institution || '—'}{q.year_obtained ? ` · ${q.year_obtained}` : ''}{q.grade ? ` · ${q.grade}` : ''}
                          </p>
                        </div>
                        <Button size="xs" variant="ghost" icon={Trash2}
                          className="!text-red-400 shrink-0"
                          onClick={() => deleteQual(q.id)} />
                      </div>
                    ))}
                  </div>
                )}

                {!addingQual && quals.length > 0 && (
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAddingQual(true)}>
                    Add Qualification
                  </Button>
                )}

                {addingQual && (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm font-semibold text-blue-800">New Qualification</p>
                    <Input label="Qualification *" value={qualForm.qualification} onChange={qf('qualification')} placeholder="e.g. Bachelor of Education" autoFocus />
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Institution" value={qualForm.institution} onChange={qf('institution')} placeholder="e.g. Makerere University" />
                      <Input label="Year Obtained" type="number" value={qualForm.year_obtained} onChange={qf('year_obtained')} placeholder="2015" />
                    </div>
                    <Input label="Grade / Result" value={qualForm.grade} onChange={qf('grade')} placeholder="e.g. First Class Honours" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setAddingQual(false)}>Cancel</Button>
                      <Button size="sm" loading={savingQual} onClick={handleAddQual}>Save</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Status toggle confirm */}
      <ConfirmModal
        open={!!statusModal}
        onClose={() => setStatusModal(null)}
        onConfirm={handleStatusToggle}
        title={statusModal?.is_active !== 0 ? 'Deactivate Teacher' : 'Activate Teacher'}
        message={statusModal?.is_active !== 0
          ? `Deactivate ${statusModal?.full_name}? They will not appear in allocation dropdowns.`
          : `Re-activate ${statusModal?.full_name}?`}
        confirmLabel={statusModal?.is_active !== 0 ? 'Deactivate' : 'Activate'}
      />
    </div>
  )
}
