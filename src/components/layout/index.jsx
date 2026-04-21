import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '../../store/auth'
import { clsx } from 'clsx'
import {
  LayoutDashboard, CalendarCheck, GraduationCap, FileBarChart2,
  Settings, LogOut, Menu, X, Building2, ClipboardCheck,
  AlertTriangle, BookOpen, ClipboardList, Bell, School, Printer,
  Star, BookMarked, BarChart2, User, Users, Link2
} from 'lucide-react'
import { Avatar } from '../ui'

const NAV_GROUPS = [
  { label:'Overview', items:[{ to:'/dashboard', icon:LayoutDashboard, label:'Dashboard' }] },
  {
    label:'Academic',
    items:[
      { to:'/setup',    icon:School,        label:'School Setup' },
      { to:'/students', icon:GraduationCap, label:'Students' },
    ]
  },
  {
    label:'Teachers',
    items:[
      { to:'/teachers',             icon:Users, label:'Teacher Management' },
      { to:'/teachers/allocations', icon:Link2, label:'Subject Allocations' },
    ]
  },
  {
    label:'Curriculum',
    items:[
      { to:'/curriculum',                 icon:BookMarked,   label:'Curriculum Hub' },
      { to:'/curriculum/subjects',        icon:BookOpen,     label:'Subjects & Topics' },
      { to:'/curriculum/lessons',         icon:ClipboardList,label:'Lessons' },
      { to:'/curriculum/reports',         icon:BarChart2,    label:'Coverage Reports' },
      { to:'/curriculum/student-reports', icon:User,         label:'Student Reports' },
    ]
  },
  {
    label:'Examinations',
    items:[
      { to:'/exams',          icon:ClipboardList, label:'Exams' },
      { to:'/exams/subjects', icon:BookOpen,      label:'Exam Subjects' },
      { to:'/exams/grading',  icon:Star,          label:'Grading & Comments' },
      { to:'/exams/reports',  icon:Printer,       label:'Academic Reports' },
    ]
  },
  {
    label:'Attendance',
    items:[
      { to:'/sessions',    icon:CalendarCheck,  label:'Sessions' },
      { to:'/corrections', icon:ClipboardCheck, label:'Corrections' },
      { to:'/flags',       icon:AlertTriangle,  label:'Absentee Flags' },
      { to:'/calendar',    icon:BookOpen,       label:'Calendar' },
    ]
  },
  { label:'Insights', items:[{ to:'/reports', icon:FileBarChart2, label:'Attendance Reports' }] },
  { label:'System',   items:[{ to:'/settings', icon:Settings, label:'Settings' }] },
]

function NavItem({ to, icon:Icon, label, onClick }) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 rounded-r-full" />}
          <Icon size={16} className="shrink-0" />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ mobile, onClose }) {
  const { user, school, logout } = useAuthStore()
  const navigate = useNavigate()
  return (
    <aside className={clsx('flex flex-col h-dvh bg-white border-r border-slate-200',mobile?'fixed left-0 top-0 z-[200] w-[248px] shadow-xl':'sticky top-0 w-[248px] shrink-0')}>
      <div className="flex items-center justify-between px-4 h-[58px] border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm"><GraduationCap size={16} className="text-white" /></div>
          <div>
            <span className="font-display font-bold text-slate-900 text-[15px] leading-none">AcadEx</span>
            <span className="block text-[9px] text-slate-400 font-semibold tracking-widest uppercase mt-0.5">Academic Suite</span>
          </div>
        </div>
        {mobile && <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={17} /></button>}
      </div>
      {school ? (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0"><Building2 size={13} className="text-white" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest leading-none mb-0.5">Active School</p>
            <p className="text-sm text-blue-800 font-semibold truncate">{school.name}</p>
          </div>
        </div>
      ) : (
        <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 cursor-pointer" onClick={() => navigate('/onboarding')}>
          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 font-medium">No school selected</p>
        </div>
      )}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {NAV_GROUPS.map(g => (
          <div key={g.label}>
            <p className="nav-group-label">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map(item => <NavItem key={item.to} {...item} onClick={mobile ? onClose : undefined} />)}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
          <Avatar name={`${user?.firstName||''} ${user?.lastName||''}`} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.firstName||user?.email}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/login') }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all group">
          <LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />Sign out
        </button>
      </div>
    </aside>
  )
}

export function Topbar({ onMenuClick }) {
  return (
    <header className="h-[58px] flex items-center justify-between px-5 border-b border-slate-200 bg-white sticky top-0 z-50 shrink-0">
      <button id="mobile-menu-btn" onClick={onMenuClick} className="hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"><Menu size={19} /></button>
      <div className="flex-1" />
      <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><Bell size={17} /></button>
      <style>{`@media(max-width:768px){#mobile-menu-btn{display:flex!important}}`}</style>
    </header>
  )
}

export function AppLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className="flex min-h-dvh bg-slate-50">
      <div className="hidden md:flex"><Sidebar /></div>
      {mobileOpen && (<><div className="fixed inset-0 z-[199] bg-black/30 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} /><Sidebar mobile onClose={() => setMobileOpen(false)} /></>)}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-5 md:p-6">{children}</main>
      </div>
    </div>
  )
}
