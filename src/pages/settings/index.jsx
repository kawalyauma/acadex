import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/auth'
import { api } from '../../services/api'
import { Card, Button, Input, Select, SectionHeader, Alert, Spinner, Divider } from '../../components/ui'
import { Settings as Gear, Save, Info } from 'lucide-react'
import toast from 'react-hot-toast'

const DEFAULTS = { name: 'Default Policy', late_grace_minutes: 15, half_day_threshold_minutes: 180, absence_alert_threshold: 3, chronic_absence_percent: 20, allow_self_correction: 0, correction_window_hours: 24 }

function PolicyRow({ label, help, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-slate-100 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {help && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{help}</p>}
      </div>
      <div className="shrink-0 w-44">{children}</div>
    </div>
  )
}

export default function Settings() {
  const { token, schoolId, user, school } = useAuthStore()
  const [policy, setPolicy]   = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (!schoolId) { setLoading(false); return }
    api.policy(schoolId, token).then(p => { if (p) setPolicy(p) }).catch(() => {}).finally(() => setLoading(false))
  }, [schoolId, token])

  const s = (k, v) => setPolicy(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try { await api.upsertPolicy(schoolId, policy, token); toast.success('Policy saved') }
    catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner /></div>

  return (
    <div className="page space-y-5">
      <SectionHeader title="Settings" sub="Configure platform preferences and attendance policies" breadcrumb="System" />

      {/* Account */}
      <Card>
        <p className="font-display font-semibold text-slate-900 text-sm mb-4">Account</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: 'Name',          v: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—' },
            { l: 'Email',         v: user?.email || '—' },
            { l: 'Active School', v: school?.name || 'None selected' },
            { l: 'School ID',     v: schoolId ? `#${schoolId}` : '—' },
          ].map(r => (
            <div key={r.l} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{r.l}</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{r.v}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Policy */}
      {!schoolId ? (
        <Alert type="warning">Select a school first to configure its attendance policy.</Alert>
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <Gear size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="font-display font-semibold text-slate-900 text-sm">Attendance Policy</p>
                <p className="text-xs text-slate-400">Late thresholds, chronic absence rules, correction permissions</p>
              </div>
            </div>
            <Button icon={Save} loading={saving} onClick={handleSave} size="sm">Save Policy</Button>
          </div>

          <Divider label="Timing" />
          <PolicyRow label="Policy Name" help="A label for this configuration">
            <input value={policy.name} onChange={e => s('name', e.target.value)} className="input-base text-sm" />
          </PolicyRow>
          <PolicyRow label="Late Grace Period" help="Minutes allowed after session open before marking late">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={60} value={policy.late_grace_minutes} onChange={e => s('late_grace_minutes', parseInt(e.target.value))} className="input-base text-sm w-20" />
              <span className="text-xs text-slate-400 whitespace-nowrap">minutes</span>
            </div>
          </PolicyRow>
          <PolicyRow label="Half-Day Threshold" help="Minimum minutes present to count as half-day">
            <div className="flex items-center gap-2">
              <input type="number" min={30} max={480} value={policy.half_day_threshold_minutes} onChange={e => s('half_day_threshold_minutes', parseInt(e.target.value))} className="input-base text-sm w-20" />
              <span className="text-xs text-slate-400 whitespace-nowrap">minutes</span>
            </div>
          </PolicyRow>

          <Divider label="Alert Thresholds" />
          <PolicyRow label="Consecutive Absence Alert" help="Days before an absence flag is created">
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={30} value={policy.absence_alert_threshold} onChange={e => s('absence_alert_threshold', parseInt(e.target.value))} className="input-base text-sm w-20" />
              <span className="text-xs text-slate-400">days</span>
            </div>
          </PolicyRow>
          <PolicyRow label="Chronic Absence Threshold" help="Percentage of absences for chronic classification">
            <div className="flex items-center gap-2">
              <input type="number" min={5} max={100} value={policy.chronic_absence_percent} onChange={e => s('chronic_absence_percent', parseFloat(e.target.value))} className="input-base text-sm w-20" />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </PolicyRow>

          <Divider label="Corrections" />
          <PolicyRow label="Teacher Self-Correction" help="Whether teachers can edit their own records without approval">
            <Select value={String(policy.allow_self_correction)} onChange={e => s('allow_self_correction', parseInt(e.target.value))}>
              <option value="0">No — require admin approval</option>
              <option value="1">Yes — self-correct allowed</option>
            </Select>
          </PolicyRow>
          <PolicyRow label="Correction Window" help="Hours after session close during which corrections can be submitted">
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={168} value={policy.correction_window_hours} onChange={e => s('correction_window_hours', parseInt(e.target.value))} className="input-base text-sm w-20" />
              <span className="text-xs text-slate-400">hours</span>
            </div>
          </PolicyRow>
        </Card>
      )}

      {/* About */}
      <Card>
        <div className="flex gap-4">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Info size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="font-display font-semibold text-slate-900 text-sm mb-1">AcadEx — Academic Suite v1.0</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Progressive Web App · Works offline · Vite + React + Tailwind CSS<br />
              Backend: Cloudflare Workers + D1 SQLite · Designed for schools across East Africa.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
