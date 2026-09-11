import { useState } from 'react'
import { auth, ADMIN_EMAIL, ADMIN_UID } from '../firebase-auth'
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword
} from 'firebase/auth'
import { LogIn, Mail } from 'lucide-react'
import logo from '../../../images/hsst-logo-96.webp'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider()
    setLoading(true)
    setError('')
    try {
      const result = await signInWithPopup(auth, provider)
      if (result.user.email !== ADMIN_EMAIL || result.user.uid !== ADMIN_UID || !result.user.emailVerified) setError('Use the verified administrator Google account.')
    } catch (err) {
      setError(
        err.code === 'auth/unauthorized-domain'
          ? 'This domain is not authorized in Firebase Auth. Use localhost for local testing or add this domain in Firebase Authentication settings.'
          : 'Failed to login with Google'
      )
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      if (result.user.email !== ADMIN_EMAIL || result.user.uid !== ADMIN_UID || !result.user.emailVerified) setError('Use the verified administrator account.')
    } catch (err) {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} width="96" height="72" className="mx-auto mb-4 h-20 w-auto object-contain" alt="Hinrichs Specialty Services and Technology" />
          <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-widest">HSST Admin CRM</h1>
          <p className="text-slate-500 text-sm mt-2">Authorized Access Only</p>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-slate-800 text-white font-semibold py-3 rounded-xl hover:bg-slate-700 transition-all mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-600">Or continue with mail</span>
            </div>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="crm-email" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Email Address</label>
              <div className="relative">
                <input
                  id="crm-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-dark w-full px-4 py-3 rounded-xl pl-11"
                  placeholder="bhinrichs1380@gmail.com"
                  required
                />
                <Mail className="absolute left-4 top-3.5 text-slate-300" size={18} />
              </div>
            </div>

            <div>
              <label htmlFor="crm-password" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Password</label>
              <div className="relative">
                <input
                  id="crm-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-dark w-full px-4 py-3 rounded-xl pl-11"
                  placeholder="••••••••"
                  required
                />
                <LogIn className="absolute left-4 top-3.5 text-slate-300" size={18} />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-red-600 text-xs font-medium bg-red-50 p-3 rounded-lg border border-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-green w-full py-3.5 rounded-xl font-bold tracking-wide mt-2"
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-slate-400 text-xs">
          © {new Date().getFullYear()} Hinrichs Specialty Services and Technology
        </p>
      </div>
    </main>
  )
}
