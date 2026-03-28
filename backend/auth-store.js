const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "auth.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbFile);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function mapUser(row, providers = []) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    providers,
  };
}

async function getProvidersForUser(userId) {
  return all(
    `
      SELECT provider, provider_id AS providerId
      FROM user_providers
      WHERE user_id = ?
    `,
    [userId]
  );
}

async function withProviders(row) {
  if (!row) {
    return null;
  }

  const providers = await getProvidersForUser(row.id);
  return mapUser(row, providers);
}

async function initStore() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      UNIQUE(provider, provider_id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
}

async function findUserByEmail(email) {
  const row = await get(
    `
      SELECT id, name, email, password_hash, created_at
      FROM users
      WHERE email = ?
    `,
    [normalizeEmail(email)]
  );

  return withProviders(row);
}

async function findUserById(id) {
  const row = await get(
    `
      SELECT id, name, email, password_hash, created_at
      FROM users
      WHERE id = ?
    `,
    [id]
  );

  return withProviders(row);
}

async function findUserByProvider(provider, providerId) {
  const row = await get(
    `
      SELECT u.id, u.name, u.email, u.password_hash, u.created_at
      FROM users u
      INNER JOIN user_providers p ON p.user_id = u.id
      WHERE p.provider = ? AND p.provider_id = ?
    `,
    [provider, providerId]
  );

  return withProviders(row);
}

async function createUser(user) {
  await run(
    `
      INSERT INTO users (id, name, email, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      user.id,
      user.name,
      normalizeEmail(user.email),
      user.passwordHash,
      user.createdAt,
    ]
  );

  for (const provider of user.providers || []) {
    await run(
      `
        INSERT OR IGNORE INTO user_providers (user_id, provider, provider_id)
        VALUES (?, ?, ?)
      `,
      [user.id, provider.provider, provider.providerId]
    );
  }

  return findUserById(user.id);
}

async function updateUser(user) {
  await run(
    `
      UPDATE users
      SET name = ?, email = ?, password_hash = ?
      WHERE id = ?
    `,
    [user.name, normalizeEmail(user.email), user.passwordHash, user.id]
  );

  for (const provider of user.providers || []) {
    await run(
      `
        INSERT OR IGNORE INTO user_providers (user_id, provider, provider_id)
        VALUES (?, ?, ?)
      `,
      [user.id, provider.provider, provider.providerId]
    );
  }

  return findUserById(user.id);
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByProvider,
  initStore,
  normalizeEmail,
  updateUser,
};
