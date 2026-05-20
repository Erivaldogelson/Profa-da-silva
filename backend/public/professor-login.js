const loginForm = document.getElementById("professor-login-form");
const otpForm = document.getElementById("professor-otp-form");
const feedback = document.getElementById("feedback");
const otpEmail = document.getElementById("otp-email");
const otpCode = document.getElementById("otp-code");
const otpSubtitle = document.getElementById("otp-subtitle");
const otpBack = document.getElementById("otp-back");
const otpResend = document.getElementById("otp-resend");

function setFeedback(message = "", type = "") {
  feedback.textContent = message;
  feedback.classList.remove("is-error", "is-success");

  if (type) {
    feedback.classList.add(type === "error" ? "is-error" : "is-success");
  }
}

function showOtpStep(data) {
  loginForm.classList.remove("is-visible");
  otpForm.classList.add("is-visible");
  otpEmail.value = data.email;
  otpCode.value = "";
  otpSubtitle.textContent = `Digite o código enviado para ${data.email}.`;

  const helperMessage = data.debugCode
    ? `${data.debugHint} Código local: ${data.debugCode}`
    : data.debugHint;

  setFeedback(
    helperMessage
      ? `Código enviado. ${helperMessage}`
      : "Código enviado com sucesso.",
    "success"
  );

  otpCode.focus();
}

async function sendRequest(url, payload) {
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

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    const data = await sendRequest("/api/professor/login/start", {
      email: formData.get("email"),
      password: formData.get("password"),
    });

    loginForm.reset();
    showOtpStep(data);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

otpForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const data = await sendRequest("/api/auth/verify", {
      email: otpEmail.value,
      purpose: "professor-login",
      code: otpCode.value,
    });

    if (data.user?.role !== "gestao") {
      throw new Error("Este acesso é exclusivo para professor/gestão.");
    }

    setFeedback(data.message, "success");
    setTimeout(() => {
      window.location.href = "/gestao/";
    }, 400);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

otpBack.addEventListener("click", () => {
  otpForm.classList.remove("is-visible");
  loginForm.classList.add("is-visible");
  setFeedback("");
});

otpResend.addEventListener("click", async () => {
  try {
    otpResend.disabled = true;
    const data = await sendRequest("/api/professor/login/resend", {});
    showOtpStep(data);
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    otpResend.disabled = false;
  }
});

const params = new URLSearchParams(window.location.search);

if (params.get("erro") === "permissao") {
  setFeedback("Entre com uma conta de professor para acessar a gestão.", "error");
}
