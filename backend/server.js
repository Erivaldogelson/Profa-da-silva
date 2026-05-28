const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const multer = require("multer");
const nodemailer = require("nodemailer");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const {
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
} = require("./auth-store");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");
const paymentDir = path.join(__dirname, "..", "Pro-fa Pagamento");
const gestaoDir = path.join(__dirname, "gestao");
const alunoDir = path.join(__dirname, "aluno");
const uploadsDir = path.join(__dirname, "uploads");
const pdfUploadsDir = path.join(uploadsDir, "pdfs");
const videoUploadsDir = path.join(uploadsDir, "videos");
const profileUploadsDir = path.join(uploadsDir, "profiles");
const announcementUploadsDir = path.join(uploadsDir, "announcements");
const sessionSecret = process.env.SESSION_SECRET || "troque-esta-chave";
const isProduction = process.env.NODE_ENV === "production";
const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const emailFrom =
  process.env.EMAIL_FROM ||
  process.env.EMAIL_USER ||
  "nao-responda@profa.local";
const pythonScript = path.join(__dirname, "python", "twilio_verify.py");
const paymentDbScript = path.join(__dirname, "python", "payments_db.py");
const materialsDbScript = path.join(__dirname, "python", "materials_db.py");
const learningDbScript = path.join(__dirname, "python", "learning_db.py");
const pythonEnv = {
  ...process.env,
  PYTHONIOENCODING: "utf-8",
};
const gestaoEmails = String(process.env.GESTAO_EMAILS || "")
  .split(",")
  .map((email) => normalizeEmail(email))
  .filter(Boolean);
const twilioConfigured =
  Boolean(process.env.TWILIO_ACCOUNT_SID) &&
  Boolean(process.env.TWILIO_AUTH_TOKEN) &&
  Boolean(process.env.TWILIO_VERIFY_SERVICE_SID);

const smtpConfigured =
  Boolean(process.env.EMAIL_HOST) &&
  Boolean(process.env.EMAIL_PORT) &&
  Boolean(process.env.EMAIL_USER) &&
  Boolean(process.env.EMAIL_PASS);

const mailTransport = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: String(process.env.EMAIL_SECURE || "false") === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
  })
  : null;

if (isProduction && sessionSecret === "troque-esta-chave") {
  throw new Error("Configure SESSION_SECRET no ambiente de produção.");
}

[uploadsDir, pdfUploadsDir, videoUploadsDir, profileUploadsDir, announcementUploadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const materialStorage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, req.materialType === "video" ? videoUploadsDir : pdfUploadsDir);
  },
  filename(req, file, callback) {
    const safeBaseName = path
      .basename(file.originalname, path.extname(file.originalname))
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "material";
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}-${safeBaseName}${extension}`);
  },
});

const materialUpload = multer({
  storage: materialStorage,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    if (req.materialType === "pdf" && file.mimetype !== "application/pdf") {
      callback(new Error("Envie um arquivo PDF válido."));
      return;
    }

    if (req.materialType === "video" && !file.mimetype.startsWith("video/")) {
      callback(new Error("Envie um arquivo de vídeo válido."));
      return;
    }

    callback(null, true);
  },
});

const profileStorage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, profileUploadsDir);
  },
  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
    callback(null, `${req.user.id}-${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const profileUpload = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Envie uma imagem válida para a foto de perfil."));
      return;
    }

    callback(null, true);
  },
});

const announcementStorage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, announcementUploadsDir);
  },
  filename(req, file, callback) {
    const safeBaseName = path
      .basename(file.originalname, path.extname(file.originalname))
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "comunicado";
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}-${safeBaseName}${extension}`);
  },
});

const announcementUpload = multer({
  storage: announcementStorage,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    if (!file.mimetype.startsWith("audio/") && !file.mimetype.startsWith("video/")) {
      callback(new Error("Envie um arquivo de áudio ou vídeo válido."));
      return;
    }

    callback(null, true);
  },
});

function hasRealEnvValue(value, placeholderSnippets = []) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return false;
  }

  const lowerValue = normalized.toLowerCase();
  return !placeholderSnippets.some((snippet) => lowerValue.includes(snippet));
}

function sanitizeUser(user) {
  const role = getUserRole(user);

  return {
    id: user.id,
    name: user.name,
    email: user.email || "",
    phoneNumber: user.phoneNumber || "",
    createdAt: user.createdAt,
    role,
    accessStatus: user.accessStatus || "aguardando_pagamento",
    paidAt: user.paidAt || "",
    avatarUrl: user.avatarUrl || "",
    subjects: Array.isArray(user.subjects) ? user.subjects : [],
    providers: (user.providers || []).map((provider) => provider.provider),
  };
}

function getUserRole(user) {
  if (!user) {
    return "aluno";
  }

  if (user.role === "gestao") {
    return "gestao";
  }

  return gestaoEmails.includes(normalizeEmail(user.email)) ? "gestao" : "aluno";
}

function canAccessPaidArea(user) {
  return getUserRole(user) === "gestao" || user?.accessStatus === "ativo";
}

function getCurrentPaymentCycleStart(referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 5, 0, 0, 0, 0);

  if (referenceDate.getDate() < 5) {
    start.setMonth(start.getMonth() - 1);
  }

  return start;
}

function getNextPaymentClosingDate(referenceDate = new Date()) {
  const closingDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 5, 12, 0, 0, 0);

  if (referenceDate.getDate() > 5) {
    closingDate.setMonth(closingDate.getMonth() + 1);
  }

  return closingDate;
}

function formatBillingDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function paymentBelongsToCurrentCycle(payment, cycleStart) {
  const paidDate = new Date(payment.updated_at || payment.created_at || "");
  return payment.status === "pago" && Number.isFinite(paidDate.getTime()) && paidDate >= cycleStart;
}

async function getStudentBillingStatus(user) {
  if (!user || getUserRole(user) === "gestao") {
    return {
      status: "ok",
      requiresPayment: false,
    };
  }

  const today = new Date();
  const todayDay = today.getDate();
  const cycleStart = getCurrentPaymentCycleStart(today);
  const nextClosingDate = getNextPaymentClosingDate(today);
  const payments = await runPaymentDb("list-payments", { userId: user.id });
  const hasPaidCurrentCycle = payments.some((payment) => paymentBelongsToCurrentCycle(payment, cycleStart));

  if (hasPaidCurrentCycle) {
    return {
      status: "ok",
      requiresPayment: false,
      hasPaidCurrentCycle,
      closingDay: 5,
      warningDay: 10,
      cancellationDay: 12,
      nextClosingDate: nextClosingDate.toISOString(),
      message: `Pagamento do ciclo atual confirmado. Próximo fechamento: ${formatBillingDate(nextClosingDate)}.`,
    };
  }

  if (todayDay >= 12) {
    return {
      status: "blocked",
      requiresPayment: true,
      hasPaidCurrentCycle,
      closingDay: 5,
      warningDay: 10,
      cancellationDay: 12,
      nextClosingDate: nextClosingDate.toISOString(),
      message:
        "Seu acesso foi pausado automaticamente porque o pagamento deste mês não foi confirmado até o dia 12.",
    };
  }

  if (todayDay >= 10) {
    return {
      status: "warning",
      requiresPayment: true,
      hasPaidCurrentCycle,
      closingDay: 5,
      warningDay: 10,
      cancellationDay: 12,
      nextClosingDate: nextClosingDate.toISOString(),
      message:
        "Seu pagamento fecha todo dia 5. Como o pagamento deste mês ainda não foi confirmado, seu acesso será retirado no dia 12.",
    };
  }

  return {
    status: "ok",
    requiresPayment: false,
    hasPaidCurrentCycle,
    closingDay: 5,
    warningDay: 10,
    cancellationDay: 12,
    nextClosingDate: nextClosingDate.toISOString(),
    message: `Seu pagamento fecha todo dia 5. Próximo fechamento: ${formatBillingDate(nextClosingDate)}.`,
  };
}

function pauseUserForMissingPayment(user) {
  const updatedUser = updateUserAccess(
    user.id,
    "pausado",
    "Acesso pausado automaticamente: pagamento mensal não confirmado até o dia 12."
  );
  return updatedUser || findUserById(user.id) || user;
}

function shouldSkipPayment(user) {
  return getUserRole(user) !== "gestao" && user?.accessStatus === "ativo";
}

function normalizeSubjectName(subject) {
  return String(subject || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function canAccessMaterial(user, material) {
  if (getUserRole(user) === "gestao") {
    return true;
  }

  if (material.target_user_id && material.target_user_id !== user.id) {
    return false;
  }

  const subjects = listUserSubjects(user.id).map(normalizeSubjectName);
  const materialSubject = normalizeSubjectName(material.subject);
  return Boolean(materialSubject) && subjects.includes(materialSubject);
}

function enrichTargetUsers(items, users) {
  const usersById = new Map(users.map((user) => [user.id, user]));
  return items.map((item) => ({
    ...item,
    target_user: item.target_user_id ? usersById.get(item.target_user_id) || null : null,
  }));
}

function sendMaterialFile(res, material) {
  const resolvedUploads = path.resolve(uploadsDir);
  const resolvedFile = path.resolve(material.file_path);
  const relativePath = path.relative(resolvedUploads, resolvedFile);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return res.status(400).json({ message: "Arquivo inválido." });
  }

  return res.sendFile(resolvedFile);
}

function sendProfileFile(req, res, next) {
  const resolvedProfiles = path.resolve(profileUploadsDir);
  const resolvedFile = path.resolve(profileUploadsDir, req.params.fileName || "");
  const relativePath = path.relative(resolvedProfiles, resolvedFile);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return res.status(400).json({ message: "Arquivo inválido." });
  }

  return res.sendFile(resolvedFile, (error) => {
    if (error) {
      next(error);
    }
  });
}

function sendAnnouncementMediaFile(req, res, announcement) {
  if (!announcement?.media_path) {
    return res.status(404).json({ message: "Este comunicado não possui mídia." });
  }

  const resolvedAnnouncements = path.resolve(announcementUploadsDir);
  const resolvedFile = path.resolve(announcement.media_path);
  const relativePath = path.relative(resolvedAnnouncements, resolvedFile);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return res.status(400).json({ message: "Arquivo inválido." });
  }

  return res.sendFile(resolvedFile);
}

function canAccessAnnouncement(user, announcement) {
  if (getUserRole(user) === "gestao") {
    return true;
  }

  if (announcement.target_user_id && announcement.target_user_id !== user.id) {
    return false;
  }

  if (!announcement.subject) {
    return true;
  }

  const subjects = listUserSubjects(user.id).map(normalizeSubjectName);
  return subjects.includes(normalizeSubjectName(announcement.subject));
}

function requireAuth(req, res, next) {
  if (req.user) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ message: "Faça login para continuar." });
  }

  return res.redirect("/login.html");
}

function requireGestao(req, res, next) {
  if (!req.user) {
    if (!req.originalUrl.startsWith("/api/")) {
      return res.redirect("/professor-login.html");
    }

    return res.status(401).json({ message: "Faça login para continuar." });
  }

  if (getUserRole(req.user) !== "gestao") {
    if (!req.originalUrl.startsWith("/api/")) {
      return res.redirect("/professor-login.html?erro=permissao");
    }

    return res.status(403).json({
      message: "Acesso permitido somente para a gestão.",
    });
  }

  return next();
}

async function requirePaidAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Faça login para continuar." });
  }

  let billing = null;

  try {
    billing = await getStudentBillingStatus(req.user);
  } catch (error) {
    return res.status(500).json({
      message: "Não foi possível verificar a situação do pagamento.",
    });
  }

  if (billing.status === "blocked" && canAccessPaidArea(req.user)) {
    req.user = pauseUserForMissingPayment(req.user);
  }

  if (billing.status === "blocked") {
    return res.status(402).json({
      message: billing.message,
      billing,
    });
  }

  if (!canAccessPaidArea(req.user)) {
    return res.status(402).json({
      message:
        "Seu acesso ainda aguarda confirmação do pagamento pela gestão.",
      billing,
    });
  }

  return next();
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildPhoneCodeMessage(channel) {
  return "Código enviado por SMS.";
}

async function startSmsLogin(req, user, options = {}) {
  if (!user.phoneNumber) {
    return {
      errorStatus: 400,
      errorMessage: "Esta conta ainda não possui telefone cadastrado para confirmação por SMS.",
    };
  }

  if (!twilioConfigured) {
    return {
      errorStatus: 400,
      errorMessage:
        "Twilio Verify ainda não está configurado. Preencha as credenciais da Twilio no .env para enviar SMS.",
    };
  }

  try {
    await runPythonTwilio(["start", user.phoneNumber, "sms"]);
  } catch (error) {
    return {
      errorStatus: 500,
      errorMessage: error.message,
    };
  }

  req.session.pendingPhoneLogin = {
    userId: user.id,
    phoneNumber: user.phoneNumber,
    channel: "sms",
    requireRole: options.requireRole || "",
  };

  return {
    message: buildPhoneCodeMessage("sms"),
    phoneNumber: user.phoneNumber,
    channel: "sms",
    purpose: "login-phone",
  };
}

async function sendOtpEmail(email, code, purpose) {
  const subject =
    purpose === "register"
      ? "Confirme seu cadastro"
      : purpose === "reset-password"
        ? "Redefina sua senha"
      : "Confirme seu login";
  const action =
    purpose === "register"
      ? "concluir seu cadastro"
      : purpose === "reset-password"
        ? "redefinir sua senha"
      : "concluir seu login";
  const text = `Seu código de confirmação é ${code}. Ele expira em ${otpExpiryMinutes} minutos. Use este código para ${action}.`;

  if (!mailTransport) {
    console.log(`[OTP ${purpose}] ${email}: ${code}`);
    return {
      debugHint:
        "E-mail não configurado. Em ambiente local, confira o código no terminal do servidor.",
      debugCode: code,
    };
  }

  try {
    await mailTransport.sendMail({
      from: emailFrom,
      to: email,
      subject,
      text,
      html: `
        <div style="font-family: Arial, sans-serif; color: #181818;">
          <h2>${subject}</h2>
          <p>Use o código abaixo para ${action}:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
          <p>Este código expira em ${otpExpiryMinutes} minutos.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Falha ao enviar OTP por e-mail:", error.message);
    console.log(`[OTP ${purpose}] ${email}: ${code}`);
    return {
      debugHint:
        "O envio de e-mail falhou. Em ambiente local, confira o código no terminal do servidor.",
      debugCode: code,
    };
  }

  return { debugHint: "", debugCode: "" };
}

async function createVerification(payload) {
  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  saveVerification({
    id: crypto.randomUUID(),
    email: normalizeEmail(payload.email),
    purpose: payload.purpose,
    codeHash,
    userId: payload.userId || null,
    name: payload.name || null,
    phoneNumber: payload.phoneNumber || "",
    passwordHash: payload.passwordHash || null,
    expiresAt: new Date(
      Date.now() + otpExpiryMinutes * 60 * 1000
    ).toISOString(),
    attempts: 0,
    createdAt: new Date().toISOString(),
  });

  return sendOtpEmail(payload.email, code, payload.purpose);
}

function runPythonTwilio(args) {
  return new Promise((resolve, reject) => {
    execFile("python", [pythonScript, ...args], { env: pythonEnv }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(
            stderr?.trim() ||
              stdout?.trim() ||
              "Falha ao executar o script Python da Twilio."
          )
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (parseError) {
        reject(new Error("Resposta inválida do script Python da Twilio."));
      }
    });
  });
}

function runPaymentDb(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "python",
      [paymentDbScript, action],
      { env: pythonEnv },
      (error, stdout, stderr) => {
        let parsed = null;

        try {
          parsed = JSON.parse(stdout || "{}");
        } catch (parseError) {
          reject(new Error("Resposta inválida do banco de dados Python."));
          return;
        }

        if (error || !parsed.ok) {
          reject(
            new Error(
              parsed.message ||
                stderr?.trim() ||
                "Falha ao executar o banco de dados Python."
            )
          );
          return;
        }

        resolve(parsed.data);
      }
    );

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function runMaterialsDb(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "python",
      [materialsDbScript, action],
      { env: pythonEnv },
      (error, stdout, stderr) => {
        let parsed = null;

        try {
          parsed = JSON.parse(stdout || "{}");
        } catch (parseError) {
          reject(new Error("Resposta inválida do banco de materiais."));
          return;
        }

        if (error || !parsed.ok) {
          reject(
            new Error(
              parsed.message ||
                stderr?.trim() ||
                "Falha ao executar o banco de materiais."
            )
          );
          return;
        }

        resolve(parsed.data);
      }
    );

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function runLearningDb(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "python",
      [learningDbScript, action],
      { env: pythonEnv },
      (error, stdout, stderr) => {
        let parsed = null;

        try {
          parsed = JSON.parse(stdout || "{}");
        } catch (parseError) {
          reject(new Error("Resposta inválida do banco de aprendizagem."));
          return;
        }

        if (error || !parsed.ok) {
          reject(
            new Error(
              parsed.message ||
                stderr?.trim() ||
                "Falha ao executar o banco de aprendizagem."
            )
          );
          return;
        }

        resolve(parsed.data);
      }
    );

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function buildOAuthUser(profile, provider, emailFallback = "") {
  const email =
    normalizeEmail(profile?.emails?.[0]?.value) || normalizeEmail(emailFallback);
  const displayName =
    profile?.displayName ||
    [profile?.name?.givenName, profile?.name?.familyName]
      .filter(Boolean)
      .join(" ") ||
    "Aluno(a)";
  const providerId = String(profile.id);

  let user = findUserByProvider(provider, providerId);

  if (!user && email) {
    user = findUserByEmail(email);
  }

  if (user) {
    const providers = Array.isArray(user.providers) ? user.providers : [];
    const alreadyLinked = providers.some((item) => {
      return item.provider === provider && item.providerId === providerId;
    });

    if (!alreadyLinked) {
      providers.push({ provider, providerId });
    }

    user.name = user.name || displayName;
    user.email = user.email || email;
    user.providers = providers;
    return updateUser(user);
  }

  return createUser({
    id: crypto.randomUUID(),
    name: displayName,
    email,
    phoneNumber: "",
    passwordHash: null,
    providers: [{ provider, providerId }],
    createdAt: new Date().toISOString(),
  });
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  done(null, findUserById(id) || false);
});

const googleConfigured =
  hasRealEnvValue(process.env.GOOGLE_CLIENT_ID, ["seu-client-id-google"]) &&
  hasRealEnvValue(process.env.GOOGLE_CLIENT_SECRET, ["seu-client-secret-google"]) &&
  Boolean(String(process.env.GOOGLE_CALLBACK_URL || "").trim());

if (googleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          const user = buildOAuthUser(profile, "google");
          done(null, user);
        } catch (error) {
          done(error);
        }
      }
    )
  );
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
      "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(publicDir));
app.use("/gestao", requireGestao, express.static(gestaoDir));
app.use("/aluno", requirePaidAccess, express.static(alunoDir));
app.use(
  "/pagamento",
  requireAuth,
  (req, res, next) => {
    if (shouldSkipPayment(req.user)) {
      return res.redirect("/aluno/");
    }

    return next();
  },
  express.static(paymentDir)
);

runPaymentDb("init").catch((error) => {
  console.error("Falha ao iniciar o banco de pagamentos:", error.message);
});

runMaterialsDb("init").catch((error) => {
  console.error("Falha ao iniciar o banco de materiais:", error.message);
});

runLearningDb("init").catch((error) => {
  console.error("Falha ao iniciar o banco de aprendizagem:", error.message);
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/providers", (req, res) => {
  res.json({
    google: googleConfigured,
    googleMode: googleConfigured ? "oauth" : "disabled",
    twilio: twilioConfigured,
  });
});

app.post("/api/auth/register/start", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  const password = String(req.body?.password || "");

  if (!name || !email || password.length < 6) {
    return res.status(400).json({
      message: "Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.",
    });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ message: "Este e-mail já está cadastrado." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await createVerification({
    email,
    purpose: "register",
    name,
    phoneNumber,
    passwordHash,
  });

  req.session.pendingEmailRegister = {
    name,
    email,
    phoneNumber,
    passwordHash,
  };

  return res.status(201).json({
    message: "Código de confirmação enviado para o seu e-mail.",
    email,
    purpose: "register",
    debugCode: result.debugCode,
    debugHint: result.debugHint,
  });
});

app.post("/api/auth/register/phone/start", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  const password = String(req.body?.password || "");
  const channel = String(req.body?.channel || "").trim().toLowerCase();

  if (!name || !email || !phoneNumber || password.length < 6) {
    return res.status(400).json({
      message:
        "Preencha nome, e-mail, telefone e uma senha com pelo menos 6 caracteres.",
    });
  }

  if (!twilioConfigured) {
    return res.status(400).json({
      message:
        "Twilio Verify ainda não está configurado. Preencha as credenciais da Twilio no .env.",
    });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ message: "Este e-mail já está cadastrado." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await runPythonTwilio(["start", phoneNumber, channel]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  req.session.pendingPhoneRegister = {
    name,
    email,
    phoneNumber,
    passwordHash,
    channel,
  };

  return res.status(201).json({
    message: buildPhoneCodeMessage(channel),
    phoneNumber,
    channel,
    purpose: "register-phone",
  });
});

app.post("/api/auth/login/start", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const user = findUserByEmail(email);

  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: "E-mail ou senha inválidos." });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ message: "E-mail ou senha inválidos." });
  }

  const result = await createVerification({
    email,
    purpose: "login",
    userId: user.id,
  });

  req.session.pendingEmailLogin = {
    email,
    userId: user.id,
  };

  return res.json({
    message: "Código de confirmação enviado para o seu e-mail.",
    email,
    purpose: "login",
    debugCode: result.debugCode,
    debugHint: result.debugHint,
  });
});

app.post("/api/professor/login/start", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const user = findUserByEmail(email);

  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: "E-mail ou senha inválidos." });
  }

  if (getUserRole(user) !== "gestao") {
    return res.status(403).json({
      message: "Este login é exclusivo para professor/gestão.",
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ message: "E-mail ou senha inválidos." });
  }

  const result = await createVerification({
    email,
    purpose: "professor-login",
    userId: user.id,
  });

  req.session.pendingProfessorLogin = {
    email,
    userId: user.id,
  };

  return res.json({
    message: "Código de confirmação enviado para o e-mail do professor.",
    email,
    purpose: "professor-login",
    debugCode: result.debugCode,
    debugHint: result.debugHint,
  });
});

app.post("/api/professor/login/resend", async (req, res) => {
  const sessionData = req.session.pendingProfessorLogin;

  if (!sessionData?.email || !sessionData?.userId) {
    return res.status(400).json({
      message: "Inicie novamente o login do professor para receber um novo código.",
    });
  }

  const user = findUserById(sessionData.userId);

  if (!user || user.email !== sessionData.email || getUserRole(user) !== "gestao") {
    delete req.session.pendingProfessorLogin;
    return res.status(404).json({ message: "Professor não encontrado." });
  }

  const result = await createVerification({
    email: sessionData.email,
    purpose: "professor-login",
    userId: sessionData.userId,
  });

  return res.json({
    message: "Novo código enviado para o e-mail do professor.",
    email: sessionData.email,
    purpose: "professor-login",
    debugCode: result.debugCode,
    debugHint: result.debugHint,
  });
});

app.post("/api/auth/password/forgot/start", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const user = findUserByEmail(email);

  if (!email) {
    return res.status(400).json({ message: "Informe um e-mail válido." });
  }

  if (!user || !user.passwordHash) {
    return res.status(404).json({
      message: "Não encontramos uma conta com senha cadastrada para este e-mail.",
    });
  }

  const result = await createVerification({
    email,
    purpose: "reset-password",
    userId: user.id,
  });

  req.session.pendingPasswordReset = {
    email,
    userId: user.id,
    verified: false,
    token: "",
    expiresAt: "",
  };

  return res.json({
    message: "Código de recuperação enviado para o seu e-mail.",
    email,
    purpose: "reset-password",
    debugCode: result.debugCode,
    debugHint: result.debugHint,
  });
});

app.post("/api/auth/login/phone/start", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const user = findUserByEmail(email);

  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: "E-mail ou senha inválidos." });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ message: "E-mail ou senha inválidos." });
  }

  const result = await startSmsLogin(req, user);

  if (result.errorStatus) {
    return res.status(result.errorStatus).json({ message: result.errorMessage });
  }

  return res.json(result);
});

app.post("/api/auth/register/resend", async (req, res) => {
  const sessionData = req.session.pendingEmailRegister;

  if (!sessionData?.email || !sessionData?.passwordHash || !sessionData?.name) {
    return res.status(400).json({
      message: "Inicie novamente o cadastro para receber um novo código.",
    });
  }

  if (findUserByEmail(sessionData.email)) {
    delete req.session.pendingEmailRegister;
    return res.status(409).json({ message: "Este e-mail já está cadastrado." });
  }

  const result = await createVerification({
    email: sessionData.email,
    purpose: "register",
    name: sessionData.name,
    phoneNumber: sessionData.phoneNumber || "",
    passwordHash: sessionData.passwordHash,
  });

  return res.json({
    message: "Novo código de confirmação enviado para o seu e-mail.",
    email: sessionData.email,
    purpose: "register",
    debugCode: result.debugCode,
    debugHint: result.debugHint,
  });
});

app.post("/api/auth/login/resend", async (req, res) => {
  const sessionData = req.session.pendingEmailLogin;

  if (!sessionData?.email || !sessionData?.userId) {
    return res.status(400).json({
      message: "Inicie novamente o login para receber um novo código.",
    });
  }

  const user = findUserById(sessionData.userId);

  if (!user || user.email !== sessionData.email) {
    delete req.session.pendingEmailLogin;
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  const result = await createVerification({
    email: sessionData.email,
    purpose: "login",
    userId: sessionData.userId,
  });

  return res.json({
    message: "Novo código de confirmação enviado para o seu e-mail.",
    email: sessionData.email,
    purpose: "login",
    debugCode: result.debugCode,
    debugHint: result.debugHint,
  });
});

app.post("/api/auth/password/forgot/resend", async (req, res) => {
  const sessionData = req.session.pendingPasswordReset;

  if (!sessionData?.email || !sessionData?.userId) {
    return res.status(400).json({
      message: "Inicie novamente a recuperação de senha para receber um novo código.",
    });
  }

  const user = findUserById(sessionData.userId);

  if (!user || user.email !== sessionData.email || !user.passwordHash) {
    delete req.session.pendingPasswordReset;
    return res.status(404).json({
      message: "Não encontramos uma conta com senha cadastrada para este e-mail.",
    });
  }

  const result = await createVerification({
    email: sessionData.email,
    purpose: "reset-password",
    userId: sessionData.userId,
  });

  req.session.pendingPasswordReset = {
    ...sessionData,
    verified: false,
    token: "",
    expiresAt: "",
  };

  return res.json({
    message: "Novo código de recuperação enviado para o seu e-mail.",
    email: sessionData.email,
    purpose: "reset-password",
    debugCode: result.debugCode,
    debugHint: result.debugHint,
  });
});

app.post("/api/auth/register/phone/resend", async (req, res) => {
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  const sessionData = req.session.pendingPhoneRegister;

  if (!sessionData?.phoneNumber || sessionData.phoneNumber !== phoneNumber) {
    return res.status(400).json({
      message: "Inicie novamente o cadastro para receber um novo código.",
    });
  }

  if (!twilioConfigured) {
    return res.status(400).json({
      message:
        "Twilio Verify ainda não está configurado. Preencha as credenciais da Twilio no .env.",
    });
  }

  try {
    await runPythonTwilio(["start", sessionData.phoneNumber, sessionData.channel]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  return res.json({
    message: buildPhoneCodeMessage(sessionData.channel),
    phoneNumber: sessionData.phoneNumber,
    channel: sessionData.channel,
    purpose: "register-phone",
  });
});

app.post("/api/auth/login/phone/resend", async (req, res) => {
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  const sessionData = req.session.pendingPhoneLogin;

  if (!sessionData?.phoneNumber || sessionData.phoneNumber !== phoneNumber) {
    return res.status(400).json({
      message: "Inicie novamente o login para receber um novo código.",
    });
  }

  if (!twilioConfigured) {
    return res.status(400).json({
      message:
        "Twilio Verify ainda não está configurado. Preencha as credenciais da Twilio no .env.",
    });
  }

  try {
    await runPythonTwilio(["start", sessionData.phoneNumber, sessionData.channel]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  return res.json({
    message: buildPhoneCodeMessage(sessionData.channel),
    phoneNumber: sessionData.phoneNumber,
    channel: sessionData.channel,
    purpose: "login-phone",
  });
});

app.post("/api/auth/verify", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();
  const purpose = String(req.body?.purpose || "").trim();

  if (
    !email ||
    !code ||
    !["login", "register", "professor-login"].includes(purpose)
  ) {
    return res.status(400).json({ message: "Informe e-mail, código e operação." });
  }

  const verification = findVerification(email, purpose);

  if (!verification) {
    return res.status(404).json({
      message: "Código não encontrado ou expirado. Solicite um novo código.",
    });
  }

  if (verification.attempts >= 5) {
    deleteVerification(verification.id);
    return res.status(429).json({
      message: "Muitas tentativas inválidas. Solicite um novo código.",
    });
  }

  const validCode = await bcrypt.compare(code, verification.codeHash);

  if (!validCode) {
    verification.attempts += 1;
    updateVerification(verification);
    return res.status(401).json({ message: "Código de confirmação inválido." });
  }

  deleteVerification(verification.id);
  delete req.session.pendingEmailRegister;
  delete req.session.pendingEmailLogin;
  delete req.session.pendingProfessorLogin;

  let user = null;

  if (purpose === "register") {
    if (findUserByEmail(email)) {
      return res.status(409).json({ message: "Este e-mail já está cadastrado." });
    }

    user = createUser({
      id: crypto.randomUUID(),
      name: verification.name,
      email,
      phoneNumber: verification.phoneNumber || "",
      passwordHash: verification.passwordHash,
      providers: [],
      createdAt: new Date().toISOString(),
    });
  } else {
    user = findUserById(verification.userId);
  }

  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  if (purpose === "professor-login" && getUserRole(user) !== "gestao") {
    return res.status(403).json({
      message: "Este login é exclusivo para professor/gestão.",
    });
  }

  req.login(user, (error) => {
    if (error) {
      return res.status(500).json({ message: "Não foi possível iniciar a sessão." });
    }

    return res.json({
      message:
        purpose === "register"
          ? "Cadastro confirmado com sucesso."
          : purpose === "professor-login"
            ? "Login do professor confirmado com sucesso."
          : "Login confirmado com sucesso.",
      user: sanitizeUser(user),
    });
  });
});

app.post("/api/auth/password/forgot/verify", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();
  const sessionData = req.session.pendingPasswordReset;

  if (!sessionData || sessionData.email !== email) {
    return res.status(400).json({
      message: "Solicite um novo código antes de confirmar a recuperação.",
    });
  }

  const verification = findVerification(email, "reset-password");

  if (!verification || verification.userId !== sessionData.userId) {
    return res.status(404).json({
      message: "Código não encontrado ou expirado. Solicite um novo código.",
    });
  }

  if (verification.attempts >= 5) {
    deleteVerification(verification.id);
    return res.status(429).json({
      message: "Muitas tentativas inválidas. Solicite um novo código.",
    });
  }

  const validCode = await bcrypt.compare(code, verification.codeHash);

  if (!validCode) {
    verification.attempts += 1;
    updateVerification(verification);
    return res.status(401).json({ message: "Código de confirmação inválido." });
  }

  const user = findUserById(sessionData.userId);

  if (!user || user.email !== email) {
    delete req.session.pendingPasswordReset;
    return res.status(404).json({
      message: "Não encontramos uma conta válida para redefinir a senha.",
    });
  }

  deleteVerification(verification.id);

  const token = crypto.randomUUID();
  req.session.pendingPasswordReset = {
    ...sessionData,
    verified: true,
    token,
    expiresAt: new Date(Date.now() + otpExpiryMinutes * 60 * 1000).toISOString(),
  };

  return res.json({
    message: "Código confirmado. Agora defina a nova senha.",
    redirectTo: `/reset-password.html?token=${encodeURIComponent(token)}`,
  });
});

app.post("/api/auth/password/reset", async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const password = String(req.body?.password || "");
  const sessionData = req.session.pendingPasswordReset;

  if (!token || !sessionData?.verified || sessionData.token !== token) {
    return res.status(400).json({
      message: "Solicite uma nova recuperação de senha antes de continuar.",
    });
  }

  if (!sessionData.expiresAt || new Date(sessionData.expiresAt).getTime() <= Date.now()) {
    delete req.session.pendingPasswordReset;
    return res.status(400).json({
      message: "O link para redefinir a senha expirou. Solicite um novo código.",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "A nova senha precisa ter pelo menos 6 caracteres.",
    });
  }

  const user = findUserById(sessionData.userId);

  if (!user || user.email !== sessionData.email) {
    delete req.session.pendingPasswordReset;
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  updateUser(user);
  delete req.session.pendingPasswordReset;

  return res.json({ message: "Senha redefinida com sucesso. Faça login com a nova senha." });
});

app.post("/api/auth/phone/start", async (req, res) => {
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  const channel = String(req.body?.channel || "sms").trim().toLowerCase();
  const name = String(req.body?.name || "").trim();

  if (!twilioConfigured) {
    return res.status(400).json({
      message:
        "Twilio Verify ainda não está configurado. Preencha as credenciais da Twilio no .env.",
    });
  }

  if (!phoneNumber) {
    return res.status(400).json({ message: "Informe um número de telefone válido." });
  }

  if (!["sms", "whatsapp"].includes(channel)) {
    return res.status(400).json({ message: "Canal inválido para verificação." });
  }

  try {
    await runPythonTwilio(["start", phoneNumber, channel]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  req.session.phoneAuth = {
    phoneNumber,
    channel,
    name,
  };

  return res.json({
    message:
      channel === "whatsapp"
        ? "Código enviado por WhatsApp."
        : "Código enviado por SMS. Em dispositivos compatíveis, a Twilio pode elevar a entrega para RCS.",
    phoneNumber,
    purpose: "phone",
    channel,
  });
});

app.post("/api/auth/phone/verify", async (req, res) => {
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  const code = String(req.body?.code || "").trim();
  const sessionData = req.session.phoneAuth;

  if (!sessionData || sessionData.phoneNumber !== phoneNumber) {
    return res.status(400).json({
      message: "Solicite um novo código para este número antes de confirmar.",
    });
  }

  try {
    const result = await runPythonTwilio(["check", phoneNumber, code]);

    if (result.status !== "approved") {
      return res.status(401).json({ message: "Código de confirmação inválido." });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  let user = findUserByPhone(phoneNumber);

  if (!user) {
    user = createUser({
      id: crypto.randomUUID(),
      name: sessionData.name || "Usuário por telefone",
      email: "",
      phoneNumber,
      passwordHash: null,
      providers: [],
      createdAt: new Date().toISOString(),
    });
  } else if (!user.phoneNumber) {
    user.phoneNumber = phoneNumber;
    user = updateUser(user);
  }

  delete req.session.phoneAuth;

  req.login(user, (error) => {
    if (error) {
      return res.status(500).json({ message: "Não foi possível iniciar a sessão." });
    }

    return res.json({
      message: "Telefone confirmado com sucesso.",
      user: sanitizeUser(user),
    });
  });
});

app.post("/api/auth/register/phone/verify", async (req, res) => {
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  const code = String(req.body?.code || "").trim();
  const sessionData = req.session.pendingPhoneRegister;

  if (!sessionData || sessionData.phoneNumber !== phoneNumber) {
    return res.status(400).json({
      message: "Solicite um novo código para este cadastro antes de confirmar.",
    });
  }

  try {
    const result = await runPythonTwilio(["check", phoneNumber, code]);

    if (result.status !== "approved") {
      return res.status(401).json({ message: "Código de confirmação inválido." });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  if (findUserByEmail(sessionData.email)) {
    return res.status(409).json({ message: "Este e-mail já está cadastrado." });
  }

  const user = createUser({
    id: crypto.randomUUID(),
    name: sessionData.name,
    email: sessionData.email,
    phoneNumber: sessionData.phoneNumber,
    passwordHash: sessionData.passwordHash,
    providers: [],
    createdAt: new Date().toISOString(),
  });

  delete req.session.pendingPhoneRegister;

  req.login(user, (error) => {
    if (error) {
      return res.status(500).json({ message: "Não foi possível iniciar a sessão." });
    }

    return res.json({
      message: "Cadastro confirmado com sucesso.",
      user: sanitizeUser(user),
    });
  });
});

app.post("/api/auth/login/phone/verify", async (req, res) => {
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  const code = String(req.body?.code || "").trim();
  const sessionData = req.session.pendingPhoneLogin;

  if (!sessionData || sessionData.phoneNumber !== phoneNumber) {
    return res.status(400).json({
      message: "Solicite um novo código para este login antes de confirmar.",
    });
  }

  try {
    const result = await runPythonTwilio(["check", phoneNumber, code]);

    if (result.status !== "approved") {
      return res.status(401).json({ message: "Código de confirmação inválido." });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  const user = findUserById(sessionData.userId);

  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado." });
  }

  if (sessionData.requireRole && getUserRole(user) !== sessionData.requireRole) {
    delete req.session.pendingPhoneLogin;
    return res.status(403).json({
      message: "Este acesso é exclusivo para professor/gestão.",
    });
  }

  delete req.session.pendingPhoneLogin;

  req.login(user, (error) => {
    if (error) {
      return res.status(500).json({ message: "Não foi possível iniciar a sessão." });
    }

    return res.json({
      message: "Login confirmado com sucesso.",
      user: sanitizeUser(user),
    });
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.logout((error) => {
    if (error) {
      return res.status(500).json({ message: "Não foi possível encerrar a sessão." });
    }

    req.session.destroy(() => {
      res.json({ message: "Sessão encerrada." });
    });
  });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user: sanitizeUser(req.user),
  });
});

app.get("/pos-login", requireAuth, (req, res) => {
  if (getUserRole(req.user) === "gestao") {
    return res.redirect("/gestao/");
  }

  if (shouldSkipPayment(req.user)) {
    return res.redirect("/aluno/");
  }

  return res.redirect("/pagamento");
});

app.get("/api/aluno/status", requirePaidAccess, async (req, res) => {
  try {
    const billing = await getStudentBillingStatus(req.user);
    return res.json({
      message: "Acesso liberado.",
      user: sanitizeUser(req.user),
      billing,
    });
  } catch (error) {
    return res.status(500).json({ message: "Não foi possível carregar o status do aluno." });
  }
});

app.get("/uploads/profiles/:fileName", requirePaidAccess, sendProfileFile);

app.post(
  "/api/aluno/profile",
  requirePaidAccess,
  profileUpload.single("avatar"),
  async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const phoneNumber = normalizePhone(req.body?.phoneNumber);
    const password = String(req.body?.password || "");
    const passwordConfirm = String(req.body?.passwordConfirm || "");

    if (!name || !email) {
      return res.status(400).json({ message: "Informe nome e e-mail válidos." });
    }

    if ((password || passwordConfirm) && password !== passwordConfirm) {
      return res.status(400).json({ message: "A confirmação da nova senha não confere." });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ message: "A nova senha precisa ter pelo menos 6 caracteres." });
    }

    const emailOwner = findUserByEmail(email);
    if (emailOwner && emailOwner.id !== req.user.id) {
      return res.status(409).json({ message: "Este e-mail já está em uso." });
    }

    const phoneOwner = phoneNumber ? findUserByPhone(phoneNumber) : null;
    if (phoneOwner && phoneOwner.id !== req.user.id) {
      return res.status(409).json({ message: "Este telefone já está em uso." });
    }

    const updatedUser = {
      ...req.user,
      name,
      email,
      phoneNumber,
    };

    if (password) {
      updatedUser.passwordHash = await bcrypt.hash(password, 10);
    }

    if (req.file) {
      updatedUser.avatarPath = req.file.path;
      updatedUser.avatarUrl = `/uploads/profiles/${req.file.filename}`;
    }

    let savedUser = null;

    try {
      savedUser = updateUser(updatedUser);
    } catch (error) {
      return res.status(400).json({
        message: "Não foi possível atualizar o perfil. Verifique os dados informados.",
      });
    }

    return req.login(savedUser, (error) => {
      if (error) {
        return res.status(500).json({ message: "Perfil atualizado, mas não foi possível renovar a sessão." });
      }

      return res.json({
        message: "Perfil atualizado com sucesso.",
        user: sanitizeUser(savedUser),
      });
    });
  }
);

app.get("/api/aluno/materials", requirePaidAccess, async (req, res) => {
  try {
    const subjects = listUserSubjects(req.user.id);
    if (!subjects.length && getUserRole(req.user) !== "gestao") {
      return res.json({ subjects, materials: [] });
    }

    const subjectKeys = subjects.map(normalizeSubjectName);
    const allMaterials = await runMaterialsDb("list-materials", {
      type: req.query.type || "",
      userId: req.user.id,
    });
    const materials = allMaterials.filter((material) => {
      return (
        (!material.target_user_id || material.target_user_id === req.user.id) &&
        subjectKeys.includes(normalizeSubjectName(material.subject))
      );
    });

    return res.json({ subjects, materials });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/aluno/announcements", requirePaidAccess, async (req, res) => {
  try {
    const subjects = listUserSubjects(req.user.id);
    const subjectKeys = subjects.map(normalizeSubjectName);
    const allAnnouncements = await runLearningDb("list-announcements", { userId: req.user.id });
    const announcements = allAnnouncements.filter((announcement) => {
      const targetAllowed = !announcement.target_user_id || announcement.target_user_id === req.user.id;
      const subjectAllowed = !announcement.subject || subjectKeys.includes(normalizeSubjectName(announcement.subject));
      return targetAllowed && subjectAllowed;
    });
    return res.json({ announcements });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/aluno/announcements/:id/media", requirePaidAccess, async (req, res) => {
  try {
    const announcement = await runLearningDb("get-announcement", { id: req.params.id });

    if (!canAccessAnnouncement(req.user, announcement)) {
      return res.status(403).json({
        message: "Este comunicado não está liberado para as suas matérias.",
      });
    }

    return sendAnnouncementMediaFile(req, res, announcement);
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

app.get("/api/aluno/events", requirePaidAccess, async (req, res) => {
  try {
    const events = await runLearningDb("list-events", { userId: req.user.id });
    return res.json({ events });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/aluno/events", requirePaidAccess, async (req, res) => {
  try {
    const event = await runLearningDb("create-event", {
      userId: req.user.id,
      title: req.body?.title,
      subject: req.body?.subject || "",
      startsAt: req.body?.startsAt,
      notes: req.body?.notes || "",
    });

    return res.status(201).json({
      message: "Aula adicionada ao calendário.",
      event,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.delete("/api/aluno/events/:id", requirePaidAccess, async (req, res) => {
  try {
    const event = await runLearningDb("delete-event", {
      id: req.params.id,
      userId: req.user.id,
    });
    return res.json({ message: "Evento apagado.", event });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.get("/api/aluno/grades", requirePaidAccess, async (req, res) => {
  try {
    const grades = await runLearningDb("list-grades", { userId: req.user.id });
    return res.json({ grades });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/aluno/dashboard", requirePaidAccess, async (req, res) => {
  try {
    const billing = await getStudentBillingStatus(req.user);
    const subjects = listUserSubjects(req.user.id);
    const subjectKeys = subjects.map(normalizeSubjectName);
    const allMaterials = await runMaterialsDb("list-materials", {});
    const materials = allMaterials.filter((material) => {
      return subjectKeys.includes(normalizeSubjectName(material.subject));
    });
    const allAnnouncements = await runLearningDb("list-announcements", {});
    const announcements = allAnnouncements.filter((announcement) => {
      return (
        !announcement.subject ||
        subjectKeys.includes(normalizeSubjectName(announcement.subject))
      );
    });
    const events = await runLearningDb("list-events", { userId: req.user.id });
    const grades = await runLearningDb("list-grades", { userId: req.user.id });
    const now = Date.now();
    const upcomingEvents = events.filter((event) => {
      return new Date(event.starts_at).getTime() >= now;
    });

    return res.json({
      billing,
      subjects,
      stats: {
        subjects: subjects.length,
        materials: materials.length,
        pdfs: materials.filter((material) => material.type === "pdf").length,
        videos: materials.filter((material) => material.type === "video").length,
        announcements: announcements.length,
        upcomingEvents: upcomingEvents.length,
        grades: grades.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/aluno/materials/:id/file", requirePaidAccess, async (req, res) => {
  try {
    const material = await runMaterialsDb("get-material", { id: req.params.id });

    if (!canAccessMaterial(req.user, material)) {
      return res.status(403).json({
        message: "Este conteúdo não está liberado para as suas matérias.",
      });
    }

    return sendMaterialFile(res, material);
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

app.post("/api/payments", requireAuth, async (req, res) => {
  const materia = String(req.body?.materia || "").trim();
  const plano = String(req.body?.plano || "").trim();

  if (!materia || !plano) {
    return res.status(400).json({ message: "Informe a matéria e o plano." });
  }

  try {
    const payment = await runPaymentDb("create-payment", {
      userId: req.user.id,
      userName: req.user.name || "Aluno(a)",
      userEmail: req.user.email || "",
      userPhone: req.user.phoneNumber || "",
      materia,
      plano,
    });

    return res.status(201).json({
      message: "Pedido registrado com segurança.",
      payment,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/payment-catalog", requireAuth, async (req, res) => {
  try {
    const courses = await runPaymentDb("list-catalog", {
      includeInactive: false,
    });
    return res.json({ courses });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/gestao/payments", requireGestao, async (req, res) => {
  try {
    const users = listUsers("").map(sanitizeUser);
    const payments = await runPaymentDb("list-payments", {
      status: req.query.status || "",
    });

    return res.json({ users, payments });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/gestao/payments", requireGestao, async (req, res) => {
  try {
    const userId = String(req.body?.userId || "").trim();
    const user = userId ? findUserById(userId) : null;
    const payment = await runPaymentDb("create-payment", {
      userId: user?.id || `manual-${crypto.randomUUID()}`,
      userName: user?.name || req.body?.userName,
      userEmail: user?.email || "",
      userPhone: user?.phoneNumber || "",
      materia: req.body?.materia,
      plano: req.body?.plano,
      status: req.body?.status || "pendente",
      lessonDate: req.body?.lessonDate || "",
      duration: req.body?.duration || "",
      classValue: req.body?.classValue || 0,
    });

    return res.status(201).json({ message: "Linha de pagamento adicionada.", payment });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.get("/api/gestao/payment-catalog", requireGestao, async (req, res) => {
  try {
    const courses = await runPaymentDb("list-catalog", {
      includeInactive: true,
    });
    return res.json({ courses });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/gestao/payment-courses", requireGestao, async (req, res) => {
  try {
    const course = await runPaymentDb("create-course", {
      name: req.body?.name,
      icon: req.body?.icon || "",
      description: req.body?.description || "",
      sortOrder: req.body?.sortOrder || 0,
      isActive: req.body?.isActive !== false,
    });
    return res.status(201).json({ message: "Curso salvo.", course });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.patch("/api/gestao/payment-courses/:id", requireGestao, async (req, res) => {
  try {
    const course = await runPaymentDb("update-course", {
      id: req.params.id,
      name: req.body?.name,
      icon: req.body?.icon || "",
      description: req.body?.description || "",
      sortOrder: req.body?.sortOrder || 0,
      isActive: req.body?.isActive !== false,
    });
    return res.json({ message: "Curso atualizado.", course });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.delete("/api/gestao/payment-courses/:id", requireGestao, async (req, res) => {
  try {
    const course = await runPaymentDb("delete-course", { id: req.params.id });
    return res.json({ message: "Curso apagado.", course });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

app.post("/api/gestao/payment-plans", requireGestao, async (req, res) => {
  try {
    const plan = await runPaymentDb("create-plan", {
      courseId: req.body?.courseId,
      title: req.body?.title,
      subtitle: req.body?.subtitle || "",
      priceText: req.body?.priceText,
      secondaryPriceText: req.body?.secondaryPriceText || "",
      features: req.body?.features || [],
      badge: req.body?.badge || "",
      isHighlighted: req.body?.isHighlighted === true,
      isActive: req.body?.isActive !== false,
      sortOrder: req.body?.sortOrder || 0,
    });
    return res.status(201).json({ message: "Plano salvo.", plan });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.patch("/api/gestao/payment-plans/:id", requireGestao, async (req, res) => {
  try {
    const plan = await runPaymentDb("update-plan", {
      id: req.params.id,
      courseId: req.body?.courseId,
      title: req.body?.title,
      subtitle: req.body?.subtitle || "",
      priceText: req.body?.priceText,
      secondaryPriceText: req.body?.secondaryPriceText || "",
      features: req.body?.features || [],
      badge: req.body?.badge || "",
      isHighlighted: req.body?.isHighlighted === true,
      isActive: req.body?.isActive !== false,
      sortOrder: req.body?.sortOrder || 0,
    });
    return res.json({ message: "Plano atualizado.", plan });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.delete("/api/gestao/payment-plans/:id", requireGestao, async (req, res) => {
  try {
    const plan = await runPaymentDb("delete-plan", { id: req.params.id });
    return res.json({ message: "Plano apagado.", plan });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

app.patch("/api/gestao/payments/:id/status", requireGestao, async (req, res) => {
  try {
    const payment = await runPaymentDb("update-payment-status", {
      id: req.params.id,
      status: req.body?.status,
      note: req.body?.note || "",
      managerId: req.user.id,
    });

    if (payment.status === "pago" && !String(payment.user_id || "").startsWith("manual-")) {
      updateUserAccess(
        payment.user_id,
        "ativo",
        `Acesso liberado pelo pagamento #${payment.id}.`
      );
    }

    if (payment.status === "cancelado" && !String(payment.user_id || "").startsWith("manual-")) {
      updateUserAccess(
        payment.user_id,
        "pausado",
        `Acesso pausado pelo cancelamento do pagamento #${payment.id}.`
      );
    }

    return res.json({
      message: "Status atualizado.",
      payment,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.patch("/api/gestao/payments/:id", requireGestao, async (req, res) => {
  try {
    const payment = await runPaymentDb("update-payment", {
      id: req.params.id,
      userName: req.body?.userName,
      userEmail: req.body?.userEmail || "",
      userPhone: req.body?.userPhone || "",
      materia: req.body?.materia,
      plano: req.body?.plano,
      status: req.body?.status,
      lessonDate: req.body?.lessonDate || "",
      duration: req.body?.duration || "",
      classValue: req.body?.classValue || 0,
      managerId: req.user.id,
    });

    if (payment.status === "pago" && !String(payment.user_id || "").startsWith("manual-")) {
      updateUserAccess(
        payment.user_id,
        "ativo",
        `Acesso liberado pelo pagamento #${payment.id}.`
      );
    }

    if (payment.status === "cancelado" && !String(payment.user_id || "").startsWith("manual-")) {
      updateUserAccess(
        payment.user_id,
        "pausado",
        `Acesso pausado pelo cancelamento do pagamento #${payment.id}.`
      );
    }

    return res.json({ message: "Linha de pagamento atualizada.", payment });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.get("/api/gestao/users", requireGestao, (req, res) => {
  try {
    const users = listUsers(req.query.accessStatus || "").map(sanitizeUser);
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/gestao/events", requireGestao, async (req, res) => {
  try {
    const users = listUsers("").map(sanitizeUser);
    const events = await runLearningDb("list-events", {
      userId: req.query.userId || "",
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const enrichedEvents = events.map((event) => ({
      ...event,
      user: usersById.get(event.user_id) || null,
    }));

    return res.json({ users, events: enrichedEvents });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/gestao/events", requireGestao, async (req, res) => {
  try {
    const target = String(req.body?.target || "").trim();
    const title = String(req.body?.title || "").trim();
    const startsAt = String(req.body?.startsAt || "").trim();
    const professorId = String(req.user?.id || "").trim();

    if (!target) {
      return res.status(400).json({ message: "Selecione um login ou escolha todos os alunos." });
    }

    if (!title || !startsAt) {
      return res.status(400).json({ message: "Preencha o título, a data e a hora do evento." });
    }

    if (!professorId) {
      return res.status(400).json({ message: "Sessão da professora não foi identificada. Faça login novamente." });
    }

    const users = listUsers("").map(sanitizeUser);
    const studentUsers = users.filter((user) => user.id !== professorId && user.role !== "gestao");
    let targetUsers = [];

    if (target === "all") {
      targetUsers = studentUsers;
    } else if (target === "professor") {
      targetUsers = [sanitizeUser(req.user)];
    } else {
      const normalizedTargetEmail = normalizeEmail(target);
      const normalizedTargetPhone = normalizePhone(target);
      const user = users.find((item) => {
        return (
          item.id === target ||
          normalizeEmail(item.email) === normalizedTargetEmail ||
          normalizePhone(item.phoneNumber) === normalizedTargetPhone
        );
      });
      if (!user) {
        return res.status(400).json({ message: "Login selecionado não encontrado. Atualize a lista e tente novamente." });
      }
      targetUsers = [user];
    }

    if (!targetUsers.length) {
      return res.status(400).json({ message: "Nenhum login disponível para receber o evento." });
    }

    const events = [];
    for (const user of targetUsers) {
      events.push(
        await runLearningDb("create-event", {
          userId: user.id,
          title,
          subject: req.body?.subject || "",
          startsAt,
          notes: req.body?.notes || "",
          createdBy: professorId,
          createdByRole: "professor",
        })
      );
    }

    return res.status(201).json({
      message: target === "all" ? "Evento enviado para todos os alunos." : "Evento criado.",
      events,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.delete("/api/gestao/events/:id", requireGestao, async (req, res) => {
  try {
    const event = await runLearningDb("delete-event", {
      id: req.params.id,
      managerId: req.user?.id || "gestao",
    });
    return res.json({ message: "Evento apagado.", event });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

app.patch("/api/gestao/users/:id/access", requireGestao, (req, res) => {
  try {
    const accessStatus = String(req.body?.accessStatus || "").trim();
    const accessNotes = String(req.body?.accessNotes || "").trim();
    const user = updateUserAccess(req.params.id, accessStatus, accessNotes);

    return res.json({
      message: "Acesso do aluno atualizado.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.get("/api/gestao/users/:id/subjects", requireGestao, (req, res) => {
  try {
    const subjects = listUserSubjects(req.params.id);
    return res.json({ subjects });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.patch("/api/gestao/users/:id/subjects", requireGestao, (req, res) => {
  try {
    const subjects = Array.isArray(req.body?.subjects) ? req.body.subjects : [];
    const updatedSubjects = updateUserSubjects(req.params.id, subjects);
    return res.json({
      message: "Matérias do aluno atualizadas.",
      subjects: updatedSubjects,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.get("/api/gestao/grades", requireGestao, async (req, res) => {
  try {
    const users = listUsers("").map(sanitizeUser);
    const grades = await runLearningDb("list-grades", {
      userId: req.query.userId || "",
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const enrichedGrades = grades.map((grade) => ({
      ...grade,
      user: usersById.get(grade.user_id) || null,
    }));

    return res.json({ users, grades: enrichedGrades });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post("/api/gestao/grades", requireGestao, async (req, res) => {
  try {
    const user = findUserById(req.body?.userId);

    if (!user) {
      return res.status(404).json({ message: "Aluno não encontrado." });
    }

    const grade = await runLearningDb("create-grade", {
      userId: user.id,
      subject: req.body?.subject,
      title: req.body?.title,
      score: req.body?.score,
      maxScore: req.body?.maxScore || 10,
      notes: req.body?.notes || "",
      createdBy: req.user.id,
    });

    return res.status(201).json({
      message: "Nota registrada.",
      grade: {
        ...grade,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.delete("/api/gestao/grades/:id", requireGestao, async (req, res) => {
  try {
    const grade = await runLearningDb("delete-grade", { id: req.params.id });
    return res.json({ message: "Nota apagada.", grade });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

function setMaterialType(type) {
  return (req, res, next) => {
    req.materialType = type;
    next();
  };
}

function handleMaterialUploadError(error, req, res, next) {
  if (error) {
    return res.status(400).json({ message: error.message });
  }

  return next();
}

app.get("/api/gestao/materials", requireGestao, async (req, res) => {
  try {
    const users = listUsers("").map(sanitizeUser);
    const materials = await runMaterialsDb("list-materials", {
      type: req.query.type || "",
    });

    return res.json({ users, materials: enrichTargetUsers(materials, users) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/gestao/materials/:id/file", requireGestao, async (req, res) => {
  try {
    const material = await runMaterialsDb("get-material", { id: req.params.id });
    return sendMaterialFile(res, material);
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

app.get("/api/gestao/announcements", requireGestao, async (req, res) => {
  try {
    const users = listUsers("").map(sanitizeUser);
    const announcements = await runLearningDb("list-announcements", {});
    return res.json({ users, announcements: enrichTargetUsers(announcements, users) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get("/api/gestao/announcements/:id/media", requireGestao, async (req, res) => {
  try {
    const announcement = await runLearningDb("get-announcement", { id: req.params.id });
    return sendAnnouncementMediaFile(req, res, announcement);
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

app.post("/api/gestao/announcements", requireGestao, announcementUpload.single("media"), async (req, res) => {
  try {
    const mediaType = req.file?.mimetype.startsWith("video/") ? "video" : req.file?.mimetype.startsWith("audio/") ? "audio" : "";
    const announcement = await runLearningDb("create-announcement", {
      title: req.body?.title,
      body: req.body?.body,
      subject: req.body?.subject || "",
      module: req.body?.module || "",
      mediaType,
      mediaPath: req.file?.path || "",
      mediaUrl: "",
      mediaMimeType: req.file?.mimetype || "",
      mediaOriginalName: req.file?.originalname || "",
      targetUserId: req.body?.targetUserId || "",
      createdBy: req.user.id,
    });

    return res.status(201).json({
      message: "Comunicado publicado.",
      announcement,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.delete("/api/gestao/announcements/:id", requireGestao, async (req, res) => {
  try {
    const announcement = await runLearningDb("delete-announcement", {
      id: req.params.id,
    });
    if (announcement.media_path) {
      fs.unlink(announcement.media_path, () => {});
    }
    return res.json({ message: "Comunicado apagado.", announcement });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

app.patch("/api/gestao/materials/:id", requireGestao, async (req, res) => {
  try {
    const material = await runMaterialsDb("update-material", {
      id: req.params.id,
      title: req.body?.title,
      description: req.body?.description || "",
      subject: req.body?.subject,
      module: req.body?.module || "",
      targetUserId: req.body?.targetUserId || "",
    });

    return res.json({
      message: "Material atualizado com sucesso.",
      material,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.delete("/api/gestao/materials/:id", requireGestao, async (req, res) => {
  try {
    const material = await runMaterialsDb("delete-material", { id: req.params.id });
    const resolvedUploads = path.resolve(uploadsDir);
    const resolvedFile = path.resolve(material.file_path);
    const relativePath = path.relative(resolvedUploads, resolvedFile);

    if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
      fs.rm(resolvedFile, { force: true }, (error) => {
        if (error) {
          console.error("Falha ao apagar arquivo de material:", error.message);
        }
      });
    }

    return res.json({
      message: "Material apagado com sucesso.",
      material,
    });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
});

app.post(
  "/api/gestao/materials/pdf",
  requireGestao,
  setMaterialType("pdf"),
  materialUpload.single("material"),
  handleMaterialUploadError,
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Envie um arquivo PDF." });
    }

    try {
      const material = await runMaterialsDb("create-material", {
        type: "pdf",
        title: req.body?.title || req.file.originalname,
        description: req.body?.description || "",
        subject: req.body?.subject || "",
        module: req.body?.module || "",
        targetUserId: req.body?.targetUserId || "",
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        fileUrl: `/uploads/pdfs/${req.file.filename}`,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        createdBy: req.user.id,
      });

      return res.status(201).json({
        message: "PDF publicado com sucesso.",
        material,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

app.post(
  "/api/gestao/materials/video",
  requireGestao,
  setMaterialType("video"),
  materialUpload.single("material"),
  handleMaterialUploadError,
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Envie um arquivo de vídeo." });
    }

    try {
      const material = await runMaterialsDb("create-material", {
        type: "video",
        title: req.body?.title || req.file.originalname,
        description: req.body?.description || "",
        subject: req.body?.subject || "",
        module: req.body?.module || "",
        targetUserId: req.body?.targetUserId || "",
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        fileUrl: `/uploads/videos/${req.file.filename}`,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        createdBy: req.user.id,
      });

      return res.status(201).json({
        message: "Vídeo aula publicada com sucesso.",
        material,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }
);

app.get("/voltar-login", (req, res) => {
  req.logout((error) => {
    if (error) {
      return res.redirect("/login.html?erro=logout");
    }

    req.session.destroy(() => {
      res.redirect("/login.html?logout=1");
    });
  });
});

app.get("/pagamento", requireAuth, (req, res) => {
  if (shouldSkipPayment(req.user)) {
    return res.redirect("/aluno/");
  }

  res.sendFile(path.join(paymentDir, "planos.html"));
});

app.get("/auth/google", (req, res, next) => {
  if (!googleConfigured) {
    return res.redirect("/login.html?erro=google");
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })(req, res, next);
});

app.get("/auth/google/callback", (req, res, next) => {
  if (!googleConfigured) {
    return res.redirect("/login.html?erro=google");
  }

  return passport.authenticate("google", (error, user) => {
    if (error || !user) {
      console.error("Falha no login com Google:", error?.message || "Usuário ausente.");
      return res.redirect("/login.html?erro=social");
    }

    return req.login(user, (loginError) => {
      if (loginError) {
        console.error("Falha ao iniciar sessão Google:", loginError.message);
        return res.redirect("/login.html?erro=social");
      }

      return res.redirect("/pos-login");
    });
  })(req, res, next);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor em http://localhost:${PORT}`);
});
