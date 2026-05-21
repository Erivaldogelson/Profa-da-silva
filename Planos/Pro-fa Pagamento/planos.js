const catalog = document.getElementById("plans-catalog");
const feedback = document.getElementById("payment-feedback");
const gestaoLink = document.getElementById("gestao-link");
let currentUser = null;
const isGitHubPages = window.location.hostname.endsWith("github.io");
const pagesPreviewMessage =
  "Pré-visualização do GitHub Pages: a escolha do plano abre o WhatsApp, mas o registro no sistema precisa do servidor Node.";

const fallbackCourses = [
  {
    name: "Português",
    icon: "📘",
    description: "",
    plans: [
      {
        title: "Acompanhamento Escolar",
        subtitle: "Ensino Fundamental",
        price_text: "R$ 50,00 /mês",
        secondary_price_text: "R$ 55,00 /aula (acima de 6 meses)",
        badge: "Acompanhamento",
        is_highlighted: false,
        features: [
          "1 aula semanal de 1 hora",
          "Material complementar",
          "Exercícios por aula",
          "Acesso ao site",
        ],
      },
      {
        title: "Acompanhamento Escolar",
        subtitle: "Ensino Médio",
        price_text: "R$ 60,00 /mês",
        secondary_price_text: "R$ 65,00 /aula (acima de 6 meses)",
        badge: "Acompanhamento",
        is_highlighted: true,
        features: [
          "1 aula semanal de 1 hora",
          "Material complementar",
          "Exercícios por aula",
          "Acesso ao site",
        ],
      },
      {
        title: "Aula Avulsa",
        subtitle: "Português",
        price_text: "R$ 90,00",
        secondary_price_text: "",
        badge: "",
        is_highlighted: false,
        features: ["1 aula de 1 hora", "Material complementar", "Exercícios"],
      },
    ],
  },
  {
    name: "História",
    icon: "📜",
    description: "",
    plans: [
      {
        title: "Aula Avulsa",
        subtitle: "História",
        price_text: "R$ 100,00",
        secondary_price_text: "",
        badge: "",
        is_highlighted: false,
        features: ["1 aula de 1 hora", "Material complementar da aula", "Exercícios da aula"],
      },
      {
        title: "Acompanhamento Escolar",
        subtitle: "História - Ensino Médio",
        price_text: "R$ 75,00 /aula (até 6 meses)",
        secondary_price_text: "R$ 70,00 /aula (acima de 6 meses)",
        badge: "Acompanhamento",
        is_highlighted: true,
        features: [
          "1 aula semanal de 1 hora",
          "Material complementar por aula",
          "Exercícios por aula",
          "Acesso ao site com materiais extras",
          "Tempo: ano escolar (a combinar)",
        ],
      },
      {
        title: "Acompanhamento Escolar",
        subtitle: "História - Ensino Fundamental",
        price_text: "R$ 65,00 /aula (até 6 meses)",
        secondary_price_text: "R$ 60,00 /aula (acima de 6 meses)",
        badge: "Acompanhamento",
        is_highlighted: false,
        features: [
          "1 aula semanal de 1 hora",
          "Material complementar por aula",
          "Exercícios por aula",
          "Acesso ao site com materiais extras",
          "Tempo: ano escolar (a combinar)",
        ],
      },
    ],
  },
  {
    name: "Espanhol",
    icon: "💬",
    description: "",
    plans: [
      {
        title: "Plano destravar o espanhol: básico ao intermediário",
        subtitle: "Espanhol",
        price_text: "R$ 40 por aula efetiva",
        secondary_price_text: "R$ 30,00 /Taxa de Inscrição",
        badge: "",
        is_highlighted: false,
        features: [
          "1 aula semanal de 1 hora",
          "Material complementar por aula",
          "Exercícios por aula",
          "Acesso ao site com materiais extras para estudo",
        ],
      },
      {
        title: "Plano começar a falar - básico (A1 ao A2)",
        subtitle: "Espanhol - básico",
        price_text: "R$ 45 /aula (Aulas efetivas)",
        secondary_price_text: "R$ 30,00 /Taxa de Inscrição",
        badge: "Acompanhamento",
        is_highlighted: true,
        features: [
          "1 aula semanal de 1 hora",
          "Material complementar por aula",
          "Exercícios por aula",
          "Acesso ao site com materiais extras",
          "Tempo: ano escolar (a combinar)",
        ],
      },
      {
        title: "Plano Progressivo (básico ao avançado)",
        subtitle: "Espanhol avançado intermediário",
        price_text: "R$ 35,00 /aula (até 6 meses)",
        secondary_price_text: "R$ 30,00 /Taxa de Inscrição",
        badge: "Acompanhamento",
        is_highlighted: false,
        features: [
          "1 aula semanal de 1 hora",
          "Material complementar por aula",
          "Exercícios por aula",
          "Acesso ao site com materiais extras para estudo",
          "Tempo: ano escolar (a combinar)",
        ],
      },
    ],
  },
];

function setFeedback(message = "", type = "") {
  if (!feedback) {
    return;
  }

  feedback.textContent = message;
  feedback.classList.remove("is-success", "is-error");

  if (type) {
    feedback.classList.add(type === "error" ? "is-error" : "is-success");
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadCurrentUser() {
  if (isGitHubPages) {
    currentUser = null;
    setFeedback(pagesPreviewMessage, "success");
    return;
  }

  const response = await fetch("/api/auth/me");

  if (!response.ok) {
    window.location.href = "/login.html";
    return;
  }

  const data = await response.json();
  currentUser = data.user;

  if (currentUser?.role !== "gestao" && currentUser?.accessStatus === "ativo") {
    window.location.href = "/aluno/";
    return;
  }

  if (gestaoLink && currentUser?.role === "gestao") {
    gestaoLink.hidden = false;
  }
}

async function registerPayment(materia, plano) {
  if (isGitHubPages) {
    return null;
  }

  const response = await fetch("/api/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ materia, plano }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível registrar o pedido.");
  }

  return data.payment;
}

function renderCatalog(courses) {
  if (!courses.length) {
    catalog.innerHTML = `<p class="text-center text-muted">Nenhum plano disponível no momento.</p>`;
    return;
  }

  catalog.innerHTML = courses
    .map((course) => {
      const plans = course.plans || [];
      const cards = plans.length
        ? plans
            .map((plan) => {
              const features = (plan.features || [])
                .map((feature) => `<li>✓ ${escapeHtml(feature)}</li>`)
                .join("");
              const badge = plan.badge
                ? `<span class="badge-highlight">${escapeHtml(plan.badge)}</span>`
                : "";
              const highlighted = plan.is_highlighted ? " destaque" : "";
              const planName = plan.subtitle || plan.title;

              return `
                <div class="col-md-4">
                  <div class="plan-card text-center${highlighted}">
                    ${badge}
                    <h3>${escapeHtml(plan.title)}</h3>
                    <p class="text-muted">${escapeHtml(plan.subtitle || course.name)}</p>
                    <div class="plan-price">${escapeHtml(plan.price_text)}</div>
                    ${
                      plan.secondary_price_text
                        ? `<small class="text-muted">${escapeHtml(plan.secondary_price_text)}</small>`
                        : ""
                    }
                    <ul class="list-unstyled mt-4">${features}</ul>
                    <button class="btn btn-plan mt-4" data-materia="${escapeHtml(course.name)}" data-plano="${escapeHtml(planName)}">
                      Escolher plano
                    </button>
                  </div>
                </div>
              `;
            })
            .join("")
        : `<p class="text-muted">Nenhum plano cadastrado para este curso.</p>`;

      return `
        <section class="mb-5">
          <h2 class="categoria-titulo mb-4">${escapeHtml(course.icon)} ${escapeHtml(course.name)}</h2>
          ${course.description ? `<p class="text-muted">${escapeHtml(course.description)}</p>` : ""}
          <div class="row g-4">${cards}</div>
        </section>
      `;
    })
    .join("");

  catalog.querySelectorAll(".btn-plan").forEach((button) => {
    button.addEventListener("click", () => choosePlan(button));
  });
}

async function loadCatalog() {
  try {
    if (isGitHubPages) {
      renderCatalog(fallbackCourses);
      return;
    }

    const response = await fetch("/api/payment-catalog");
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível carregar os planos.");
    }

    const courses = data.courses || [];
    renderCatalog(courses.length ? courses : fallbackCourses);
  } catch (error) {
    renderCatalog(fallbackCourses);
    setFeedback("Planos restaurados. Reinicie o servidor para carregar edições feitas pela professora.", "success");
  }
}

async function choosePlan(button) {
  const materia = button.dataset.materia;
  const plano = button.dataset.plano;

  try {
    button.disabled = true;
    setFeedback("Registrando seu pedido com segurança...", "success");
    const payment = await registerPayment(materia, plano);
    const pedido = payment?.id ? `Pedido registrado no sistema: #${payment.id}.` : "";

    const mensagem = `Olá Professora Mariane!
Tudo bem?
Tenho interesse em aulas de *${materia}*.
Plano escolhido: *${plano}*.
${pedido}`;

    const telefone = "5534999702517";

    setFeedback(
      payment?.id ? `Pedido #${payment.id} registrado. Abrindo WhatsApp...` : "Abrindo WhatsApp...",
      "success"
    );
    window.open(
      `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`,
      "_blank"
    );
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function start() {
  await loadCurrentUser();
  await loadCatalog();
}

start().catch((error) => {
  setFeedback(error.message || "Não foi possível carregar a página.", "error");
});
