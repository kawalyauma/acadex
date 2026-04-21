import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/auth'
import { useDataStore } from '../../store/data'
import { curriculumApi } from '../../services/api'
import {
  Card, Button, Badge, Modal, Input, Select, SearchableSelect,
  SectionHeader, Spinner, EmptyState, ConfirmModal, Alert, Divider
} from '../../components/ui'
import { BookMarked, Plus, Edit2, Trash2, ChevronRight, ChevronDown, BookOpen, List } from 'lucide-react'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

export default function SubjectsPage() {
  const { token, schoolId } = useAuthStore()
  const { classOptions, termOptions, currentTerm } = useDataStore()

  const [selClass,  setSelClass]  = useState('')
  const [selTerm,   setSelTerm]   = useState('')
  const [subjects,  setSubjects]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [expanded,  setExpanded]  = useState({}) // subjectId → { topics: [], open }
  const [topicExpanded, setTopicExpanded] = useState({}) // topicId → open

  // Modals
  const [subjModal,    setSubjModal]    = useState(false)
  const [topicModal,   setTopicModal]   = useState(null) // subject
  const [subtopicModal,setSubtopicModal]= useState(null) // topic
  const [editModal,    setEditModal]    = useState(null)  // { type, item }
  const [delModal,     setDelModal]     = useState(null)
  const [form,         setForm]         = useState({})
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(false)

  useEffect(() => {
    const t = currentTerm(); if (t) setSelTerm(String(t.id))
  }, [])

  const loadSubjects = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const p = {}
      if (selClass) p.class_id = selClass
      if (selTerm)  p.term_id  = selTerm
      const data = await curriculumApi.subjects(schoolId, p, token)
      setSubjects(Array.isArray(data) ? data : [])
      setExpanded({})
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [schoolId, token, selClass, selTerm])

  useEffect(() => { loadSubjects() }, [loadSubjects])

  const toggleSubject = async (subj) => {
    const id = subj.id
    if (expanded[id]) {
      setExpanded(p => ({ ...p, [id]: { ...p[id], open: !p[id].open } }))
      return
    }
    try {
      const topics = await curriculumApi.topics(schoolId, id, token)
      setExpanded(p => ({ ...p, [id]: { topics: Array.isArray(topics) ? topics : [], open: true } }))
    } catch { setExpanded(p => ({ ...p, [id]: { topics: [], open: true } })) }
  }

  const toggleTopic = async (topic) => {
    const id = topic.id
    if (topicExpanded[id]) {
      setTopicExpanded(p => ({ ...p, [id]: { ...p[id], open: !p[id].open } }))
      return
    }
    try {
      const subs = await curriculumApi.subtopics(schoolId, id, token)
      setTopicExpanded(p => ({ ...p, [id]: { subtopics: Array.isArray(subs) ? subs : [], open: true } }))
    } catch { setTopicExpanded(p => ({ ...p, [id]: { subtopics: [], open: true } })) }
  }

  const refreshTopics = async (subjectId) => {
    const topics = await curriculumApi.topics(schoolId, subjectId, token).catch(() => [])
    setExpanded(p => ({ ...p, [subjectId]: { ...p[subjectId], topics: Array.isArray(topics) ? topics : [] } }))
  }

  const refreshSubtopics = async (topicId) => {
    const subs = await curriculumApi.subtopics(schoolId, topicId, token).catch(() => [])
    setTopicExpanded(p => ({ ...p, [topicId]: { ...p[topicId], subtopics: Array.isArray(subs) ? subs : [] } }))
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  // Save subject
  const saveSubject = async () => {
    if (!form.name?.trim()) return toast.error('Subject name required')
    setSaving(true)
    try {
      const body = { name: form.name, code: form.code, description: form.description,
        class_id: selClass ? parseInt(selClass) : undefined,
        term_id:  selTerm  ? parseInt(selTerm)  : undefined }
      if (editModal?.type === 'subject') {
        await curriculumApi.updateSubject(schoolId, editModal.item.id, body, token)
        toast.success('Subject updated')
        setEditModal(null)
      } else {
        await curriculumApi.createSubject(schoolId, body, token)
        toast.success('Subject created')
        setSubjModal(false)
      }
      loadSubjects()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // Save topic
  const saveTopic = async () => {
    if (!form.name?.trim()) return toast.error('Topic name required')
    setSaving(true)
    try {
      const body = { name: form.name, description: form.description, sort_order: parseInt(form.sort_order || 0) }
      if (editModal?.type === 'topic') {
        await curriculumApi.updateTopic(schoolId, editModal.item.id, body, token)
        toast.success('Topic updated')
        refreshTopics(editModal.item.subject_id)
        setEditModal(null)
      } else {
        await curriculumApi.createTopic(schoolId, topicModal.id, body, token)
        toast.success('Topic added')
        refreshTopics(topicModal.id)
        setTopicModal(null)
      }
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // Save subtopic
  const saveSubtopic = async () => {
    if (!form.name?.trim()) return toast.error('Subtopic name required')
    setSaving(true)
    try {
      const body = { name: form.name, description: form.description, sort_order: parseInt(form.sort_order || 0) }
      if (editModal?.type === 'subtopic') {
        await curriculumApi.updateSubtopic(schoolId, editModal.item.id, body, token)
        toast.success('Subtopic updated')
        refreshSubtopics(editModal.item.topic_id)
        setEditModal(null)
      } else {
        await curriculumApi.createSubtopic(schoolId, subtopicModal.id, body, token)
        toast.success('Subtopic added')
        refreshSubtopics(subtopicModal.id)
        setSubtopicModal(null)
      }
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      if (delModal.type === 'subject') await curriculumApi.deleteSubject(schoolId, delModal.item.id, token)
      if (delModal.type === 'topic')   await curriculumApi.deleteTopic(schoolId, delModal.item.id, token)
      if (delModal.type === 'subtopic')await curriculumApi.deleteSubtopic(schoolId, delModal.item.id, token)
      toast.success(`${delModal.type} deleted`)
      if (delModal.type === 'subject') loadSubjects()
      if (delModal.type === 'topic')   refreshTopics(delModal.item.subject_id)
      if (delModal.type === 'subtopic')refreshSubtopics(delModal.item.topic_id)
      setDelModal(null)
    } catch (e) { toast.error(e.message) }
    finally { setDeleting(false) }
  }

  const classOpts = classOptions()
  const termOpts  = termOptions()

  return (
    <div className="page space-y-5">
      <SectionHeader title="Subjects & Curriculum" sub="Manage subjects, topics and subtopics"
        breadcrumb="Curriculum"
        actions={
          <Button icon={Plus} onClick={() => { setForm({ name:'', code:'', description:'' }); setSubjModal(true) }}>
            Add Subject
          </Button>
        } />

      {/* Filters */}
      <Card className="flex gap-3 flex-wrap items-end">
        <div className="w-52">
          <SearchableSelect label="Class" options={[{ value:'', label:'All classes' }, ...classOpts]}
            value={selClass} onChange={v => setSelClass(v)} placeholder="All classes…" />
        </div>
        <div className="w-44">
          <SearchableSelect label="Term" options={[{ value:'', label:'All terms' }, ...termOpts]}
            value={selTerm} onChange={v => setSelTerm(v)} placeholder="All terms…" />
        </div>
      </Card>

      {loading && <div className="flex justify-center py-10"><Spinner /></div>}

      {/* Subject tree */}
      {!loading && subjects.length === 0 && (
        <Card>
          <EmptyState icon={BookMarked} title="No subjects yet"
            subtitle="Add subjects, then topics and subtopics to build the curriculum"
            action={<Button icon={Plus} onClick={() => { setForm({ name:'', code:'', description:'' }); setSubjModal(true) }}>Add Subject</Button>} />
        </Card>
      )}

      {!loading && subjects.map(subj => {
        const exp = expanded[subj.id]
        return (
          <Card key={subj.id} noPad>
            {/* Subject row */}
            <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
              onClick={() => toggleSubject(subj)}>
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <BookMarked size={15} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-slate-900 text-sm">{subj.name}</p>
                <p className="text-xs text-slate-400">{subj.code && `${subj.code} · `}{subj.class_name || ''}{subj.description && ` · ${subj.description}`}</p>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Button size="xs" variant="secondary" icon={Plus}
                  onClick={() => { setForm({ name:'', description:'', sort_order:'0' }); setTopicModal(subj) }}>
                  Add Topic
                </Button>
                <Button size="xs" variant="ghost" icon={Edit2}
                  onClick={() => { setForm({ name: subj.name, code: subj.code||'', description: subj.description||'' }); setEditModal({ type:'subject', item:subj }) }} />
                <Button size="xs" variant="ghost" icon={Trash2} className="!text-red-400 hover:!bg-red-50"
                  onClick={() => setDelModal({ type:'subject', item:subj })} />
              </div>
              {exp?.open ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
            </div>

            {/* Topics */}
            {exp?.open && (
              <div className="border-t border-slate-100">
                {exp.topics.length === 0 ? (
                  <p className="text-xs text-slate-400 px-14 py-3 italic">No topics yet — click "Add Topic" above.</p>
                ) : exp.topics.map(topic => {
                  const te = topicExpanded[topic.id]
                  return (
                    <div key={topic.id}>
                      <div className="flex items-center gap-3 px-14 py-3 cursor-pointer hover:bg-slate-50/60 transition-colors border-b border-slate-50"
                        onClick={() => toggleTopic(topic)}>
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                          <BookOpen size={11} className="text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{topic.name}</p>
                          {topic.description && <p className="text-xs text-slate-400">{topic.description}</p>}
                        </div>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Button size="xs" variant="secondary" icon={Plus}
                            onClick={() => { setForm({ name:'', description:'', sort_order:'0' }); setSubtopicModal({ ...topic, subject_id: subj.id }) }}>
                            Subtopic
                          </Button>
                          <Button size="xs" variant="ghost" icon={Edit2}
                            onClick={() => { setForm({ name: topic.name, description: topic.description||'', sort_order: String(topic.sort_order||0) }); setEditModal({ type:'topic', item:{ ...topic, subject_id: subj.id } }) }} />
                          <Button size="xs" variant="ghost" icon={Trash2} className="!text-red-400 hover:!bg-red-50"
                            onClick={() => setDelModal({ type:'topic', item:{ ...topic, subject_id: subj.id } })} />
                        </div>
                        {te?.open ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                      </div>

                      {/* Subtopics */}
                      {te?.open && (
                        <div className="border-b border-slate-50">
                          {te.subtopics.length === 0 ? (
                            <p className="text-xs text-slate-400 px-24 py-2 italic">No subtopics yet.</p>
                          ) : te.subtopics.map(sub => (
                            <div key={sub.id} className="flex items-center gap-3 px-24 py-2.5 hover:bg-slate-50/60 transition-colors border-b border-slate-50 last:border-0">
                              <div className="w-4 h-4 rounded bg-violet-100 flex items-center justify-center shrink-0">
                                <List size={9} className="text-violet-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-700">{sub.name}</p>
                                {sub.description && <p className="text-[10px] text-slate-400">{sub.description}</p>}
                              </div>
                              <div className="flex gap-1">
                                <Button size="xs" variant="ghost" icon={Edit2}
                                  onClick={() => { setForm({ name: sub.name, description: sub.description||'', sort_order: String(sub.sort_order||0) }); setEditModal({ type:'subtopic', item:{ ...sub, topic_id: topic.id } }) }} />
                                <Button size="xs" variant="ghost" icon={Trash2} className="!text-red-400 hover:!bg-red-50"
                                  onClick={() => setDelModal({ type:'subtopic', item:{ ...sub, topic_id: topic.id } })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )
      })}

      {/* Subject modal */}
      <Modal open={subjModal || editModal?.type === 'subject'}
        onClose={() => { setSubjModal(false); setEditModal(null) }}
        title={editModal?.type === 'subject' ? 'Edit Subject' : 'Add Subject'} width={480}
        footer={<div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => { setSubjModal(false); setEditModal(null) }}>Cancel</Button><Button className="flex-1" loading={saving} onClick={saveSubject}>{editModal?.type === 'subject' ? 'Save' : 'Add Subject'}</Button></div>}>
        <div className="space-y-3">
          <Input label="Subject Name *" placeholder="Mathematics" value={form.name || ''} onChange={f('name')} autoFocus />
          <Input label="Subject Code"   placeholder="MTH"         value={form.code || ''} onChange={f('code')} />
          <div className="flex flex-col gap-1"><label className="label">Description</label>
            <textarea value={form.description || ''} onChange={f('description')} rows={2} className="input-base resize-none" placeholder="Brief description…" /></div>
        </div>
      </Modal>

      {/* Topic modal */}
      <Modal open={!!topicModal || editModal?.type === 'topic'}
        onClose={() => { setTopicModal(null); setEditModal(null) }}
        title={editModal?.type === 'topic' ? 'Edit Topic' : `Add Topic — ${topicModal?.name || ''}`} width={480}
        footer={<div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => { setTopicModal(null); setEditModal(null) }}>Cancel</Button><Button className="flex-1" loading={saving} onClick={saveTopic}>{editModal?.type === 'topic' ? 'Save' : 'Add Topic'}</Button></div>}>
        <div className="space-y-3">
          <Input label="Topic Name *" placeholder="e.g. Fractions and Decimals" value={form.name || ''} onChange={f('name')} autoFocus />
          <div className="flex flex-col gap-1"><label className="label">Description</label>
            <textarea value={form.description || ''} onChange={f('description')} rows={2} className="input-base resize-none" /></div>
          <Input label="Sort Order" type="number" value={form.sort_order || '0'} onChange={f('sort_order')} />
        </div>
      </Modal>

      {/* Subtopic modal */}
      <Modal open={!!subtopicModal || editModal?.type === 'subtopic'}
        onClose={() => { setSubtopicModal(null); setEditModal(null) }}
        title={editModal?.type === 'subtopic' ? 'Edit Subtopic' : `Add Subtopic — ${subtopicModal?.name || ''}`} width={480}
        footer={<div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => { setSubtopicModal(null); setEditModal(null) }}>Cancel</Button><Button className="flex-1" loading={saving} onClick={saveSubtopic}>{editModal?.type === 'subtopic' ? 'Save' : 'Add Subtopic'}</Button></div>}>
        <div className="space-y-3">
          <Input label="Subtopic Name *" placeholder="e.g. Adding Fractions" value={form.name || ''} onChange={f('name')} autoFocus />
          <div className="flex flex-col gap-1"><label className="label">Description</label>
            <textarea value={form.description || ''} onChange={f('description')} rows={2} className="input-base resize-none" /></div>
          <Input label="Sort Order" type="number" value={form.sort_order || '0'} onChange={f('sort_order')} />
        </div>
      </Modal>

      <ConfirmModal open={!!delModal} onClose={() => setDelModal(null)} onConfirm={handleDelete}
        loading={deleting} title={`Delete ${delModal?.type}`}
        message={`Delete "${delModal?.item?.name}"? This action cannot be undone.`}
        confirmLabel="Delete" />
    </div>
  )
}
