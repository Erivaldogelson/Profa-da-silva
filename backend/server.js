const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
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
  normalizeEmail,
  normalizePhone,
  saveVerification,
  updateUser,
  updateVerification,
} = require("./auth-store");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");
const paymentDir = path.join(__dirname, "..", "Pro-fa Pagamento");
const sessionSecret = process.env.SESSION_SECRET || "troque-esta-chave";
const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const emailFrom =
  process.env.EMAIL_FROM ||
  process.env.EMAIL_USER ||
  "nao-responda@profa.local";
const pythonScript = path.join(__dirname, "python", "twilio_verify.py");
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

function hasRealEnvValue(value, placeholderSnippets = []) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return false;
  }

  const lowerValue = normalized.toLowerCase();
  return !placeholderSnippets.some((snippet) => lowerValue.includes(snippet));
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email || "",
    phoneNumber: user.phoneNumber || "",
    createdAt: user.createdAt,
    providers: (user.providers || []).map((provider) => provider.provider),
  };
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildPhoneCodeMessage(channel) {
  return channel === "whatsapp"
    ? "Código enviado por WhatsApp."
    : "Código enviado por SMS. Em dispositivos compatíveis, a Twilio pode elevar a entrega para RCS.";
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
    execFile("python", [pythonScript, ...args], (error, stdout, stderr) => {
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

app.use(express.json());
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(publicDir));
app.use("/pagamento", express.static(paymentDir));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/providers", (req, res) => {
  res.json({
    google: googleConfigured,
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

app.post("/api/auth/password/forgot/start", async (req, res) => {
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  const channel = String(req.body?.channel || "sms").trim().toLowerCase();
  const user = findUserByPhone(phoneNumber);

  if (!phoneNumber) {
    return res.status(400).json({ message: "Informe um número de telefone válido." });
  }

  if (!["sms", "whatsapp"].includes(channel)) {
    return res.status(400).json({ message: "Canal inválido para recuperação de senha." });
  }

  if (!user || !user.passwordHash) {
    return res.status(404).json({
      message: "Não encontramos uma conta com senha cadastrada para este número.",
    });
  }

  if (!twilioConfigured) {
    return res.status(400).json({
      message:
        "Twilio Verify ainda não está configurado. Preencha as credenciais da Twilio no .env.",
    });
  }

  try {
    await runPythonTwilio(["start", phoneNumber, channel]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  req.session.pendingPasswordReset = {
    email: user.email || "",
    userId: user.id,
    phoneNumber,
    channel,
    verified: false,
    token: "",
    expiresAt: "",
  };

  return res.json({
    message: buildPhoneCodeMessage(channel),
    phoneNumber,
    channel,
    purpose: "reset-password-phone",
  });
});

app.post("/api/auth/login/phone/start", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const channel = String(req.body?.channel || "").trim().toLowerCase();
  const user = findUserByEmail(email);

  if (!user || !user.passwordHash) {
    return res.status(401).json({ message: "E-mail ou senha inválidos." });
  }

  if (!user.phoneNumber) {
    return res.status(400).json({
      message: "Esta conta ainda não possui telefone cadastrado para confirmação.",
    });
  }

  if (!twilioConfigured) {
    return res.status(400).json({
      message:
        "Twilio Verify ainda não está configurado. Preencha as credenciais da Twilio no .env.",
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ message: "E-mail ou senha inválidos." });
  }

  try {
    await runPythonTwilio(["start", user.phoneNumber, channel]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  req.session.pendingPhoneLogin = {
    userId: user.id,
    phoneNumber: user.phoneNumber,
    channel,
  };

  return res.json({
    message: buildPhoneCodeMessage(channel),
    phoneNumber: user.phoneNumber,
    channel,
    purpose: "login-phone",
  });
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

  if (!sessionData?.phoneNumber || !sessionData?.userId) {
    return res.status(400).json({
      message: "Inicie novamente a recuperação de senha para receber um novo código.",
    });
  }

  const user = findUserById(sessionData.userId);

  if (!user || user.phoneNumber !== sessionData.phoneNumber || !user.passwordHash) {
    delete req.session.pendingPasswordReset;
    return res.status(404).json({
      message: "Não encontramos uma conta com senha cadastrada para este número.",
    });
  }

  if (!twilioConfigured) {
    return res.status(400).json({
      message:
        "Twilio Verify ainda não está configurado. Preencha as credenciais da Twilio no .env.",
    });
  }

  if (!sessionData.phoneNumber) {
    return res.status(400).json({
      message: "Esta conta ainda não possui telefone cadastrado para recuperação por celular.",
    });
  }

  try {
    await runPythonTwilio(["start", sessionData.phoneNumber, sessionData.channel]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }

  req.session.pendingPasswordReset = {
    ...sessionData,
    verified: false,
    token: "",
    expiresAt: "",
  };

  return res.json({
    message: buildPhoneCodeMessage(sessionData.channel),
    phoneNumber: sessionData.phoneNumber,
    channel: sessionData.channel,
    purpose: "reset-password-phone",
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

  if (!email || !code || !["login", "register"].includes(purpose)) {
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

  req.login(user, (error) => {
    if (error) {
      return res.status(500).json({ message: "Não foi possível iniciar a sessão." });
    }

    return res.json({
      message:
        purpose === "register"
          ? "Cadastro confirmado com sucesso."
          : "Login confirmado com sucesso.",
      user: sanitizeUser(user),
    });
  });
});

app.post("/api/auth/password/forgot/phone/verify", async (req, res) => {
  const phoneNumber = normalizePhone(req.body?.phoneNumber);
  const code = String(req.body?.code || "").trim();
  const sessionData = req.session.pendingPasswordReset;

  if (!sessionData || sessionData.phoneNumber !== phoneNumber) {
    return res.status(400).json({
      message: "Solicite um novo código antes de confirmar a recuperação.",
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

  if (!user || user.phoneNumber !== phoneNumber) {
    delete req.session.pendingPasswordReset;
    return res.status(404).json({
      message: "Não encontramos uma conta válida para redefinir a senha.",
    });
  }

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

app.get("/pagamento", (req, res) => {
  res.sendFile(path.join(paymentDir, "planos.html"));
});

app.get("/auth/google", (req, res, next) => {
  if (!googleConfigured) {
    return res.redirect("/login.html?erro=google");
  }

  return passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next
  );
});

app.get("/auth/google/callback", (req, res, next) => {
  if (!googleConfigured) {
    return res.redirect("/login.html?erro=google");
  }

  return passport.authenticate("google", {
    failureRedirect: "/login.html?erro=social",
    successRedirect: "/pagamento",
  })(req, res, next);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor em http://localhost:${PORT}`);
});
