import { Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotConfigured({ feature = 'This feature' }) {
  return (
    <div className="card-dark rounded-xl p-14 text-center max-w-md mx-auto mt-8">
      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4">
        <Settings size={22} className="text-blue-500" />
      </div>
      <h2 className="font-semibold text-slate-800 mb-1">Firebase Not Configured</h2>
      <p className="text-sm text-slate-500 mb-5">
        {feature} requires Firebase. Add your environment variables to get started.
      </p>
      <Link
        to="/settings"
        className="btn-green inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
      >
        <Settings size={15} />
        View Setup Guide
      </Link>
    </div>
  )
}
