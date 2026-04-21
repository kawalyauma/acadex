import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { api } from '../../services/api'
import { Button, Input, Alert } from '../../components/ui'
import { GraduationCap, Eye, EyeOff, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await api.login(email, password)
      login(result.token, result.user)
      toast.success(`Welcome back, ${result.user.firstName || result.user.email}!`)
      // Redirect to onboarding — it handles school selection logic
      navigate('/onboarding')
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex bg-slate-50">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between flex-1 p-12 bg-blue-600 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-blue-500/50" />
        <div className="absolute bottom-0 -left-10 w-80 h-80 rounded-full bg-blue-700/60" />
        <div className="absolute top-1/2 right-10 w-32 h-32 rounded-full bg-blue-400/30" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-white text-lg">AcadEx</span>
            <span className="block text-[10px] text-blue-200 font-semibold tracking-widest uppercase">Academic Suite</span>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="font-display font-bold text-5xl text-white leading-[1.15] mb-5">
            The smart way<br />to run your<br />school.
          </h1>
          <p className="text-blue-100 text-base leading-relaxed max-w-sm">
            Multi-school academic management — attendance, students, classes, reports and analytics built for African schools.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 relative z-10">
          {[
            { n: '100%', l: 'Attendance accuracy' },
            { n: 'PDF',  l: 'Instant reports' },
            { n: 'PWA',  l: 'Works offline' },
            { n: '∞',    l: 'Schools supported' },
          ].map(s => (
            <div key={s.l} className="bg-white/10 rounded-xl px-4 py-3 border border-white/10">
              <p className="font-display font-bold text-2xl text-white">{s.n}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 lg:max-w-[460px] flex items-center justify-center p-8 bg-white lg:border-l border-slate-200">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <GraduationCap size={18} className="text-white" />
            </div>
            <span className="font-display font-bold text-slate-900 text-lg">AcadEx</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display font-bold text-2xl text-slate-900 mb-1">Sign in</h2>
            <p className="text-sm text-slate-500">Enter your institution credentials to continue</p>
          </div>

          {error && <div className="mb-5"><Alert type="danger">{error}</Alert></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email address" type="email" placeholder="admin@school.ac.ug"
              value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <div className="relative">
              <Input label="Password" type={showPw ? 'text' : 'password'} placeholder="••••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 bottom-2.5 text-slate-400 hover:text-slate-600 transition-colors">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Button type="submit" loading={loading} className="w-full justify-center !py-2.5 mt-2">
              {loading ? 'Signing in…' : 'Sign in to AcadEx'}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 font-semibold hover:underline">Create one free</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
