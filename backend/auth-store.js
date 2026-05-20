const path = require("path");
const { execFileSync } = require("child_process");

const authDbScript = path.join(__dirname, "python", "auth_db.py");
const pythonEnv = {
  ...process.env,
  PYTHONIOENCODING: "utf-8",
};

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

function runAuthDb(action, payload = {}) {
  const output = execFileSync("python", [authDbScript, action], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: pythonEnv,
  });
  const parsed = JSON.parse(output || "{}");

  if (!parsed.ok) {
    throw new Error(parsed.message || "Falha ao acessar o banco de login.");
  }

  return parsed.data || null;
}

function createUser(user) {
  return runAuthDb("create-user", user);
}

function updateUser(updatedUser) {
  return runAuthDb("update-user", updatedUser);
}

function findUserByEmail(email) {
  return runAuthDb("find-user-by-email", { email });
}

function findUserByPhone(phoneNumber) {
  return runAuthDb("find-user-by-phone", { phoneNumber });
}

function findUserById(id) {
  return runAuthDb("find-user-by-id", { id });
}

function findUserByProvider(provider, providerId) {
  return runAuthDb("find-user-by-provider", { provider, providerId });
}

function listUsers(accessStatus = "") {
  return runAuthDb("list-users", { accessStatus });
}

function updateUserAccess(id, accessStatus, accessNotes = "") {
  return runAuthDb("update-user-access", {
    id,
    accessStatus,
    accessNotes,
  });
}

function listUserSubjects(id) {
  return runAuthDb("list-user-subjects", { id }) || [];
}

function updateUserSubjects(id, subjects = []) {
  return runAuthDb("update-user-subjects", { id, subjects }) || [];
}

function saveVerification(verification) {
  return runAuthDb("save-verification", verification);
}

function findVerification(email, purpose) {
  return runAuthDb("find-verification", { email, purpose });
}

function updateVerification(updatedVerification) {
  return runAuthDb("update-verification", updatedVerification);
}

function deleteVerification(id) {
  runAuthDb("delete-verification", { id });
}

runAuthDb("init");

module.exports = {
  createUser,
  deleteVerification,
  findVerification,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  findUserByProvider,
  listUsers,
  listUserSubjects,
  normalizeEmail,
  normalizePhone,
  saveVerification,
  updateUser,
  updateUserAccess,
  updateUserSubjects,
  updateVerification,
};
