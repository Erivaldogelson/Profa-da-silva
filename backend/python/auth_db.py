import json
import os
import sqlite3
import sys
from datetime import datetime, timezone


BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "profa.sqlite3")
JSON_STORE_PATH = os.path.join(DATA_DIR, "users.json")


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def connect():
    os.makedirs(DATA_DIR, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(connection):
    connection.executescript(
        """
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
        """
    )
    connection.commit()
    ensure_user_profile_columns(connection)
    migrate_json_store(connection)


def ensure_user_profile_columns(connection):
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(users)").fetchall()
    }
    if "avatar_path" not in columns:
        connection.execute("ALTER TABLE users ADD COLUMN avatar_path TEXT")
    if "avatar_url" not in columns:
        connection.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
    connection.commit()


def migrate_json_store(connection):
    if not os.path.exists(JSON_STORE_PATH):
        return

    existing_count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if existing_count > 0:
        return

    try:
        with open(JSON_STORE_PATH, "r", encoding="utf-8") as store_file:
            data = json.load(store_file)
    except (OSError, json.JSONDecodeError):
        return

    users = data.get("users", [])
    if not isinstance(users, list):
        return

    for user in users:
        create_user(connection, user, commit=False)

    connection.commit()


def normalize_email(email):
    return str(email or "").strip().lower()


def normalize_phone(phone_number):
    value = str(phone_number or "").strip()
    if not value:
        return ""

    cleaned = "".join(char for char in value if char.isdigit() or char == "+")
    return cleaned if cleaned.startswith("+") else f"+{cleaned}"


def clean_optional(value):
    text = str(value or "").strip()
    return text or None


def user_from_row(connection, row):
    if row is None:
        return None

    providers = connection.execute(
        """
        SELECT provider, provider_id
        FROM user_providers
        WHERE user_id = ?
        ORDER BY id ASC
        """,
        (row["id"],),
    ).fetchall()
    subjects = list_user_subjects(connection, row["id"])

    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"] or "",
        "phoneNumber": row["phone_number"] or "",
        "passwordHash": row["password_hash"],
        "role": row["role"],
        "accessStatus": row["access_status"],
        "accessNotes": row["access_notes"] or "",
        "paidAt": row["paid_at"] or "",
        "avatarPath": row["avatar_path"] or "",
        "avatarUrl": row["avatar_url"] or "",
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "providers": [
            {"provider": provider["provider"], "providerId": provider["provider_id"]}
            for provider in providers
        ],
        "subjects": subjects,
    }


def verification_from_row(row):
    if row is None:
        return None

    return {
        "id": row["id"],
        "email": row["email"],
        "purpose": row["purpose"],
        "codeHash": row["code_hash"],
        "userId": row["user_id"],
        "name": row["name"],
        "phoneNumber": row["phone_number"] or "",
        "passwordHash": row["password_hash"],
        "expiresAt": row["expires_at"],
        "attempts": row["attempts"],
        "createdAt": row["created_at"],
    }


def save_providers(connection, user_id, providers):
    connection.execute("DELETE FROM user_providers WHERE user_id = ?", (user_id,))

    for provider in providers or []:
        provider_name = str(provider.get("provider", "")).strip()
        provider_id = str(provider.get("providerId", "")).strip()

        if provider_name and provider_id:
            connection.execute(
                """
                INSERT OR IGNORE INTO user_providers (user_id, provider, provider_id)
                VALUES (?, ?, ?)
                """,
                (user_id, provider_name, provider_id),
            )


def create_user(connection, payload, commit=True):
    now = utc_now()
    access_status = str(payload.get("accessStatus") or "aguardando_pagamento").strip()

    connection.execute(
        """
        INSERT INTO users (
            id, name, email, phone_number, password_hash, role, access_status,
            access_notes, paid_at, avatar_path, avatar_url, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload["id"],
            str(payload.get("name") or "Aluno(a)").strip(),
            clean_optional(normalize_email(payload.get("email"))),
            clean_optional(normalize_phone(payload.get("phoneNumber"))),
            payload.get("passwordHash"),
            str(payload.get("role") or "aluno").strip(),
            access_status,
            str(payload.get("accessNotes") or "").strip(),
            clean_optional(payload.get("paidAt")),
            clean_optional(payload.get("avatarPath")),
            clean_optional(payload.get("avatarUrl")),
            payload.get("createdAt") or now,
            now,
        ),
    )
    save_providers(connection, payload["id"], payload.get("providers", []))

    if commit:
        connection.commit()

    return find_user_by_id(connection, payload["id"])


def update_user(connection, payload):
    existing = find_user_by_id(connection, payload.get("id"))
    if existing is None:
        return None

    now = utc_now()
    connection.execute(
        """
        UPDATE users
        SET name = ?, email = ?, phone_number = ?, password_hash = ?, role = ?,
            access_status = ?, access_notes = ?, paid_at = ?, avatar_path = ?,
            avatar_url = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            str(payload.get("name") or existing["name"]).strip(),
            clean_optional(normalize_email(payload.get("email"))),
            clean_optional(normalize_phone(payload.get("phoneNumber"))),
            payload.get("passwordHash"),
            str(payload.get("role") or existing["role"]).strip(),
            str(payload.get("accessStatus") or existing["accessStatus"]).strip(),
            str(payload.get("accessNotes") or "").strip(),
            clean_optional(payload.get("paidAt") or existing["paidAt"]),
            clean_optional(payload.get("avatarPath") or existing.get("avatarPath")),
            clean_optional(payload.get("avatarUrl") or existing.get("avatarUrl")),
            now,
            payload["id"],
        ),
    )
    save_providers(connection, payload["id"], payload.get("providers", []))
    connection.commit()
    return find_user_by_id(connection, payload["id"])


def find_user_by_id(connection, user_id):
    row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return user_from_row(connection, row)


def find_user_by_email(connection, email):
    row = connection.execute(
        "SELECT * FROM users WHERE email = ?",
        (clean_optional(normalize_email(email)),),
    ).fetchone()
    return user_from_row(connection, row)


def find_user_by_phone(connection, phone_number):
    row = connection.execute(
        "SELECT * FROM users WHERE phone_number = ?",
        (clean_optional(normalize_phone(phone_number)),),
    ).fetchone()
    return user_from_row(connection, row)


def find_user_by_provider(connection, provider, provider_id):
    row = connection.execute(
        """
        SELECT users.*
        FROM users
        INNER JOIN user_providers ON user_providers.user_id = users.id
        WHERE user_providers.provider = ? AND user_providers.provider_id = ?
        """,
        (provider, provider_id),
    ).fetchone()
    return user_from_row(connection, row)


def normalize_subject(subject):
    return " ".join(str(subject or "").strip().split())


def list_user_subjects(connection, user_id):
    rows = connection.execute(
        """
        SELECT subject
        FROM user_subject_access
        WHERE user_id = ?
        ORDER BY subject ASC
        """,
        (user_id,),
    ).fetchall()
    return [row["subject"] for row in rows]


def update_user_subjects(connection, payload):
    user_id = str(payload.get("id", "")).strip()
    user = find_user_by_id(connection, user_id)

    if user is None:
        raise ValueError("Usuário não encontrado.")

    subjects = []
    for subject in payload.get("subjects", []):
        normalized = normalize_subject(subject)
        if normalized and normalized.lower() not in [item.lower() for item in subjects]:
            subjects.append(normalized)

    now = utc_now()
    connection.execute("DELETE FROM user_subject_access WHERE user_id = ?", (user_id,))

    for subject in subjects:
        connection.execute(
            """
            INSERT INTO user_subject_access (user_id, subject, created_at)
            VALUES (?, ?, ?)
            """,
            (user_id, subject, now),
        )

    connection.commit()
    return list_user_subjects(connection, user_id)


def list_users(connection, payload):
    status = str(payload.get("accessStatus", "")).strip()
    params = []
    where = ""

    if status:
        where = "WHERE access_status = ?"
        params.append(status)

    rows = connection.execute(
        f"""
        SELECT *
        FROM users
        {where}
        ORDER BY created_at DESC
        LIMIT 200
        """,
        params,
    ).fetchall()
    return [user_from_row(connection, row) for row in rows]


def update_user_access(connection, payload):
    user_id = str(payload.get("id", "")).strip()
    status = str(payload.get("accessStatus", "")).strip().lower()
    notes = str(payload.get("accessNotes", "")).strip()
    paid_at = utc_now() if status == "ativo" else ""
    allowed = {"aguardando_pagamento", "ativo", "pausado", "bloqueado"}

    if status not in allowed:
        raise ValueError("Status de acesso inválido.")

    user = find_user_by_id(connection, user_id)
    if user is None:
        raise ValueError("Usuário não encontrado.")

    user["accessStatus"] = status
    user["accessNotes"] = notes
    if paid_at:
        user["paidAt"] = paid_at

    return update_user(connection, user)


def save_verification(connection, payload):
    connection.execute(
        """
        INSERT INTO verifications (
            id, email, purpose, code_hash, user_id, name, phone_number,
            password_hash, expires_at, attempts, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email, purpose) DO UPDATE SET
            id = excluded.id,
            code_hash = excluded.code_hash,
            user_id = excluded.user_id,
            name = excluded.name,
            phone_number = excluded.phone_number,
            password_hash = excluded.password_hash,
            expires_at = excluded.expires_at,
            attempts = excluded.attempts,
            created_at = excluded.created_at
        """,
        (
            payload["id"],
            normalize_email(payload.get("email")),
            payload["purpose"],
            payload["codeHash"],
            payload.get("userId"),
            payload.get("name"),
            normalize_phone(payload.get("phoneNumber")),
            payload.get("passwordHash"),
            payload["expiresAt"],
            int(payload.get("attempts", 0)),
            payload["createdAt"],
        ),
    )
    connection.commit()
    return find_verification(connection, payload.get("email"), payload.get("purpose"))


def purge_expired_verifications(connection):
    connection.execute(
        "DELETE FROM verifications WHERE expires_at <= ?",
        (utc_now(),),
    )
    connection.commit()


def find_verification(connection, email, purpose):
    purge_expired_verifications(connection)
    row = connection.execute(
        "SELECT * FROM verifications WHERE email = ? AND purpose = ?",
        (normalize_email(email), purpose),
    ).fetchone()
    return verification_from_row(row)


def update_verification(connection, payload):
    connection.execute(
        """
        UPDATE verifications
        SET attempts = ?
        WHERE id = ?
        """,
        (int(payload.get("attempts", 0)), payload["id"]),
    )
    connection.commit()
    row = connection.execute(
        "SELECT * FROM verifications WHERE id = ?",
        (payload["id"],),
    ).fetchone()
    return verification_from_row(row)


def delete_verification(connection, verification_id):
    connection.execute("DELETE FROM verifications WHERE id = ?", (verification_id,))
    connection.commit()
    return {"deleted": True}


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
            "create-user": lambda: create_user(connection, payload),
            "update-user": lambda: update_user(connection, payload),
            "find-user-by-id": lambda: find_user_by_id(connection, payload.get("id")),
            "find-user-by-email": lambda: find_user_by_email(connection, payload.get("email")),
            "find-user-by-phone": lambda: find_user_by_phone(connection, payload.get("phoneNumber")),
            "find-user-by-provider": lambda: find_user_by_provider(
                connection, payload.get("provider"), payload.get("providerId")
            ),
            "list-users": lambda: list_users(connection, payload),
            "update-user-access": lambda: update_user_access(connection, payload),
            "list-user-subjects": lambda: list_user_subjects(connection, payload.get("id")),
            "update-user-subjects": lambda: update_user_subjects(connection, payload),
            "save-verification": lambda: save_verification(connection, payload),
            "find-verification": lambda: find_verification(
                connection, payload.get("email"), payload.get("purpose")
            ),
            "update-verification": lambda: update_verification(connection, payload),
            "delete-verification": lambda: delete_verification(connection, payload.get("id")),
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
