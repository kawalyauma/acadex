import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/auth'
import { AppLayout } from './components/layout'
import { useSchoolData } from './hooks/useSchoolData'
import Login            from './pages/auth/Login'
import Register         from './pages/auth/Register'
import Onboarding       from './pages/onboarding'
import Setup            from './pages/setup'
import Dashboard        from './pages/dashboard'
import Students         from './pages/students'
import Sessions         from './pages/sessions'
import Reports          from './pages/reports'
import Corrections      from './pages/corrections'
import Flags            from './pages/flags'
import Calendar         from './pages/calendar'
import Settings         from './pages/settings'
import Exams            from './pages/exams'
import ExamDetail       from './pages/exams/ExamDetail'
import ReportCards      from './pages/exams/ReportCards'
import Subjects         from './pages/exams/Subjects'
import GradingSettings  from './pages/exams/GradingSettings'
import AcademicReports  from './pages/exams/AcademicReports'
import CurriculumHub    from './pages/curriculum'
import CurrSubjects     from './pages/curriculum/Subjects'
import Lessons          from './pages/curriculum/Lessons'
import CurrReports      from './pages/curriculum/Reports'
import StudentReports   from './pages/curriculum/StudentReports'
import Teachers         from './pages/teachers'
import Allocations      from './pages/teachers/Allocations'

function DataLoader({ children }) { useSchoolData(); return children }
function AppRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <DataLoader><AppLayout>{children}</AppLayout></DataLoader>
}
function OnboardingRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <DataLoader>{children}</DataLoader>
}
function PublicRoute({ children }) {
  const { isAuthenticated, schoolId } = useAuthStore()
  if (!isAuthenticated) return children
  return <Navigate to={schoolId ? '/dashboard' : '/onboarding'} replace />
}
const T={style:{background:'#fff',color:'#1E293B',border:'1px solid #E2E8F0',borderRadius:'12px',fontSize:'13px',fontFamily:'Inter,sans-serif',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'},success:{iconTheme:{primary:'#059669',secondary:'transparent'}},error:{iconTheme:{primary:'#DC2626',secondary:'transparent'}}}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={T} />
      <Routes>
        <Route path="/login"      element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register"   element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
        <Route path="/setup"      element={<OnboardingRoute><Setup /></OnboardingRoute>} />
        <Route path="/dashboard"    element={<AppRoute><Dashboard /></AppRoute>} />
        <Route path="/students"     element={<AppRoute><Students /></AppRoute>} />
        <Route path="/sessions"     element={<AppRoute><Sessions /></AppRoute>} />
        <Route path="/reports"      element={<AppRoute><Reports /></AppRoute>} />
        <Route path="/corrections"  element={<AppRoute><Corrections /></AppRoute>} />
        <Route path="/flags"        element={<AppRoute><Flags /></AppRoute>} />
        <Route path="/calendar"     element={<AppRoute><Calendar /></AppRoute>} />
        <Route path="/settings"     element={<AppRoute><Settings /></AppRoute>} />
        {/* Teachers */}
        <Route path="/teachers"             element={<AppRoute><Teachers /></AppRoute>} />
        <Route path="/teachers/allocations" element={<AppRoute><Allocations /></AppRoute>} />
        {/* Exams */}
        <Route path="/exams"                      element={<AppRoute><Exams /></AppRoute>} />
        <Route path="/exams/subjects"             element={<AppRoute><Subjects /></AppRoute>} />
        <Route path="/exams/grading"              element={<AppRoute><GradingSettings /></AppRoute>} />
        <Route path="/exams/reports"              element={<AppRoute><AcademicReports /></AppRoute>} />
        <Route path="/exams/:examId"              element={<AppRoute><ExamDetail /></AppRoute>} />
        <Route path="/exams/:examId/report-cards" element={<AppRoute><ReportCards /></AppRoute>} />
        {/* Curriculum */}
        <Route path="/curriculum"                 element={<AppRoute><CurriculumHub /></AppRoute>} />
        <Route path="/curriculum/subjects"        element={<AppRoute><CurrSubjects /></AppRoute>} />
        <Route path="/curriculum/lessons"         element={<AppRoute><Lessons /></AppRoute>} />
        <Route path="/curriculum/reports"         element={<AppRoute><CurrReports /></AppRoute>} />
        <Route path="/curriculum/student-reports" element={<AppRoute><StudentReports /></AppRoute>} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
