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
    return connection


def init_db(connection):
    connection.executescript(
        """
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
        """
    )
    columns = [row["name"] for row in connection.execute("PRAGMA table_info(teaching_materials)").fetchall()]
    if "module" not in columns:
        connection.execute("ALTER TABLE teaching_materials ADD COLUMN module TEXT")
    if "target_user_id" not in columns:
        connection.execute("ALTER TABLE teaching_materials ADD COLUMN target_user_id TEXT")
    connection.commit()


def row_to_dict(row):
    return {key: row[key] for key in row.keys()}


def create_material(connection, payload):
    required = ["type", "title", "originalName", "fileName", "filePath", "fileUrl", "mimeType", "sizeBytes", "createdBy"]
    missing = [field for field in required if not str(payload.get(field, "")).strip()]

    if missing:
        raise ValueError("Dados obrigatórios ausentes: " + ", ".join(missing))

    material_type = str(payload["type"]).strip().lower()
    if material_type not in {"pdf", "video"}:
        raise ValueError("Tipo de material inválido.")

    now = utc_now()
    cursor = connection.execute(
        """
        INSERT INTO teaching_materials (
            type, title, description, subject, module, original_name, file_name, file_path,
            file_url, mime_type, size_bytes, target_user_id, created_by, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            material_type,
            str(payload["title"]).strip(),
            str(payload.get("description", "")).strip(),
            str(payload.get("subject", "")).strip(),
            str(payload.get("module", "")).strip(),
            str(payload["originalName"]).strip(),
            str(payload["fileName"]).strip(),
            str(payload["filePath"]).strip(),
            str(payload["fileUrl"]).strip(),
            str(payload["mimeType"]).strip(),
            int(payload["sizeBytes"]),
            str(payload.get("targetUserId", "")).strip(),
            str(payload["createdBy"]).strip(),
            now,
        ),
    )
    connection.commit()
    return get_material(connection, cursor.lastrowid)


def get_material(connection, material_id):
    row = connection.execute(
        "SELECT * FROM teaching_materials WHERE id = ?",
        (material_id,),
    ).fetchone()

    if row is None:
        raise ValueError("Material não encontrado.")

    return row_to_dict(row)


def update_material(connection, payload):
    material_id = int(payload.get("id", 0))
    material = get_material(connection, material_id)
    title = str(payload.get("title") or material["title"]).strip()
    description = str(payload.get("description", material["description"] or "")).strip()
    subject = str(payload.get("subject") or material["subject"] or "").strip()
    module = str(payload.get("module") or material["module"] or "").strip()
    target_user_id = str(payload.get("targetUserId", material["target_user_id"] or "")).strip()

    if not title:
        raise ValueError("Informe o título do material.")

    if not subject:
        raise ValueError("Informe a disciplina do material.")

    connection.execute(
        """
        UPDATE teaching_materials
        SET title = ?, description = ?, subject = ?, module = ?, target_user_id = ?
        WHERE id = ?
        """,
        (title, description, subject, module, target_user_id, material_id),
    )
    connection.commit()
    return get_material(connection, material_id)


def delete_material(connection, payload):
    material_id = int(payload.get("id", 0))
    material = get_material(connection, material_id)
    connection.execute("DELETE FROM teaching_materials WHERE id = ?", (material_id,))
    connection.commit()
    return material


def list_materials(connection, payload):
    material_type = str(payload.get("type", "")).strip().lower()
    subjects = [
        str(subject).strip().lower()
        for subject in payload.get("subjects", [])
        if str(subject).strip()
    ]
    user_id = str(payload.get("userId", "")).strip()
    params = []
    filters = []

    if material_type:
        filters.append("type = ?")
        params.append(material_type)

    if subjects:
        placeholders = ",".join("?" for _ in subjects)
        filters.append(f"LOWER(subject) IN ({placeholders})")
        params.extend(subjects)

    if user_id:
        filters.append("(target_user_id = '' OR target_user_id IS NULL OR target_user_id = ?)")
        params.append(user_id)

    where = f"WHERE {' AND '.join(filters)}" if filters else ""

    rows = connection.execute(
        f"""
        SELECT *
        FROM teaching_materials
        {where}
        ORDER BY created_at DESC
        LIMIT 200
        """,
        params,
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def read_payload():
    raw = sys.stdin.read().strip()
    return json.loads(raw) if raw else {}


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "init"
    payload = read_payload()

    with connect() as connection:
        init_db(connection)

        if action == "init":
            result = {"ok": True, "database": DB_PATH}
        elif action == "create-material":
            result = create_material(connection, payload)
        elif action == "get-material":
            result = get_material(connection, int(payload.get("id", 0)))
        elif action == "update-material":
            result = update_material(connection, payload)
        elif action == "delete-material":
            result = delete_material(connection, payload)
        elif action == "list-materials":
            result = list_materials(connection, payload)
        else:
            raise ValueError("Ação desconhecida.")

    print(json.dumps({"ok": True, "data": result}, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"ok": False, "message": str(error)}, ensure_ascii=True))
        sys.exit(1)
