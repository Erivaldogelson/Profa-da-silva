import json
import os
import sqlite3
import sys
from datetime import datetime, timezone


BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "profa.sqlite3")


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def connect():
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        os.chmod(DATA_DIR, 0o700)
    except OSError:
        pass
    connection = sqlite3.connect(DB_PATH)
    try:
        os.chmod(DB_PATH, 0o600)
    except OSError:
        pass
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(connection):
    connection.executescript(
        """
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
            pdf_path TEXT,
            pdf_mime_type TEXT,
            pdf_original_name TEXT,
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
        """
    )
    connection.commit()
    ensure_announcement_media_columns(connection)
    ensure_event_owner_columns(connection)


def ensure_announcement_media_columns(connection):
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(announcements)").fetchall()
    }
    media_columns = {
        "media_type": "TEXT",
        "media_path": "TEXT",
        "media_url": "TEXT",
        "media_mime_type": "TEXT",
        "media_original_name": "TEXT",
        "pdf_path": "TEXT",
        "pdf_mime_type": "TEXT",
        "pdf_original_name": "TEXT",
        "target_user_id": "TEXT",
    }
    for column, column_type in media_columns.items():
        if column not in columns:
            connection.execute(f"ALTER TABLE announcements ADD COLUMN {column} {column_type}")
    connection.commit()


def ensure_event_owner_columns(connection):
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(student_events)").fetchall()
    }
    if "created_by" not in columns:
        connection.execute("ALTER TABLE student_events ADD COLUMN created_by TEXT")
        connection.execute("UPDATE student_events SET created_by = user_id WHERE created_by IS NULL")
    if "created_by_role" not in columns:
        connection.execute("ALTER TABLE student_events ADD COLUMN created_by_role TEXT")
        connection.execute(
            "UPDATE student_events SET created_by_role = 'aluno' WHERE created_by_role IS NULL"
        )
    connection.commit()


def row_to_dict(row):
    return {key: row[key] for key in row.keys()}


def create_announcement(connection, payload):
    title = str(payload.get("title", "")).strip()
    body = str(payload.get("body", "")).strip()
    subject = str(payload.get("subject", "")).strip()
    module = str(payload.get("module", "")).strip()
    media_type = str(payload.get("mediaType", "")).strip()
    media_path = str(payload.get("mediaPath", "")).strip()
    media_url = str(payload.get("mediaUrl", "")).strip()
    media_mime_type = str(payload.get("mediaMimeType", "")).strip()
    media_original_name = str(payload.get("mediaOriginalName", "")).strip()
    pdf_path = str(payload.get("pdfPath", "")).strip()
    pdf_mime_type = str(payload.get("pdfMimeType", "")).strip()
    pdf_original_name = str(payload.get("pdfOriginalName", "")).strip()
    target_user_id = str(payload.get("targetUserId", "")).strip()
    created_by = str(payload.get("createdBy", "")).strip()

    if not title or not body or not created_by:
        raise ValueError("Informe título, comunicado e professor responsável.")

    now = utc_now()
    cursor = connection.execute(
        """
        INSERT INTO announcements (
            title, body, subject, module, media_type, media_path, media_url,
            media_mime_type, media_original_name, pdf_path, pdf_mime_type,
            pdf_original_name, target_user_id, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            title,
            body,
            subject,
            module,
            media_type,
            media_path,
            media_url,
            media_mime_type,
            media_original_name,
            pdf_path,
            pdf_mime_type,
            pdf_original_name,
            target_user_id,
            created_by,
            now,
            now,
        ),
    )
    connection.commit()
    return get_announcement(connection, cursor.lastrowid)


def get_announcement(connection, announcement_id):
    row = connection.execute(
        "SELECT * FROM announcements WHERE id = ?",
        (announcement_id,),
    ).fetchone()
    if row is None:
        raise ValueError("Comunicado não encontrado.")
    return row_to_dict(row)


def list_announcements(connection, payload):
    subjects = [
        str(subject).strip().lower()
        for subject in payload.get("subjects", [])
        if str(subject).strip()
    ]
    user_id = str(payload.get("userId", "")).strip()
    params = []
    filters = []

    if subjects:
        placeholders = ",".join("?" for _ in subjects)
        filters.append(f"(subject = '' OR subject IS NULL OR LOWER(subject) IN ({placeholders}))")
        params.extend(subjects)

    if user_id:
        filters.append("(target_user_id = '' OR target_user_id IS NULL OR target_user_id = ?)")
        params.append(user_id)

    where = f"WHERE {' AND '.join(filters)}" if filters else ""

    rows = connection.execute(
        f"""
        SELECT *
        FROM announcements
        {where}
        ORDER BY created_at DESC
        LIMIT 100
        """,
        params,
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def update_announcement(connection, payload):
    announcement_id = int(payload.get("id", 0))
    title = str(payload.get("title", "")).strip()
    body = str(payload.get("body", "")).strip()
    subject = str(payload.get("subject", "")).strip()
    module = str(payload.get("module", "")).strip()
    media_type = str(payload.get("mediaType", "")).strip()
    media_path = str(payload.get("mediaPath", "")).strip()
    media_url = str(payload.get("mediaUrl", "")).strip()
    media_mime_type = str(payload.get("mediaMimeType", "")).strip()
    media_original_name = str(payload.get("mediaOriginalName", "")).strip()
    pdf_path = str(payload.get("pdfPath", "")).strip()
    pdf_mime_type = str(payload.get("pdfMimeType", "")).strip()
    pdf_original_name = str(payload.get("pdfOriginalName", "")).strip()
    target_user_id = str(payload.get("targetUserId", "")).strip()

    if not title or not body:
        raise ValueError("Informe título e comunicado.")

    get_announcement(connection, announcement_id)
    now = utc_now()
    connection.execute(
        """
        UPDATE announcements
        SET title = ?, body = ?, subject = ?, module = ?, media_type = ?,
            media_path = ?, media_url = ?, media_mime_type = ?,
            media_original_name = ?, pdf_path = ?, pdf_mime_type = ?,
            pdf_original_name = ?, target_user_id = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            title,
            body,
            subject,
            module,
            media_type,
            media_path,
            media_url,
            media_mime_type,
            media_original_name,
            pdf_path,
            pdf_mime_type,
            pdf_original_name,
            target_user_id,
            now,
            announcement_id,
        ),
    )
    connection.commit()
    return get_announcement(connection, announcement_id)


def delete_announcement(connection, payload):
    announcement = get_announcement(connection, int(payload.get("id", 0)))
    connection.execute("DELETE FROM announcements WHERE id = ?", (announcement["id"],))
    connection.commit()
    return announcement


def create_event(connection, payload):
    user_id = str(payload.get("userId", "")).strip()
    title = str(payload.get("title", "")).strip()
    subject = str(payload.get("subject", "")).strip()
    starts_at = str(payload.get("startsAt", "")).strip()
    notes = str(payload.get("notes", "")).strip()
    created_by = str(payload.get("createdBy") or user_id).strip()
    created_by_role = str(payload.get("createdByRole") or "aluno").strip()

    if not user_id or not title or not starts_at:
        raise ValueError("Informe título, data e aluno responsável.")

    now = utc_now()
    cursor = connection.execute(
        """
        INSERT INTO student_events (
            user_id, title, subject, starts_at, notes, created_by, created_by_role,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, title, subject, starts_at, notes, created_by, created_by_role, now, now),
    )
    connection.commit()
    return get_event(connection, cursor.lastrowid)


def get_event(connection, event_id):
    row = connection.execute(
        "SELECT * FROM student_events WHERE id = ?",
        (event_id,),
    ).fetchone()
    if row is None:
        raise ValueError("Evento não encontrado.")
    return row_to_dict(row)


def list_events(connection, payload):
    user_id = str(payload.get("userId", "")).strip()
    params = []
    where = ""

    if user_id:
        where = "WHERE user_id = ?"
        params.append(user_id)

    rows = connection.execute(
        f"""
        SELECT *
        FROM student_events
        {where}
        ORDER BY starts_at ASC
        LIMIT 100
        """,
        params,
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def delete_event(connection, payload):
    event = get_event(connection, int(payload.get("id", 0)))
    requester = str(payload.get("userId", "")).strip()
    manager_id = str(payload.get("managerId", "")).strip()
    if manager_id:
        connection.execute("DELETE FROM student_events WHERE id = ?", (event["id"],))
        connection.commit()
        return event
    if event["user_id"] != requester or event.get("created_by") != requester:
        raise ValueError("Evento não pertence a este aluno.")
    connection.execute("DELETE FROM student_events WHERE id = ?", (event["id"],))
    connection.commit()
    return event


def normalize_score(value, field_name):
    try:
        score = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        raise ValueError(f"Informe {field_name} como número.")

    if score < 0:
        raise ValueError(f"{field_name.capitalize()} não pode ser negativa.")

    return score


def get_grade(connection, grade_id):
    row = connection.execute(
        "SELECT * FROM student_grades WHERE id = ?",
        (grade_id,),
    ).fetchone()
    if row is None:
        raise ValueError("Nota não encontrada.")
    return row_to_dict(row)


def create_grade(connection, payload):
    user_id = str(payload.get("userId", "")).strip()
    subject = str(payload.get("subject", "")).strip()
    title = str(payload.get("title", "")).strip()
    notes = str(payload.get("notes", "")).strip()
    created_by = str(payload.get("createdBy", "")).strip()
    score = normalize_score(payload.get("score"), "a nota")
    max_score = normalize_score(payload.get("maxScore", 10), "a nota máxima")

    if not user_id or not subject or not title or not created_by:
        raise ValueError("Informe aluno, disciplina, atividade e professor responsável.")

    if max_score <= 0:
        raise ValueError("A nota máxima deve ser maior que zero.")

    if score > max_score:
        raise ValueError("A nota não pode ser maior que a nota máxima.")

    now = utc_now()
    cursor = connection.execute(
        """
        INSERT INTO student_grades (
            user_id, subject, title, score, max_score, notes, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (user_id, subject, title, score, max_score, notes, created_by, now, now),
    )
    connection.commit()
    return get_grade(connection, cursor.lastrowid)


def list_grades(connection, payload):
    user_id = str(payload.get("userId", "")).strip()
    params = []
    where = ""

    if user_id:
        where = "WHERE user_id = ?"
        params.append(user_id)

    rows = connection.execute(
        f"""
        SELECT *
        FROM student_grades
        {where}
        ORDER BY created_at DESC
        LIMIT 200
        """,
        params,
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def delete_grade(connection, payload):
    grade = get_grade(connection, int(payload.get("id", 0)))
    connection.execute("DELETE FROM student_grades WHERE id = ?", (grade["id"],))
    connection.commit()
    return grade


def read_payload():
    raw = sys.stdin.read().strip()
    return json.loads(raw) if raw else {}


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "init"
    payload = read_payload()

    with connect() as connection:
        init_db(connection)
        actions = {
            "init": lambda: {"ok": True, "database": DB_PATH},
            "create-announcement": lambda: create_announcement(connection, payload),
            "get-announcement": lambda: get_announcement(connection, int(payload.get("id", 0))),
            "list-announcements": lambda: list_announcements(connection, payload),
            "update-announcement": lambda: update_announcement(connection, payload),
            "delete-announcement": lambda: delete_announcement(connection, payload),
            "create-event": lambda: create_event(connection, payload),
            "list-events": lambda: list_events(connection, payload),
            "delete-event": lambda: delete_event(connection, payload),
            "create-grade": lambda: create_grade(connection, payload),
            "list-grades": lambda: list_grades(connection, payload),
            "delete-grade": lambda: delete_grade(connection, payload),
        }

        if action not in actions:
            raise ValueError("Ação desconhecida.")

        result = actions[action]()

    print(json.dumps({"ok": True, "data": result}, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"ok": False, "message": str(error)}, ensure_ascii=True))
        sys.exit(1)
