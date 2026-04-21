import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../../services/api'
import { Button, Input, Alert, FormGrid } from '../../components/ui'
import { GraduationCap, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) return setError('Passwords do not match')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    try {
      await api.createUser({ first_name: form.first_name, last_name: form.last_name, email: form.email, password: form.password })
      toast.success('Account created! Please sign in.')
      navigate('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <GraduationCap size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-slate-900 text-lg">AcadEx</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="mb-6">
            <h2 className="font-display font-bold text-xl text-slate-900 mb-1">Create your account</h2>
            <p className="text-sm text-slate-500">Set up AcadEx for your school in minutes</p>
          </div>

          {error && <div className="mb-4"><Alert type="danger">{error}</Alert></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormGrid cols={2}>
              <Input label="First Name *" placeholder="John" value={form.first_name} onChange={f('first_name')} required />
              <Input label="Last Name *"  placeholder="Doe"  value={form.last_name}  onChange={f('last_name')}  required />
            </FormGrid>
            <Input label="Email address *" type="email" placeholder="you@school.ac.ug" value={form.email} onChange={f('email')} required />
            <div className="relative">
              <Input label="Password *" type={showPw ? 'text' : 'password'} placeholder="Min 6 characters"
                value={form.password} onChange={f('password')} required />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 bottom-2.5 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Input label="Confirm Password *" type="password" placeholder="Repeat password"
              value={form.confirm} onChange={f('confirm')} required />
            <Button type="submit" loading={loading} className="w-full justify-center !py-2.5">
              {loading ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
