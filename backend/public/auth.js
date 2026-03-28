const tabs = document.querySelectorAll(".tab");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const feedback = document.getElementById("feedback");
const sessionCard = document.getElementById("session-card");
const sessionName = document.getElementById("session-name");
const sessionEmail = document.getElementById("session-email");
const logoutBtn = document.getElementById("logout-btn");
const googleBtn = document.getElementById("google-auth");
const appleBtn = document.getElementById("apple-auth");
const paymentPath = "/pagamento";

function setMode(mode) {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.mode === mode);
  });

  loginForm.classList.toggle("is-visible", mode === "login");
  registerForm.classList.toggle("is-visible", mode === "register");
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
    return;
  }

  sessionName.textContent = user.name || "Aluno(a)";
  sessionEmail.textContent = user.email || "Conta social conectada";
}

function goToPayment() {
  window.location.href = paymentPath;
}

async function sendAuthRequest(url, payload) {
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
    const response = await fetch("/api/auth/providers");
    const providers = await response.json();

    if (!providers.google) {
      googleBtn.classList.add("is-disabled");
      googleBtn.setAttribute("aria-disabled", "true");
      googleBtn.title = "Configure as credenciais do Google no backend para ativar.";
    }

    if (!providers.apple) {
      appleBtn.classList.add("is-disabled");
      appleBtn.setAttribute("aria-disabled", "true");
      appleBtn.title = "Configure as credenciais da Apple no backend para ativar.";
    }
  } catch (error) {
    setFeedback("Não foi possível verificar os provedores sociais.", "error");
  }
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
    const data = await sendAuthRequest("/api/auth/login", {
      email: formData.get("email"),
      password: formData.get("password"),
    });

    setFeedback(data.message, "success");
    updateSession(data.user);
    loginForm.reset();
    setTimeout(goToPayment, 500);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);

  try {
    const data = await sendAuthRequest("/api/auth/register", {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    setFeedback(data.message, "success");
    updateSession(data.user);
    registerForm.reset();
    setTimeout(goToPayment, 500);
  } catch (error) {
    setFeedback(error.message, "error");
  }
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
  goToPayment();
}

if (params.get("sucesso") === "apple") {
  goToPayment();
}

if (params.get("erro")) {
  setFeedback("Não foi possível concluir a autenticação social.", "error");
}

loadSession();
loadProviders();
