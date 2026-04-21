import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { api } from '../../services/api'
import { Button, Input, FormGrid, Alert, Spinner } from '../../components/ui'
import { Building2, Plus, ArrowRight, GraduationCap, Check } from 'lucide-react'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────
// CRITICAL: After login, user.schools[] in the JWT token
// contains EXACTLY the schools this user has access to.
// We NEVER call GET /api/schools (superadmin only).
// Each school entry shape: { schoolId, schoolName, roleId, roleName, permissions[] }
// ─────────────────────────────────────────────────────────

export default function Onboarding() {
  const { token, user, setSchool } = useAuthStore()
  const navigate = useNavigate()
  const [mode, setMode]     = useState('list')   // 'list' | 'create'
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [form, setForm]     = useState({ name: '', code: '', email: '', phone: '', address: '' })

  // ── Schools come from the JWT token directly ──────────
  // user.schools = [{ schoolId, schoolName, roleName, ... }]
  const userSchools = user?.schools || []

  const handleSelect = (school) => {
    // school is { schoolId, schoolName, roleName, permissions[] }
    setSchool({
      id:       school.schoolId,
      name:     school.schoolName || `School #${school.schoolId}`,
      roleName: school.roleName,
    })
    toast.success(`Switched to ${school.schoolName || 'school'}`)
    navigate('/dashboard')
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleCreate = async () => {
    setError('')
    if (!form.name.trim()) return setError('School name is required')
    setSaving(true)
    try {
      const school = await api.createSchool(form, token)
      // After creating, the token still doesn't have this school.
      // Set it directly and redirect to setup.
      setSchool({ id: school.id, name: school.name })
      toast.success(`${school.name} created! Complete the setup now.`)
      navigate('/setup')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      {/* Topbar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <GraduationCap size={14} className="text-white" />
        </div>
        <span className="font-display font-bold text-slate-900 text-sm">AcadEx</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600">{user?.firstName?.[0] || user?.email?.[0] || 'U'}</span>
          </div>
          <span className="hidden sm:block">{user?.firstName || user?.email}</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg animate-fade-in">

          {/* ── List schools from token ── */}
          {mode === 'list' && (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                  <Building2 size={24} className="text-white" />
                </div>
                <h1 className="font-display font-bold text-2xl text-slate-900 mb-2">
                  {userSchools.length === 0 ? 'Create your school' : 'Select a school'}
                </h1>
                <p className="text-slate-500 text-sm">
                  {userSchools.length === 0
                    ? 'You have no schools yet. Create one to get started.'
                    : 'Choose the school you want to manage right now.'}
                </p>
              </div>

              {userSchools.length === 0 ? (
                <div className="text-center">
                  <Button onClick={() => setMode('create')} icon={Plus} size="lg">
                    Create Your First School
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {userSchools.map(s => (
                    <button key={s.schoolId} onClick={() => handleSelect(s)}
                      className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group text-left shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                        <Building2 size={17} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">
                          {s.schoolName || `School #${s.schoolId}`}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 capitalize">
                          {s.roleName?.replace(/_/g, ' ') || 'Member'}
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Super admin note or create option */}
              {(userSchools.length > 0 || user?.email === 'admin@platform.com') && (
                <div className="text-center">
                  <Button variant="ghost" size="sm" icon={Plus} onClick={() => setMode('create')}>
                    Create another school
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── Create school form ── */}
          {mode === 'create' && (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-100">
                  <Plus size={24} className="text-white" />
                </div>
                <h1 className="font-display font-bold text-2xl text-slate-900 mb-2">Create a School</h1>
                <p className="text-slate-500 text-sm">Fill in your school's details. You can edit these later.</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                {error && <Alert type="danger">{error}</Alert>}

                <Input label="School Name *" placeholder="St. Mary's College Kisubi"
                  value={form.name} onChange={f('name')} autoFocus />
                <FormGrid cols={2}>
                  <Input label="School Code" placeholder="SMCK" value={form.code} onChange={f('code')} />
                  <Input label="Email" type="email" placeholder="info@school.ac.ug" value={form.email} onChange={f('email')} />
                </FormGrid>
                <FormGrid cols={2}>
                  <Input label="Phone" placeholder="+256 700 000000" value={form.phone} onChange={f('phone')} />
                  <Input label="Address" placeholder="P.O Box 1, Kampala" value={form.address} onChange={f('address')} />
                </FormGrid>

                <div className="flex gap-3 pt-2">
                  {userSchools.length > 0 && (
                    <Button variant="secondary" className="flex-1" onClick={() => { setMode('list'); setError('') }}>
                      ← Back
                    </Button>
                  )}
                  <Button className="flex-1" loading={saving} onClick={handleCreate}>
                    Create School →
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
