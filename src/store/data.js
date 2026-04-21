import { create } from 'zustand'

export const useDataStore = create((set, get) => ({
  academicYears: [],
  terms:         [],
  classes:       [],   // each class has .streams[]
  students:      [],
  loading:       { years: false, terms: false, classes: false, students: false },

  set: (key, val) => set({ [key]: val }),
  setLoading: (key, val) => set(s => ({ loading: { ...s.loading, [key]: val } })),
  clear: () => set({ academicYears: [], terms: [], classes: [], students: [] }),

  // Selectors
  currentYear:   () => get().academicYears.find(y => y.is_current) || get().academicYears[0] || null,
  currentTerm:   () => get().terms.find(t => t.is_current) || get().terms[0] || null,

  classOptions: () => get().classes.map(c => ({
    value: c.id, label: c.name,
    sub: c.level ? `Level ${c.level}` : undefined,
  })),

  streamOptions: (classId) => {
    const cls = get().classes.find(c => String(c.id) === String(classId))
    return (cls?.streams || []).map(s => ({ value: s.id, label: s.name, sub: s.code }))
  },

  studentOptions: (classId) => get().students
    .filter(s => !classId || String(s.current_class_id) === String(classId))
    .map(s => ({
      value: s.id,
      label: `${s.first_name} ${s.last_name}`,
      sub: s.student_number,
      avatar: `${s.first_name?.[0] || ''}${s.last_name?.[0] || ''}`.toUpperCase(),
    })),

  yearOptions: () => get().academicYears.map(y => ({ value: y.id, label: y.name, sub: y.is_current ? 'Current' : undefined })),
  termOptions: (yearId) => get().terms
    .filter(t => !yearId || String(t.academic_year_id) === String(yearId))
    .map(t => ({ value: t.id, label: t.name, sub: t.is_current ? 'Current' : undefined })),
}))
