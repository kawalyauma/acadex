# AcadEx — Enterprise Academic Suite

A production-grade Progressive Web App built with **Vite + React + Tailwind CSS**, connecting to a Cloudflare Workers backend.

## Features

### 🏫 School Management
- Register and manage multiple schools
- Switch active school context — all data scoped accordingly

### 👨‍🎓 Student Management
- Full CRUD — create, edit, delete students
- Assign students to classes with searchable dropdown
- Parent/guardian contact info
- Per-student attendance report with SVG gauge + PDF export

### 📋 Attendance Sessions
- Open daily sessions per class (full-day, morning, afternoon, period-based)
- Students **pre-loaded automatically** from class enrollment
- Bulk mark: present, absent, late, half-day, excused
- Check-in / check-out time capture
- Close session → auto-flags unmarked students as absent

### 📊 Reports & Analytics
- **Daily Report** — class-level attendance summary with rate bars
- **Student Report** — daily history, summary stats, SVG gauge chart
- **Chronic Absentees** — configurable absence % threshold
- **Trends** — 30-day area chart with daily rate tracking
- **PDF Export** on every report type (branded, autotable)

### 🔄 Corrections Workflow
- Teachers submit correction requests with reason + supporting doc
- Admin approves/rejects with review notes
- Full audit trail — who changed what and when

### 🚩 Absentee Flags
- Auto-detected on session close
- Colour-coded severity: 3+ days = amber, 5+ days = red
- Filter by class, date range, resolved status

### 📅 Academic Calendar
- Term management with start/end dates
- Public holidays, school events, closures
- Holiday blocking prevents sessions opening on non-school days

### ⚙️ Settings
- Attendance policy: grace period, half-day threshold, chronic absence %
- Correction window configuration
- Self-correction permission toggle

### 📱 PWA
- Installable on desktop and mobile
- Service worker for offline resilience
- Dark theme, optimised for all screen sizes

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Build | Vite 5 |
| UI | React 18 + Tailwind CSS 3 |
| Routing | React Router v6 |
| State | Zustand (persisted auth, cached reference data) |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable |
| PWA | vite-plugin-pwa + Workbox |
| Icons | Lucide React |
| Toasts | react-hot-toast |
| Date utils | date-fns |

---

## Project Structure

```
src/
├── App.jsx                    # Routes, protected routes, DataLoader
├── main.jsx
├── index.css                  # Tailwind + component classes
│
├── store/
│   ├── auth.js                # Zustand persisted auth (token, user, schoolId)
│   └── data.js                # Zustand cached classes + students per school
│
├── hooks/
│   └── useSchoolData.js       # Auto-loads classes/students on school switch
│
├── services/
│   └── api.js                 # All API calls (schools, students, sessions, reports…)
│
├── lib/
│   └── pdf.js                 # PDF export: daily, student, chronic, trends
│
├── components/
│   ├── ui/index.jsx           # Button, Card, Badge, Input, Select, SearchableSelect,
│   │                          # Modal, Table, StatCard, Tabs, Avatar, Alert, FormGrid…
│   └── layout/index.jsx       # Sidebar, Topbar, AppLayout
│
└── pages/
    ├── auth/Login.jsx
    ├── dashboard/
    ├── schools/               # Multi-school management + switcher
    ├── students/              # CRUD + inline report modal
    ├── sessions/              # Open/close/mark attendance
    ├── reports/               # 4 report types + PDF
    ├── corrections/           # Approval workflow
    ├── flags/                 # Absentee flag viewer
    ├── calendar/              # Academic calendar + holidays
    └── settings/              # Policy configuration
```

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure API endpoint
cp .env.example .env
# Edit .env → VITE_API_URL=https://your-api.workers.dev

# 3. Dev server
npm run dev

# 4. Production build
npm run build

# 5. Preview production build
npm run preview
```

## Deploy

```bash
# Cloudflare Pages
npx wrangler pages deploy dist --project-name acadex

# Netlify (drag dist/ folder) or:
npx netlify deploy --prod --dir dist

# Vercel
npx vercel dist/
```

---

## Environment Variables

```env
VITE_API_URL=https://your-api.workers.dev
```

---

## Backend

The API is built on Cloudflare Workers + D1 SQLite. See the backend repo for:
- `services/student-attendance/` — attendance engine
- `migrations/001_student_attendance.sql` — database schema (all tables prefixed `new_`)

