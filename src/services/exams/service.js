// ============================================================
// services/exams/service.js
// Uganda PLE Exam Module — subjects, grading, marks, report cards
// ============================================================

function now() { return new Date().toISOString() }

// ── HELPERS ─────────────────────────────────────────────────

/** Uganda PLE default grade bands */
const PLE_BANDS = [
  { grade: 'D1', label: 'Distinction', min_mark: 90, max_mark: 100, points: 1, color_hex: '#059669', sort_order: 1 },
  { grade: 'D2', label: 'Distinction', min_mark: 80, max_mark: 89,  points: 2, color_hex: '#10B981', sort_order: 2 },
  { grade: 'C3', label: 'Credit',      min_mark: 70, max_mark: 79,  points: 3, color_hex: '#2563EB', sort_order: 3 },
  { grade: 'C4', label: 'Credit',      min_mark: 60, max_mark: 69,  points: 4, color_hex: '#3B82F6', sort_order: 4 },
  { grade: 'C5', label: 'Credit',      min_mark: 55, max_mark: 59,  points: 5, color_hex: '#60A5FA', sort_order: 5 },
  { grade: 'C6', label: 'Credit',      min_mark: 50, max_mark: 54,  points: 6, color_hex: '#93C5FD', sort_order: 6 },
  { grade: 'P7', label: 'Pass',        min_mark: 45, max_mark: 49,  points: 7, color_hex: '#F59E0B', sort_order: 7 },
  { grade: 'P8', label: 'Pass',        min_mark: 40, max_mark: 44,  points: 8, color_hex: '#D97706', sort_order: 8 },
  { grade: 'F9', label: 'Fail',        min_mark:  0, max_mark: 39,  points: 9, color_hex: '#DC2626', sort_order: 9 },
]

/** Uganda PLE default comments */
const DEFAULT_CT_COMMENTS = [
  { min_agg: 4,  max_agg: 8,  comment_text: 'Excellent performance! This student has demonstrated outstanding academic ability. Keep up the great work.' },
  { min_agg: 9,  max_agg: 14, comment_text: 'Very good performance. This student is performing above average. Consistent effort will lead to even better results.' },
  { min_agg: 15, max_agg: 20, comment_text: 'Good performance. The student is progressing well. With a little more effort, great results are attainable.' },
  { min_agg: 21, max_agg: 28, comment_text: 'Fair performance. The student needs to work harder, especially in weak subjects. Regular revision is highly encouraged.' },
  { min_agg: 29, max_agg: 36, comment_text: 'Below average performance. The student must put in extra effort and attend extra classes. Parental support is needed.' },
  { min_agg: 37, max_agg: 99, comment_text: 'Poor performance. The student is struggling and needs immediate intervention. Please consult with the class teacher urgently.' },
]

const DEFAULT_HT_COMMENTS = [
  { min_agg: 4,  max_agg: 8,  comment_text: 'Exceptional results. We are very proud of this student\'s achievement. Continue to soar high.' },
  { min_agg: 9,  max_agg: 14, comment_text: 'Commendable performance. This student shows real promise. We encourage continued dedication to studies.' },
  { min_agg: 15, max_agg: 20, comment_text: 'Satisfactory performance. The school believes this student can achieve much more with sustained commitment.' },
  { min_agg: 21, max_agg: 28, comment_text: 'Average performance. We urge the student to take studies more seriously and participate actively in class.' },
  { min_agg: 29, max_agg: 36, comment_text: 'Needs improvement. The school calls upon the parents and student to work closely with teachers for better results.' },
  { min_agg: 37, max_agg: 99, comment_text: 'Very poor results. Immediate and serious attention is required. Please schedule a meeting with school management.' },
]

/**
 * Compute grade from a mark using the given grade bands.
 * Returns { grade, grade_points, label, percentage }
 */
function computeGrade(marksObtained, maxMark, bands) {
  if (marksObtained == null) return { grade: null, grade_points: null, label: null, percentage: null }
  const pct = maxMark > 0 ? Math.round((marksObtained / maxMark) * 100 * 10) / 10 : 0
  const band = bands.find(b => pct >= b.min_mark && pct <= b.max_mark) || bands[bands.length - 1]
  return { grade: band.grade, grade_points: band.points, label: band.label, percentage: pct }
}

/**
 * Pick a comment for a given aggregate and type ('class_teacher'|'head_teacher').
 */
function pickComment(aggregate, rules) {
  if (aggregate == null) return null
  const rule = rules.find(r => aggregate >= r.min_agg && aggregate <= r.max_agg)
  return rule?.comment_text ?? null
}

// ── SUBJECTS ────────────────────────────────────────────────

export async function listSubjects(db, schoolId, filters = {}) {
  let sql = `SELECT s.*, c.name as class_name
             FROM exm_subjects s
             LEFT JOIN classes c ON c.id = s.class_id
             WHERE s.school_id = ? AND s.is_active = 1`
  const params = [schoolId]
  if (filters.class_id) { sql += ' AND (s.class_id = ? OR s.class_id IS NULL)'; params.push(filters.class_id) }
  sql += ' ORDER BY s.sort_order ASC, s.name ASC'
  return (await db.prepare(sql).bind(...params).all()).results
}

export async function createSubject(db, schoolId, data, userId) {
  const r = await db.prepare(`
    INSERT INTO exm_subjects (school_id, name, code, class_id, is_gradable, max_mark, passing_mark, sort_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    schoolId, data.name, data.code || null,
    data.class_id ? parseInt(data.class_id) : null,
    data.is_gradable ?? 1,
    data.max_mark ?? 100,
    data.passing_mark ?? 50,
    data.sort_order ?? 0,
    userId
  ).run()
  return db.prepare('SELECT * FROM exm_subjects WHERE id = ?').bind(r.meta.last_row_id).first()
}

export async function updateSubject(db, schoolId, subjectId, data, userId) {
  await db.prepare(`
    UPDATE exm_subjects SET
      name=?, code=?, class_id=?, is_gradable=?, max_mark=?, passing_mark=?,
      sort_order=?, is_active=?, updated_at=?
    WHERE id=? AND school_id=?
  `).bind(
    data.name, data.code || null,
    data.class_id ? parseInt(data.class_id) : null,
    data.is_gradable ?? 1,
    data.max_mark ?? 100,
    data.passing_mark ?? 50,
    data.sort_order ?? 0,
    data.is_active ?? 1,
    now(), subjectId, schoolId
  ).run()
  return db.prepare('SELECT * FROM exm_subjects WHERE id=?').bind(subjectId).first()
}

export async function deleteSubject(db, schoolId, subjectId) {
  await db.prepare('UPDATE exm_subjects SET is_active=0, updated_at=? WHERE id=? AND school_id=?')
    .bind(now(), subjectId, schoolId).run()
  return { deleted: true }
}

// ── GRADING SCALES ───────────────────────────────────────────

export async function createDefaultGradingScale(db, schoolId, userId) {
  // Check if already exists
  const existing = await db.prepare(
    'SELECT id FROM exm_grading_scales WHERE school_id=? AND is_default=1'
  ).bind(schoolId).first()
  if (existing) return existing

  const r = await db.prepare(
    'INSERT INTO exm_grading_scales (school_id, name, is_default, created_by) VALUES (?,?,1,?)'
  ).bind(schoolId, 'Uganda PLE Scale', userId).run()
  const scaleId = r.meta.last_row_id

  for (const b of PLE_BANDS) {
    await db.prepare(`
      INSERT INTO exm_grade_bands (grading_scale_id, school_id, grade, label, min_mark, max_mark, points, color_hex, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(scaleId, schoolId, b.grade, b.label, b.min_mark, b.max_mark, b.points, b.color_hex, b.sort_order).run()
  }

  return db.prepare('SELECT * FROM exm_grading_scales WHERE id=?').bind(scaleId).first()
}

export async function listGradingScales(db, schoolId) {
  const scales = (await db.prepare(
    'SELECT * FROM exm_grading_scales WHERE school_id=? ORDER BY is_default DESC'
  ).bind(schoolId).all()).results

  for (const s of scales) {
    s.bands = (await db.prepare(
      'SELECT * FROM exm_grade_bands WHERE grading_scale_id=? ORDER BY sort_order ASC'
    ).bind(s.id).all()).results
  }
  return scales
}

export async function updateGradeBand(db, schoolId, bandId, data) {
  await db.prepare(`
    UPDATE exm_grade_bands SET grade=?, label=?, min_mark=?, max_mark=?, points=?, color_hex=?, sort_order=?
    WHERE id=? AND school_id=?
  `).bind(data.grade, data.label, data.min_mark, data.max_mark, data.points, data.color_hex || '#64748B', data.sort_order ?? 0, bandId, schoolId).run()
  return db.prepare('SELECT * FROM exm_grade_bands WHERE id=?').bind(bandId).first()
}

// ── COMMENT RULES ────────────────────────────────────────────

export async function seedDefaultComments(db, schoolId, userId) {
  const existing = await db.prepare(
    'SELECT COUNT(*) as cnt FROM exm_comment_rules WHERE school_id=?'
  ).bind(schoolId).first()
  if (existing?.cnt > 0) return { skipped: true }

  for (const c of DEFAULT_CT_COMMENTS) {
    await db.prepare(`
      INSERT INTO exm_comment_rules (school_id, comment_type, min_agg, max_agg, comment_text, created_by)
      VALUES (?,?,?,?,?,?)
    `).bind(schoolId, 'class_teacher', c.min_agg, c.max_agg, c.comment_text, userId).run()
  }
  for (const c of DEFAULT_HT_COMMENTS) {
    await db.prepare(`
      INSERT INTO exm_comment_rules (school_id, comment_type, min_agg, max_agg, comment_text, created_by)
      VALUES (?,?,?,?,?,?)
    `).bind(schoolId, 'head_teacher', c.min_agg, c.max_agg, c.comment_text, userId).run()
  }
  return { seeded: true }
}

export async function listCommentRules(db, schoolId, type) {
  let sql = 'SELECT * FROM exm_comment_rules WHERE school_id=?'
  const params = [schoolId]
  if (type) { sql += ' AND comment_type=?'; params.push(type) }
  sql += ' ORDER BY comment_type ASC, min_agg ASC'
  return (await db.prepare(sql).bind(...params).all()).results
}

export async function upsertCommentRule(db, schoolId, data, userId) {
  if (data.id) {
    await db.prepare(`
      UPDATE exm_comment_rules SET min_agg=?, max_agg=?, comment_text=?, updated_at=?
      WHERE id=? AND school_id=?
    `).bind(data.min_agg, data.max_agg, data.comment_text, now(), data.id, schoolId).run()
    return db.prepare('SELECT * FROM exm_comment_rules WHERE id=?').bind(data.id).first()
  }
  const r = await db.prepare(`
    INSERT INTO exm_comment_rules (school_id, comment_type, min_agg, max_agg, comment_text, created_by)
    VALUES (?,?,?,?,?,?)
  `).bind(schoolId, data.comment_type, data.min_agg, data.max_agg, data.comment_text, userId).run()
  return db.prepare('SELECT * FROM exm_comment_rules WHERE id=?').bind(r.meta.last_row_id).first()
}

export async function deleteCommentRule(db, schoolId, ruleId) {
  await db.prepare('DELETE FROM exm_comment_rules WHERE id=? AND school_id=?').bind(ruleId, schoolId).run()
  return { deleted: true }
}

// ── EXAMS ────────────────────────────────────────────────────

export async function listExams(db, schoolId, filters = {}) {
  let sql = `
    SELECT e.*, t.name as term_name, ay.name as academic_year_name,
           gs.name as grading_scale_name
    FROM exm_exams e
    LEFT JOIN terms t ON t.id = e.term_id
    LEFT JOIN academic_years ay ON ay.id = e.academic_year_id
    LEFT JOIN exm_grading_scales gs ON gs.id = e.grading_scale_id
    WHERE e.school_id = ?`
  const params = [schoolId]
  if (filters.status)          { sql += ' AND e.status=?';          params.push(filters.status) }
  if (filters.term_id)         { sql += ' AND e.term_id=?';         params.push(filters.term_id) }
  if (filters.academic_year_id){ sql += ' AND e.academic_year_id=?'; params.push(filters.academic_year_id) }
  sql += ' ORDER BY e.created_at DESC'
  return (await db.prepare(sql).bind(...params).all()).results
}

export async function getExam(db, schoolId, examId) {
  const exam = await db.prepare(`
    SELECT e.*, t.name as term_name, ay.name as academic_year_name
    FROM exm_exams e
    LEFT JOIN terms t ON t.id = e.term_id
    LEFT JOIN academic_years ay ON ay.id = e.academic_year_id
    WHERE e.id=? AND e.school_id=?
  `).bind(examId, schoolId).first()
  if (!exam) throw new Error('Exam not found')

  // Attach enrolled classes
  exam.classes = (await db.prepare(`
    SELECT ec.*, c.name as class_name, s.name as stream_name
    FROM exm_exam_classes ec
    LEFT JOIN classes c ON c.id = ec.class_id
    LEFT JOIN streams s ON s.id = ec.stream_id
    WHERE ec.exam_id=?
  `).bind(examId).all()).results

  return exam
}

export async function createExam(db, schoolId, data, userId) {
  // Auto-create default grading scale if none exists
  const defaultScale = await db.prepare(
    'SELECT id FROM exm_grading_scales WHERE school_id=? AND is_default=1'
  ).bind(schoolId).first()
  const scaleId = data.grading_scale_id || defaultScale?.id || null

  const r = await db.prepare(`
    INSERT INTO exm_exams (school_id, term_id, academic_year_id, name, exam_type, start_date, end_date, grading_scale_id, status, remarks, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    schoolId,
    data.term_id         || null,
    data.academic_year_id || null,
    data.name,
    data.exam_type       || 'end_of_term',
    data.start_date      || null,
    data.end_date        || null,
    scaleId,
    'draft',
    data.remarks         || null,
    userId
  ).run()

  return db.prepare('SELECT * FROM exm_exams WHERE id=?').bind(r.meta.last_row_id).first()
}

export async function updateExam(db, schoolId, examId, data) {
  await db.prepare(`
    UPDATE exm_exams SET name=?, exam_type=?, start_date=?, end_date=?, term_id=?,
      academic_year_id=?, grading_scale_id=?, status=?, remarks=?, updated_at=?
    WHERE id=? AND school_id=?
  `).bind(
    data.name, data.exam_type, data.start_date || null, data.end_date || null,
    data.term_id || null, data.academic_year_id || null,
    data.grading_scale_id || null, data.status || 'draft',
    data.remarks || null, now(), examId, schoolId
  ).run()
  return db.prepare('SELECT * FROM exm_exams WHERE id=?').bind(examId).first()
}

export async function updateExamStatus(db, schoolId, examId, status) {
  const valid = ['draft','active','marking','published','archived']
  if (!valid.includes(status)) throw new Error(`Invalid status: ${status}`)
  await db.prepare('UPDATE exm_exams SET status=?, updated_at=? WHERE id=? AND school_id=?')
    .bind(status, now(), examId, schoolId).run()
  return db.prepare('SELECT * FROM exm_exams WHERE id=?').bind(examId).first()
}

// ── EXAM CLASS ENROLMENT ─────────────────────────────────────

export async function enrollClassInExam(db, schoolId, examId, classId, streamId, userId) {
  const exam = await db.prepare('SELECT id, status FROM exm_exams WHERE id=? AND school_id=?').bind(examId, schoolId).first()
  if (!exam) throw new Error('Exam not found')
  if (!['draft','active'].includes(exam.status)) throw new Error('Can only enrol classes in draft or active exams')

  await db.prepare(`
    INSERT OR IGNORE INTO exm_exam_classes (school_id, exam_id, class_id, stream_id)
    VALUES (?,?,?,?)
  `).bind(schoolId, examId, classId, streamId || null).run()

  return db.prepare('SELECT * FROM exm_exam_classes WHERE exam_id=? AND class_id=?').bind(examId, classId).first()
}

export async function removeClassFromExam(db, schoolId, examId, classId) {
  await db.prepare('DELETE FROM exm_exam_classes WHERE exam_id=? AND class_id=? AND school_id=?')
    .bind(examId, classId, schoolId).run()
  // Also remove exam subjects for that class
  await db.prepare('DELETE FROM exm_exam_subjects WHERE exam_id=? AND class_id=? AND school_id=?')
    .bind(examId, classId, schoolId).run()
  return { removed: true }
}

export async function listExamClasses(db, examId) {
  return (await db.prepare(`
    SELECT ec.*, c.name as class_name, s.name as stream_name
    FROM exm_exam_classes ec
    LEFT JOIN classes c ON c.id = ec.class_id
    LEFT JOIN streams s ON s.id = ec.stream_id
    WHERE ec.exam_id=?
    ORDER BY c.level ASC, c.name ASC
  `).bind(examId).all()).results
}

// ── EXAM SUBJECTS ────────────────────────────────────────────

export async function addSubjectToExam(db, schoolId, examId, classId, subjectId, overrides, userId) {
  const subject = await db.prepare('SELECT * FROM exm_subjects WHERE id=? AND school_id=?').bind(subjectId, schoolId).first()
  if (!subject) throw new Error('Subject not found')

  await db.prepare(`
    INSERT OR REPLACE INTO exm_exam_subjects (school_id, exam_id, class_id, subject_id, max_mark, passing_mark, is_gradable)
    VALUES (?,?,?,?,?,?,?)
  `).bind(
    schoolId, examId, classId, subjectId,
    overrides?.max_mark    ?? subject.max_mark,
    overrides?.passing_mark ?? subject.passing_mark,
    overrides?.is_gradable  ?? subject.is_gradable,
  ).run()

  return db.prepare(`
    SELECT es.*, subj.name as subject_name, subj.code as subject_code
    FROM exm_exam_subjects es
    LEFT JOIN exm_subjects subj ON subj.id = es.subject_id
    WHERE es.exam_id=? AND es.class_id=? AND es.subject_id=?
  `).bind(examId, classId, subjectId).first()
}

export async function bulkAddSubjectsToExam(db, schoolId, examId, classId, subjectIds, userId) {
  const results = []
  for (const sid of subjectIds) {
    try {
      const r = await addSubjectToExam(db, schoolId, examId, classId, sid, {}, userId)
      results.push(r)
    } catch { /* skip individual errors */ }
  }
  return results
}

export async function removeSubjectFromExam(db, schoolId, examId, classId, subjectId) {
  await db.prepare('DELETE FROM exm_exam_subjects WHERE exam_id=? AND class_id=? AND subject_id=? AND school_id=?')
    .bind(examId, classId, subjectId, schoolId).run()
  return { removed: true }
}

export async function listExamSubjects(db, schoolId, examId, classId) {
  let sql = `
    SELECT es.*, subj.name as subject_name, subj.code as subject_code, subj.sort_order
    FROM exm_exam_subjects es
    LEFT JOIN exm_subjects subj ON subj.id = es.subject_id
    WHERE es.exam_id=? AND es.school_id=?`
  const params = [examId, schoolId]
  if (classId) { sql += ' AND es.class_id=?'; params.push(classId) }
  sql += ' ORDER BY subj.sort_order ASC, subj.name ASC'
  return (await db.prepare(sql).bind(...params).all()).results
}

// ── MARKS ENTRY ──────────────────────────────────────────────

export async function enterMark(db, schoolId, examId, studentId, subjectId, marksData, userId) {
  // Get exam subject config
  const examSubj = await db.prepare(`
    SELECT * FROM exm_exam_subjects WHERE exam_id=? AND subject_id=?
  `).bind(examId, subjectId).first()
  if (!examSubj) throw new Error('Subject is not configured for this exam')

  // Get grading bands for this exam
  const exam = await db.prepare('SELECT grading_scale_id, school_id FROM exm_exams WHERE id=?').bind(examId).first()
  const bands = exam?.grading_scale_id
    ? (await db.prepare('SELECT * FROM exm_grade_bands WHERE grading_scale_id=? ORDER BY sort_order ASC')
        .bind(exam.grading_scale_id).all()).results
    : PLE_BANDS

  // Compute grade
  const marks = marksData.is_absent ? null : (marksData.marks_obtained ?? null)
  const computed = examSubj.is_gradable
    ? computeGrade(marks, examSubj.max_mark, bands)
    : { grade: 'NG', grade_points: null, label: 'Non-Gradable', percentage: marks != null ? Math.round(marks / examSubj.max_mark * 100 * 10) / 10 : null }

  // Get existing record
  const existing = await db.prepare(
    'SELECT id, marks_obtained FROM exm_marks WHERE exam_id=? AND student_id=? AND subject_id=?'
  ).bind(examId, studentId, subjectId).first()

  const student = await db.prepare('SELECT current_class_id FROM students WHERE id=?').bind(studentId).first()

  if (existing) {
    // Audit trail
    await db.prepare(`
      INSERT INTO exm_mark_audit (school_id, mark_id, action, old_mark, new_mark, changed_by, reason)
      VALUES (?,?,?,?,?,?,?)
    `).bind(schoolId, existing.id, 'updated', existing.marks_obtained, marks, userId, marksData.reason || null).run()

    await db.prepare(`
      UPDATE exm_marks SET marks_obtained=?, is_absent=?, is_exempt=?,
        percentage=?, grade=?, grade_points=?, remarks=?, entered_by=?, entered_at=?, updated_at=?
      WHERE id=?
    `).bind(
      marks, marksData.is_absent ? 1 : 0, marksData.is_exempt ? 1 : 0,
      computed.percentage, computed.grade, computed.grade_points,
      marksData.remarks || null, userId, now(), now(), existing.id
    ).run()

    return db.prepare('SELECT * FROM exm_marks WHERE id=?').bind(existing.id).first()
  } else {
    const r = await db.prepare(`
      INSERT INTO exm_marks (school_id, exam_id, exam_subject_id, student_id, class_id, subject_id,
        marks_obtained, is_absent, is_exempt, percentage, grade, grade_points, remarks, entered_by, entered_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      schoolId, examId, examSubj.id, studentId,
      student?.current_class_id || examSubj.class_id,
      subjectId, marks,
      marksData.is_absent ? 1 : 0, marksData.is_exempt ? 1 : 0,
      computed.percentage, computed.grade, computed.grade_points,
      marksData.remarks || null, userId, now()
    ).run()

    await db.prepare(`
      INSERT INTO exm_mark_audit (school_id, mark_id, action, new_mark, changed_by)
      VALUES (?,?,?,?,?)
    `).bind(schoolId, r.meta.last_row_id, 'entered', marks, userId).run()

    return db.prepare('SELECT * FROM exm_marks WHERE id=?').bind(r.meta.last_row_id).first()
  }
}

/**
 * Bulk enter marks for a whole class on one subject.
 * records: [{ student_id, marks_obtained, is_absent?, is_exempt?, remarks? }]
 */
export async function bulkEnterMarks(db, schoolId, examId, subjectId, records, userId) {
  const results = []
  for (const rec of records) {
    try {
      const r = await enterMark(db, schoolId, examId, rec.student_id, subjectId, rec, userId)
      results.push({ student_id: rec.student_id, ok: true, data: r })
    } catch (e) {
      results.push({ student_id: rec.student_id, ok: false, error: e.message })
    }
  }
  return results
}

export async function getMarksheet(db, schoolId, examId, classId) {
  // Returns all students in the class with their marks for each subject
  const subjects = await listExamSubjects(db, schoolId, examId, classId)

  const students = (await db.prepare(`
    SELECT s.id, s.first_name, s.last_name, s.student_number, s.current_stream_id,
           st.name as stream_name
    FROM students s
    LEFT JOIN streams st ON st.id = s.current_stream_id
    WHERE s.current_class_id=? AND s.school_id=? AND s.status='active' AND s.deleted_at IS NULL
    ORDER BY s.last_name ASC, s.first_name ASC
  `).bind(classId, schoolId).all()).results

  const marks = (await db.prepare(`
    SELECT m.* FROM exm_marks m
    WHERE m.exam_id=? AND m.class_id=? AND m.school_id=?
  `).bind(examId, classId, schoolId).all()).results

  // Index marks by student_id + subject_id
  const markIndex = {}
  for (const m of marks) {
    markIndex[`${m.student_id}_${m.subject_id}`] = m
  }

  return {
    subjects,
    students: students.map(s => ({
      ...s,
      marks: subjects.reduce((acc, subj) => {
        acc[subj.subject_id] = markIndex[`${s.id}_${subj.subject_id}`] || null
        return acc
      }, {})
    }))
  }
}

// ── REPORT CARDS ─────────────────────────────────────────────

/**
 * Compute and save report card for one student.
 * This calculates aggregate, position (done separately for class),
 * picks auto-comments from rules, then saves to exm_report_cards.
 */
export async function computeStudentReportCard(db, schoolId, examId, studentId, userId) {
  const exam = await db.prepare(
    'SELECT * FROM exm_exams WHERE id=? AND school_id=?'
  ).bind(examId, schoolId).first()
  if (!exam) throw new Error('Exam not found')

  const student = await db.prepare(
    'SELECT * FROM students WHERE id=? AND school_id=?'
  ).bind(studentId, schoolId).first()
  if (!student) throw new Error('Student not found')

  const classId = student.current_class_id

  // Get all marks for this student in this exam
  const marks = (await db.prepare(`
    SELECT m.*, es.is_gradable, es.max_mark as exam_max_mark
    FROM exm_marks m
    JOIN exm_exam_subjects es ON es.id = m.exam_subject_id
    WHERE m.exam_id=? AND m.student_id=? AND m.school_id=?
      AND m.is_exempt=0 AND m.is_absent=0
  `).bind(examId, studentId, schoolId).all()).results

  const gradableMarks = marks.filter(m => m.is_gradable && m.grade_points != null)
  const totalMarks    = marks.reduce((s, m) => s + (m.marks_obtained || 0), 0)
  const maxPossible   = marks.reduce((s, m) => s + (m.exam_max_mark || 0), 0)

  // Uganda PLE aggregate = sum of grade_points of ALL gradable subjects
  // (Best subjects approach can be configured — for now all subjects)
  const aggregate = gradableMarks.length > 0
    ? gradableMarks.reduce((s, m) => s + (m.grade_points || 0), 0)
    : null

  // Grade summary count
  const gradeSummary = {}
  for (const m of gradableMarks) {
    if (m.grade) gradeSummary[m.grade] = (gradeSummary[m.grade] || 0) + 1
  }

  // Auto-pick comments from rules
  const ctRules = (await db.prepare(
    "SELECT * FROM exm_comment_rules WHERE school_id=? AND comment_type='class_teacher' ORDER BY min_agg ASC"
  ).bind(schoolId).all()).results
  const htRules = (await db.prepare(
    "SELECT * FROM exm_comment_rules WHERE school_id=? AND comment_type='head_teacher' ORDER BY min_agg ASC"
  ).bind(schoolId).all()).results

  const ctComment = pickComment(aggregate, ctRules)
  const htComment = pickComment(aggregate, htRules)

  // Upsert report card
  const existing = await db.prepare(
    'SELECT id, class_teacher_comment, head_teacher_comment FROM exm_report_cards WHERE exam_id=? AND student_id=?'
  ).bind(examId, studentId).first()

  const cardData = {
    total_marks:        totalMarks,
    max_possible_marks: maxPossible,
    subjects_sat:       marks.length,
    aggregate,
    grade_summary:      JSON.stringify(gradeSummary),
    // Keep manually-overridden comments if already set
    class_teacher_comment: existing?.class_teacher_comment || ctComment,
    head_teacher_comment:  existing?.head_teacher_comment  || htComment,
  }

  if (existing) {
    await db.prepare(`
      UPDATE exm_report_cards SET total_marks=?, max_possible_marks=?, subjects_sat=?,
        aggregate=?, grade_summary=?, class_teacher_comment=?, head_teacher_comment=?, updated_at=?
      WHERE id=?
    `).bind(
      cardData.total_marks, cardData.max_possible_marks, cardData.subjects_sat,
      cardData.aggregate, cardData.grade_summary,
      cardData.class_teacher_comment, cardData.head_teacher_comment,
      now(), existing.id
    ).run()
    return db.prepare('SELECT * FROM exm_report_cards WHERE id=?').bind(existing.id).first()
  } else {
    const r = await db.prepare(`
      INSERT INTO exm_report_cards
        (school_id, exam_id, student_id, class_id, stream_id, total_marks, max_possible_marks,
         subjects_sat, aggregate, grade_summary, class_teacher_comment, head_teacher_comment)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      schoolId, examId, studentId, classId, student.current_stream_id || null,
      cardData.total_marks, cardData.max_possible_marks, cardData.subjects_sat,
      cardData.aggregate, cardData.grade_summary,
      cardData.class_teacher_comment, cardData.head_teacher_comment
    ).run()
    return db.prepare('SELECT * FROM exm_report_cards WHERE id=?').bind(r.meta.last_row_id).first()
  }
}

/**
 * Compute report cards for an entire class and rank students.
 */
export async function computeClassReportCards(db, schoolId, examId, classId, userId) {
  // Get all active students in this class
  const students = (await db.prepare(`
    SELECT id FROM students WHERE current_class_id=? AND school_id=? AND status='active' AND deleted_at IS NULL
  `).bind(classId, schoolId).all()).results

  // Compute each student
  for (const s of students) {
    await computeStudentReportCard(db, schoolId, examId, s.id, userId)
  }

  // Now rank by aggregate (lower = better in PLE)
  const cards = (await db.prepare(`
    SELECT id, student_id, stream_id, aggregate
    FROM exm_report_cards
    WHERE exam_id=? AND class_id=?
    ORDER BY aggregate ASC NULLS LAST, total_marks DESC
  `).bind(examId, classId).all()).results

  const total = cards.length

  // Assign positions
  let pos = 1
  let prevAgg = null
  let prevPos = 1
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]
    if (c.aggregate == null) {
      await db.prepare('UPDATE exm_report_cards SET position_in_class=NULL, total_students_in_class=? WHERE id=?')
        .bind(total, c.id).run()
      continue
    }
    if (c.aggregate !== prevAgg) { pos = i + 1; prevPos = pos }
    await db.prepare(
      'UPDATE exm_report_cards SET position_in_class=?, total_students_in_class=?, updated_at=? WHERE id=?'
    ).bind(prevPos, total, now(), c.id).run()
    prevAgg = c.aggregate
  }

  return { computed: students.length, total_in_class: total }
}

export async function getStudentReportCard(db, schoolId, examId, studentId) {
  const card = await db.prepare(`
    SELECT rc.*,
      s.first_name, s.last_name, s.student_number, s.date_of_birth,
      c.name as class_name, st.name as stream_name,
      e.name as exam_name, e.exam_type, e.start_date, e.end_date,
      t.name as term_name, ay.name as academic_year_name
    FROM exm_report_cards rc
    JOIN students s ON s.id = rc.student_id
    JOIN exm_exams e ON e.id = rc.exam_id
    LEFT JOIN classes c ON c.id = rc.class_id
    LEFT JOIN streams st ON st.id = rc.stream_id
    LEFT JOIN terms t ON t.id = e.term_id
    LEFT JOIN academic_years ay ON ay.id = e.academic_year_id
    WHERE rc.exam_id=? AND rc.student_id=? AND rc.school_id=?
  `).bind(examId, studentId, schoolId).first()

  if (!card) throw new Error('Report card not found. Run compute first.')

  // Attach subject marks
  card.marks = (await db.prepare(`
    SELECT m.*, subj.name as subject_name, subj.code as subject_code,
           subj.sort_order, es.max_mark as exam_max_mark, es.is_gradable
    FROM exm_marks m
    JOIN exm_subjects subj ON subj.id = m.subject_id
    JOIN exm_exam_subjects es ON es.id = m.exam_subject_id
    WHERE m.exam_id=? AND m.student_id=? AND m.school_id=?
    ORDER BY subj.sort_order ASC, subj.name ASC
  `).bind(examId, studentId, schoolId).all()).results

  if (card.grade_summary) {
    try { card.grade_summary = JSON.parse(card.grade_summary) } catch { card.grade_summary = {} }
  }

  return card
}

export async function updateReportCardComment(db, schoolId, examId, studentId, data, userId) {
  const card = await db.prepare(
    'SELECT id FROM exm_report_cards WHERE exam_id=? AND student_id=? AND school_id=?'
  ).bind(examId, studentId, schoolId).first()
  if (!card) throw new Error('Report card not found')

  await db.prepare(`
    UPDATE exm_report_cards SET
      class_teacher_comment=?, head_teacher_comment=?,
      class_teacher_id=?, head_teacher_id=?, updated_at=?
    WHERE id=?
  `).bind(
    data.class_teacher_comment ?? null,
    data.head_teacher_comment  ?? null,
    data.class_teacher_id      ?? null,
    data.head_teacher_id       ?? null,
    now(), card.id
  ).run()

  return db.prepare('SELECT * FROM exm_report_cards WHERE id=?').bind(card.id).first()
}

export async function publishExamResults(db, schoolId, examId, classId, userId) {
  let sql = 'UPDATE exm_report_cards SET is_published=1, published_at=?, updated_at=? WHERE exam_id=? AND school_id=?'
  const params = [now(), now(), examId, schoolId]
  if (classId) { sql += ' AND class_id=?'; params.push(classId) }
  await db.prepare(sql).bind(...params).run()
  return { published: true }
}

export async function getClassReportSummary(db, schoolId, examId, classId) {
  return (await db.prepare(`
    SELECT rc.*,
      s.first_name, s.last_name, s.student_number,
      st.name as stream_name
    FROM exm_report_cards rc
    JOIN students s ON s.id = rc.student_id
    LEFT JOIN streams st ON st.id = rc.stream_id
    WHERE rc.exam_id=? AND rc.class_id=? AND rc.school_id=?
    ORDER BY rc.position_in_class ASC NULLS LAST, s.last_name ASC
  `).bind(examId, classId, schoolId).all()).results
}
