const resetForm = document.getElementById("reset-password-form");
const feedback = document.getElementById("reset-feedback");
const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";

function setFeedback(message = "", type = "") {
  feedback.textContent = message;
  feedback.classList.remove("is-error", "is-success");

  if (type) {
    feedback.classList.add(type === "error" ? "is-error" : "is-success");
  }
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
    throw new Error(data.message || "Não foi possível salvar a nova senha.");
  }

  return data;
}

if (!token) {
  setFeedback("Link de redefinição inválido. Solicite um novo código.", "error");
  resetForm.querySelectorAll("input, button").forEach((element) => {
    element.disabled = true;
  });
}

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(resetForm);
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (password.length < 6) {
    setFeedback("A nova senha precisa ter pelo menos 6 caracteres.", "error");
    return;
  }

  if (password !== confirmPassword) {
    setFeedback("As senhas não coincidem.", "error");
    return;
  }

  try {
    const data = await sendRequest("/api/auth/password/reset", {
      token,
      password,
    });

    setFeedback(data.message, "success");
    setTimeout(() => {
      window.location.href = "/login.html?senha=alterada";
    }, 900);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});
