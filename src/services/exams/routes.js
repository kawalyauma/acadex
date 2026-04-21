// ============================================================
// services/exams/routes.js
// Register exam module routes into the itty-router
// Usage: registerExamRoutes(router) in index.js
// ============================================================
import { authMiddleware, extractSchoolContext } from '../../middleware/auth'
import { rbacMiddleware } from '../../middleware/rbac'
import { respondSuccess, respondError } from '../../utils/response'
import * as ExamService from './service'

const ADMIN   = ['platform_super_admin', 'school_admin', 'head_teacher']
const TEACHER = ['platform_super_admin', 'school_admin', 'head_teacher', 'class_teacher', 'teacher']

export function registerExamRoutes(router) {

  // ─────────────────────────────────────────────────────────
  // SUBJECTS
  // ─────────────────────────────────────────────────────────
  router.get('/api/schools/:schoolId/exams/subjects',
    authMiddleware, extractSchoolContext,
    async (req, env) => {
      try {
        const { class_id } = req.query
        return respondSuccess(await ExamService.listSubjects(env.DB, req.schoolId, { class_id }))
      } catch (e) { return respondError(e.message) }
    })

  router.post('/api/schools/:schoolId/exams/subjects',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const data = await req.json()
        return respondSuccess(await ExamService.createSubject(env.DB, req.schoolId, data, req.user.id), 201)
      } catch (e) { return respondError(e.message) }
    })

  router.patch('/api/schools/:schoolId/exams/subjects/:subjectId',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { subjectId } = req.params
        const data = await req.json()
        return respondSuccess(await ExamService.updateSubject(env.DB, req.schoolId, subjectId, data, req.user.id))
      } catch (e) { return respondError(e.message) }
    })

  router.delete('/api/schools/:schoolId/exams/subjects/:subjectId',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { subjectId } = req.params
        return respondSuccess(await ExamService.deleteSubject(env.DB, req.schoolId, subjectId))
      } catch (e) { return respondError(e.message) }
    })

  // ─────────────────────────────────────────────────────────
  // GRADING SCALES
  // ─────────────────────────────────────────────────────────
  router.get('/api/schools/:schoolId/exams/grading-scales',
    authMiddleware, extractSchoolContext,
    async (req, env) => {
      try {
        return respondSuccess(await ExamService.listGradingScales(env.DB, req.schoolId))
      } catch (e) { return respondError(e.message) }
    })

  router.post('/api/schools/:schoolId/exams/grading-scales/seed-ple',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        return respondSuccess(await ExamService.createDefaultGradingScale(env.DB, req.schoolId, req.user.id))
      } catch (e) { return respondError(e.message) }
    })

  router.patch('/api/schools/:schoolId/exams/grade-bands/:bandId',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { bandId } = req.params
        const data = await req.json()
        return respondSuccess(await ExamService.updateGradeBand(env.DB, req.schoolId, bandId, data))
      } catch (e) { return respondError(e.message) }
    })

  // ─────────────────────────────────────────────────────────
  // COMMENT RULES
  // ─────────────────────────────────────────────────────────
  router.get('/api/schools/:schoolId/exams/comment-rules',
    authMiddleware, extractSchoolContext,
    async (req, env) => {
      try {
        const { type } = req.query
        return respondSuccess(await ExamService.listCommentRules(env.DB, req.schoolId, type))
      } catch (e) { return respondError(e.message) }
    })

  router.post('/api/schools/:schoolId/exams/comment-rules',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const data = await req.json()
        return respondSuccess(await ExamService.upsertCommentRule(env.DB, req.schoolId, data, req.user.id), 201)
      } catch (e) { return respondError(e.message) }
    })

  router.post('/api/schools/:schoolId/exams/comment-rules/seed-defaults',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        return respondSuccess(await ExamService.seedDefaultComments(env.DB, req.schoolId, req.user.id))
      } catch (e) { return respondError(e.message) }
    })

  router.delete('/api/schools/:schoolId/exams/comment-rules/:ruleId',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { ruleId } = req.params
        return respondSuccess(await ExamService.deleteCommentRule(env.DB, req.schoolId, ruleId))
      } catch (e) { return respondError(e.message) }
    })

  // ─────────────────────────────────────────────────────────
  // EXAMS (CRUD)
  // ─────────────────────────────────────────────────────────
  router.get('/api/schools/:schoolId/exams',
    authMiddleware, extractSchoolContext,
    async (req, env) => {
      try {
        const { status, term_id, academic_year_id } = req.query
        return respondSuccess(await ExamService.listExams(env.DB, req.schoolId, { status, term_id, academic_year_id }))
      } catch (e) { return respondError(e.message) }
    })

  router.get('/api/schools/:schoolId/exams/:examId',
    authMiddleware, extractSchoolContext,
    async (req, env) => {
      try {
        const { examId } = req.params
        return respondSuccess(await ExamService.getExam(env.DB, req.schoolId, examId))
      } catch (e) { return respondError(e.message, 404) }
    })

  router.post('/api/schools/:schoolId/exams',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const data = await req.json()
        if (!data.name) return respondError('Exam name is required', 400)
        return respondSuccess(await ExamService.createExam(env.DB, req.schoolId, data, req.user.id), 201)
      } catch (e) { return respondError(e.message) }
    })

  router.patch('/api/schools/:schoolId/exams/:examId',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { examId } = req.params
        const data = await req.json()
        return respondSuccess(await ExamService.updateExam(env.DB, req.schoolId, examId, data))
      } catch (e) { return respondError(e.message) }
    })

  router.patch('/api/schools/:schoolId/exams/:examId/status',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { examId } = req.params
        const { status } = await req.json()
        return respondSuccess(await ExamService.updateExamStatus(env.DB, req.schoolId, examId, status))
      } catch (e) { return respondError(e.message) }
    })

  // ─────────────────────────────────────────────────────────
  // EXAM CLASS ENROLMENT
  // ─────────────────────────────────────────────────────────
  router.get('/api/schools/:schoolId/exams/:examId/classes',
    authMiddleware, extractSchoolContext,
    async (req, env) => {
      try {
        const { examId } = req.params
        return respondSuccess(await ExamService.listExamClasses(env.DB, examId))
      } catch (e) { return respondError(e.message) }
    })

  router.post('/api/schools/:schoolId/exams/:examId/classes',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { examId } = req.params
        const { class_id, stream_id } = await req.json()
        if (!class_id) return respondError('class_id is required', 400)
        return respondSuccess(await ExamService.enrollClassInExam(env.DB, req.schoolId, examId, class_id, stream_id, req.user.id), 201)
      } catch (e) { return respondError(e.message) }
    })

  router.delete('/api/schools/:schoolId/exams/:examId/classes/:classId',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { examId, classId } = req.params
        return respondSuccess(await ExamService.removeClassFromExam(env.DB, req.schoolId, examId, classId))
      } catch (e) { return respondError(e.message) }
    })

  // ─────────────────────────────────────────────────────────
  // EXAM SUBJECTS (per class)
  // ─────────────────────────────────────────────────────────
  router.get('/api/schools/:schoolId/exams/:examId/subjects',
    authMiddleware, extractSchoolContext,
    async (req, env) => {
      try {
        const { examId } = req.params
        const { class_id } = req.query
        return respondSuccess(await ExamService.listExamSubjects(env.DB, req.schoolId, examId, class_id))
      } catch (e) { return respondError(e.message) }
    })

  router.post('/api/schools/:schoolId/exams/:examId/subjects',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { examId } = req.params
        const data = await req.json()
        if (!data.class_id || !data.subject_id) return respondError('class_id and subject_id required', 400)
        return respondSuccess(await ExamService.addSubjectToExam(env.DB, req.schoolId, examId, data.class_id, data.subject_id, data, req.user.id), 201)
      } catch (e) { return respondError(e.message) }
    })

  router.post('/api/schools/:schoolId/exams/:examId/subjects/bulk',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { examId } = req.params
        const { class_id, subject_ids } = await req.json()
        if (!class_id || !Array.isArray(subject_ids)) return respondError('class_id and subject_ids[] required', 400)
        return respondSuccess(await ExamService.bulkAddSubjectsToExam(env.DB, req.schoolId, examId, class_id, subject_ids, req.user.id))
      } catch (e) { return respondError(e.message) }
    })

  router.delete('/api/schools/:schoolId/exams/:examId/subjects/:subjectId',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { examId, subjectId } = req.params
        const { class_id } = req.query
        return respondSuccess(await ExamService.removeSubjectFromExam(env.DB, req.schoolId, examId, class_id, subjectId))
      } catch (e) { return respondError(e.message) }
    })

  // ─────────────────────────────────────────────────────────
  // MARKSHEET & MARKS ENTRY
  // ─────────────────────────────────────────────────────────
  router.get('/api/schools/:schoolId/exams/:examId/marksheet',
    authMiddleware, extractSchoolContext,
    async (req, env) => {
      try {
        const { examId } = req.params
        const { class_id } = req.query
        if (!class_id) return respondError('class_id query param required', 400)
        return respondSuccess(await ExamService.getMarksheet(env.DB, req.schoolId, examId, class_id))
      } catch (e) { return respondError(e.message) }
    })

  router.post('/api/schools/:schoolId/exams/:examId/marks',
    authMiddleware, extractSchoolContext, rbacMiddleware(TEACHER),
    async (req, env) => {
      try {
        const { examId } = req.params
        const data = await req.json()
        const { student_id, subject_id, ...markData } = data
        if (!student_id || !subject_id) return respondError('student_id and subject_id required', 400)
        return respondSuccess(await ExamService.enterMark(env.DB, req.schoolId, examId, student_id, subject_id, markData, req.user.id))
      } catch (e) { return respondError(e.message) }
    })

  router.post('/api/schools/:schoolId/exams/:examId/marks/bulk',
    authMiddleware, extractSchoolContext, rbacMiddleware(TEACHER),
    async (req, env) => {
      try {
        const { examId } = req.params
        const { subject_id, records } = await req.json()
        if (!subject_id || !Array.isArray(records)) return respondError('subject_id and records[] required', 400)
        return respondSuccess(await ExamService.bulkEnterMarks(env.DB, req.schoolId, examId, subject_id, records, req.user.id))
      } catch (e) { return respondError(e.message) }
    })

  // ─────────────────────────────────────────────────────────
  // REPORT CARDS
  // ─────────────────────────────────────────────────────────
  router.post('/api/schools/:schoolId/exams/:examId/compute',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { examId } = req.params
        const { class_id } = await req.json()
        if (!class_id) return respondError('class_id required', 400)
        return respondSuccess(await ExamService.computeClassReportCards(env.DB, req.schoolId, examId, class_id, req.user.id))
      } catch (e) { return respondError(e.message) }
    })

  router.get('/api/schools/:schoolId/exams/:examId/report-cards',
    authMiddleware, extractSchoolContext,
    async (req, env) => {
      try {
        const { examId } = req.params
        const { class_id } = req.query
        if (!class_id) return respondError('class_id required', 400)
        return respondSuccess(await ExamService.getClassReportSummary(env.DB, req.schoolId, examId, class_id))
      } catch (e) { return respondError(e.message) }
    })

  router.get('/api/schools/:schoolId/exams/:examId/report-cards/:studentId',
    authMiddleware, extractSchoolContext,
    async (req, env) => {
      try {
        const { examId, studentId } = req.params
        return respondSuccess(await ExamService.getStudentReportCard(env.DB, req.schoolId, examId, studentId))
      } catch (e) { return respondError(e.message, 404) }
    })

  router.patch('/api/schools/:schoolId/exams/:examId/report-cards/:studentId/comments',
    authMiddleware, extractSchoolContext, rbacMiddleware(TEACHER),
    async (req, env) => {
      try {
        const { examId, studentId } = req.params
        const data = await req.json()
        return respondSuccess(await ExamService.updateReportCardComment(env.DB, req.schoolId, examId, studentId, data, req.user.id))
      } catch (e) { return respondError(e.message) }
    })

  router.post('/api/schools/:schoolId/exams/:examId/publish',
    authMiddleware, extractSchoolContext, rbacMiddleware(ADMIN),
    async (req, env) => {
      try {
        const { examId } = req.params
        const { class_id } = await req.json()
        return respondSuccess(await ExamService.publishExamResults(env.DB, req.schoolId, examId, class_id, req.user.id))
      } catch (e) { return respondError(e.message) }
    })
}
