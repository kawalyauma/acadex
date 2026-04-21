const BASE = 'https://xedux.kawalyaumar500.workers.dev'

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || json?.message || `Error ${res.status}`)
  return json.data ?? json
}

const qs = (p = {}) => {
  const s = new URLSearchParams(
    Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== ''))
  ).toString()
  return s ? `?${s}` : ''
}

export const api = {
  // AUTH
  login:      (email, password) => req('POST', '/api/auth/login', { email, password }),
  createUser: (body)            => req('POST', '/api/users', body),

  // SCHOOL
  createSchool: (body, tok) => req('POST', '/api/schools', body, tok),

  // ACADEMIC YEARS
  academicYears:      (sid, tok)       => req('GET',  `/api/schools/${sid}/academic-years`, null, tok),
  createAcademicYear: (sid, body, tok) => req('POST', `/api/schools/${sid}/academic-years`, body, tok),

  // TERMS
  terms:      (sid, tok)       => req('GET',  `/api/schools/${sid}/terms`, null, tok),
  createTerm: (sid, body, tok) => req('POST', `/api/schools/${sid}/terms`, body, tok),

  // CLASSES & STREAMS
  classes:      (sid, tok)            => req('GET',  `/api/schools/${sid}/classes`, null, tok),
  createClass:  (sid, body, tok)      => req('POST', `/api/schools/${sid}/classes`, body, tok),
  createStream: (sid, cid, body, tok) => req('POST', `/api/schools/${sid}/classes/${cid}/streams`, body, tok),

  // STUDENTS
  students:       (sid, p, tok)        => req('GET',   `/api/schools/${sid}/students${qs({ status: p?.status, classId: p?.classId, streamId: p?.streamId, limit: p?.limit || 500, offset: p?.offset })}`, null, tok),
  searchStudents: (sid, q, cid, tok)   => req('GET',   `/api/schools/${sid}/students/search${qs({ q, classId: cid || undefined })}`, null, tok),
  getStudent:     (sid, id, tok)       => req('GET',   `/api/schools/${sid}/students/${id}`, null, tok),
  createStudent:  (sid, body, tok)     => req('POST',  `/api/schools/${sid}/students`, body, tok),
  updateStudent:  (sid, id, body, tok) => req('PATCH', `/api/schools/${sid}/students/${id}`, body, tok),
  studentHistory: (sid, id, tok)       => req('GET',   `/api/schools/${sid}/students/${id}/history`, null, tok),
  promoteStudent: (sid, id, body, tok) => req('POST',  `/api/schools/${sid}/students/${id}/promote`, body, tok),
  withdrawStudent:(sid, id, body, tok) => req('POST',  `/api/schools/${sid}/students/${id}/withdraw`, body, tok),

  // ATTENDANCE CALENDARS
  attCalendars:      (sid, tok)       => req('GET',  `/api/schools/${sid}/attendance/calendars`, null, tok),
  createAttCalendar: (sid, body, tok) => req('POST', `/api/schools/${sid}/attendance/calendars`, body, tok),

  // ATTENDANCE POLICY
  policy:       (sid, tok)       => req('GET',  `/api/schools/${sid}/attendance/policy`, null, tok),
  upsertPolicy: (sid, body, tok) => req('POST', `/api/schools/${sid}/attendance/policy`, body, tok),

  // HOLIDAYS
  holidays:   (sid, cid, tok)  => req('GET',  `/api/schools/${sid}/attendance/holidays${qs({ calendar_id: cid })}`, null, tok),
  addHoliday: (sid, body, tok) => req('POST', `/api/schools/${sid}/attendance/holidays`, body, tok),

  // SESSIONS
  sessions:      (sid, p, tok)    => req('GET',   `/api/schools/${sid}/attendance/sessions${qs(p)}`, null, tok),
  openSession:   (sid, body, tok) => req('POST',  `/api/schools/${sid}/attendance/sessions`, body, tok),
  closeSession:  (sid, id, tok)   => req('PATCH', `/api/schools/${sid}/attendance/sessions/${id}/close`, {}, tok),
  sessionRecords:(sid, id, tok)   => req('GET',   `/api/schools/${sid}/attendance/sessions/${id}/records`, null, tok),
  markAttendance:(sid, sid2, records, tok) => req('POST', `/api/schools/${sid}/attendance/sessions/${sid2}/mark`, { records }, tok),

  // CORRECTIONS
  corrections:       (sid, p, tok)            => req('GET',   `/api/schools/${sid}/attendance/corrections${qs(p)}`, null, tok),
  requestCorrection: (sid, body, tok)         => req('POST',  `/api/schools/${sid}/attendance/corrections`, body, tok),
  reviewCorrection:  (sid, id, d, notes, tok) => req('PATCH', `/api/schools/${sid}/attendance/corrections/${id}/review`, { decision: d, review_notes: notes }, tok),

  // FLAGS
  absenteeFlags: (sid, p, tok) => req('GET', `/api/schools/${sid}/attendance/absentee-flags${qs(p)}`, null, tok),

  // ATTENDANCE REPORTS
  dailyReport:      (sid, date, cid, tok)      => req('GET', `/api/schools/${sid}/attendance/reports/daily${qs({ date, class_id: cid })}`, null, tok),
  studentReport:    (sid, stId, from, to, tok) => req('GET', `/api/schools/${sid}/attendance/reports/student/${stId}${qs({ from, to })}`, null, tok),
  chronicAbsentees: (sid, from, to, thr, tok)  => req('GET', `/api/schools/${sid}/attendance/reports/chronic-absentees${qs({ from, to, threshold: thr })}`, null, tok),
  trends:           (sid, from, to, cid, tok)  => req('GET', `/api/schools/${sid}/attendance/reports/trends${qs({ from, to, class_id: cid })}`, null, tok),
  auditLog:         (sid, p, tok)              => req('GET', `/api/schools/${sid}/attendance/audit-log${qs(p)}`, null, tok),
}

// ── EXAM API ──────────────────────────────────────────────────────────────────
export const examApi = {
  // Subjects
  subjects:      (sid, p, tok)               => req('GET',    `/api/schools/${sid}/exams/subjects${qs(p)}`, null, tok),
  createSubject: (sid, body, tok)            => req('POST',   `/api/schools/${sid}/exams/subjects`, body, tok),
  updateSubject: (sid, id, body, tok)        => req('PATCH',  `/api/schools/${sid}/exams/subjects/${id}`, body, tok),
  deleteSubject: (sid, id, tok)              => req('DELETE', `/api/schools/${sid}/exams/subjects/${id}`, null, tok),

  // Grading scales
  gradingScales: (sid, tok)                  => req('GET',  `/api/schools/${sid}/exams/grading-scales`, null, tok),
  seedPLE:       (sid, tok)                  => req('POST', `/api/schools/${sid}/exams/grading-scales/seed-ple`, {}, tok),
  updateBand:    (sid, id, body, tok)        => req('PATCH',`/api/schools/${sid}/exams/grade-bands/${id}`, body, tok),

  // Comment rules
  commentRules:  (sid, type, tok)            => req('GET',    `/api/schools/${sid}/exams/comment-rules${qs({ type })}`, null, tok),
  seedComments:  (sid, tok)                  => req('POST',   `/api/schools/${sid}/exams/comment-rules/seed-defaults`, {}, tok),
  upsertComment: (sid, body, tok)            => req('POST',   `/api/schools/${sid}/exams/comment-rules`, body, tok),
  deleteComment: (sid, id, tok)              => req('DELETE', `/api/schools/${sid}/exams/comment-rules/${id}`, null, tok),

  // Exams CRUD
  exams:            (sid, p, tok)            => req('GET',   `/api/schools/${sid}/exams${qs(p)}`, null, tok),
  getExam:          (sid, id, tok)           => req('GET',   `/api/schools/${sid}/exams/${id}`, null, tok),
  createExam:       (sid, body, tok)         => req('POST',  `/api/schools/${sid}/exams`, body, tok),
  updateExam:       (sid, id, body, tok)     => req('PATCH', `/api/schools/${sid}/exams/${id}`, body, tok),
  updateExamStatus: (sid, id, status, tok)   => req('PATCH', `/api/schools/${sid}/exams/${id}/status`, { status }, tok),

  // Class enrolment
  examClasses:  (sid, eid, tok)              => req('GET',    `/api/schools/${sid}/exams/${eid}/classes`, null, tok),
  enrollClass:  (sid, eid, body, tok)        => req('POST',   `/api/schools/${sid}/exams/${eid}/classes`, body, tok),
  removeClass:  (sid, eid, cid, tok)         => req('DELETE', `/api/schools/${sid}/exams/${eid}/classes/${cid}`, null, tok),

  // Exam subjects per class
  examSubjects:    (sid, eid, cid, tok)      => req('GET',    `/api/schools/${sid}/exams/${eid}/subjects${qs({ class_id: cid })}`, null, tok),
  addSubject:      (sid, eid, body, tok)     => req('POST',   `/api/schools/${sid}/exams/${eid}/subjects`, body, tok),
  bulkAddSubjects: (sid, eid, body, tok)     => req('POST',   `/api/schools/${sid}/exams/${eid}/subjects/bulk`, body, tok),
  removeExamSubj:  (sid, eid, sid2, cid, tok)=> req('DELETE', `/api/schools/${sid}/exams/${eid}/subjects/${sid2}${qs({ class_id: cid })}`, null, tok),

  // Marks entry
  marksheet:   (sid, eid, cid, tok)          => req('GET',  `/api/schools/${sid}/exams/${eid}/marksheet${qs({ class_id: cid })}`, null, tok),
  enterMark:   (sid, eid, body, tok)         => req('POST', `/api/schools/${sid}/exams/${eid}/marks`, body, tok),
  bulkMarks:   (sid, eid, body, tok)         => req('POST', `/api/schools/${sid}/exams/${eid}/marks/bulk`, body, tok),

  // Report cards
  compute:        (sid, eid, cid, tok)       => req('POST',  `/api/schools/${sid}/exams/${eid}/compute`, { class_id: cid }, tok),
  reportCards:    (sid, eid, cid, tok)       => req('GET',   `/api/schools/${sid}/exams/${eid}/report-cards${qs({ class_id: cid })}`, null, tok),
  studentCard:    (sid, eid, stId, tok)      => req('GET',   `/api/schools/${sid}/exams/${eid}/report-cards/${stId}`, null, tok),
  updateComments: (sid, eid, stId, body, tok)=> req('PATCH', `/api/schools/${sid}/exams/${eid}/report-cards/${stId}/comments`, body, tok),
  publish:        (sid, eid, cid, tok)       => req('POST',  `/api/schools/${sid}/exams/${eid}/publish`, { class_id: cid }, tok),
}

// ── CURRICULUM API ─────────────────────────────────────────────────────────────
export const curriculumApi = {
  // Subjects (curriculum subjects, linked to class + term)
  subjects:        (sid, p, tok)          => req('GET',    `/api/schools/${sid}/aca/subjects${qs(p)}`, null, tok),
  getSubject:      (sid, id, tok)         => req('GET',    `/api/schools/${sid}/aca/subjects/${id}`, null, tok),
  createSubject:   (sid, body, tok)       => req('POST',   `/api/schools/${sid}/aca/subjects`, body, tok),
  updateSubject:   (sid, id, body, tok)   => req('PATCH',  `/api/schools/${sid}/aca/subjects/${id}`, body, tok),
  deleteSubject:   (sid, id, tok)         => req('DELETE', `/api/schools/${sid}/aca/subjects/${id}`, null, tok),

  // Topics
  topics:          (sid, subjId, tok)     => req('GET',    `/api/schools/${sid}/aca/subjects/${subjId}/topics`, null, tok),
  getTopic:        (sid, id, tok)         => req('GET',    `/api/schools/${sid}/aca/topics/${id}`, null, tok),
  createTopic:     (sid, subjId, body, tok) => req('POST', `/api/schools/${sid}/aca/subjects/${subjId}/topics`, body, tok),
  updateTopic:     (sid, id, body, tok)   => req('PATCH',  `/api/schools/${sid}/aca/topics/${id}`, body, tok),
  deleteTopic:     (sid, id, tok)         => req('DELETE', `/api/schools/${sid}/aca/topics/${id}`, null, tok),

  // Subtopics
  subtopics:       (sid, topicId, tok)    => req('GET',    `/api/schools/${sid}/aca/topics/${topicId}/subtopics`, null, tok),
  getSubtopic:     (sid, id, tok)         => req('GET',    `/api/schools/${sid}/aca/subtopics/${id}`, null, tok),
  createSubtopic:  (sid, topicId, body, tok) => req('POST',`/api/schools/${sid}/aca/topics/${topicId}/subtopics`, body, tok),
  updateSubtopic:  (sid, id, body, tok)   => req('PATCH',  `/api/schools/${sid}/aca/subtopics/${id}`, body, tok),
  deleteSubtopic:  (sid, id, tok)         => req('DELETE', `/api/schools/${sid}/aca/subtopics/${id}`, null, tok),

  // Teacher allocations
  allocations:     (sid, p, tok)          => req('GET',    `/api/schools/${sid}/aca/teacher-allocations${qs(p)}`, null, tok),
  allocateTeacher: (sid, body, tok)       => req('POST',   `/api/schools/${sid}/aca/teacher-allocations`, body, tok),

  // Lessons
  lessons:         (sid, p, tok)          => req('GET',    `/api/schools/${sid}/aca/lessons${qs(p)}`, null, tok),
  getLesson:       (sid, id, tok)         => req('GET',    `/api/schools/${sid}/aca/lessons/${id}`, null, tok),
  createLesson:    (sid, body, tok)       => req('POST',   `/api/schools/${sid}/aca/lessons`, body, tok),
  updateLesson:    (sid, id, body, tok)   => req('PATCH',  `/api/schools/${sid}/aca/lessons/${id}`, body, tok),
  approveLesson:   (sid, id, body, tok)   => req('POST',   `/api/schools/${sid}/aca/lessons/${id}/approve`, body, tok),

  // Lesson plan attachments (R2 server-side)
  uploadPlanFile:      (sid, lessonId, formData, tok) => {
    const BASE = 'https://xedux.kawalyaumar500.workers.dev'
    return fetch(`${BASE}/api/schools/${sid}/aca/lessons/${lessonId}/plan/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: formData,
    }).then(r => r.json()).then(j => { if (!j.success) throw new Error(j.error?.message || j.message || 'Upload failed'); return j.data; })
  },
  listPlanAttachments: (sid, lessonId, tok)  => req('GET',    `/api/schools/${sid}/aca/lessons/${lessonId}/plan/attachments`, null, tok),
  deletePlanAttachment:(sid, attId, tok)     => req('DELETE', `/api/schools/${sid}/aca/lesson-plan-attachments/${attId}`, null, tok),

  // Case-study uploads (R2 server-side — single step)
  uploadCaseStudyFile: (sid, lessonId, formData, tok) => {
    const BASE = 'https://xedux.kawalyaumar500.workers.dev'
    return fetch(`${BASE}/api/schools/${sid}/aca/lessons/${lessonId}/case-study/upload`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: formData,
    }).then(r => r.json()).then(j => { if (!j.success) throw new Error(j.error?.message || j.message || 'Upload failed'); return j.data; })
  },
  listCaseStudyFiles:  (sid, lessonId, tok)  => req('GET',    `/api/schools/${sid}/aca/lessons/${lessonId}/case-study/attachments`, null, tok),
  deleteCaseStudyFile: (sid, attId, tok)     => req('DELETE', `/api/schools/${sid}/aca/case-study-attachments/${attId}`, null, tok),
  getCaseStudyStudent: (sid, lessonId, tok)  => req('GET',    `/api/schools/${sid}/aca/lessons/${lessonId}/case-study/student`, null, tok),

  // Marks
  submitMarks: (sid, lessonId, body, tok) => req('POST', `/api/schools/${sid}/aca/lessons/${lessonId}/marks`, body, tok),
  getMarks:    (sid, lessonId, tok)       => req('GET',  `/api/schools/${sid}/aca/lessons/${lessonId}/marks`, null, tok),

  // Teacher assessment
  teacherAssessment:       (sid, lessonId, tok)       => req('GET',  `/api/schools/${sid}/aca/lessons/${lessonId}/teacher-assessment`, null, tok),
  submitTeacherAssessment: (sid, lessonId, body, tok) => req('POST', `/api/schools/${sid}/aca/lessons/${lessonId}/teacher-assessment`, body, tok),

  // Coverage / completion
  termCompletion:       (sid, p, tok) => req('GET', `/api/schools/${sid}/aca/completion${qs(p)}`, null, tok),
  termCompletionReport: (sid, p, tok) => req('GET', `/api/schools/${sid}/aca/reports/term-completion${qs(p)}`, null, tok),
  weeklyReport:         (sid, p, tok) => req('GET', `/api/schools/${sid}/aca/reports/weekly${qs(p)}`, null, tok),
  classPerformance:     (sid, p, tok) => req('GET', `/api/schools/${sid}/aca/reports/class-performance${qs(p)}`, null, tok),
  studentReport:        (sid, studentId, p, tok) => req('GET', `/api/schools/${sid}/aca/reports/student/${studentId}${qs(p)}`, null, tok),
  teacherPerformance:   (sid, teacherId, p, tok) => req('GET', `/api/schools/${sid}/aca/reports/teacher-performance/${teacherId}${qs(p)}`, null, tok),
  studentAcademicProfile: (sid, studentId, p, tok) => req('GET', `/api/schools/${sid}/students/${studentId}/academic-profile${qs(p)}`, null, tok),
}

// ── TEACHER MANAGEMENT API ─────────────────────────────────────────────────────
export const teacherApi = {
  // Teachers
  list:         (sid, p, tok)         => req('GET',    `/api/schools/${sid}/tchr/teachers${qs(p)}`, null, tok),
  get:          (sid, uid, tok)       => req('GET',    `/api/schools/${sid}/tchr/teachers/${uid}`, null, tok),
  create:       (sid, body, tok)      => req('POST',   `/api/schools/${sid}/tchr/teachers`, body, tok),
  update:       (sid, uid, body, tok) => req('PATCH',  `/api/schools/${sid}/tchr/teachers/${uid}`, body, tok),
  setStatus:    (sid, uid, body, tok) => req('PATCH',  `/api/schools/${sid}/tchr/teachers/${uid}/status`, body, tok),
  // Qualifications
  quals:        (sid, uid, tok)       => req('GET',    `/api/schools/${sid}/tchr/teachers/${uid}/qualifications`, null, tok),
  addQual:      (sid, uid, body, tok) => req('POST',   `/api/schools/${sid}/tchr/teachers/${uid}/qualifications`, body, tok),
  delQual:      (sid, qid, tok)       => req('DELETE', `/api/schools/${sid}/tchr/teachers/qualifications/${qid}`, null, tok),
  // School users (for dropdowns)
  schoolUsers:  (sid, tok)            => req('GET',    `/api/schools/${sid}/tchr/users`, null, tok),
  // Allocations
  allocations:  (sid, p, tok)         => req('GET',    `/api/schools/${sid}/tchr/allocations${qs(p)}`, null, tok),
  allocate:     (sid, body, tok)      => req('POST',   `/api/schools/${sid}/tchr/allocations`, body, tok),
  bulkAllocate: (sid, body, tok)      => req('POST',   `/api/schools/${sid}/tchr/allocations/bulk`, body, tok),
  removeAlloc:  (sid, id, tok)        => req('DELETE', `/api/schools/${sid}/tchr/allocations/${id}`, null, tok),
  // Load
  load:         (sid, p, tok)         => req('GET',    `/api/schools/${sid}/tchr/load${qs(p)}`, null, tok),
}

// patch teacherApi to add roles endpoint
// (added here to avoid rewriting the block above)
teacherApi.roles = (sid, tok) => req('GET', `/api/schools/${sid}/tchr/roles`, null, tok)
