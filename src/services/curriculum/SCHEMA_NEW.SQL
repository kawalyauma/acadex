-- =========================================================
-- CURRICULUM MODULE SCHEMA — v3 (CLEAN REBUILD)
-- Prefix: aca_new_
-- Cloudflare D1 (SQLite-compatible)
-- References existing tables: schools, terms, classes, students, users
--
-- FIXES vs original:
--  1. aca_subjects: added missing term_id, class_id columns
--  2. aca_subjects: fixed broken unique index (referenced non-existent cols)
--  3. All missing tables included (plans, attachments, comments, assessments)
--  4. All aca_ prefixes renamed to aca_new_
-- =========================================================


-- =========================================================
-- 1. aca_new_subjects
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_subjects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id   INTEGER NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  -- FIX: term_id and class_id were in the unique index but missing from the table
  term_id     INTEGER REFERENCES terms(id)   ON DELETE RESTRICT,
  class_id    INTEGER REFERENCES classes(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  code        TEXT,
  description TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_by  INTEGER REFERENCES users(id),
  updated_by  INTEGER REFERENCES users(id),
  deleted_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT,
  deleted_at  TEXT
);

-- FIX: was ON aca_subjects (school_id, term_id, class_id, name) but term_id/class_id didn't exist
CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_subjects_name
  ON aca_new_subjects (school_id, term_id, class_id, name) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aca_new_subjects_school     ON aca_new_subjects (school_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_subjects_term_class ON aca_new_subjects (school_id, term_id, class_id);


-- =========================================================
-- 2. aca_new_topics
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_topics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id   INTEGER NOT NULL REFERENCES schools(id)          ON DELETE CASCADE,
  subject_id  INTEGER NOT NULL REFERENCES aca_new_subjects(id) ON DELETE RESTRICT,
  name        TEXT    NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_by  INTEGER REFERENCES users(id),
  updated_by  INTEGER REFERENCES users(id),
  deleted_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT,
  deleted_at  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_topics_name
  ON aca_new_topics (school_id, subject_id, name) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aca_new_topics_subject ON aca_new_topics (school_id, subject_id);


-- =========================================================
-- 3. aca_new_subtopics
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_subtopics (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id    INTEGER NOT NULL REFERENCES schools(id)        ON DELETE CASCADE,
  topic_id     INTEGER NOT NULL REFERENCES aca_new_topics(id) ON DELETE RESTRICT,
  name         TEXT    NOT NULL,
  description  TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  is_completed INTEGER NOT NULL DEFAULT 0,
  auto_created INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_by   INTEGER REFERENCES users(id),
  updated_by   INTEGER REFERENCES users(id),
  deleted_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT,
  deleted_at   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_subtopics_name
  ON aca_new_subtopics (school_id, topic_id, name) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aca_new_subtopics_topic ON aca_new_subtopics (school_id, topic_id);


-- =========================================================
-- 4. aca_new_teacher_allocations
-- One teacher per (term + class + subject)
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_teacher_allocations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id        INTEGER NOT NULL REFERENCES schools(id)          ON DELETE CASCADE,
  teacher_user_id  INTEGER NOT NULL REFERENCES users(id)            ON DELETE RESTRICT,
  term_id          INTEGER NOT NULL REFERENCES terms(id)            ON DELETE RESTRICT,
  class_id         INTEGER NOT NULL REFERENCES classes(id)          ON DELETE RESTRICT,
  subject_id       INTEGER NOT NULL REFERENCES aca_new_subjects(id) ON DELETE RESTRICT,
  effective_from   TEXT    NOT NULL DEFAULT (date('now')),
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_by       INTEGER REFERENCES users(id),
  deleted_by       INTEGER REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT,
  deleted_at       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_alloc_active
  ON aca_new_teacher_allocations (school_id, term_id, class_id, subject_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aca_new_alloc_teacher ON aca_new_teacher_allocations (school_id, teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_alloc_subject ON aca_new_teacher_allocations (school_id, subject_id);


-- =========================================================
-- 5. aca_new_lessons
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_lessons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id   INTEGER NOT NULL REFERENCES schools(id)          ON DELETE CASCADE,
  term_id     INTEGER NOT NULL REFERENCES terms(id)            ON DELETE RESTRICT,
  class_id    INTEGER NOT NULL REFERENCES classes(id)          ON DELETE RESTRICT,
  subject_id  INTEGER NOT NULL REFERENCES aca_new_subjects(id) ON DELETE RESTRICT,
  topic_id    INTEGER NOT NULL REFERENCES aca_new_topics(id)   ON DELETE RESTRICT,
  teacher_user_id INTEGER NOT NULL REFERENCES users(id)        ON DELETE RESTRICT,

  lesson_type TEXT NOT NULL DEFAULT 'normal'
                CHECK (lesson_type IN ('normal','extra','configurable')),
  lesson_date TEXT NOT NULL,
  period_no   INTEGER NOT NULL,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,

  -- Workflow completion flags
  lesson_plan_submitted         INTEGER NOT NULL DEFAULT 0,
  lesson_plan_uploaded          INTEGER NOT NULL DEFAULT 0,
  marks_submitted               INTEGER NOT NULL DEFAULT 0,
  case_study_uploaded           INTEGER NOT NULL DEFAULT 0,
  teacher_assessment_submitted  INTEGER NOT NULL DEFAULT 0,
  admin_analysis_submitted      INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','marks_submitted','pending_review','approved','repeat_required')),

  repeat_required   INTEGER NOT NULL DEFAULT 0,
  repeat_reason     TEXT,
  areas_to_improve  TEXT,
  repeat_flagged_by INTEGER REFERENCES users(id),
  repeat_flagged_at TEXT,

  average_marks         REAL,
  average_percent       REAL,
  highest_mark          REAL,
  lowest_mark           REAL,
  total_students        INTEGER,
  case_study_student_id INTEGER REFERENCES students(id),

  approved_by    INTEGER REFERENCES users(id),
  approved_at    TEXT,
  approval_notes TEXT,

  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  deleted_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_lessons_period
  ON aca_new_lessons (school_id, term_id, class_id, subject_id, lesson_date, period_no)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aca_new_lessons_class   ON aca_new_lessons (school_id, class_id, lesson_date);
CREATE INDEX IF NOT EXISTS idx_aca_new_lessons_subject ON aca_new_lessons (school_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_lessons_teacher ON aca_new_lessons (school_id, teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_lessons_topic   ON aca_new_lessons (school_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_lessons_term    ON aca_new_lessons (school_id, term_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_lessons_status  ON aca_new_lessons (school_id, status);


-- =========================================================
-- 6. aca_new_lesson_subtopics  (lesson ↔ subtopics junction)
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_lesson_subtopics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id   INTEGER NOT NULL REFERENCES schools(id)           ON DELETE CASCADE,
  lesson_id   INTEGER NOT NULL REFERENCES aca_new_lessons(id)   ON DELETE CASCADE,
  subtopic_id INTEGER NOT NULL REFERENCES aca_new_subtopics(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_lesson_subtopics
  ON aca_new_lesson_subtopics (school_id, lesson_id, subtopic_id);

CREATE INDEX IF NOT EXISTS idx_aca_new_ls_lesson   ON aca_new_lesson_subtopics (school_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_ls_subtopic ON aca_new_lesson_subtopics (school_id, subtopic_id);


-- =========================================================
-- 7. aca_new_lesson_plans
-- Structured plan per lesson (objectives, methodology, etc.)
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_lesson_plans (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id           INTEGER NOT NULL REFERENCES schools(id)        ON DELETE CASCADE,
  lesson_id           INTEGER NOT NULL REFERENCES aca_new_lessons(id) ON DELETE CASCADE,
  objectives          TEXT    NOT NULL,
  learning_outcomes   TEXT,
  teaching_materials  TEXT,
  methodology         TEXT,
  duration_minutes    INTEGER,
  prior_knowledge     TEXT,
  differentiation     TEXT,
  assessment_strategy TEXT,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('draft','submitted','reviewed','approved')),
  submitted_by        INTEGER REFERENCES users(id),
  submitted_at        TEXT,
  reviewed_by         INTEGER REFERENCES users(id),
  reviewed_at         TEXT,
  created_by          INTEGER REFERENCES users(id),
  deleted_by          INTEGER REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_lesson_plan
  ON aca_new_lesson_plans (school_id, lesson_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aca_new_lp_lesson ON aca_new_lesson_plans (school_id, lesson_id);


-- =========================================================
-- 8. aca_new_lesson_plan_attachments  (R2 file uploads)
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_lesson_plan_attachments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id      INTEGER NOT NULL REFERENCES schools(id)             ON DELETE CASCADE,
  lesson_id      INTEGER NOT NULL REFERENCES aca_new_lessons(id)     ON DELETE CASCADE,
  lesson_plan_id INTEGER NOT NULL REFERENCES aca_new_lesson_plans(id) ON DELETE CASCADE,
  object_key     TEXT    NOT NULL,
  file_url       TEXT    NOT NULL,
  file_name      TEXT,
  file_mime      TEXT,
  file_size      INTEGER,
  uploaded_by    INTEGER REFERENCES users(id),
  uploaded_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_by     INTEGER REFERENCES users(id),
  deleted_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_aca_new_lpa_plan   ON aca_new_lesson_plan_attachments (school_id, lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_lpa_lesson ON aca_new_lesson_plan_attachments (school_id, lesson_id);


-- =========================================================
-- 9. aca_new_lesson_plan_comments  (admin review thread)
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_lesson_plan_comments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id      INTEGER NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  lesson_id      INTEGER NOT NULL REFERENCES aca_new_lessons(id)      ON DELETE CASCADE,
  lesson_plan_id INTEGER NOT NULL REFERENCES aca_new_lesson_plans(id) ON DELETE CASCADE,
  comment        TEXT    NOT NULL,
  comment_type   TEXT    NOT NULL DEFAULT 'general'
                   CHECK (comment_type IN ('general','correction','concern','approval')),
  commented_by   INTEGER REFERENCES users(id),
  created_by     INTEGER REFERENCES users(id),
  deleted_by     INTEGER REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_aca_new_lpc_plan   ON aca_new_lesson_plan_comments (school_id, lesson_plan_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_lpc_lesson ON aca_new_lesson_plan_comments (school_id, lesson_id);


-- =========================================================
-- 10. aca_new_lesson_assessments  (marks container per lesson)
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_lesson_assessments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id    INTEGER NOT NULL REFERENCES schools(id)        ON DELETE CASCADE,
  lesson_id    INTEGER NOT NULL REFERENCES aca_new_lessons(id) ON DELETE CASCADE,
  max_marks    REAL    NOT NULL DEFAULT 100,
  submitted_by INTEGER REFERENCES users(id),
  submitted_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_lesson_assessment
  ON aca_new_lesson_assessments (school_id, lesson_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aca_new_la_lesson ON aca_new_lesson_assessments (school_id, lesson_id);


-- =========================================================
-- 11. aca_new_student_marks
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_student_marks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id     INTEGER NOT NULL REFERENCES schools(id)                    ON DELETE CASCADE,
  assessment_id INTEGER NOT NULL REFERENCES aca_new_lesson_assessments(id) ON DELETE CASCADE,
  lesson_id     INTEGER NOT NULL REFERENCES aca_new_lessons(id)            ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES students(id)                   ON DELETE RESTRICT,
  marks_scored  REAL    NOT NULL DEFAULT 0,
  max_marks     REAL    NOT NULL DEFAULT 100,
  percentage    REAL    NOT NULL DEFAULT 0,
  created_by    INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_marks_student
  ON aca_new_student_marks (school_id, assessment_id, student_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aca_new_marks_lesson   ON aca_new_student_marks (school_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_marks_student  ON aca_new_student_marks (school_id, student_id);


-- =========================================================
-- 12. aca_new_lesson_case_studies
-- Auto-selected student as the case study per lesson
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_lesson_case_studies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id   INTEGER NOT NULL REFERENCES schools(id)        ON DELETE CASCADE,
  lesson_id   INTEGER NOT NULL REFERENCES aca_new_lessons(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(id)        ON DELETE RESTRICT,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  assigned_by INTEGER REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_case_study_lesson
  ON aca_new_lesson_case_studies (school_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_aca_new_cs_student ON aca_new_lesson_case_studies (school_id, student_id);


-- =========================================================
-- 13. aca_new_case_study_attachments  (teacher uploads R2)
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_case_study_attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id   INTEGER NOT NULL REFERENCES schools(id)        ON DELETE CASCADE,
  lesson_id   INTEGER NOT NULL REFERENCES aca_new_lessons(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(id)        ON DELETE RESTRICT,
  object_key  TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_name   TEXT,
  file_mime   TEXT,
  file_size   INTEGER,
  caption     TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_by  INTEGER REFERENCES users(id),
  deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_aca_new_csa_lesson  ON aca_new_case_study_attachments (school_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_csa_student ON aca_new_case_study_attachments (school_id, student_id);


-- =========================================================
-- 14. aca_new_teacher_assessments  (post-lesson reflection)
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_teacher_assessments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id           INTEGER NOT NULL REFERENCES schools(id)        ON DELETE CASCADE,
  lesson_id           INTEGER NOT NULL REFERENCES aca_new_lessons(id) ON DELETE CASCADE,
  strengths           TEXT NOT NULL,
  weaknesses          TEXT NOT NULL,
  recommendations     TEXT NOT NULL,
  student_engagement  TEXT,
  objectives_met      INTEGER NOT NULL DEFAULT 0,
  follow_up_required  INTEGER NOT NULL DEFAULT 0,
  additional_notes    TEXT,
  submitted_by        INTEGER REFERENCES users(id),
  submitted_at        TEXT,
  created_by          INTEGER REFERENCES users(id),
  deleted_by          INTEGER REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_teacher_assessment
  ON aca_new_teacher_assessments (school_id, lesson_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aca_new_ta_lesson ON aca_new_teacher_assessments (school_id, lesson_id);


-- =========================================================
-- 15. aca_new_admin_analyses  (admin structured review)
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_admin_analyses (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id           INTEGER NOT NULL REFERENCES schools(id)        ON DELETE CASCADE,
  lesson_id           INTEGER NOT NULL REFERENCES aca_new_lessons(id) ON DELETE CASCADE,
  overall_rating      INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  lesson_plan_quality TEXT,
  delivery_assessment TEXT,
  marks_assessment    TEXT,
  case_study_notes    TEXT,
  compliance_notes    TEXT,
  recommendations     TEXT,
  additional_notes    TEXT,
  analysed_by         INTEGER REFERENCES users(id),
  analysed_at         TEXT,
  created_by          INTEGER REFERENCES users(id),
  deleted_by          INTEGER REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_admin_analysis
  ON aca_new_admin_analyses (school_id, lesson_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_aca_new_aa_lesson ON aca_new_admin_analyses (school_id, lesson_id);


-- =========================================================
-- 16. aca_new_subtopic_completions
-- Created on lesson approval, reversed on flop flagging
-- =========================================================
CREATE TABLE IF NOT EXISTS aca_new_subtopic_completions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id    INTEGER NOT NULL REFERENCES schools(id)           ON DELETE CASCADE,
  subtopic_id  INTEGER NOT NULL REFERENCES aca_new_subtopics(id) ON DELETE CASCADE,
  topic_id     INTEGER NOT NULL REFERENCES aca_new_topics(id)    ON DELETE CASCADE,
  subject_id   INTEGER NOT NULL REFERENCES aca_new_subjects(id)  ON DELETE CASCADE,
  term_id      INTEGER NOT NULL REFERENCES terms(id)             ON DELETE RESTRICT,
  class_id     INTEGER NOT NULL REFERENCES classes(id)           ON DELETE RESTRICT,
  lesson_id    INTEGER NOT NULL REFERENCES aca_new_lessons(id)   ON DELETE CASCADE,
  completed_by INTEGER REFERENCES users(id),
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aca_new_completion_subtopic_lesson
  ON aca_new_subtopic_completions (school_id, subtopic_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_aca_new_comp_term     ON aca_new_subtopic_completions (school_id, term_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_comp_class    ON aca_new_subtopic_completions (school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_comp_subject  ON aca_new_subtopic_completions (school_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_aca_new_comp_subtopic ON aca_new_subtopic_completions (school_id, subtopic_id);


-- =========================================================
-- END OF SCHEMA — aca_new_ (16 tables, fully self-consistent)
-- =========================================================
