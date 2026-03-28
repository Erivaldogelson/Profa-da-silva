const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const AppleStrategy = require("passport-apple");
const {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByProvider,
  normalizeEmail,
  updateUser,
} = require("./auth-store");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");
const paymentDir = path.join(__dirname, "..", "Pro-fa Pagamento");
const sessionSecret = process.env.SESSION_SECRET || "troque-esta-chave";

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    providers: (user.providers || []).map((provider) => provider.provider),
  };
}

function buildOAuthUser(profile, provider, emailFallback = "") {
  const email =
    normalizeEmail(profile?.emails?.[0]?.value) || normalizeEmail(emailFallback);
  const displayName =
    profile?.displayName ||
    [profile?.name?.givenName, profile?.name?.familyName].filter(Boolean).join(" ") ||
    "Aluno(a)";
  const providerId = String(profile.id);

  let user = findUserByProvider(provider, providerId);

  if (!user && email) {
    user = findUserByEmail(email);
  }

  if (user) {
    const providers = Array.isArray(user.providers) ? user.providers : [];
    const alreadyLinked = providers.some(
      (item) => item.provider === provider && item.providerId === providerId
    );

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
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
  Boolean(process.env.GOOGLE_CALLBACK_URL);

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

const appleKeyPath = process.env.APPLE_PRIVATE_KEY_PATH
  ? path.resolve(process.cwd(), process.env.APPLE_PRIVATE_KEY_PATH)
  : "";
const appleConfigured =
  Boolean(process.env.APPLE_CLIENT_ID) &&
  Boolean(process.env.APPLE_TEAM_ID) &&
  Boolean(process.env.APPLE_KEY_ID) &&
  Boolean(process.env.APPLE_CALLBACK_URL) &&
  Boolean(appleKeyPath) &&
  fs.existsSync(appleKeyPath);

if (appleConfigured) {
  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        callbackURL: process.env.APPLE_CALLBACK_URL,
        privateKeyLocation: appleKeyPath,
        passReqToCallback: false,
      },
      (accessToken, refreshToken, idToken, profile, done) => {
        try {
          const email = profile?.email || "";
          const user = buildOAuthUser(profile, "apple", email);
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
    apple: appleConfigured,
  });
});

app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
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
  const user = createUser({
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    providers: [],
    createdAt: new Date().toISOString(),
  });

  req.login(user, (error) => {
    if (error) {
      return res.status(500).json({ message: "Não foi possível iniciar a sessão." });
    }

    return res.status(201).json({
      message: "Cadastro realizado com sucesso.",
      user: sanitizeUser(user),
    });
  });
});

app.post("/api/auth/login", async (req, res) => {
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

  req.login(user, (error) => {
    if (error) {
      return res.status(500).json({ message: "Não foi possível iniciar a sessão." });
    }

    return res.json({
      message: "Login realizado com sucesso.",
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

app.get("/auth/apple", (req, res, next) => {
  if (!appleConfigured) {
    return res.redirect("/login.html?erro=apple");
  }

  return passport.authenticate("apple")(req, res, next);
});

app.post(
  "/auth/apple/callback",
  passport.authenticate("apple", {
    failureRedirect: "/login.html?erro=social",
    successRedirect: "/pagamento",
  })
);

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor em http://localhost:${PORT}`);
});
