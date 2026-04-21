// ==========================================================
// services/curriculum/service.js  — CLEAN REBUILD v3
// Table prefix: aca_new_
//
// FIXES vs original:
//  1. listSubjects: termId/classId variables were undeclared → fixed
//  2. createSubject: now correctly inserts term_id and class_id columns
//  3. All table references updated from aca_ → aca_new_
//  4. createLesson: subtopic_names fallback if not provided
//  5. getTermCompletion: complete rewrite (original referenced missing variables)
//  6. getStudentDetailedReport: fixed bind param order
//  7. getLessonPlanUploadUrl export added (was missing)
// ==========================================================

import { Repository } from '../../repository';

// ── Helpers ────────────────────────────────────────────────
function nowISO()   { return new Date().toISOString(); }
function todayISO() { return new Date().toISOString().split('T')[0]; }

function required(v, name) {
  if (v === undefined || v === null || String(v).trim() === '')
    throw new Error(`${name} is required`);
}

function toInt(v, def = null) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : def;
}

function toFloat(v, def = 0) {
  if (v === undefined || v === null || v === '') return def;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

// ── R2 upload engine ───────────────────────────────────────
const ALLOWED_MIME = [
  'image/jpeg','image/jpg','image/png','image/webp','image/gif','application/pdf',
];

export async function generateUploadUrl(r2, folder, fileName, mimeType, schoolId, lessonId, r2PublicUrl) {
  required(folder,   'folder');
  required(fileName, 'fileName');
  required(mimeType, 'mimeType');

  if (!ALLOWED_MIME.includes(mimeType))
    throw new Error(`Unsupported file type: "${mimeType}". Allowed: ${ALLOWED_MIME.join(', ')}`);

  const sanitized  = fileName.replace(/[^a-z0-9._-]/gi, '_');
  const objectKey  = `schools/${schoolId}/lessons/${lessonId}/${folder}/${Date.now()}_${sanitized}`;

  const presignedUrl = await r2.createPresignedUrl(objectKey, {
    method: 'PUT', expiresIn: 900,
    httpMetadata: { contentType: mimeType },
  });

  return {
    presigned_url: presignedUrl,
    object_key:    objectKey,
    public_url:    `${r2PublicUrl}/${objectKey}`,
    expires_in:    900,
    instructions:  'PUT file to presigned_url with Content-Type header, then call the confirm endpoint.',
  };
}

export async function confirmUpload(r2, objectKey, r2PublicUrl) {
  required(objectKey, 'objectKey');
  const obj = await r2.head(objectKey);
  if (!obj) throw new Error('File not found in storage. Upload may have failed or expired.');
  return {
    confirmed:  true,
    object_key: objectKey,
    size:       obj.size,
    etag:       obj.etag,
    public_url: `${r2PublicUrl}/${objectKey}`,
  };
}

// ── Internal: enriched lesson row ──────────────────────────
async function _getLessonRow(db, schoolId, lessonId) {
  const row = await db.prepare(`
    SELECT
      l.*,
      u.first_name || ' ' || u.last_name AS teacher_full_name,
      u.first_name AS teacher_first_name,
      u.last_name  AS teacher_last_name,
      u.email      AS teacher_email,
      s.name  AS subject_name,
      t.name  AS term_name,
      c.name  AS class_name,
      c.code  AS class_code,
      tp.name AS topic_name
    FROM aca_new_lessons l
    LEFT JOIN users             u  ON u.id  = l.teacher_user_id
    LEFT JOIN aca_new_subjects  s  ON s.id  = l.subject_id AND s.school_id = l.school_id
    LEFT JOIN terms             t  ON t.id  = l.term_id    AND t.school_id = l.school_id
    LEFT JOIN classes           c  ON c.id  = l.class_id   AND c.school_id = l.school_id AND c.deleted_at IS NULL
    LEFT JOIN aca_new_topics    tp ON tp.id = l.topic_id   AND tp.school_id = l.school_id
    WHERE l.school_id = ? AND l.id = ? AND l.deleted_at IS NULL
    LIMIT 1
  `).bind(schoolId, lessonId).first();
  if (!row) throw new Error('Lesson not found');
  return row;
}

// ==========================================================
// 1. SUBJECTS
// ==========================================================

// FIX: original used undeclared termId/classId variables
export async function listSubjects(db, schoolId, filters = {}) {
  const termId  = filters.term_id  ? toInt(filters.term_id)  : null;
  const classId = filters.class_id ? toInt(filters.class_id) : null;

  const res = await db.prepare(`
    SELECT
      s.*,
      t.name AS term_name,
      c.name AS class_name,
      c.code AS class_code
    FROM aca_new_subjects s
    LEFT JOIN terms   t ON t.id = s.term_id  AND t.school_id = s.school_id
    LEFT JOIN classes c ON c.id = s.class_id AND c.school_id = s.school_id AND c.deleted_at IS NULL
    WHERE s.school_id = ? AND s.deleted_at IS NULL
      AND (? IS NULL OR s.term_id  = ?)
      AND (? IS NULL OR s.class_id = ?)
    ORDER BY c.name ASC, s.name ASC
  `).bind(schoolId, termId, termId, classId, classId).all();

  return res.results || [];
}

export async function getSubject(db, schoolId, subjectId) {
  const row = await db.prepare(`
    SELECT s.*, t.name AS term_name, c.name AS class_name, c.code AS class_code
    FROM aca_new_subjects s
    LEFT JOIN terms   t ON t.id = s.term_id  AND t.school_id = s.school_id
    LEFT JOIN classes c ON c.id = s.class_id AND c.school_id = s.school_id AND c.deleted_at IS NULL
    WHERE s.school_id = ? AND s.id = ? AND s.deleted_at IS NULL LIMIT 1
  `).bind(schoolId, subjectId).first();
  if (!row) throw new Error('Subject not found');
  return row;
}

// FIX: original createSubject didn't insert term_id or class_id
export async function createSubject(db, schoolId, data, userId) {
  required(data.name,     'name');
  required(data.term_id,  'term_id');
  required(data.class_id, 'class_id');

  const dup = await db.prepare(`
    SELECT id FROM aca_new_subjects
    WHERE school_id=? AND term_id=? AND class_id=? AND LOWER(name)=LOWER(?) AND deleted_at IS NULL LIMIT 1
  `).bind(schoolId, data.term_id, data.class_id, data.name).first();
  if (dup) throw new Error('Subject already exists for this term and class');

  const repo = new Repository(db);
  const subject = await repo.insert('aca_new_subjects', {
    school_id:   schoolId,
    term_id:     toInt(data.term_id),
    class_id:    toInt(data.class_id),
    name:        data.name,
    code:        data.code        || null,
    description: data.description || null,
    is_active:   1,
    created_by:  userId,
  });
  return getSubject(db, schoolId, subject.id);
}

export async function updateSubject(db, schoolId, subjectId, data, userId) {
  const repo = new Repository(db);
  const ex   = await repo.findOne('aca_new_subjects', { id: subjectId }, schoolId);
  if (!ex || ex.deleted_at) throw new Error('Subject not found');
  await repo.update('aca_new_subjects', subjectId, {
    name:        data.name        ?? ex.name,
    code:        data.code        ?? ex.code,
    description: data.description ?? ex.description,
    is_active:   data.is_active   !== undefined ? (data.is_active ? 1 : 0) : ex.is_active,
    updated_by:  userId,
    updated_at:  nowISO(),
  }, schoolId);
  return getSubject(db, schoolId, subjectId);
}

export async function deleteSubject(db, schoolId, subjectId, userId) {
  const repo = new Repository(db);
  const ex   = await repo.findOne('aca_new_subjects', { id: subjectId }, schoolId);
  if (!ex || ex.deleted_at) throw new Error('Subject not found');
  await repo.update('aca_new_subjects', subjectId, { deleted_at: nowISO(), deleted_by: userId }, schoolId);
  return { success: true };
}

// ==========================================================
// 2. TOPICS
// ==========================================================

export async function listTopics(db, schoolId, subjectId) {
  const res = await db.prepare(`
    SELECT tp.*, s.name AS subject_name, t.name AS term_name, c.name AS class_name
    FROM aca_new_topics tp
    LEFT JOIN aca_new_subjects s ON s.id = tp.subject_id AND s.school_id = tp.school_id
    LEFT JOIN terms            t ON t.id = s.term_id     AND t.school_id = tp.school_id
    LEFT JOIN classes          c ON c.id = s.class_id    AND c.school_id = tp.school_id AND c.deleted_at IS NULL
    WHERE tp.school_id = ? AND tp.subject_id = ? AND tp.deleted_at IS NULL
    ORDER BY tp.order_index ASC, tp.name ASC
  `).bind(schoolId, subjectId).all();
  return res.results || [];
}

export async function getTopic(db, schoolId, topicId) {
  const row = await db.prepare(`
    SELECT tp.*, s.name AS subject_name, s.term_id, s.class_id, t.name AS term_name, c.name AS class_name
    FROM aca_new_topics tp
    LEFT JOIN aca_new_subjects s ON s.id = tp.subject_id AND s.school_id = tp.school_id
    LEFT JOIN terms            t ON t.id = s.term_id     AND t.school_id = tp.school_id
    LEFT JOIN classes          c ON c.id = s.class_id    AND c.school_id = tp.school_id AND c.deleted_at IS NULL
    WHERE tp.school_id = ? AND tp.id = ? AND tp.deleted_at IS NULL LIMIT 1
  `).bind(schoolId, topicId).first();
  if (!row) throw new Error('Topic not found');
  return row;
}

export async function createTopic(db, schoolId, subjectId, data, userId) {
  required(data.name, 'name');
  const repo    = new Repository(db);
  const subject = await repo.findOne('aca_new_subjects', { id: subjectId }, schoolId);
  if (!subject || subject.deleted_at) throw new Error('Subject not found');

  const dup = await db.prepare(`
    SELECT id FROM aca_new_topics
    WHERE school_id=? AND subject_id=? AND LOWER(name)=LOWER(?) AND deleted_at IS NULL LIMIT 1
  `).bind(schoolId, subjectId, data.name).first();
  if (dup) throw new Error('Topic already exists for this subject');

  const topic = await repo.insert('aca_new_topics', {
    school_id:   schoolId,
    subject_id:  subjectId,
    name:        data.name,
    description: data.description || null,
    order_index: toInt(data.order_index, 0),
    is_active:   1,
    created_by:  userId,
  });
  return getTopic(db, schoolId, topic.id);
}

export async function updateTopic(db, schoolId, topicId, data, userId) {
  const repo = new Repository(db);
  const ex   = await repo.findOne('aca_new_topics', { id: topicId }, schoolId);
  if (!ex || ex.deleted_at) throw new Error('Topic not found');
  await repo.update('aca_new_topics', topicId, {
    name:        data.name        ?? ex.name,
    description: data.description ?? ex.description,
    order_index: data.order_index !== undefined ? toInt(data.order_index) : ex.order_index,
    is_active:   data.is_active   !== undefined ? (data.is_active ? 1 : 0) : ex.is_active,
    updated_by:  userId,
    updated_at:  nowISO(),
  }, schoolId);
  return getTopic(db, schoolId, topicId);
}

export async function deleteTopic(db, schoolId, topicId, userId) {
  const repo = new Repository(db);
  const ex   = await repo.findOne('aca_new_topics', { id: topicId }, schoolId);
  if (!ex || ex.deleted_at) throw new Error('Topic not found');
  const hasLessons = await db.prepare(`
    SELECT id FROM aca_new_lessons WHERE school_id=? AND topic_id=? AND deleted_at IS NULL LIMIT 1
  `).bind(schoolId, topicId).first();
  if (hasLessons) throw new Error('Cannot delete topic with existing lessons');
  await repo.update('aca_new_topics', topicId, { deleted_at: nowISO(), deleted_by: userId }, schoolId);
  return { success: true };
}

// ==========================================================
// 3. SUBTOPICS
// ==========================================================

export async function listSubtopics(db, schoolId, topicId) {
  const res = await db.prepare(`
    SELECT
      st.*,
      tp.name AS topic_name,
      s.name  AS subject_name,
      s.id    AS subject_id,
      t.name  AS term_name,
      c.name  AS class_name
    FROM aca_new_subtopics  st
    LEFT JOIN aca_new_topics    tp ON tp.id = st.topic_id   AND tp.school_id = st.school_id
    LEFT JOIN aca_new_subjects   s ON  s.id = tp.subject_id AND  s.school_id = st.school_id
    LEFT JOIN terms              t ON  t.id = s.term_id     AND  t.school_id = st.school_id
    LEFT JOIN classes            c ON  c.id = s.class_id    AND  c.school_id = st.school_id AND c.deleted_at IS NULL
    WHERE st.school_id = ? AND st.topic_id = ? AND st.deleted_at IS NULL
    ORDER BY st.order_index ASC, st.name ASC
  `).bind(schoolId, topicId).all();
  return res.results || [];
}

export async function getSubtopic(db, schoolId, subtopicId) {
  const row = await db.prepare(`
    SELECT st.*, tp.name AS topic_name, tp.subject_id, s.name AS subject_name,
      s.term_id, s.class_id, t.name AS term_name, c.name AS class_name
    FROM aca_new_subtopics  st
    LEFT JOIN aca_new_topics    tp ON tp.id = st.topic_id   AND tp.school_id = st.school_id
    LEFT JOIN aca_new_subjects   s ON  s.id = tp.subject_id AND  s.school_id = st.school_id
    LEFT JOIN terms              t ON  t.id = s.term_id     AND  t.school_id = st.school_id
    LEFT JOIN classes            c ON  c.id = s.class_id    AND  c.school_id = st.school_id AND c.deleted_at IS NULL
    WHERE st.school_id = ? AND st.id = ? AND st.deleted_at IS NULL LIMIT 1
  `).bind(schoolId, subtopicId).first();
  if (!row) throw new Error('Subtopic not found');
  return row;
}

export async function findOrCreateSubtopic(db, schoolId, topicId, name, userId) {
  required(name, 'name');
  if (!await db.prepare('SELECT id FROM aca_new_topics WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, topicId).first())
    throw new Error('Topic not found');

  const existing = await db.prepare(`
    SELECT id FROM aca_new_subtopics WHERE school_id=? AND topic_id=? AND LOWER(name)=LOWER(?) AND deleted_at IS NULL LIMIT 1
  `).bind(schoolId, topicId, name).first();
  if (existing) return getSubtopic(db, schoolId, existing.id);

  const repo = new Repository(db);
  const st   = await repo.insert('aca_new_subtopics', {
    school_id: schoolId, topic_id: topicId, name,
    order_index: 0, is_completed: 0, auto_created: 1, created_by: userId,
  });
  return getSubtopic(db, schoolId, st.id);
}

export async function createSubtopic(db, schoolId, topicId, data, userId) {
  required(data.name, 'name');
  return findOrCreateSubtopic(db, schoolId, topicId, data.name, userId);
}

export async function updateSubtopic(db, schoolId, subtopicId, data, userId) {
  const repo = new Repository(db);
  const ex   = await repo.findOne('aca_new_subtopics', { id: subtopicId }, schoolId);
  if (!ex || ex.deleted_at) throw new Error('Subtopic not found');
  await repo.update('aca_new_subtopics', subtopicId, {
    name:        data.name        ?? ex.name,
    description: data.description ?? ex.description,
    order_index: data.order_index !== undefined ? toInt(data.order_index) : ex.order_index,
    updated_by:  userId,
    updated_at:  nowISO(),
  }, schoolId);
  return getSubtopic(db, schoolId, subtopicId);
}

export async function deleteSubtopic(db, schoolId, subtopicId, userId) {
  const repo = new Repository(db);
  const ex   = await repo.findOne('aca_new_subtopics', { id: subtopicId }, schoolId);
  if (!ex || ex.deleted_at) throw new Error('Subtopic not found');
  await repo.update('aca_new_subtopics', subtopicId, { deleted_at: nowISO(), deleted_by: userId }, schoolId);
  return { success: true };
}

// ==========================================================
// 4. TEACHER ALLOCATIONS
// ==========================================================

export async function listTeacherAllocations(db, schoolId, filters = {}) {
  const termId    = filters.term_id    ? toInt(filters.term_id)    : null;
  const classId   = filters.class_id   ? toInt(filters.class_id)   : null;
  const subjectId = filters.subject_id ? toInt(filters.subject_id) : null;

  const res = await db.prepare(`
    SELECT
      a.*,
      u.first_name||' '||u.last_name AS teacher_full_name,
      u.first_name AS teacher_first_name,
      u.last_name  AS teacher_last_name,
      u.email      AS teacher_email,
      s.name AS subject_name,
      t.name AS term_name,
      c.name AS class_name, c.code AS class_code
    FROM aca_new_teacher_allocations a
    LEFT JOIN users            u ON u.id = a.teacher_user_id
    LEFT JOIN aca_new_subjects s ON s.id = a.subject_id AND s.school_id = a.school_id
    LEFT JOIN terms            t ON t.id = a.term_id    AND t.school_id = a.school_id
    LEFT JOIN classes          c ON c.id = a.class_id   AND c.school_id = a.school_id AND c.deleted_at IS NULL
    WHERE a.school_id = ? AND a.deleted_at IS NULL
      AND (? IS NULL OR a.term_id    = ?)
      AND (? IS NULL OR a.class_id   = ?)
      AND (? IS NULL OR a.subject_id = ?)
    ORDER BY t.name ASC, c.name ASC, s.name ASC
  `).bind(schoolId, termId, termId, classId, classId, subjectId, subjectId).all();
  return res.results || [];
}

export async function allocateTeacher(db, schoolId, data, userId) {
  required(data.teacher_user_id, 'teacher_user_id');
  required(data.term_id,         'term_id');
  required(data.class_id,        'class_id');
  required(data.subject_id,      'subject_id');

  if (!await db.prepare('SELECT id FROM users WHERE id=? LIMIT 1').bind(data.teacher_user_id).first())
    throw new Error('Teacher user not found');
  if (!await db.prepare('SELECT id FROM aca_new_subjects WHERE school_id=? AND id=? AND term_id=? AND class_id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, data.subject_id, data.term_id, data.class_id).first())
    throw new Error('Subject not found for this term and class');

  const repo = new Repository(db);
  // Supersede existing allocation
  await db.prepare(`
    UPDATE aca_new_teacher_allocations SET deleted_at=datetime('now'), deleted_by=?
    WHERE school_id=? AND term_id=? AND class_id=? AND subject_id=? AND deleted_at IS NULL
  `).bind(userId, schoolId, data.term_id, data.class_id, data.subject_id).run();

  const alloc = await repo.insert('aca_new_teacher_allocations', {
    school_id: schoolId, teacher_user_id: data.teacher_user_id,
    term_id: data.term_id, class_id: data.class_id, subject_id: data.subject_id,
    effective_from: data.effective_from || todayISO(), is_active: 1, created_by: userId,
  });

  return db.prepare(`
    SELECT a.*, u.first_name||' '||u.last_name AS teacher_full_name, u.email AS teacher_email,
      s.name AS subject_name, t.name AS term_name, c.name AS class_name
    FROM aca_new_teacher_allocations a
    LEFT JOIN users            u ON u.id=a.teacher_user_id
    LEFT JOIN aca_new_subjects s ON s.id=a.subject_id AND s.school_id=a.school_id
    LEFT JOIN terms            t ON t.id=a.term_id    AND t.school_id=a.school_id
    LEFT JOIN classes          c ON c.id=a.class_id   AND c.school_id=a.school_id AND c.deleted_at IS NULL
    WHERE a.id=? LIMIT 1
  `).bind(alloc.id).first();
}

async function resolveTeacher(db, schoolId, termId, classId, subjectId) {
  const row = await db.prepare(`
    SELECT a.teacher_user_id, u.first_name, u.last_name,
      u.first_name||' '||u.last_name AS teacher_full_name, u.email
    FROM aca_new_teacher_allocations a
    LEFT JOIN users u ON u.id=a.teacher_user_id
    WHERE a.school_id=? AND a.term_id=? AND a.class_id=? AND a.subject_id=?
      AND a.is_active=1 AND a.deleted_at IS NULL
    LIMIT 1
  `).bind(schoolId, termId, classId, subjectId).first();
  if (!row) throw new Error('No teacher allocated for this term, class, and subject. Please allocate a teacher first.');
  return row;
}

// ==========================================================
// 5. LESSONS
// ==========================================================

export async function listLessons(db, schoolId, filters = {}) {
  const termId    = filters.term_id    ? toInt(filters.term_id)    : null;
  const classId   = filters.class_id   ? toInt(filters.class_id)   : null;
  const subjectId = filters.subject_id ? toInt(filters.subject_id) : null;
  const status    = filters.status     || null;
  const limit     = Math.min(parseInt(filters.limit  || 100, 10), 500);
  const offset    = Math.max(parseInt(filters.offset || 0,   10), 0);

  const res = await db.prepare(`
    SELECT
      l.*,
      u.first_name||' '||u.last_name AS teacher_full_name,
      u.email  AS teacher_email,
      s.name   AS subject_name,
      t.name   AS term_name,
      c.name   AS class_name, c.code AS class_code,
      tp.name  AS topic_name
    FROM aca_new_lessons l
    LEFT JOIN users            u  ON u.id  = l.teacher_user_id
    LEFT JOIN aca_new_subjects s  ON s.id  = l.subject_id AND s.school_id = l.school_id
    LEFT JOIN terms            t  ON t.id  = l.term_id    AND t.school_id = l.school_id
    LEFT JOIN classes          c  ON c.id  = l.class_id   AND c.school_id = l.school_id AND c.deleted_at IS NULL
    LEFT JOIN aca_new_topics   tp ON tp.id = l.topic_id   AND tp.school_id = l.school_id
    WHERE l.school_id = ? AND l.deleted_at IS NULL
      AND (? IS NULL OR l.term_id    = ?)
      AND (? IS NULL OR l.class_id   = ?)
      AND (? IS NULL OR l.subject_id = ?)
      AND (? IS NULL OR l.status     = ?)
    ORDER BY l.lesson_date DESC, l.period_no ASC, l.id DESC
    LIMIT ? OFFSET ?
  `).bind(schoolId, termId, termId, classId, classId, subjectId, subjectId, status, status, limit, offset).all();
  return res.results || [];
}

export async function getLesson(db, schoolId, lessonId) {
  const lesson   = await _getLessonRow(db, schoolId, lessonId);
  const subtopics = await db.prepare(`
    SELECT ls.subtopic_id, st.name AS subtopic_name
    FROM aca_new_lesson_subtopics ls
    LEFT JOIN aca_new_subtopics st ON st.id = ls.subtopic_id AND st.school_id = ls.school_id
    WHERE ls.school_id = ? AND ls.lesson_id = ?
  `).bind(schoolId, lessonId).all();
  lesson.subtopics = subtopics.results || [];
  return lesson;
}

export async function createLesson(db, schoolId, data, userId) {
  required(data.term_id,     'term_id');
  required(data.class_id,    'class_id');
  required(data.subject_id,  'subject_id');
  required(data.topic_id,    'topic_id');
  required(data.lesson_date, 'lesson_date');
  required(data.period_no,   'period_no');
  required(data.start_time,  'start_time');
  required(data.end_time,    'end_time');

  const repo        = new Repository(db);
  const teacherInfo = await resolveTeacher(db, schoolId, data.term_id, data.class_id, data.subject_id);

  if (!await db.prepare('SELECT id FROM aca_new_topics WHERE school_id=? AND id=? AND subject_id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, data.topic_id, data.subject_id).first())
    throw new Error('Topic not found or does not belong to this subject');

  if (await db.prepare('SELECT id FROM aca_new_lessons WHERE school_id=? AND term_id=? AND class_id=? AND subject_id=? AND lesson_date=? AND period_no=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, data.term_id, data.class_id, data.subject_id, data.lesson_date, data.period_no).first())
    throw new Error('A lesson already exists for this term, class, subject, date, and period');

  const validTypes = ['normal','extra','configurable'];
  const lessonType = data.lesson_type || 'normal';
  if (!validTypes.includes(lessonType)) throw new Error('Invalid lesson_type. Must be: normal | extra | configurable');

  const lesson = await repo.insert('aca_new_lessons', {
    school_id: schoolId, term_id: data.term_id, class_id: data.class_id,
    subject_id: data.subject_id, topic_id: data.topic_id,
    teacher_user_id: teacherInfo.teacher_user_id,
    lesson_type: lessonType, lesson_date: data.lesson_date,
    period_no: toInt(data.period_no), start_time: data.start_time, end_time: data.end_time,
    status: 'draft',
    lesson_plan_submitted: 0, lesson_plan_uploaded: 0, marks_submitted: 0,
    case_study_uploaded: 0, teacher_assessment_submitted: 0, admin_analysis_submitted: 0,
    created_by: userId,
  });

  // Attach subtopics if provided
  if (Array.isArray(data.subtopic_names) && data.subtopic_names.length > 0) {
    for (const stName of data.subtopic_names) {
      if (!stName?.trim()) continue;
      const st = await findOrCreateSubtopic(db, schoolId, data.topic_id, stName.trim(), userId);
      await db.prepare('INSERT OR IGNORE INTO aca_new_lesson_subtopics (school_id,lesson_id,subtopic_id) VALUES (?,?,?)').bind(schoolId, lesson.id, st.id).run();
    }
  }

  return getLesson(db, schoolId, lesson.id);
}

export async function updateLesson(db, schoolId, lessonId, data, userId) {
  const repo   = new Repository(db);
  const lesson = await repo.findOne('aca_new_lessons', { id: lessonId }, schoolId);
  if (!lesson || lesson.deleted_at) throw new Error('Lesson not found');
  if (lesson.status === 'approved' && !data.force) throw new Error('Cannot edit an approved lesson');

  await repo.update('aca_new_lessons', lessonId, {
    lesson_type: data.lesson_type ?? lesson.lesson_type,
    lesson_date: data.lesson_date ?? lesson.lesson_date,
    period_no:   data.period_no   !== undefined ? toInt(data.period_no) : lesson.period_no,
    start_time:  data.start_time  ?? lesson.start_time,
    end_time:    data.end_time    ?? lesson.end_time,
    updated_by:  userId, updated_at: nowISO(),
  }, schoolId);

  return getLesson(db, schoolId, lessonId);
}

// ==========================================================
// 6. LESSON PLAN
// ==========================================================

export async function getLessonPlan(db, schoolId, lessonId) {
  return db.prepare(`
    SELECT p.*, u.first_name||' '||u.last_name AS submitted_by_name
    FROM aca_new_lesson_plans p
    LEFT JOIN users u ON u.id = p.submitted_by
    WHERE p.school_id=? AND p.lesson_id=? AND p.deleted_at IS NULL LIMIT 1
  `).bind(schoolId, lessonId).first();
}

export async function createLessonPlan(db, schoolId, lessonId, data, userId) {
  required(data.objectives, 'objectives');
  const lesson = await db.prepare('SELECT id, status FROM aca_new_lessons WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, lessonId).first();
  if (!lesson) throw new Error('Lesson not found');
  if (lesson.status === 'approved') throw new Error('Cannot modify an approved lesson plan');

  await db.prepare(`UPDATE aca_new_lesson_plans SET deleted_at=datetime('now'), deleted_by=? WHERE school_id=? AND lesson_id=? AND deleted_at IS NULL`).bind(userId, schoolId, lessonId).run();

  const repo = new Repository(db);
  const plan = await repo.insert('aca_new_lesson_plans', {
    school_id: schoolId, lesson_id: lessonId,
    objectives:          data.objectives,
    learning_outcomes:   data.learning_outcomes   || null,
    teaching_materials:  data.teaching_materials  || null,
    methodology:         data.methodology         || null,
    duration_minutes:    toInt(data.duration_minutes, null),
    prior_knowledge:     data.prior_knowledge     || null,
    differentiation:     data.differentiation     || null,
    assessment_strategy: data.assessment_strategy || null,
    notes:               data.notes               || null,
    status:              'submitted',
    submitted_by:        userId,
    submitted_at:        nowISO(),
    created_by:          userId,
  });

  await db.prepare(`UPDATE aca_new_lessons SET lesson_plan_submitted=1, updated_at=datetime('now'), updated_by=? WHERE school_id=? AND id=?`).bind(userId, schoolId, lessonId).run();
  return getLessonPlan(db, schoolId, lessonId);
}

// FIX: this export was missing from the original
export async function getLessonPlanUploadUrl(r2, schoolId, lessonId, data, r2PublicUrl) {
  required(data.file_name, 'file_name');
  required(data.file_mime, 'file_mime');
  return generateUploadUrl(r2, 'lesson-plans', data.file_name, data.file_mime, schoolId, lessonId, r2PublicUrl);
}

export async function confirmLessonPlanAttachment(db, r2, schoolId, lessonId, data, userId, r2PublicUrl) {
  required(data.object_key, 'object_key');
  const plan = await db.prepare('SELECT id FROM aca_new_lesson_plans WHERE school_id=? AND lesson_id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, lessonId).first();
  if (!plan) throw new Error('Lesson plan not found. Create the lesson plan first.');

  const confirmed = await confirmUpload(r2, data.object_key, r2PublicUrl);
  const repo      = new Repository(db);
  const att       = await repo.insert('aca_new_lesson_plan_attachments', {
    school_id:     schoolId, lesson_id: lessonId, lesson_plan_id: plan.id,
    object_key:    data.object_key, file_url: confirmed.public_url,
    file_name:     data.file_name || data.object_key.split('/').pop(),
    file_mime:     data.file_mime || null, file_size: toInt(data.file_size || confirmed.size, null),
    uploaded_by:   userId, uploaded_at: nowISO(),
  });

  await db.prepare(`UPDATE aca_new_lessons SET lesson_plan_uploaded=1, updated_at=datetime('now'), updated_by=? WHERE school_id=? AND id=?`).bind(userId, schoolId, lessonId).run();
  return { ...att, file_url: confirmed.public_url };
}

export async function listLessonPlanAttachments(db, schoolId, lessonId) {
  const plan = await db.prepare('SELECT id FROM aca_new_lesson_plans WHERE school_id=? AND lesson_id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, lessonId).first();
  if (!plan) return [];
  const res = await db.prepare(`
    SELECT a.*, u.first_name||' '||u.last_name AS uploaded_by_name
    FROM aca_new_lesson_plan_attachments a
    LEFT JOIN users u ON u.id=a.uploaded_by
    WHERE a.school_id=? AND a.lesson_plan_id=? AND a.deleted_at IS NULL
    ORDER BY a.uploaded_at DESC
  `).bind(schoolId, plan.id).all();
  return res.results || [];
}

export async function deleteLessonPlanAttachment(db, r2, schoolId, attachmentId, userId) {
  const att = await db.prepare('SELECT * FROM aca_new_lesson_plan_attachments WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, attachmentId).first();
  if (!att) throw new Error('Attachment not found');
  try { await r2.delete(att.object_key); } catch (_) {}
  await db.prepare(`UPDATE aca_new_lesson_plan_attachments SET deleted_at=datetime('now'), deleted_by=? WHERE id=?`).bind(userId, att.id).run();
  return { success: true };
}

export async function addLessonPlanComment(db, schoolId, lessonId, data, userId) {
  required(data.comment, 'comment');
  const validTypes = ['general','correction','concern','approval'];
  const commentType = data.comment_type || 'general';
  if (!validTypes.includes(commentType)) throw new Error(`Invalid comment_type. Must be: ${validTypes.join(' | ')}`);

  const plan = await db.prepare('SELECT id FROM aca_new_lesson_plans WHERE school_id=? AND lesson_id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, lessonId).first();
  if (!plan) throw new Error('Lesson plan not found');

  const repo    = new Repository(db);
  const comment = await repo.insert('aca_new_lesson_plan_comments', {
    school_id: schoolId, lesson_plan_id: plan.id, lesson_id: lessonId,
    comment: data.comment, comment_type: commentType, commented_by: userId, created_at: nowISO(),
  });

  return db.prepare(`
    SELECT c.*, u.first_name||' '||u.last_name AS commented_by_name
    FROM aca_new_lesson_plan_comments c
    LEFT JOIN users u ON u.id=c.commented_by
    WHERE c.id=? LIMIT 1
  `).bind(comment.id).first();
}

export async function deleteLessonPlanComment(db, schoolId, commentId, userId) {
  const c = await db.prepare('SELECT id FROM aca_new_lesson_plan_comments WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, commentId).first();
  if (!c) throw new Error('Comment not found');
  await db.prepare(`UPDATE aca_new_lesson_plan_comments SET deleted_at=datetime('now'), deleted_by=? WHERE id=?`).bind(userId, commentId).run();
  return { success: true };
}

// ==========================================================
// 7. MARKS ENGINE
// ==========================================================

export async function submitMarks(db, schoolId, lessonId, data, userId) {
  required(data.marks, 'marks');
  if (!Array.isArray(data.marks) || data.marks.length === 0)
    throw new Error('marks must be a non-empty array');

  const repo   = new Repository(db);
  const lesson = await db.prepare('SELECT id, status, teacher_user_id FROM aca_new_lessons WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, lessonId).first();
  if (!lesson) throw new Error('Lesson not found');
  if (lesson.status === 'approved') throw new Error('Cannot resubmit marks for an approved lesson');

  const existingAss = await db.prepare('SELECT id FROM aca_new_lesson_assessments WHERE school_id=? AND lesson_id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, lessonId).first();
  if (existingAss) {
    await db.prepare(`UPDATE aca_new_student_marks SET deleted_at=datetime('now') WHERE school_id=? AND assessment_id=?`).bind(schoolId, existingAss.id).run();
    await db.prepare(`UPDATE aca_new_lesson_assessments SET deleted_at=datetime('now') WHERE school_id=? AND id=?`).bind(schoolId, existingAss.id).run();
  }

  const defaultMax = toInt(data.max_marks, 100);
  const assessment = await repo.insert('aca_new_lesson_assessments', {
    school_id: schoolId, lesson_id: lessonId,
    max_marks: defaultMax, submitted_by: userId, submitted_at: nowISO(),
  });

  let totalMarks = 0, totalStudents = 0, highestMark = null, lowestMark = null;
  const eligible = [];

  for (const m of data.marks) {
    if (!m.student_id) continue;
    const scored  = toFloat(m.marks_scored, 0);
    const maxMark = toInt(m.max_marks || defaultMax, 100);
    const pct     = maxMark > 0 ? Math.round((scored / maxMark) * 10000) / 100 : 0;

    await repo.insert('aca_new_student_marks', {
      school_id: schoolId, assessment_id: assessment.id, lesson_id: lessonId,
      student_id: m.student_id, marks_scored: scored, max_marks: maxMark,
      percentage: pct, created_by: userId,
    });

    totalMarks    += scored;
    totalStudents += 1;
    highestMark    = highestMark === null ? scored : Math.max(highestMark, scored);
    lowestMark     = lowestMark  === null ? scored : Math.min(lowestMark,  scored);
    if (scored > 0) eligible.push(m.student_id);
  }

  const avgMarks      = totalStudents > 0 ? Math.round((totalMarks / totalStudents) * 100) / 100 : 0;
  const avgPercent    = defaultMax > 0 ? Math.round((avgMarks / defaultMax) * 10000) / 100 : 0;
  const repeatRequired = avgPercent < 50 ? 1 : 0;

  let caseStudyStudentId = null, caseStudyStudent = null;
  if (eligible.length > 0) {
    caseStudyStudentId = eligible[Math.floor(Math.random() * eligible.length)];
    await db.prepare(`DELETE FROM aca_new_lesson_case_studies WHERE school_id=? AND lesson_id=?`).bind(schoolId, lessonId).run();
    await db.prepare(`INSERT INTO aca_new_lesson_case_studies (school_id,lesson_id,student_id,assigned_at,assigned_by) VALUES (?,?,?,datetime('now'),?)`).bind(schoolId, lessonId, caseStudyStudentId, userId).run();
    caseStudyStudent = await db.prepare(`
      SELECT s.id, s.student_number, s.first_name, s.last_name, s.gender,
        m.marks_scored, m.max_marks, m.percentage
      FROM students s
      LEFT JOIN aca_new_student_marks m ON m.student_id=s.id AND m.lesson_id=? AND m.assessment_id=? AND m.deleted_at IS NULL
      WHERE s.id=? AND s.school_id=? LIMIT 1
    `).bind(lessonId, assessment.id, caseStudyStudentId, schoolId).first();
  }

  await db.prepare(`
    UPDATE aca_new_lessons SET
      average_marks=?, average_percent=?, highest_mark=?, lowest_mark=?, total_students=?,
      case_study_student_id=?, repeat_required=?, marks_submitted=1,
      status=CASE WHEN status='draft' THEN 'marks_submitted' ELSE status END,
      updated_at=datetime('now'), updated_by=?
    WHERE school_id=? AND id=?
  `).bind(avgMarks, avgPercent, highestMark, lowestMark, totalStudents, caseStudyStudentId, repeatRequired, userId, schoolId, lessonId).run();

  return {
    assessment_id: assessment.id, lesson_id: lessonId,
    average_marks: avgMarks, average_percent: avgPercent,
    highest_mark: highestMark, lowest_mark: lowestMark,
    total_students: totalStudents, repeat_auto_flagged: repeatRequired === 1,
    case_study_student: caseStudyStudent,
    message: caseStudyStudent
      ? `Case study: ${caseStudyStudent.first_name} ${caseStudyStudent.last_name} (${caseStudyStudent.marks_scored}/${caseStudyStudent.max_marks} — ${caseStudyStudent.percentage}%)`
      : 'No eligible student (all marks are 0).',
  };
}

export async function getCaseStudyStudent(db, schoolId, lessonId) {
  const row = await db.prepare(`
    SELECT cs.*, s.student_number, s.first_name, s.last_name, s.gender,
      m.marks_scored, m.max_marks, m.percentage,
      u.first_name||' '||u.last_name AS assigned_by_name
    FROM aca_new_lesson_case_studies cs
    LEFT JOIN students s ON s.id=cs.student_id AND s.school_id=cs.school_id
    LEFT JOIN aca_new_student_marks m ON m.student_id=cs.student_id AND m.lesson_id=cs.lesson_id AND m.deleted_at IS NULL
    LEFT JOIN users u ON u.id=cs.assigned_by
    WHERE cs.school_id=? AND cs.lesson_id=? LIMIT 1
  `).bind(schoolId, lessonId).first();
  return row || null;
}

// ==========================================================
// 8. CASE STUDY UPLOADS (R2)
// ==========================================================

export async function getCaseStudyUploadUrl(r2, schoolId, lessonId, data, r2PublicUrl) {
  required(data.file_name, 'file_name');
  required(data.file_mime, 'file_mime');
  return generateUploadUrl(r2, 'case-study', data.file_name, data.file_mime, schoolId, lessonId, r2PublicUrl);
}

export async function confirmCaseStudyUpload(db, r2, schoolId, lessonId, data, userId, r2PublicUrl) {
  required(data.object_key, 'object_key');
  const cs = await db.prepare('SELECT student_id FROM aca_new_lesson_case_studies WHERE school_id=? AND lesson_id=? LIMIT 1').bind(schoolId, lessonId).first();
  if (!cs) throw new Error('No case study student assigned. Submit marks first so the system can select a student.');

  const confirmed = await confirmUpload(r2, data.object_key, r2PublicUrl);
  const repo      = new Repository(db);
  const att       = await repo.insert('aca_new_case_study_attachments', {
    school_id: schoolId, lesson_id: lessonId, student_id: cs.student_id,
    object_key: data.object_key, file_url: confirmed.public_url,
    file_name: data.file_name || data.object_key.split('/').pop(),
    file_mime: data.file_mime || null, file_size: toInt(data.file_size || confirmed.size, null),
    caption: data.caption || null, uploaded_by: userId, uploaded_at: nowISO(),
  });

  await db.prepare(`UPDATE aca_new_lessons SET case_study_uploaded=1, updated_at=datetime('now'), updated_by=? WHERE school_id=? AND id=?`).bind(userId, schoolId, lessonId).run();
  const student = await db.prepare('SELECT id,student_number,first_name,last_name FROM students WHERE id=? LIMIT 1').bind(cs.student_id).first();
  return { ...att, file_url: confirmed.public_url, student };
}

export async function listCaseStudyAttachments(db, schoolId, lessonId) {
  const res = await db.prepare(`
    SELECT a.*, s.first_name||' '||s.last_name AS student_full_name, s.student_number,
      u.first_name||' '||u.last_name AS uploaded_by_name
    FROM aca_new_case_study_attachments a
    LEFT JOIN students s ON s.id=a.student_id AND s.school_id=a.school_id
    LEFT JOIN users    u ON u.id=a.uploaded_by
    WHERE a.school_id=? AND a.lesson_id=? AND a.deleted_at IS NULL
    ORDER BY a.uploaded_at DESC
  `).bind(schoolId, lessonId).all();
  return res.results || [];
}

export async function deleteCaseStudyAttachment(db, r2, schoolId, attachmentId, userId) {
  const att = await db.prepare('SELECT * FROM aca_new_case_study_attachments WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, attachmentId).first();
  if (!att) throw new Error('Attachment not found');
  try { await r2.delete(att.object_key); } catch (_) {}
  await db.prepare(`UPDATE aca_new_case_study_attachments SET deleted_at=datetime('now'), deleted_by=? WHERE id=?`).bind(userId, att.id).run();
  return { success: true };
}

// ==========================================================
// 9. TEACHER ASSESSMENT
// ==========================================================

export async function getTeacherAssessment(db, schoolId, lessonId) {
  return db.prepare(`
    SELECT ta.*, u.first_name||' '||u.last_name AS submitted_by_name
    FROM aca_new_teacher_assessments ta
    LEFT JOIN users u ON u.id=ta.submitted_by
    WHERE ta.school_id=? AND ta.lesson_id=? AND ta.deleted_at IS NULL LIMIT 1
  `).bind(schoolId, lessonId).first();
}

export async function submitTeacherAssessment(db, schoolId, lessonId, data, userId) {
  required(data.strengths,       'strengths');
  required(data.weaknesses,      'weaknesses');
  required(data.recommendations, 'recommendations');

  const lesson = await db.prepare('SELECT id, status, marks_submitted FROM aca_new_lessons WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, lessonId).first();
  if (!lesson) throw new Error('Lesson not found');
  if (lesson.status === 'approved') throw new Error('Lesson is already approved');
  if (!lesson.marks_submitted) throw new Error('Marks must be submitted before posting the lesson assessment');

  await db.prepare(`UPDATE aca_new_teacher_assessments SET deleted_at=datetime('now'), deleted_by=? WHERE school_id=? AND lesson_id=? AND deleted_at IS NULL`).bind(userId, schoolId, lessonId).run();

  const repo = new Repository(db);
  await repo.insert('aca_new_teacher_assessments', {
    school_id:          schoolId, lesson_id: lessonId,
    strengths:          data.strengths,
    weaknesses:         data.weaknesses,
    recommendations:    data.recommendations,
    student_engagement: data.student_engagement || null,
    objectives_met:     data.objectives_met     ? 1 : 0,
    follow_up_required: data.follow_up_required ? 1 : 0,
    additional_notes:   data.additional_notes   || null,
    submitted_by:       userId, submitted_at: nowISO(), created_by: userId,
  });

  await db.prepare(`UPDATE aca_new_lessons SET teacher_assessment_submitted=1, updated_at=datetime('now'), updated_by=? WHERE school_id=? AND id=?`).bind(userId, schoolId, lessonId).run();
  return getTeacherAssessment(db, schoolId, lessonId);
}

// ==========================================================
// 10. ADMIN ANALYSIS
// ==========================================================

export async function getAdminAnalysis(db, schoolId, lessonId) {
  return db.prepare(`
    SELECT aa.*, u.first_name||' '||u.last_name AS analysed_by_name
    FROM aca_new_admin_analyses aa
    LEFT JOIN users u ON u.id=aa.analysed_by
    WHERE aa.school_id=? AND aa.lesson_id=? AND aa.deleted_at IS NULL LIMIT 1
  `).bind(schoolId, lessonId).first();
}

export async function submitAdminAnalysis(db, schoolId, lessonId, data, userId) {
  required(data.overall_rating, 'overall_rating');
  const rating = toInt(data.overall_rating);
  if (rating < 1 || rating > 5) throw new Error('overall_rating must be between 1 and 5');

  const lesson = await db.prepare('SELECT id, status FROM aca_new_lessons WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, lessonId).first();
  if (!lesson) throw new Error('Lesson not found');

  await db.prepare(`UPDATE aca_new_admin_analyses SET deleted_at=datetime('now'), deleted_by=? WHERE school_id=? AND lesson_id=? AND deleted_at IS NULL`).bind(userId, schoolId, lessonId).run();

  const repo = new Repository(db);
  await repo.insert('aca_new_admin_analyses', {
    school_id:           schoolId, lesson_id: lessonId,
    overall_rating:      rating,
    lesson_plan_quality: data.lesson_plan_quality  || null,
    delivery_assessment: data.delivery_assessment  || null,
    marks_assessment:    data.marks_assessment     || null,
    case_study_notes:    data.case_study_notes     || null,
    compliance_notes:    data.compliance_notes     || null,
    recommendations:     data.recommendations      || null,
    additional_notes:    data.additional_notes     || null,
    analysed_by:         userId, analysed_at: nowISO(), created_by: userId,
  });

  await db.prepare(`UPDATE aca_new_lessons SET admin_analysis_submitted=1, updated_at=datetime('now'), updated_by=? WHERE school_id=? AND id=?`).bind(userId, schoolId, lessonId).run();
  return getAdminAnalysis(db, schoolId, lessonId);
}

// ==========================================================
// 11. APPROVAL ENGINE
// ==========================================================

export async function approveLesson(db, schoolId, lessonId, data, userId) {
  const lesson = await _getLessonRow(db, schoolId, lessonId);
  if (lesson.status === 'approved') throw new Error('Lesson is already approved');
  if (!lesson.marks_submitted) throw new Error('Cannot approve: marks not yet submitted');
  if (lesson.average_percent < 50) throw new Error(`Cannot approve: class average is ${lesson.average_percent}% (minimum 50% required)`);

  // Mark the subtopic as completed
  const subtopics = await db.prepare('SELECT subtopic_id FROM aca_new_lesson_subtopics WHERE school_id=? AND lesson_id=?').bind(schoolId, lessonId).all();
  for (const s of (subtopics.results || [])) {
    await db.prepare(`
      INSERT OR IGNORE INTO aca_new_subtopic_completions
        (school_id, subtopic_id, topic_id, subject_id, term_id, class_id, lesson_id, completed_by, completed_at)
      SELECT ?, st.id, st.topic_id, tp.subject_id, l.term_id, l.class_id, l.id, ?, datetime('now')
      FROM aca_new_subtopics st
      JOIN aca_new_topics tp ON tp.id=st.topic_id
      JOIN aca_new_lessons l ON l.id=?
      WHERE st.id=?
    `).bind(schoolId, userId, lessonId, s.subtopic_id).run();

    await db.prepare(`UPDATE aca_new_subtopics SET is_completed=1, completed_at=datetime('now') WHERE school_id=? AND id=?`).bind(schoolId, s.subtopic_id).run();
  }

  await db.prepare(`
    UPDATE aca_new_lessons SET status='approved', approved_by=?, approved_at=datetime('now'),
      approval_notes=?, updated_at=datetime('now'), updated_by=?
    WHERE school_id=? AND id=?
  `).bind(userId, data.approval_notes || null, userId, schoolId, lessonId).run();

  return _getLessonRow(db, schoolId, lessonId);
}

export async function flagLessonAsFlop(db, schoolId, lessonId, data, userId) {
  required(data.repeat_reason, 'repeat_reason');
  const lesson = await db.prepare('SELECT id, status FROM aca_new_lessons WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, lessonId).first();
  if (!lesson) throw new Error('Lesson not found');

  // Reverse any subtopic completions
  const subtopics = await db.prepare('SELECT subtopic_id FROM aca_new_lesson_subtopics WHERE school_id=? AND lesson_id=?').bind(schoolId, lessonId).all();
  for (const s of (subtopics.results || [])) {
    await db.prepare(`DELETE FROM aca_new_subtopic_completions WHERE school_id=? AND lesson_id=? AND subtopic_id=?`).bind(schoolId, lessonId, s.subtopic_id).run();
    // Revert subtopic completion if no other lesson has approved it
    const otherCompletion = await db.prepare(`SELECT id FROM aca_new_subtopic_completions WHERE school_id=? AND subtopic_id=? LIMIT 1`).bind(schoolId, s.subtopic_id).first();
    if (!otherCompletion) {
      await db.prepare(`UPDATE aca_new_subtopics SET is_completed=0, completed_at=NULL WHERE school_id=? AND id=?`).bind(schoolId, s.subtopic_id).run();
    }
  }

  await db.prepare(`
    UPDATE aca_new_lessons SET
      status='repeat_required', repeat_required=1,
      repeat_reason=?, areas_to_improve=?,
      repeat_flagged_by=?, repeat_flagged_at=datetime('now'),
      updated_at=datetime('now'), updated_by=?
    WHERE school_id=? AND id=?
  `).bind(data.repeat_reason, data.areas_to_improve || null, userId, userId, schoolId, lessonId).run();

  return _getLessonRow(db, schoolId, lessonId);
}

// ==========================================================
// 12. TERM COMPLETION
// ==========================================================

export async function getTermCompletion(db, schoolId, termId, classId, subjectId) {
  const meta = await db.prepare(`
    SELECT s.name AS subject_name, t.name AS term_name, c.name AS class_name
    FROM aca_new_subjects s
    LEFT JOIN terms   t ON t.id = s.term_id  AND t.school_id = s.school_id
    LEFT JOIN classes c ON c.id = s.class_id AND c.school_id = s.school_id AND c.deleted_at IS NULL
    WHERE s.school_id=? AND s.id=? AND s.term_id=? AND s.class_id=? AND s.deleted_at IS NULL LIMIT 1
  `).bind(schoolId, subjectId, termId, classId).first();

  const totalRow = await db.prepare(`
    SELECT COUNT(DISTINCT st.id) AS cnt
    FROM aca_new_subtopics st
    JOIN aca_new_topics tp ON tp.id=st.topic_id AND tp.school_id=st.school_id
    WHERE st.school_id=? AND tp.subject_id=? AND st.deleted_at IS NULL
  `).bind(schoolId, subjectId).first();

  const completedRow = await db.prepare(`
    SELECT COUNT(DISTINCT sc.subtopic_id) AS cnt
    FROM aca_new_subtopic_completions sc
    WHERE sc.school_id=? AND sc.subject_id=? AND sc.term_id=? AND sc.class_id=?
  `).bind(schoolId, subjectId, termId, classId).first();

  const repeatRow = await db.prepare(`
    SELECT COUNT(*) AS cnt FROM aca_new_lessons
    WHERE school_id=? AND term_id=? AND class_id=? AND subject_id=? AND repeat_required=1 AND deleted_at IS NULL
  `).bind(schoolId, termId, classId, subjectId).first();

  const total     = toInt(totalRow?.cnt,     0);
  const completed = toInt(completedRow?.cnt, 0);
  const percent   = total > 0 ? Math.round((completed / total) * 10000) / 100 : 0;

  return {
    term_id: termId, class_id: classId, subject_id: subjectId,
    term_name:    meta?.term_name    || null,
    class_name:   meta?.class_name   || null,
    subject_name: meta?.subject_name || null,
    total_subtopics:       total,
    completed_subtopics:   completed,
    completion_percent:    percent,
    repeat_lessons_count:  toInt(repeatRow?.cnt, 0),
  };
}

// ==========================================================
// 13. REPORTING ENGINE
// ==========================================================

export async function getLessonReport(db, schoolId, lessonId) {
  const [lesson, plan, caseStudy, caseBooks, teacherAss, adminAnal] = await Promise.all([
    getLesson(db, schoolId, lessonId),
    getLessonPlan(db, schoolId, lessonId),
    getCaseStudyStudent(db, schoolId, lessonId),
    listCaseStudyAttachments(db, schoolId, lessonId),
    getTeacherAssessment(db, schoolId, lessonId),
    getAdminAnalysis(db, schoolId, lessonId),
  ]);

  const marksSummary = await db.prepare(`
    SELECT sm.student_id, s.first_name, s.last_name, s.student_number,
      sm.marks_scored, sm.max_marks, sm.percentage
    FROM aca_new_student_marks sm
    LEFT JOIN aca_new_lesson_assessments a ON a.id=sm.assessment_id AND a.school_id=sm.school_id
    LEFT JOIN students s ON s.id=sm.student_id AND s.school_id=sm.school_id
    WHERE sm.school_id=? AND sm.lesson_id=? AND sm.deleted_at IS NULL
    ORDER BY sm.percentage DESC
  `).bind(schoolId, lessonId).all();

  return {
    lesson, lesson_plan: plan, case_study_student: caseStudy,
    case_study_books: caseBooks, teacher_assessment: teacherAss,
    admin_analysis: adminAnal, student_marks: marksSummary.results || [],
  };
}

export async function getWeeklyReport(db, schoolId, filters = {}) {
  required(filters.week_start, 'week_start');
  required(filters.week_end,   'week_end');
  const termId  = filters.term_id  ? toInt(filters.term_id)  : null;
  const classId = filters.class_id ? toInt(filters.class_id) : null;

  const res = await db.prepare(`
    SELECT
      l.subject_id, s.name AS subject_name,
      l.class_id, c.name AS class_name,
      COUNT(l.id) AS lessons_taught,
      ROUND(AVG(l.average_percent),2) AS avg_performance,
      ROUND(SUM(CASE WHEN l.status='approved' THEN 1 ELSE 0 END)*100.0/COUNT(l.id),2) AS approval_rate,
      SUM(CASE WHEN l.repeat_required=1 THEN 1 ELSE 0 END) AS flop_count
    FROM aca_new_lessons l
    LEFT JOIN aca_new_subjects s ON s.id=l.subject_id AND s.school_id=l.school_id
    LEFT JOIN classes          c ON c.id=l.class_id   AND c.school_id=l.school_id AND c.deleted_at IS NULL
    WHERE l.school_id=? AND l.lesson_date>=? AND l.lesson_date<=? AND l.deleted_at IS NULL
      AND (? IS NULL OR l.term_id=?) AND (? IS NULL OR l.class_id=?)
    GROUP BY l.subject_id, l.class_id ORDER BY c.name ASC, s.name ASC
  `).bind(schoolId, filters.week_start, filters.week_end, termId, termId, classId, classId).all();

  return { week_start: filters.week_start, week_end: filters.week_end, data: res.results || [] };
}

export async function getTermCompletionReport(db, schoolId, termId, classId) {
  const subjects = await listSubjects(db, schoolId, { term_id: termId, class_id: classId });
  const results  = await Promise.all(subjects.map(s => getTermCompletion(db, schoolId, termId, classId, s.id)));
  const [termMeta, classMeta] = await Promise.all([
    db.prepare('SELECT name FROM terms WHERE school_id=? AND id=? LIMIT 1').bind(schoolId, termId).first(),
    db.prepare('SELECT name FROM classes WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, classId).first(),
  ]);
  return {
    term_id: termId, class_id: classId,
    term_name:  termMeta?.name  || null,
    class_name: classMeta?.name || null,
    subjects: results,
  };
}

export async function getTeacherPerformanceReport(db, schoolId, teacherUserId, termId = null) {
  const tId = termId ? toInt(termId) : null;
  const row = await db.prepare(`
    SELECT l.teacher_user_id,
      u.first_name||' '||u.last_name AS teacher_full_name, u.email AS teacher_email,
      COUNT(l.id) AS lessons_taught,
      ROUND(AVG(l.average_percent),2) AS avg_performance,
      ROUND(SUM(CASE WHEN l.status='approved' THEN 1 ELSE 0 END)*100.0/COUNT(l.id),2) AS approval_rate,
      ROUND(SUM(CASE WHEN l.repeat_required=1 THEN 1 ELSE 0 END)*100.0/COUNT(l.id),2) AS flop_rate
    FROM aca_new_lessons l
    LEFT JOIN users u ON u.id=l.teacher_user_id
    WHERE l.school_id=? AND l.teacher_user_id=? AND l.deleted_at IS NULL AND (? IS NULL OR l.term_id=?)
    GROUP BY l.teacher_user_id
  `).bind(schoolId, teacherUserId, tId, tId).first();
  if (!row) return null;

  const breakdown = await db.prepare(`
    SELECT s.id AS subject_id, s.name AS subject_name,
      COUNT(l.id) AS lessons, ROUND(AVG(l.average_percent),2) AS avg_performance
    FROM aca_new_lessons l
    LEFT JOIN aca_new_subjects s ON s.id=l.subject_id AND s.school_id=l.school_id
    WHERE l.school_id=? AND l.teacher_user_id=? AND l.deleted_at IS NULL AND (? IS NULL OR l.term_id=?)
    GROUP BY l.subject_id ORDER BY s.name ASC
  `).bind(schoolId, teacherUserId, tId, tId).all();

  return { ...row, subject_breakdown: breakdown.results || [] };
}

// FIX: original had incorrect bind param order (studentId appeared twice, schoolId missing)
export async function getStudentDetailedReport(db, schoolId, studentId, termId) {
  const student = await db.prepare('SELECT id,student_number,first_name,last_name,gender FROM students WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, studentId).first();
  if (!student) throw new Error('Student not found');

  const marks = await db.prepare(`
    SELECT
      l.lesson_date, l.id AS lesson_id,
      tp.name AS topic_name,
      s.name  AS subject_name,
      sm.marks_scored, sm.max_marks, sm.percentage,
      CASE WHEN l.case_study_student_id=? THEN 1 ELSE 0 END AS is_case_study_student
    FROM aca_new_student_marks sm
    LEFT JOIN aca_new_lesson_assessments a ON a.id=sm.assessment_id AND a.school_id=sm.school_id
    LEFT JOIN aca_new_lessons   l  ON l.id=sm.lesson_id  AND l.school_id=sm.school_id
    LEFT JOIN aca_new_topics    tp ON tp.id=l.topic_id   AND tp.school_id=l.school_id
    LEFT JOIN aca_new_subjects   s ON  s.id=l.subject_id AND  s.school_id=l.school_id
    WHERE sm.school_id=? AND sm.student_id=? AND l.term_id=? AND sm.deleted_at IS NULL
    ORDER BY l.lesson_date ASC
  `).bind(studentId, schoolId, studentId, termId).all();

  const rows   = marks.results || [];
  const avgPct = rows.length > 0
    ? Math.round((rows.reduce((s, r) => s + Number(r.percentage || 0), 0) / rows.length) * 100) / 100
    : 0;

  return {
    student, term_id: termId, lessons: rows,
    avg_performance: avgPct,
    case_study_participations: rows.filter(r => r.is_case_study_student).length,
  };
}

export async function getClassPerformanceReport(db, schoolId, termId, classId) {
  const subjects = await db.prepare(`
    SELECT l.subject_id, s.name AS subject_name,
      COUNT(l.id) AS total_lessons,
      ROUND(AVG(l.average_percent),2) AS subject_average,
      MAX(l.average_percent) AS highest_lesson_avg,
      MIN(l.average_percent) AS lowest_lesson_avg,
      ROUND(SUM(CASE WHEN l.average_percent>=50 THEN 1 ELSE 0 END)*100.0/COUNT(l.id),2) AS pass_rate
    FROM aca_new_lessons l
    LEFT JOIN aca_new_subjects s ON s.id=l.subject_id AND s.school_id=l.school_id
    WHERE l.school_id=? AND l.term_id=? AND l.class_id=? AND l.deleted_at IS NULL
    GROUP BY l.subject_id ORDER BY s.name ASC
  `).bind(schoolId, termId, classId).all();

  const trend = await db.prepare(`
    SELECT l.id AS lesson_id, l.subject_id, l.lesson_date, l.average_percent
    FROM aca_new_lessons l
    WHERE l.school_id=? AND l.term_id=? AND l.class_id=? AND l.deleted_at IS NULL
    ORDER BY l.subject_id ASC, l.lesson_date ASC
  `).bind(schoolId, termId, classId).all();

  const [classMeta, termMeta] = await Promise.all([
    db.prepare('SELECT name FROM classes WHERE school_id=? AND id=? AND deleted_at IS NULL LIMIT 1').bind(schoolId, classId).first(),
    db.prepare('SELECT name FROM terms WHERE school_id=? AND id=? LIMIT 1').bind(schoolId, termId).first(),
  ]);

  return {
    term_id: termId, class_id: classId,
    term_name:  termMeta?.name  || null,
    class_name: classMeta?.name || null,
    subjects:     subjects.results || [],
    lesson_trend: trend.results    || [],
  };
}
