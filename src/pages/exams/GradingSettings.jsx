import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { examApi } from '../../services/api'
import {
  Card, Button, Modal, Input, Select, SectionHeader,
  Spinner, EmptyState, Alert, Divider, Tabs, FormGrid, ConfirmModal, Badge
} from '../../components/ui'
import { Star, MessageSquare, Plus, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'grading',  label: 'Grading Scale',  icon: Star },
  { key: 'comments', label: 'Comment Rules',  icon: MessageSquare },
]

// ── Grading Scale Tab ────────────────────────────────────────
function GradingScaleTab() {
  const { token, schoolId } = useAuthStore()
  const [scales,   setScales]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [seeding,  setSeeding]  = useState(false)
  // Edit band modal
  const [bandModal,setBandModal]= useState(null)   // band object
  const [bandForm, setBandForm] = useState({})
  const [savingBand, setSavingBand] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const data = await examApi.gradingScales(schoolId, token)
      setScales(Array.isArray(data) ? data : [])
    } catch { setScales([]) }
    finally { setLoading(false) }
  }, [schoolId, token])

  useEffect(() => { load() }, [load])

  const handleSeedPLE = async () => {
    setSeeding(true)
    try {
      await examApi.seedPLE(schoolId, token)
      toast.success('Uganda PLE grading scale created')
      load()
    } catch (e) { toast.error(e.message) }
    finally { setSeeding(false) }
  }

  const openEditBand = (band) => {
    setBandForm({
      grade:      band.grade,
      label:      band.label,
      min_mark:   String(band.min_mark),
      max_mark:   String(band.max_mark),
      points:     String(band.points),
      color_hex:  band.color_hex || '#64748B',
      sort_order: String(band.sort_order),
    })
    setBandModal(band)
  }

  const saveBand = async () => {
    if (!bandModal) return
    setSavingBand(true)
    try {
      await examApi.updateBand(schoolId, bandModal.id, {
        grade:      bandForm.grade,
        label:      bandForm.label,
        min_mark:   parseFloat(bandForm.min_mark),
        max_mark:   parseFloat(bandForm.max_mark),
        points:     parseInt(bandForm.points),
        color_hex:  bandForm.color_hex,
        sort_order: parseInt(bandForm.sort_order),
      }, token)
      toast.success('Grade band updated')
      setBandModal(null)
      load()
    } catch (e) { toast.error(e.message) }
    finally { setSavingBand(false) }
  }

  const bf = k => e => setBandForm(p => ({ ...p, [k]: e.target.value }))
  const defaultScale = scales.find(s => s.is_default)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
          The Uganda PLE grading scale uses 9 grade points. Lower aggregate = better.
          Click any grade band to edit its thresholds, points, or label.
        </p>
        {!defaultScale && (
          <Button icon={Plus} loading={seeding} onClick={handleSeedPLE}>
            Seed Uganda PLE Scale
          </Button>
        )}
      </div>

      {loading
        ? <div className="flex justify-center py-8"><Spinner /></div>
        : scales.length === 0
          ? <Card><EmptyState icon={Star} title="No grading scale yet"
              subtitle='Click "Seed Uganda PLE Scale" to add the standard D1–F9 system'
              action={<Button icon={Plus} loading={seeding} onClick={handleSeedPLE}>Seed Uganda PLE Scale</Button>} /></Card>
          : scales.map(scale => (
            <Card key={scale.id}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Star size={15} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-display font-semibold text-slate-900 text-sm">{scale.name}</p>
                  {scale.is_default && <Badge variant="approved">Default</Badge>}
                </div>
              </div>

              {/* Band grid — each card is clickable to edit */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {(scale.bands || []).map(b => (
                  <button key={b.id}
                    onClick={() => openEditBand(b)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-slate-300 hover:bg-white transition-all group text-left w-full">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-display font-bold text-sm"
                      style={{ background: b.color_hex + '20', color: b.color_hex }}>
                      {b.grade}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700">{b.label}</p>
                      <p className="text-[10px] text-slate-400">{b.min_mark}%–{b.max_mark}% · {b.points} pt{b.points !== 1 ? 's' : ''}</p>
                    </div>
                    <Edit2 size={12} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>

              <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-700 font-semibold mb-1">How aggregates work</p>
                <p className="text-xs text-blue-600 leading-relaxed">
                  Aggregate = sum of grade points across all <strong>gradable</strong> subjects.
                  Example: D1+D2+C3+C4 = 1+2+3+4 = <strong>10 aggregate</strong>. Lower is better.
                </p>
              </div>
            </Card>
          ))
      }

      {/* Edit Band Modal */}
      <Modal open={!!bandModal} onClose={() => setBandModal(null)}
        title={`Edit Grade Band — ${bandModal?.grade}`} width={480}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setBandModal(null)}>Cancel</Button>
            <Button className="flex-1" loading={savingBand} onClick={saveBand}>Save Changes</Button>
          </div>
        }>
        {bandModal && (
          <div className="space-y-4">
            <FormGrid cols={2}>
              <Input label="Grade Symbol *" placeholder="D1" value={bandForm.grade} onChange={bf('grade')} />
              <Input label="Label *" placeholder="Distinction" value={bandForm.label} onChange={bf('label')} />
            </FormGrid>
            <FormGrid cols={2}>
              <Input label="Min Mark (%)" type="number" min={0} max={100} value={bandForm.min_mark} onChange={bf('min_mark')} />
              <Input label="Max Mark (%)" type="number" min={0} max={100} value={bandForm.max_mark} onChange={bf('max_mark')} />
            </FormGrid>
            <FormGrid cols={2}>
              <Input label="Grade Points" type="number" min={1} max={20}
                value={bandForm.points} onChange={bf('points')}
                helperText="Lower points = better grade (PLE: D1=1, F9=9)" />
              <Input label="Sort Order" type="number" value={bandForm.sort_order} onChange={bf('sort_order')} />
            </FormGrid>
            <div className="flex flex-col gap-1.5">
              <label className="label">Badge Colour</label>
              <div className="flex items-center gap-3">
                <input type="color" value={bandForm.color_hex} onChange={bf('color_hex')}
                  className="w-12 h-9 rounded-lg border border-slate-200 cursor-pointer p-1" />
                <Input value={bandForm.color_hex} onChange={bf('color_hex')} placeholder="#059669" wrapClass="flex-1" />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ background: bandForm.color_hex + '25', color: bandForm.color_hex }}>
                  {bandForm.grade}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Comments Tab ──────────────────────────────────────────────
function CommentsTab() {
  const { token, schoolId } = useAuthStore()
  const [rules,    setRules]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [seeding,  setSeeding]  = useState(false)
  const [modal,    setModal]    = useState(false)
  const [editRule, setEditRule] = useState(null)
  const [delModal, setDelModal] = useState(null)
  const [form,     setForm]     = useState({ comment_type: 'class_teacher', min_agg: '', max_agg: '', comment_text: '' })
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try { setRules(await examApi.commentRules(schoolId, null, token).then(d => Array.isArray(d) ? d : [])) }
    catch { setRules([]) }
    finally { setLoading(false) }
  }, [schoolId, token])

  useEffect(() => { load() }, [load])

  const handleSeedDefaults = async () => {
    setSeeding(true)
    try { await examApi.seedComments(schoolId, token); toast.success('Default comments seeded'); load() }
    catch (e) { toast.error(e.message) }
    finally { setSeeding(false) }
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const openCreate = () => {
    setForm({ comment_type: 'class_teacher', min_agg: '', max_agg: '', comment_text: '' })
    setEditRule(null); setModal(true)
  }
  const openEdit = (r) => {
    setForm({ comment_type: r.comment_type, min_agg: String(r.min_agg), max_agg: String(r.max_agg), comment_text: r.comment_text })
    setEditRule(r); setModal(true)
  }

  const handleSave = async () => {
    if (!form.min_agg || !form.max_agg || !form.comment_text.trim()) return toast.error('All fields required')
    setSaving(true)
    try {
      await examApi.upsertComment(schoolId, {
        id: editRule?.id, ...form,
        min_agg: parseInt(form.min_agg), max_agg: parseInt(form.max_agg),
      }, token)
      toast.success(editRule ? 'Comment updated' : 'Rule added')
      setModal(false); load()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await examApi.deleteComment(schoolId, delModal.id, token); toast.success('Rule deleted'); setDelModal(null); load() }
    catch (e) { toast.error(e.message) }
    finally { setDeleting(false) }
  }

  const ct = rules.filter(r => r.comment_type === 'class_teacher').sort((a,b) => a.min_agg - b.min_agg)
  const ht = rules.filter(r => r.comment_type === 'head_teacher').sort((a,b)  => a.min_agg - b.min_agg)

  const RuleList = ({ items, label }) => (
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{label}</p>
      {items.length === 0
        ? <p className="text-xs text-slate-400 italic">No rules. Add one above.</p>
        : <div className="space-y-2">
            {items.map(r => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="shrink-0 px-2 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 whitespace-nowrap">
                  {r.min_agg}–{r.max_agg}
                </span>
                <p className="text-xs text-slate-700 leading-relaxed flex-1">{r.comment_text}</p>
                <div className="flex gap-1 shrink-0">
                  <Button size="xs" variant="ghost" icon={Edit2}  onClick={() => openEdit(r)} />
                  <Button size="xs" variant="ghost" icon={Trash2}
                    className="!text-red-400 hover:!bg-red-50" onClick={() => setDelModal(r)} />
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-slate-600 max-w-xl leading-relaxed">
          When report cards are computed, comments are auto-assigned based on the student's aggregate.
          You can override them per student on the report cards page.
        </p>
        <div className="flex gap-2 shrink-0">
          {rules.length === 0 && <Button variant="secondary" loading={seeding} onClick={handleSeedDefaults}>Seed PLE Defaults</Button>}
          <Button icon={Plus} onClick={openCreate}>Add Rule</Button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-8"><Spinner /></div>
      : rules.length === 0
        ? <Card><EmptyState icon={MessageSquare} title="No comment rules"
            subtitle="Seed Uganda PLE defaults or add your own"
            action={<Button loading={seeding} onClick={handleSeedDefaults}>Seed PLE Defaults</Button>} /></Card>
        : <Card className="space-y-6">
            <RuleList items={ct} label="Class Teacher Comments" />
            <Divider />
            <RuleList items={ht} label="Head Teacher Comments" />
          </Card>
      }

      <Modal open={modal} onClose={() => setModal(false)}
        title={editRule ? 'Edit Comment Rule' : 'Add Comment Rule'} width={520}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleSave}>
              {editRule ? 'Save Changes' : 'Add Rule'}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Select label="Comment Type" value={form.comment_type} onChange={f('comment_type')}>
            <option value="class_teacher">Class Teacher</option>
            <option value="head_teacher">Head Teacher</option>
          </Select>
          <FormGrid cols={2}>
            <Input label="Min Aggregate *" type="number" min={1} max={99} placeholder="4"  value={form.min_agg} onChange={f('min_agg')} />
            <Input label="Max Aggregate *" type="number" min={1} max={99} placeholder="8"  value={form.max_agg} onChange={f('max_agg')} />
          </FormGrid>
          <div className="flex flex-col gap-1.5">
            <label className="label">Comment Text *</label>
            <textarea value={form.comment_text} onChange={f('comment_text')} rows={3}
              className="input-base resize-y" placeholder="Excellent performance! This student has demonstrated…" />
          </div>
          <Alert type="info">
            Auto-assigned to students with aggregate between <strong>{form.min_agg||'?'}</strong> and <strong>{form.max_agg||'?'}</strong>.
          </Alert>
        </div>
      </Modal>

      <ConfirmModal open={!!delModal} onClose={() => setDelModal(null)} onConfirm={handleDelete}
        loading={deleting} title="Delete Comment Rule"
        message="Delete this rule? Existing report cards keep their comments until re-computed."
        confirmLabel="Delete Rule" />
    </div>
  )
}

export default function GradingSettings() {
  const [tab, setTab] = useState('grading')
  const COMP = { grading: GradingScaleTab, comments: CommentsTab }
  const Comp = COMP[tab]
  return (
    <div className="page space-y-5">
      <SectionHeader title="Grading & Comments" sub="Uganda PLE scale and auto-comment configuration" breadcrumb="Exams" />
      <Card className="!p-3"><Tabs tabs={TABS} active={tab} onChange={setTab} /></Card>
      <Comp />
    </div>
  )
}
