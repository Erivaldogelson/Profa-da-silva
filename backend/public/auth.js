const tabs = document.querySelectorAll(".tab");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const forgotForm = document.getElementById("forgot-form");
const otpForm = document.getElementById("otp-form");
const feedback = document.getElementById("feedback");
const sessionCard = document.getElementById("session-card");
const sessionName = document.getElementById("session-name");
const sessionEmail = document.getElementById("session-email");
const sessionPhone = document.getElementById("session-phone");
const logoutBtn = document.getElementById("logout-btn");
const googleBtn = document.getElementById("google-auth");
const socialDivider = document.getElementById("social-divider");
const socialSection = document.getElementById("social-section");
const otpTitle = document.getElementById("otp-title");
const otpSubtitle = document.getElementById("otp-subtitle");
const otpPurpose = document.getElementById("otp-purpose");
const otpEmail = document.getElementById("otp-email");
const otpPhone = document.getElementById("otp-phone");
const otpCode = document.getElementById("otp-code");
const otpBack = document.getElementById("otp-back");
const otpResend = document.getElementById("otp-resend");
const forgotPasswordLink = document.getElementById("forgot-password-link");
const forgotBack = document.getElementById("forgot-back");
const paymentPath = "/pagamento";
const studentPortalPath = "/aluno/";
const isGitHubPages = window.location.hostname.endsWith("github.io");
const pagesPreviewMessage =
  "Esta é a pré-visualização do GitHub Pages. Login, cadastro e pagamentos precisam do servidor Node. Rode npm start e acesse http://localhost:3000.";

function setMode(mode) {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.mode === mode);
  });

  loginForm.classList.toggle("is-visible", mode === "login");
  registerForm.classList.toggle("is-visible", mode === "register");
  forgotForm.classList.remove("is-visible");
  otpForm.classList.remove("is-visible");
  socialDivider.classList.remove("auth-hidden");
  socialSection.classList.remove("auth-hidden");
}

function showForgotPasswordForm() {
  tabs.forEach((tab) => {
    tab.classList.remove("is-active");
  });

  loginForm.classList.remove("is-visible");
  registerForm.classList.remove("is-visible");
  otpForm.classList.remove("is-visible");
  forgotForm.classList.add("is-visible");
  socialDivider.classList.add("auth-hidden");
  socialSection.classList.add("auth-hidden");
}

function setFeedback(message = "", type = "") {
  feedback.textContent = message;
  feedback.classList.remove("is-error", "is-success");

  if (type) {
    feedback.classList.add(type === "error" ? "is-error" : "is-success");
  }
}

function updateSession(user) {
  const authenticated = Boolean(user);
  sessionCard.hidden = !authenticated;

  if (!authenticated) {
    sessionName.textContent = "";
    sessionEmail.textContent = "";
    sessionPhone.textContent = "";
    return;
  }

  sessionName.textContent = user.name || "Aluno(a)";
  sessionEmail.textContent = user.email
    ? `E-mail: ${user.email}`
    : "E-mail não cadastrado";
  sessionPhone.textContent = user.phoneNumber
    ? `Telefone: ${user.phoneNumber}`
    : "Telefone não cadastrado";
}

function goToPayment() {
  window.location.href = paymentPath;
}

function routeAfterLogin(user) {
  if (user?.role === "gestao") {
    window.location.href = "/gestao/";
    return;
  }

  window.location.href =
    user?.accessStatus === "ativo" ? studentPortalPath : paymentPath;
}

function showOtpStep({
  purpose,
  email = "",
  phoneNumber = "",
  channel = "",
  debugHint = "",
  debugCode = "",
}) {
  loginForm.classList.remove("is-visible");
  registerForm.classList.remove("is-visible");
  otpForm.classList.add("is-visible");
  socialDivider.classList.add("auth-hidden");
  socialSection.classList.add("auth-hidden");

  otpPurpose.value = purpose;
  otpEmail.value = email;
  otpPhone.value = phoneNumber;
  otpCode.value = "";
  otpTitle.textContent =
    purpose === "register" || purpose === "register-phone"
      ? "Confirme seu cadastro"
      : purpose === "reset-password-phone"
        ? "Confirme a recuperação"
      : "Confirme seu login";
  otpSubtitle.textContent =
    purpose.endsWith("-phone")
      ? `Digite o código enviado por SMS para ${phoneNumber}.`
      : `Digite o código enviado para ${email}.`;

  const helperMessage = debugCode
    ? `${debugHint} Código local: ${debugCode}`
    : debugHint;

  setFeedback(
    helperMessage
      ? `Código enviado. ${helperMessage}`
      : "Código enviado com sucesso.",
    "success"
  );

  otpCode.focus();
}

async function sendAuthRequest(url, payload) {
  if (isGitHubPages) {
    throw new Error(pagesPreviewMessage);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível concluir a solicitação.");
  }

  return data;
}

async function loadSession() {
  if (isGitHubPages) {
    updateSession(null);
    return;
  }

  const response = await fetch("/api/auth/me");

  if (!response.ok) {
    updateSession(null);
    return;
  }

  const data = await response.json();
  updateSession(data.user);
}

async function loadProviders() {
  try {
    if (isGitHubPages) {
      googleBtn.classList.add("is-disabled");
      googleBtn.setAttribute("aria-disabled", "true");
      googleBtn.title = "Login social precisa do servidor Node.";
      setFeedback(pagesPreviewMessage, "success");
      return;
    }

    const response = await fetch("/api/auth/providers");
    const providers = await response.json();

    if (!providers.google) {
      googleBtn.classList.add("is-disabled");
      googleBtn.setAttribute("aria-disabled", "true");
      googleBtn.title = "Configure as credenciais do Google no backend para ativar.";
    }

  } catch (error) {
    setFeedback("Não foi possível verificar os provedores sociais.", "error");
  }
}

async function resendOtp() {
  const purpose = otpPurpose.value;

  if (!purpose) {
    throw new Error("Abra novamente o fluxo de login ou cadastro para receber um novo código.");
  }

  if (purpose === "register") {
    return sendAuthRequest("/api/auth/register/resend", {});
  }

  if (purpose === "login") {
    return sendAuthRequest("/api/auth/login/resend", {});
  }

  if (purpose === "reset-password-phone") {
    return sendAuthRequest("/api/auth/password/forgot/resend", {});
  }

  if (purpose === "register-phone") {
    return sendAuthRequest("/api/auth/register/phone/resend", {
      phoneNumber: otpPhone.value,
    });
  }

  if (purpose === "login-phone") {
    return sendAuthRequest("/api/auth/login/phone/resend", {
      phoneNumber: otpPhone.value,
    });
  }

  throw new Error("Não foi possível reenviar o código para este fluxo.");
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setMode(tab.dataset.mode);
    setFeedback("");
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    const data = await sendAuthRequest("/api/auth/login/start", {
      email: formData.get("email"),
      password: formData.get("password"),
      channel: "sms",
    });

    loginForm.reset();
    showOtpStep(data);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);

  try {
    const data = await sendAuthRequest("/api/auth/register/start", {
      name: formData.get("name"),
      email: formData.get("email"),
      phoneNumber: formData.get("phoneNumber"),
      password: formData.get("password"),
    });

    registerForm.reset();
    showOtpStep(data);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(forgotForm);

  try {
    const data = await sendAuthRequest("/api/auth/password/forgot/start", {
      phoneNumber: formData.get("phoneNumber"),
      channel: formData.get("verificationChannel"),
    });

    forgotForm.reset();
    showOtpStep(data);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

otpForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    let data;

    if (otpPurpose.value.endsWith("-phone")) {
      data = await sendAuthRequest(
        otpPurpose.value === "register-phone"
          ? "/api/auth/register/phone/verify"
          : "/api/auth/login/phone/verify",
        {
          phoneNumber: otpPhone.value,
          code: otpCode.value,
        }
      );
    } else if (otpPurpose.value === "reset-password-phone") {
      data = await sendAuthRequest("/api/auth/password/forgot/phone/verify", {
        phoneNumber: otpPhone.value,
        code: otpCode.value,
      });
    } else {
      data = await sendAuthRequest("/api/auth/verify", {
        email: otpEmail.value,
        purpose: otpPurpose.value,
        code: otpCode.value,
      });
    }

    setFeedback(data.message, "success");

    if (data.redirectTo) {
      setTimeout(() => {
        window.location.href = data.redirectTo;
      }, 500);
      return;
    }

    updateSession(data.user);
    setTimeout(() => routeAfterLogin(data.user), 500);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

otpBack.addEventListener("click", () => {
  if (otpPurpose.value === "reset-password-phone") {
    showForgotPasswordForm();
  } else {
    setMode(otpPurpose.value.startsWith("register") ? "register" : "login");
  }
  setFeedback("");
});

otpResend.addEventListener("click", async () => {
  try {
    otpResend.disabled = true;
    const data = await resendOtp();
    showOtpStep(data);
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    otpResend.disabled = false;
  }
});

forgotPasswordLink.addEventListener("click", () => {
  showForgotPasswordForm();
  setFeedback("");
});

forgotBack.addEventListener("click", () => {
  setMode("login");
  setFeedback("");
});

logoutBtn.addEventListener("click", async () => {
  try {
    await sendAuthRequest("/api/auth/logout", {});
    updateSession(null);
    setFeedback("Você saiu da sua conta.", "success");
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

const params = new URLSearchParams(window.location.search);

if (params.get("sucesso") === "google") {
  window.location.href = "/pos-login";
}

if (params.get("erro") === "google") {
  setFeedback(
    "Login com Google ainda não configurado. Coloque o GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET reais no arquivo .env e reinicie o servidor.",
    "error"
  );
} else if (params.get("erro")) {
  setFeedback("Não foi possível concluir a autenticação social.", "error");
}

if (params.get("senha") === "alterada") {
  setMode("login");
  setFeedback("Senha alterada com sucesso. Faça login com a nova senha.", "success");
}

if (params.get("logout") === "1") {
  setMode("login");
  setFeedback("Sessão encerrada com segurança.", "success");
}

loadSession();
loadProviders();
