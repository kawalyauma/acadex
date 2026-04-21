import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { examApi } from '../../services/api'
import {
  Card, Button, Badge, Table, Modal, Input, Select, SearchableSelect,
  SectionHeader, FormGrid, Spinner, EmptyState, ConfirmModal
} from '../../components/ui'
import { BookOpen, Plus, Edit2, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const EMPTY = { name: '', code: '', class_id: '', is_gradable: '1', max_mark: '100', passing_mark: '50', sort_order: '0' }

export default function Subjects() {
  const { token, schoolId }          = useAuthStore()
  const { classOptions }             = useDataStore()
  const [subjects, setSubjects]      = useState([])
  const [loading,  setLoading]       = useState(true)
  const [filterClass, setFilterClass]= useState('')
  const [modal,    setModal]         = useState(false)
  const [editItem, setEditItem]      = useState(null)
  const [delModal, setDelModal]      = useState(null)
  const [form,     setForm]          = useState(EMPTY)
  const [saving,   setSaving]        = useState(false)
  const [deleting, setDeleting]      = useState(false)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const data = await examApi.subjects(schoolId, filterClass ? { class_id: filterClass } : {}, token)
      setSubjects(Array.isArray(data) ? data : [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [schoolId, token, filterClass])

  useEffect(() => { load() }, [load])

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const openCreate = () => { setForm(EMPTY); setEditItem(null); setModal(true) }
  const openEdit   = (s)  => {
    setForm({ ...s, class_id: s.class_id || '', is_gradable: String(s.is_gradable),
              max_mark: String(s.max_mark), passing_mark: String(s.passing_mark), sort_order: String(s.sort_order) })
    setEditItem(s)
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Subject name is required')
    setSaving(true)
    const body = {
      name:         form.name,
      code:         form.code || null,
      class_id:     form.class_id ? parseInt(form.class_id) : null,
      is_gradable:  parseInt(form.is_gradable),
      max_mark:     parseFloat(form.max_mark)   || 100,
      passing_mark: parseFloat(form.passing_mark) || 50,
      sort_order:   parseInt(form.sort_order)   || 0,
    }
    try {
      if (editItem) {
        await examApi.updateSubject(schoolId, editItem.id, body, token)
        toast.success('Subject updated')
      } else {
        await examApi.createSubject(schoolId, body, token)
        toast.success('Subject created')
      }
      setModal(false)
      load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await examApi.deleteSubject(schoolId, delModal.id, token)
      toast.success('Subject deactivated')
      setDelModal(null)
      load()
    } catch (e) { toast.error(e.message) }
    finally { setDeleting(false) }
  }

  const classOpts = classOptions()

  const columns = [
    { key: 'name', label: 'Subject', render: (v, row) => (
      <div>
        <p className="text-sm font-semibold text-slate-900">{v}</p>
        {row.code && <p className="text-xs text-slate-400 font-mono">{row.code}</p>}
      </div>
    )},
    { key: 'class_name', label: 'Class', render: v => v || <Badge variant="blue">All Classes</Badge> },
    { key: 'is_gradable', label: 'Type', render: v => (
      <Badge variant={v ? 'approved' : 'default'}>{v ? 'Gradable' : 'Non-Gradable'}</Badge>
    )},
    { key: 'max_mark',     label: 'Max', align: 'center' },
    { key: 'passing_mark', label: 'Pass', align: 'center' },
    { key: 'sort_order',   label: 'Order', align: 'center' },
    { key: 'id', label: '', render: (_, row) => (
      <div className="flex gap-1.5">
        <Button size="xs" variant="ghost" icon={Edit2}  onClick={() => openEdit(row)} />
        <Button size="xs" variant="ghost" icon={Trash2}
          className="!text-red-400 hover:!bg-red-50" onClick={() => setDelModal(row)} />
      </div>
    )},
  ]

  return (
    <div className="page space-y-5">
      <SectionHeader title="Subjects" sub="Manage school subjects and their grading configuration"
        breadcrumb="Exams"
        actions={<Button icon={Plus} onClick={openCreate}>Add Subject</Button>} />

      <Card className="flex gap-3 items-end flex-wrap">
        <div className="w-56">
          <SearchableSelect options={[{ value: '', label: 'All classes' }, ...classOpts]}
            value={filterClass} onChange={v => setFilterClass(v)} placeholder="Filter by class…" />
        </div>
        <Button variant="secondary" size="sm" onClick={load}>Apply</Button>
      </Card>

      <Card noPad>
        {loading
          ? <div className="p-8 flex justify-center"><Spinner /></div>
          : <Table columns={columns} data={subjects}
              emptyState={<EmptyState icon={BookOpen} title="No subjects yet"
                subtitle="Add subjects that will appear on exam papers and report cards"
                action={<Button icon={Plus} onClick={openCreate}>Add Subject</Button>} />}
            />
        }
      </Card>

      {/* Create/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editItem ? 'Edit Subject' : 'Add Subject'} width={520}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleSave}>
              {editItem ? 'Save Changes' : 'Add Subject'}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <FormGrid cols={2}>
            <Input label="Subject Name *" placeholder="Mathematics" value={form.name} onChange={f('name')} autoFocus />
            <Input label="Code" placeholder="MTH" value={form.code} onChange={f('code')} />
          </FormGrid>
          <SearchableSelect label="Class (leave blank for all classes)"
            options={[{ value: '', label: 'All classes (school-wide)' }, ...classOpts]}
            value={form.class_id} onChange={v => setForm(p => ({ ...p, class_id: v }))}
            placeholder="All classes…" />
          <Select label="Type" value={form.is_gradable} onChange={f('is_gradable')}>
            <option value="1">Gradable — contributes to aggregate (D1–F9)</option>
            <option value="0">Non-Gradable — shown on report but no points (PE, Music, Art)</option>
          </Select>
          <FormGrid cols={3}>
            <Input label="Max Mark"     type="number" value={form.max_mark}     onChange={f('max_mark')} />
            <Input label="Passing Mark" type="number" value={form.passing_mark} onChange={f('passing_mark')} />
            <Input label="Sort Order"   type="number" value={form.sort_order}   onChange={f('sort_order')} />
          </FormGrid>
          {form.is_gradable === '0' && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <span className="shrink-0 mt-0.5">ℹ</span>
              Non-gradable subjects appear on the report card with marks but don't count towards the PLE aggregate.
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal open={!!delModal} onClose={() => setDelModal(null)} onConfirm={handleDelete}
        loading={deleting} title="Deactivate Subject"
        message={`Deactivate "${delModal?.name}"? It will be hidden from new exams but existing records are preserved.`}
        confirmLabel="Deactivate" />
    </div>
  )
}
