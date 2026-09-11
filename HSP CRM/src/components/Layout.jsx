import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, Users, FileText,
  Mail, Settings, Menu, X, CircleDollarSign, LogOut, ExternalLink,
} from 'lucide-react'
import { useDialog } from './Dialog'
import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase-auth'
import logo from '../../../images/hsst-logo-96.webp'

const navItems = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/surveys',  label: 'Surveys',   icon: ClipboardList },
  { to: '/crm',      label: 'CRM',       icon: Users },
  { to: '/invoices', label: 'Invoices',  icon: FileText },
  { to: '/payments', label: 'Payments',  icon: CircleDollarSign },
  { to: '/email',    label: 'Email',     icon: Mail },
  { to: '/settings', label: 'Settings',  icon: Settings },
]

function HSSLogo({ size = 36 }) {
  return (
    <img src={logo} width={size} height={size} className="rounded-lg object-contain" alt="HSST" />
  )
}

function SidebarContent({ onNavClick }) {
  return (
    <>
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <HSSLogo size={36} />
        <div className="leading-tight">
          <p className="text-xs font-bold text-white tracking-widest uppercase">HSST</p>
          <p className="text-[11px] text-white/50 leading-snug">Hinrichs Specialty<br />Services &amp; Technology</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-white/60 hover:text-white hover:bg-white/8 border border-transparent'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/10 px-2 py-3">
        <a href="/" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-white/60 hover:bg-white/10 hover:text-white">
          <ExternalLink size={17} /> View website
        </a>
        <button onClick={() => signOut(auth).catch(() => alert('Sign out failed. Check your connection and try again.'))} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/60 hover:bg-white/10 hover:text-white">
          <LogOut size={17} /> Sign out
        </button>
      </div>
    </>
  )
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  useDialog(() => setMobileOpen(false), mobileOpen)

  return (
    <div className="flex h-dvh min-w-0 bg-[#f8fafc]">
      {/* Sidebar — navy gradient matching HSST website */}
      <aside
        className="hidden md:flex flex-col w-56 shrink-0 border-r border-blue-900/10"
        style={{ background: 'linear-gradient(180deg, #132e54 0%, #0a1f3a 100%)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2.5 border-b border-blue-900/10"
        style={{ background: 'linear-gradient(135deg, #132e54 0%, #0a1f3a 100%)' }}
      >
        <div className="flex items-center gap-2.5">
          <HSSLogo size={30} />
          <div>
            <p className="text-[10px] font-bold text-white tracking-widest uppercase leading-none">HSST</p>
            <p className="text-[10px] text-white/50 leading-none mt-0.5">Platform</p>
          </div>
        </div>
        <button aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="min-h-11 min-w-11 p-1.5 text-white/60 hover:text-white">
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div role="dialog" aria-modal="true" aria-label="Navigation" className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside
            className="relative flex flex-col w-60 max-w-full overflow-y-auto border-r border-blue-900/10"
            style={{ background: 'linear-gradient(180deg, #132e54 0%, #0a1f3a 100%)' }}
          >
            <button
              aria-label="Close navigation" onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 min-h-11 min-w-11 text-white/60 hover:text-white p-1"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-y-auto md:p-8 p-4 pt-20 md:pt-8">
        <Outlet />
      </main>
    </div>
  )
}
