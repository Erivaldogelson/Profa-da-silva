const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "users.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ users: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function findUserByEmail(email) {
  const db = readStore();
  return db.users.find((user) => user.email === normalizeEmail(email)) || null;
}

function findUserById(id) {
  const db = readStore();
  return db.users.find((user) => user.id === id) || null;
}

function findUserByProvider(provider, providerId) {
  const db = readStore();
  return (
    db.users.find(
      (user) =>
        Array.isArray(user.providers) &&
        user.providers.some(
          (entry) =>
            entry.provider === provider && entry.providerId === providerId
        )
    ) || null
  );
}

function createUser(user) {
  const db = readStore();
  db.users.push(user);
  writeStore(db);
  return user;
}

function updateUser(updatedUser) {
  const db = readStore();
  const index = db.users.findIndex((user) => user.id === updatedUser.id);

  if (index === -1) {
    return null;
  }

  db.users[index] = updatedUser;
  writeStore(db);
  return updatedUser;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByProvider,
  normalizeEmail,
  updateUser,
};
