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
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db(connection):
    connection.executescript(
        """
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
        """
    )
    connection.commit()
    seed_payment_catalog(connection)


def row_to_dict(row):
    return {key: row[key] for key in row.keys()}


def bool_to_int(value):
    return 1 if value in (True, "true", "1", 1, "on", "sim") else 0


def clean_text(value):
    return str(value or "").strip()


def normalize_features(features):
    if isinstance(features, list):
        return [clean_text(feature) for feature in features if clean_text(feature)]

    text = clean_text(features)
    if not text:
        return []

    return [line.strip() for line in text.splitlines() if line.strip()]


def course_to_dict(row, plans=None):
    course = row_to_dict(row)
    course["is_active"] = bool(course["is_active"])
    course["plans"] = plans or []
    return course


def plan_to_dict(row):
    plan = row_to_dict(row)
    plan["is_highlighted"] = bool(plan["is_highlighted"])
    plan["is_active"] = bool(plan["is_active"])
    try:
        plan["features"] = json.loads(plan.pop("features_json") or "[]")
    except json.JSONDecodeError:
        plan["features"] = []
    return plan


def seed_payment_catalog(connection):
    count = connection.execute("SELECT COUNT(*) FROM payment_courses").fetchone()[0]
    if count > 0:
        return

    seed = [
        {
            "name": "Português",
            "icon": "📘",
            "plans": [
                {
                    "title": "Acompanhamento Escolar",
                    "subtitle": "Ensino Fundamental",
                    "priceText": "R$ 50,00 /mês",
                    "secondaryPriceText": "R$ 55,00 /aula (acima de 6 meses)",
                    "badge": "Acompanhamento",
                    "features": [
                        "1 aula semanal de 1 hora",
                        "Material complementar",
                        "Exercícios por aula",
                        "Acesso ao site",
                    ],
                },
                {
                    "title": "Acompanhamento Escolar",
                    "subtitle": "Ensino Médio",
                    "priceText": "R$ 60,00 /mês",
                    "secondaryPriceText": "R$ 65,00 /aula (acima de 6 meses)",
                    "badge": "Acompanhamento",
                    "isHighlighted": True,
                    "features": [
                        "1 aula semanal de 1 hora",
                        "Material complementar",
                        "Exercícios por aula",
                        "Acesso ao site",
                    ],
                },
                {
                    "title": "Aula Avulsa",
                    "subtitle": "Português",
                    "priceText": "R$ 90,00",
                    "features": [
                        "1 aula de 1 hora",
                        "Material complementar",
                        "Exercícios",
                    ],
                },
            ],
        },
        {
            "name": "História",
            "icon": "📜",
            "plans": [
                {
                    "title": "Aula Avulsa",
                    "subtitle": "História",
                    "priceText": "R$ 100,00",
                    "features": [
                        "1 aula de 1 hora",
                        "Material complementar da aula",
                        "Exercícios da aula",
                    ],
                },
                {
                    "title": "Acompanhamento Escolar",
                    "subtitle": "História - Ensino Médio",
                    "priceText": "R$ 75,00 /aula (até 6 meses)",
                    "secondaryPriceText": "R$ 70,00 /aula (acima de 6 meses)",
                    "badge": "Acompanhamento",
                    "isHighlighted": True,
                    "features": [
                        "1 aula semanal de 1 hora",
                        "Material complementar por aula",
                        "Exercícios por aula",
                        "Acesso ao site com materiais extras",
                        "Tempo: ano escolar (a combinar)",
                    ],
                },
                {
                    "title": "Acompanhamento Escolar",
                    "subtitle": "História - Ensino Fundamental",
                    "priceText": "R$ 65,00 /aula (até 6 meses)",
                    "secondaryPriceText": "R$ 60,00 /aula (acima de 6 meses)",
                    "badge": "Acompanhamento",
                    "features": [
                        "1 aula semanal de 1 hora",
                        "Material complementar por aula",
                        "Exercícios por aula",
                        "Acesso ao site com materiais extras",
                        "Tempo: ano escolar (a combinar)",
                    ],
                },
            ],
        },
        {
            "name": "Espanhol",
            "icon": "💬",
            "plans": [
                {
                    "title": "Plano destravar o espanhol: básico ao intermediário",
                    "subtitle": "Espanhol",
                    "priceText": "R$ 40 por aula efetiva",
                    "secondaryPriceText": "R$ 30,00 /Taxa de Inscrição",
                    "features": [
                        "1 aula semanal de 1 hora",
                        "Material complementar por aula",
                        "Exercícios por aula",
                        "Acesso ao site com materiais extras para estudo",
                    ],
                },
                {
                    "title": "Plano começar a falar - básico (A1 ao A2)",
                    "subtitle": "Espanhol - básico",
                    "priceText": "R$ 45 /aula (Aulas efetivas)",
                    "secondaryPriceText": "R$ 30,00 /Taxa de Inscrição",
                    "badge": "Acompanhamento",
                    "isHighlighted": True,
                    "features": [
                        "1 aula semanal de 1 hora",
                        "Material complementar por aula",
                        "Exercícios por aula",
                        "Acesso ao site com materiais extras",
                        "Tempo: ano escolar (a combinar)",
                    ],
                },
                {
                    "title": "Plano Progressivo (básico ao avançado)",
                    "subtitle": "Espanhol avançado intermediário",
                    "priceText": "R$ 35,00 /aula (até 6 meses)",
                    "secondaryPriceText": "R$ 30,00 /Taxa de Inscrição",
                    "badge": "Acompanhamento",
                    "features": [
                        "1 aula semanal de 1 hora",
                        "Material complementar por aula",
                        "Exercícios por aula",
                        "Acesso ao site com materiais extras para estudo",
                        "Tempo: ano escolar (a combinar)",
                    ],
                },
            ],
        },
    ]

    for course_index, course in enumerate(seed, start=1):
        created = create_course(
            connection,
            {
                "name": course["name"],
                "icon": course.get("icon", ""),
                "description": "",
                "sortOrder": course_index,
                "isActive": True,
            },
            commit=False,
        )
        for plan_index, plan in enumerate(course["plans"], start=1):
            create_plan(
                connection,
                {
                    **plan,
                    "courseId": created["id"],
                    "sortOrder": plan_index,
                    "isActive": True,
                },
                commit=False,
            )

    connection.commit()


def get_course(connection, course_id):
    row = connection.execute(
        "SELECT * FROM payment_courses WHERE id = ?",
        (int(course_id),),
    ).fetchone()
    if row is None:
        raise ValueError("Curso não encontrado.")
    return course_to_dict(row)


def get_plan(connection, plan_id):
    row = connection.execute(
        "SELECT * FROM payment_plans WHERE id = ?",
        (int(plan_id),),
    ).fetchone()
    if row is None:
        raise ValueError("Plano não encontrado.")
    return plan_to_dict(row)


def create_course(connection, payload, commit=True):
    name = clean_text(payload.get("name"))
    if not name:
        raise ValueError("Informe o nome do curso.")

    now = utc_now()
    cursor = connection.execute(
        """
        INSERT INTO payment_courses (
            name, icon, description, sort_order, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            name,
            clean_text(payload.get("icon")),
            clean_text(payload.get("description")),
            int(payload.get("sortOrder") or 0),
            bool_to_int(payload.get("isActive", True)),
            now,
            now,
        ),
    )
    if commit:
        connection.commit()
    return get_course(connection, cursor.lastrowid)


def update_course(connection, payload):
    course_id = int(payload.get("id", 0))
    existing = get_course(connection, course_id)
    name = clean_text(payload.get("name")) or existing["name"]
    now = utc_now()
    connection.execute(
        """
        UPDATE payment_courses
        SET name = ?, icon = ?, description = ?, sort_order = ?, is_active = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            name,
            clean_text(payload.get("icon")),
            clean_text(payload.get("description")),
            int(payload.get("sortOrder") or 0),
            bool_to_int(payload.get("isActive", True)),
            now,
            course_id,
        ),
    )
    connection.commit()
    return get_course(connection, course_id)


def delete_course(connection, payload):
    course = get_course(connection, payload.get("id", 0))
    connection.execute("DELETE FROM payment_courses WHERE id = ?", (course["id"],))
    connection.commit()
    return course


def create_plan(connection, payload, commit=True):
    course_id = int(payload.get("courseId", 0))
    get_course(connection, course_id)
    title = clean_text(payload.get("title"))
    price_text = clean_text(payload.get("priceText"))

    if not title or not price_text:
        raise ValueError("Informe título e preço do plano.")

    now = utc_now()
    cursor = connection.execute(
        """
        INSERT INTO payment_plans (
            course_id, title, subtitle, price_text, secondary_price_text,
            features_json, badge, is_highlighted, is_active, sort_order,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            course_id,
            title,
            clean_text(payload.get("subtitle")),
            price_text,
            clean_text(payload.get("secondaryPriceText")),
            json.dumps(normalize_features(payload.get("features", [])), ensure_ascii=True),
            clean_text(payload.get("badge")),
            bool_to_int(payload.get("isHighlighted", False)),
            bool_to_int(payload.get("isActive", True)),
            int(payload.get("sortOrder") or 0),
            now,
            now,
        ),
    )
    if commit:
        connection.commit()
    return get_plan(connection, cursor.lastrowid)


def update_plan(connection, payload):
    plan_id = int(payload.get("id", 0))
    existing = get_plan(connection, plan_id)
    course_id = int(payload.get("courseId") or existing["course_id"])
    get_course(connection, course_id)
    title = clean_text(payload.get("title")) or existing["title"]
    price_text = clean_text(payload.get("priceText")) or existing["price_text"]
    now = utc_now()
    connection.execute(
        """
        UPDATE payment_plans
        SET course_id = ?, title = ?, subtitle = ?, price_text = ?,
            secondary_price_text = ?, features_json = ?, badge = ?,
            is_highlighted = ?, is_active = ?, sort_order = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            course_id,
            title,
            clean_text(payload.get("subtitle")),
            price_text,
            clean_text(payload.get("secondaryPriceText")),
            json.dumps(normalize_features(payload.get("features", [])), ensure_ascii=True),
            clean_text(payload.get("badge")),
            bool_to_int(payload.get("isHighlighted", False)),
            bool_to_int(payload.get("isActive", True)),
            int(payload.get("sortOrder") or 0),
            now,
            plan_id,
        ),
    )
    connection.commit()
    return get_plan(connection, plan_id)


def delete_plan(connection, payload):
    plan = get_plan(connection, payload.get("id", 0))
    connection.execute("DELETE FROM payment_plans WHERE id = ?", (plan["id"],))
    connection.commit()
    return plan


def list_catalog(connection, payload):
    include_inactive = bool_to_int(payload.get("includeInactive", False)) == 1
    course_where = "" if include_inactive else "WHERE is_active = 1"
    plan_where = "" if include_inactive else "AND is_active = 1"
    courses = connection.execute(
        f"""
        SELECT *
        FROM payment_courses
        {course_where}
        ORDER BY sort_order ASC, name ASC
        """
    ).fetchall()
    catalog = []
    for course_row in courses:
        plans = connection.execute(
            f"""
            SELECT *
            FROM payment_plans
            WHERE course_id = ?
            {plan_where}
            ORDER BY sort_order ASC, id ASC
            """,
            (course_row["id"],),
        ).fetchall()
        catalog.append(course_to_dict(course_row, [plan_to_dict(row) for row in plans]))
    return catalog


def create_payment(connection, payload):
    required = ["userId", "userName", "materia", "plano"]
    missing = [field for field in required if not str(payload.get(field, "")).strip()]

    if missing:
        raise ValueError("Dados obrigatórios ausentes: " + ", ".join(missing))

    now = utc_now()
    cursor = connection.execute(
        """
        INSERT INTO payment_requests (
            user_id, user_name, user_email, user_phone, materia, plano, status,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, ?)
        """,
        (
            str(payload["userId"]).strip(),
            str(payload["userName"]).strip(),
            str(payload.get("userEmail", "")).strip(),
            str(payload.get("userPhone", "")).strip(),
            str(payload["materia"]).strip(),
            str(payload["plano"]).strip(),
            now,
            now,
        ),
    )
    payment_id = cursor.lastrowid
    connection.execute(
        """
        INSERT INTO payment_audit (
            payment_id, manager_id, old_status, new_status, note, created_at
        )
        VALUES (?, NULL, NULL, 'pendente', 'Pedido criado pelo aluno.', ?)
        """,
        (payment_id, now),
    )
    connection.commit()
    return get_payment(connection, payment_id)


def get_payment(connection, payment_id):
    row = connection.execute(
        "SELECT * FROM payment_requests WHERE id = ?",
        (payment_id,),
    ).fetchone()

    if row is None:
        raise ValueError("Pedido de pagamento não encontrado.")

    return row_to_dict(row)


def list_payments(connection, payload):
    status = str(payload.get("status", "")).strip()
    params = []
    where = ""

    if status:
        where = "WHERE status = ?"
        params.append(status)

    rows = connection.execute(
        f"""
        SELECT *
        FROM payment_requests
        {where}
        ORDER BY created_at DESC
        LIMIT 200
        """,
        params,
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def update_payment_status(connection, payload):
    payment_id = int(payload.get("id", 0))
    new_status = str(payload.get("status", "")).strip().lower()
    manager_id = str(payload.get("managerId", "")).strip()
    note = str(payload.get("note", "")).strip()
    allowed_statuses = {"pendente", "em_atendimento", "pago", "cancelado"}

    if new_status not in allowed_statuses:
        raise ValueError("Status inválido.")

    payment = get_payment(connection, payment_id)
    now = utc_now()
    connection.execute(
        """
        UPDATE payment_requests
        SET status = ?, updated_at = ?
        WHERE id = ?
        """,
        (new_status, now, payment_id),
    )
    connection.execute(
        """
        INSERT INTO payment_audit (
            payment_id, manager_id, old_status, new_status, note, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (payment_id, manager_id, payment["status"], new_status, note, now),
    )
    connection.commit()
    return get_payment(connection, payment_id)


def read_payload():
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    return json.loads(raw)


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "init"
    payload = read_payload()

    with connect() as connection:
        init_db(connection)

        if action == "init":
            result = {"ok": True, "database": DB_PATH}
        elif action == "create-payment":
            result = create_payment(connection, payload)
        elif action == "list-payments":
            result = list_payments(connection, payload)
        elif action == "update-payment-status":
            result = update_payment_status(connection, payload)
        elif action == "list-catalog":
            result = list_catalog(connection, payload)
        elif action == "create-course":
            result = create_course(connection, payload)
        elif action == "update-course":
            result = update_course(connection, payload)
        elif action == "delete-course":
            result = delete_course(connection, payload)
        elif action == "create-plan":
            result = create_plan(connection, payload)
        elif action == "update-plan":
            result = update_plan(connection, payload)
        elif action == "delete-plan":
            result = delete_plan(connection, payload)
        else:
            raise ValueError("Ação desconhecida.")

    print(json.dumps({"ok": True, "data": result}, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"ok": False, "message": str(error)}, ensure_ascii=True))
        sys.exit(1)
