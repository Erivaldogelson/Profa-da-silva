CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'aluno',
    access_status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
    access_notes TEXT,
    paid_at TEXT,
    avatar_path TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_access_status ON users(access_status);

CREATE TABLE IF NOT EXISTS user_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    UNIQUE(provider, provider_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_subject_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, subject),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_subject_access_user_id
    ON user_subject_access(user_id);

CREATE TABLE IF NOT EXISTS verifications (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    purpose TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    user_id TEXT,
    name TEXT,
    phone_number TEXT,
    password_hash TEXT,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(email, purpose)
);

CREATE TABLE IF NOT EXISTS payment_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT,
    user_phone TEXT,
    materia TEXT NOT NULL,
    plano TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id
    ON payment_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_requests_status
    ON payment_requests(status);

CREATE TABLE IF NOT EXISTS payment_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,
    manager_id TEXT,
    old_status TEXT,
    new_status TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(payment_id) REFERENCES payment_requests(id)
);

CREATE TABLE IF NOT EXISTS payment_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_courses_sort_order
    ON payment_courses(sort_order);

CREATE TABLE IF NOT EXISTS payment_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    price_text TEXT NOT NULL,
    secondary_price_text TEXT,
    features_json TEXT NOT NULL DEFAULT '[]',
    badge TEXT,
    is_highlighted INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(course_id) REFERENCES payment_courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_course_id
    ON payment_plans(course_id);

CREATE TABLE IF NOT EXISTS teaching_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    subject TEXT,
    module TEXT,
    original_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    target_user_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teaching_materials_type
    ON teaching_materials(type);

CREATE INDEX IF NOT EXISTS idx_teaching_materials_created_at
    ON teaching_materials(created_at);

CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    subject TEXT,
    module TEXT,
    media_type TEXT,
    media_path TEXT,
    media_url TEXT,
    media_mime_type TEXT,
    media_original_name TEXT,
    target_user_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_subject
    ON announcements(subject);

CREATE TABLE IF NOT EXISTS student_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subject TEXT,
    starts_at TEXT NOT NULL,
    notes TEXT,
    created_by TEXT,
    created_by_role TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_events_user_id
    ON student_events(user_id);

CREATE INDEX IF NOT EXISTS idx_student_events_starts_at
    ON student_events(starts_at);

CREATE TABLE IF NOT EXISTS student_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    score REAL NOT NULL,
    max_score REAL NOT NULL DEFAULT 10,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_student_grades_user_id
    ON student_grades(user_id);

CREATE INDEX IF NOT EXISTS idx_student_grades_created_at
    ON student_grades(created_at);
