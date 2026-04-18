import { useState } from 'react'

type Mode = 'login' | 'register'

interface Props {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string) => Promise<void>
}

export function LoginPage({ onLogin, onRegister }: Props) {
  const [mode, setMode]           = useState<Mode>('login')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'register' && password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await onLogin(email, password)
      } else {
        await onRegister(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `${mode === 'login' ? 'Login' : 'Registration'} failed`)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl font-bold">FinanceTracker</h1>
          <p className="text-muted text-sm mt-1">Personal Dashboard</p>
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {/* Mode tabs */}
          <div className="flex border-b border-border">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                  mode === m ? 'text-white border-b-2 border-primary' : 'text-muted hover:text-white'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div>
              <label className="text-muted text-xs block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-muted text-xs block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Min 8 characters' : 'Enter your password'}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="text-muted text-xs block mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-primary"
                />
              </div>
            )}

            {error && <p className="text-danger text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-2.5 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
