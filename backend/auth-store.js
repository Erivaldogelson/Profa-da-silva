const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "users.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(
      dataFile,
      JSON.stringify({ users: [], verifications: [] }, null, 2)
    );
  }
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizePhone(phoneNumber) {
  const value = String(phoneNumber || "").trim();
  if (!value) {
    return "";
  }

  const cleaned = value.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

function readStore() {
  ensureStore();
  const raw = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  const data = {
    users: Array.isArray(raw.users) ? raw.users : [],
    verifications: Array.isArray(raw.verifications) ? raw.verifications : [],
  };

  const now = Date.now();
  const validVerifications = data.verifications.filter((item) => {
    return new Date(item.expiresAt).getTime() > now;
  });

  if (validVerifications.length !== data.verifications.length) {
    data.verifications = validVerifications;
    writeStore(data);
  }

  return data;
}

function findUserByEmail(email) {
  const db = readStore();
  return db.users.find((user) => user.email === normalizeEmail(email)) || null;
}

function findUserByPhone(phoneNumber) {
  const db = readStore();
  return (
    db.users.find((user) => user.phoneNumber === normalizePhone(phoneNumber)) ||
    null
  );
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

function saveVerification(verification) {
  const db = readStore();
  db.verifications = db.verifications.filter((item) => {
    return !(
      item.email === verification.email && item.purpose === verification.purpose
    );
  });
  db.verifications.push(verification);
  writeStore(db);
  return verification;
}

function findVerification(email, purpose) {
  const db = readStore();
  return (
    db.verifications.find((item) => {
      return (
        item.email === normalizeEmail(email) && item.purpose === purpose
      );
    }) || null
  );
}

function updateVerification(updatedVerification) {
  const db = readStore();
  const index = db.verifications.findIndex((item) => {
    return item.id === updatedVerification.id;
  });

  if (index === -1) {
    return null;
  }

  db.verifications[index] = updatedVerification;
  writeStore(db);
  return updatedVerification;
}

function deleteVerification(id) {
  const db = readStore();
  db.verifications = db.verifications.filter((item) => item.id !== id);
  writeStore(db);
}

module.exports = {
  createUser,
  deleteVerification,
  findVerification,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  findUserByProvider,
  normalizeEmail,
  normalizePhone,
  saveVerification,
  updateUser,
  updateVerification,
};
