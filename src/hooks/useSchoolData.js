import { useEffect } from 'react'
import { useAuthStore } from '../store/auth'
import { useDataStore } from '../store/data'
import { api } from '../services/api'

export function useSchoolData() {
  const { token, schoolId } = useAuthStore()
  const { set, setLoading, clear } = useDataStore()

  useEffect(() => {
    if (!schoolId || !token) { clear(); return }

    // Academic Years
    setLoading('years', true)
    api.academicYears(schoolId, token)
      .then(d => set('academicYears', Array.isArray(d) ? d : []))
      .catch(() => set('academicYears', []))
      .finally(() => setLoading('years', false))

    // Terms
    setLoading('terms', true)
    api.terms(schoolId, token)
      .then(d => set('terms', Array.isArray(d) ? d : []))
      .catch(() => set('terms', []))
      .finally(() => setLoading('terms', false))

    // Classes (backend returns streams nested inside each class)
    setLoading('classes', true)
    api.classes(schoolId, token)
      .then(d => set('classes', Array.isArray(d) ? d : []))
      .catch(() => set('classes', []))
      .finally(() => setLoading('classes', false))

    // Students - use camelCase params as the backend expects
    setLoading('students', true)
    api.students(schoolId, { limit: 500, status: 'active' }, token)
      .then(d => set('students', Array.isArray(d) ? d : []))
      .catch(() => set('students', []))
      .finally(() => setLoading('students', false))

  }, [schoolId, token])
}
