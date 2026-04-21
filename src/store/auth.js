import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// JWT token payload shape (from backend):
// {
//   userId, email,
//   schools: [{ schoolId, schoolName, roleId, roleName, permissions[] }]
// }
// The schools[] array contains ONLY the schools this user is assigned to.
// The backend enforces access via extractSchoolContext — any request to
// /api/schools/:schoolId will 403 if schoolId is not in the user's schools[].

export const useAuthStore = create(persist(
  (set) => ({
    token:           null,
    user:            null,
    schoolId:        null,   // currently active school id
    school:          null,   // { id, name, roleName }
    isAuthenticated: false,

    login: (token, user) => {
      // Auto-select if user has exactly one school
      let schoolId = null
      let school   = null
      if (user?.schools?.length === 1) {
        const s  = user.schools[0]
        schoolId = s.schoolId
        school   = { id: s.schoolId, name: s.schoolName, roleName: s.roleName }
      }
      set({ token, user, schoolId, school, isAuthenticated: true })
    },

    logout: () => set({ token: null, user: null, schoolId: null, school: null, isAuthenticated: false }),

    setSchool: (school) => set({
      schoolId: school?.id ?? null,
      school:   school ? { id: school.id, name: school.name, roleName: school.roleName } : null,
    }),

    clearSchool: () => set({ schoolId: null, school: null }),
  }),
  { name: 'acadex-auth-v3' }
))
