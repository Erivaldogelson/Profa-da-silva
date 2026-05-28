const shell = document.querySelector(".student-shell");
const menuToggle = document.getElementById("student-menu-toggle");
const menuLinks = document.querySelectorAll(".student-menu-link");
const modulePanels = document.querySelectorAll(".student-module");
const studentKicker = document.getElementById("student-kicker");
const studentTitle = document.getElementById("student-title");
const studentSummaryPanel = document.getElementById("student-summary-panel");
const studentName = document.getElementById("student-name");
const studentInfo = document.getElementById("student-info");
const billingAlert = document.getElementById("billing-alert");
const studentSubjects = document.getElementById("student-subjects");
const materialsFeedback = document.getElementById("materials-feedback");
const materialsList = document.getElementById("materials-list");
const announcementsFeedback = document.getElementById("announcements-feedback");
const announcementsList = document.getElementById("announcements-list");
const gradesFeedback = document.getElementById("grades-feedback");
const gradesList = document.getElementById("grades-list");
const eventsFeedback = document.getElementById("events-feedback");
const eventsList = document.getElementById("events-list");
const eventsCalendar = document.getElementById("events-calendar");
const selectedDayEvents = document.getElementById("selected-day-events");
const calendarPrev = document.getElementById("calendar-prev");
const calendarNext = document.getElementById("calendar-next");
const calendarMonth = document.getElementById("calendar-month");
const calendarYear = document.getElementById("calendar-year");
const eventForm = document.getElementById("event-form");
const eventSubject = document.getElementById("event-subject");
const studentLogout = document.getElementById("student-logout");
const profileForm = document.getElementById("profile-form");
const profileName = document.getElementById("profile-name");
const profileEmail = document.getElementById("profile-email");
const profilePhone = document.getElementById("profile-phone");
const profilePassword = document.getElementById("profile-password");
const profilePasswordConfirm = document.getElementById("profile-password-confirm");
const profileAvatar = document.getElementById("profile-avatar");
const profileAvatarPreview = document.getElementById("profile-avatar-preview");
const profileAvatarIcon = document.getElementById("profile-avatar-icon");
const profileFeedback = document.getElementById("profile-feedback");

let currentModule = "dashboard";
let currentSubjects = [];
let currentUser = null;
let currentEvents = [];
let calendarDate = new Date();
let selectedDateKey = toDateKey(new Date());
const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const moduleLabels = {
  dashboard: ["Portal do aluno", "Dashboard"],
  events: ["Calendário", "Eventos"],
  announcements: ["Avisos da professora", "Comunicados"],
  classes: ["Conteúdo liberado", "Aulas"],
  grades: ["Boletim", "Notas"],
  settings: ["Portal do aluno", "Configurações"],
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateTimeLocal(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameMonth(first, second) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth();
}

function setModule(moduleName) {
  currentModule = moduleName;
  menuLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.module === moduleName);
  });
  modulePanels.forEach((panel) => {
    panel.hidden = panel.id !== `${moduleName}-module`;
  });
  studentKicker.textContent = moduleLabels[moduleName][0];
  studentTitle.textContent = moduleLabels[moduleName][1];
  studentSummaryPanel.hidden = moduleName !== "dashboard";

  if (moduleName === "dashboard") {
    loadDashboard();
  }
  if (moduleName === "events") {
    loadEvents();
  }
  if (moduleName === "announcements") {
    loadAnnouncements();
  }
  if (moduleName === "classes") {
    loadMaterials();
  }
  if (moduleName === "grades") {
    loadGrades();
  }
  if (moduleName === "settings") {
    populateProfileForm(currentUser);
  }

  if (window.matchMedia("(max-width: 720px)").matches) {
    shell.classList.add("sidebar-collapsed");
  }
}

function renderAvatar(user) {
  if (user?.avatarUrl) {
    profileAvatarPreview.src = user.avatarUrl;
    profileAvatarPreview.hidden = false;
    profileAvatarIcon.hidden = true;
    return;
  }

  profileAvatarPreview.hidden = true;
  profileAvatarPreview.removeAttribute("src");
  profileAvatarIcon.hidden = false;
}

function populateProfileForm(user) {
  if (!user) {
    return;
  }

  profileName.value = user.name || "";
  profileEmail.value = user.email || "";
  profilePhone.value = user.phoneNumber || "";
  renderAvatar(user);
}

function applyUser(user) {
  currentUser = user;
  studentName.textContent = `Bem-vindo(a), ${user.name || "aluno(a)"}`;
  studentInfo.textContent = user.paidAt
    ? `Seu acesso foi liberado em ${formatDateTimeLocal(user.paidAt)}.`
    : "Seu acesso está ativo.";
  renderSubjects(user.subjects || []);
  populateProfileForm(user);
}

function renderBillingAlert(billing) {
  if (!billing || billing.status === "ok" || !billing.requiresPayment) {
    billingAlert.hidden = true;
    billingAlert.textContent = "";
    billingAlert.classList.remove("is-warning", "is-danger");
    return;
  }

  billingAlert.hidden = false;
  billingAlert.textContent = billing.message;
  billingAlert.classList.toggle("is-warning", billing.status === "warning");
  billingAlert.classList.toggle("is-danger", billing.status === "blocked");
}

function renderSubjects(subjects) {
  currentSubjects = subjects;

  if (!subjects.length) {
    studentSubjects.innerHTML = `<span class="text-muted">Nenhuma disciplina liberada ainda.</span>`;
    eventSubject.innerHTML = `<option value="">Sem disciplina liberada</option>`;
    return;
  }

  studentSubjects.innerHTML = subjects
    .map((subject) => `<span class="subject-pill">${escapeHtml(subject)}</span>`)
    .join("");
  eventSubject.innerHTML = subjects
    .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)
    .join("");
}

function updateBar(id, value, max) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  document.getElementById(id).style.width = `${percent}%`;
}

function setupCalendarControls() {
  calendarMonth.innerHTML = monthNames
    .map((month, index) => `<option value="${index}">${month}</option>`)
    .join("");
  calendarMonth.value = String(calendarDate.getMonth());
  calendarYear.value = String(calendarDate.getFullYear());
}

function eventsByDate() {
  return currentEvents.reduce((groups, event) => {
    const key = toDateKey(event.starts_at);
    groups[key] = groups[key] || [];
    groups[key].push(event);
    return groups;
  }, {});
}

function renderSelectedDayEvents(groups) {
  const events = groups[selectedDateKey] || [];
  if (!events.length) {
    selectedDayEvents.innerHTML = `<p class="text-muted mb-0">Nenhum evento para o dia selecionado. Clique no dia e preencha o formulário para adicionar.</p>`;
    return;
  }

  selectedDayEvents.innerHTML = events
    .map((event) => {
      const createdBy = event.created_by_role === "professor" ? "Professora" : "Você";
      const canDelete = event.created_by_role !== "professor";
      return `
        <article class="student-item">
          <div>
            <h3>${escapeHtml(event.title)}</h3>
            <small>${escapeHtml(event.subject || "Sem disciplina")} · ${formatDateTimeLocal(event.starts_at)} · ${createdBy}</small>
            <p class="text-muted mb-0 mt-2">${escapeHtml(event.notes || "Sem observações.")}</p>
          </div>
          ${
            canDelete
              ? `<button class="btn btn-outline-danger rounded-pill event-delete" type="button" data-event-id="${event.id}">Apagar</button>`
              : ""
          }
        </article>
      `;
    })
    .join("");

  selectedDayEvents.querySelectorAll(".event-delete").forEach((button) => {
    button.addEventListener("click", () => deleteEvent(button));
  });
}

function setEventFormDate(dateKey) {
  const field = eventForm.elements.startsAt;
  if (!field.value || field.value.slice(0, 10) !== dateKey) {
    field.value = `${dateKey}T09:00`;
  }
}

function renderCalendar() {
  setupCalendarControls();
  const groups = eventsByDate();
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - start.getDay());
  const todayKey = toDateKey(new Date());
  const cells = [];

  weekDays.forEach((day) => {
    cells.push(`<div class="calendar-weekday">${day}</div>`);
  });

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = toDateKey(date);
    const dayEvents = groups[key] || [];
    const muted = sameMonth(date, calendarDate) ? "" : " is-muted";
    const selected = key === selectedDateKey ? " is-selected" : "";
    const today = key === todayKey ? " is-today" : "";
    const expanded = key === selectedDateKey && dayEvents.length ? " is-expanded" : "";
    const labels = dayEvents
      .slice(0, 2)
      .map((event) => `<span class="calendar-event-chip">${escapeHtml(event.title)}</span>`)
      .join("");
    const extra = dayEvents.length > 2
      ? `<span class="calendar-event-more">+${dayEvents.length - 2}</span>`
      : "";
    const expandedDetails = expanded
      ? `<span class="calendar-expanded-events">
          ${dayEvents
            .map((event) => {
              const createdBy = event.created_by_role === "professor" ? "Professora" : "Você";
              return `<span class="calendar-expanded-item">
                <strong>${escapeHtml(event.title)}</strong>
                <small>${escapeHtml(event.subject || "Sem disciplina")} · ${formatDateTimeLocal(event.starts_at)} · ${createdBy}</small>
                ${event.notes ? `<em>${escapeHtml(event.notes)}</em>` : ""}
              </span>`;
            })
            .join("")}
        </span>`
      : "";

    cells.push(`
      <button class="calendar-day${muted}${selected}${today}${expanded}" type="button" data-date="${key}">
        <span class="calendar-day-number">${date.getDate()}</span>
        <span class="calendar-day-events">${labels}${extra}</span>
        ${expandedDetails}
      </button>
    `);
  }

  eventsCalendar.innerHTML = cells.join("");
  eventsCalendar.querySelectorAll(".calendar-day").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDateKey = button.dataset.date;
      const nextDate = new Date(`${selectedDateKey}T12:00:00`);
      if (!sameMonth(nextDate, calendarDate)) {
        calendarDate = nextDate;
      }
      setEventFormDate(selectedDateKey);
      renderCalendar();
    });
  });
  renderSelectedDayEvents(groups);
}

async function loadDashboard() {
  const response = await fetch("/api/aluno/dashboard");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return;
  }

  renderBillingAlert(data.billing);

  const stats = data.stats || {};
  document.getElementById("stat-subjects").textContent = stats.subjects || 0;
  document.getElementById("stat-materials").textContent = stats.materials || 0;
  document.getElementById("stat-events").textContent = stats.upcomingEvents || 0;
  document.getElementById("stat-pdfs").textContent = stats.pdfs || 0;
  document.getElementById("stat-videos").textContent = stats.videos || 0;
  document.getElementById("stat-announcements").textContent = stats.announcements || 0;
  document.getElementById("stat-grades").textContent = stats.grades || 0;

  const max = Math.max(stats.pdfs || 0, stats.videos || 0, stats.announcements || 0, 1);
  updateBar("bar-pdfs", stats.pdfs || 0, max);
  updateBar("bar-videos", stats.videos || 0, max);
  updateBar("bar-announcements", stats.announcements || 0, max);
}

function formatGradeValue(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  });
}

function renderGrades(grades) {
  if (!grades.length) {
    gradesList.innerHTML = "";
    gradesFeedback.textContent = "Nenhuma nota disponível no momento.";
    return;
  }

  gradesFeedback.textContent = "Notas publicadas pela professora:";
  gradesList.innerHTML = grades
    .map((grade) => {
      const score = Number(grade.score || 0);
      const maxScore = Number(grade.max_score || 1);
      const percentage = Math.round((score / maxScore) * 100);

      return `
        <article class="student-item grade-item">
          <div>
            <h3>${escapeHtml(grade.title)}</h3>
            <small>${escapeHtml(grade.subject)} · ${formatDate(grade.created_at)}</small>
            <p class="grade-score mb-0 mt-2">
              <strong>${formatGradeValue(score)}</strong> de ${formatGradeValue(maxScore)}
              <span class="grade-percent">${percentage}%</span>
            </p>
            <p class="text-muted mb-0 mt-2">${escapeHtml(grade.notes || "Sem observação.")}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadGrades() {
  const response = await fetch("/api/aluno/grades");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    gradesFeedback.textContent = data.message || "Não foi possível carregar as notas.";
    return;
  }

  renderGrades(data.grades || []);
}

function groupMaterialsByModule(materials) {
  return materials.reduce((groups, material) => {
    const moduleName = material.module || "Sem módulo";
    groups[moduleName] = groups[moduleName] || [];
    groups[moduleName].push(material);
    return groups;
  }, {});
}

function renderMaterials(materials) {
  if (!materials.length) {
    materialsList.innerHTML = "";
    materialsFeedback.textContent = "Nenhuma aula disponível para suas disciplinas no momento.";
    return;
  }

  materialsFeedback.textContent = "Aulas disponíveis por módulo:";
  const groups = groupMaterialsByModule(materials);
  materialsList.innerHTML = Object.entries(groups)
    .map(([moduleName, items]) => {
      const cards = items
        .map((material) => {
          const typeLabel = material.type === "video" ? "Vídeo aula" : "PDF";
          return `
            <article class="student-item">
              <div>
                <h3>${escapeHtml(material.title)}</h3>
                <small>${typeLabel} · ${escapeHtml(material.subject)} · ${formatDate(material.created_at)}</small>
                <p class="text-muted mb-0 mt-2">${escapeHtml(material.description || "Sem descrição.")}</p>
              </div>
              <a class="btn btn-outline-dark rounded-pill" href="/api/aluno/materials/${material.id}/file" target="_blank" rel="noreferrer">
                Abrir
              </a>
            </article>
          `;
        })
        .join("");

      return `
        <section class="module-group">
          <h3 class="module-title">${escapeHtml(moduleName)}</h3>
          ${cards}
        </section>
      `;
    })
    .join("");
}

async function loadMaterials() {
  const response = await fetch("/api/aluno/materials");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    materialsFeedback.textContent = data.message || "Não foi possível carregar as aulas.";
    return;
  }

  renderSubjects(data.subjects || currentSubjects);
  renderMaterials(data.materials || []);
}

function renderAnnouncements(announcements) {
  if (!announcements.length) {
    announcementsList.innerHTML = "";
    announcementsFeedback.textContent = "Nenhum comunicado disponível no momento.";
    return;
  }

  announcementsFeedback.textContent = "Comunicados recentes:";
  announcementsList.innerHTML = announcements
    .map((announcement) => {
      const media =
        announcement.media_type === "video"
          ? `<video class="announcement-media" controls src="/api/aluno/announcements/${announcement.id}/media"></video>`
          : announcement.media_type === "audio"
            ? `<audio class="announcement-media" controls src="/api/aluno/announcements/${announcement.id}/media"></audio>`
          : "";
      const pdfFile =
        announcement.pdf_path || announcement.media_type === "pdf"
          ? `<a class="announcement-file btn btn-outline-dark rounded-pill btn-sm" href="/api/aluno/announcements/${announcement.id}/pdf" target="_blank" rel="noreferrer"><i class="bi bi-file-earmark-pdf"></i> Abrir PDF</a>`
          : "";
      return `
        <article class="student-item">
          <div>
            <h3>${escapeHtml(announcement.title)}</h3>
            <small>${escapeHtml(announcement.subject || "Todos os alunos")} · ${escapeHtml(announcement.module || "Sem módulo")} · ${formatDate(announcement.created_at)}</small>
            <p class="text-muted mb-0 mt-2">${escapeHtml(announcement.body)}</p>
            ${media}
            ${pdfFile}
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadAnnouncements() {
  const response = await fetch("/api/aluno/announcements");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    announcementsFeedback.textContent = data.message || "Não foi possível carregar os comunicados.";
    return;
  }

  renderAnnouncements(data.announcements || []);
}

function renderEvents(events) {
  currentEvents = events;
  renderCalendar();
  if (!events.length) {
    eventsList.innerHTML = "";
    eventsFeedback.textContent = "Nenhuma aula adicionada ao calendário.";
    return;
  }

  eventsFeedback.textContent = "Seu calendário:";
  eventsList.innerHTML = events
    .map((event) => {
      const createdBy = event.created_by_role === "professor" ? "Professora" : "Você";
      const canDelete = event.created_by_role !== "professor";
      return `
        <article class="student-item">
          <div>
            <h3>${escapeHtml(event.title)}</h3>
            <small>${escapeHtml(event.subject || "Sem disciplina")} · ${formatDateTimeLocal(event.starts_at)} · ${createdBy}</small>
            <p class="text-muted mb-0 mt-2">${escapeHtml(event.notes || "Sem observações.")}</p>
          </div>
          ${
            canDelete
              ? `<button class="btn btn-outline-danger rounded-pill event-delete" type="button" data-event-id="${event.id}">Apagar</button>`
              : ""
          }
        </article>
      `;
    })
    .join("");

  eventsList.querySelectorAll(".event-delete").forEach((button) => {
    button.addEventListener("click", () => deleteEvent(button));
  });
}

async function loadEvents() {
  const response = await fetch("/api/aluno/events");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    eventsFeedback.textContent = data.message || "Não foi possível carregar o calendário.";
    return;
  }

  renderEvents(data.events || []);
}

async function createEvent(form) {
  const formData = new FormData(form);
  const response = await fetch("/api/aluno/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: formData.get("title"),
      subject: formData.get("subject"),
      startsAt: formData.get("startsAt"),
      notes: formData.get("notes"),
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    eventsFeedback.textContent = data.message || "Não foi possível adicionar o evento.";
    return;
  }

  form.reset();
  eventsFeedback.textContent = data.message;
  await loadEvents();
  await loadDashboard();
}

async function deleteEvent(button) {
  const response = await fetch(`/api/aluno/events/${button.dataset.eventId}`, {
    method: "DELETE",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    eventsFeedback.textContent = data.message || "Não foi possível apagar o evento.";
    return;
  }

  eventsFeedback.textContent = data.message;
  await loadEvents();
  await loadDashboard();
}

async function loadStudentArea() {
  const response = await fetch("/api/aluno/status");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    window.location.href = "/pagamento";
    return;
  }

  applyUser(data.user);
  renderBillingAlert(data.billing);
  setModule(currentModule);
}

async function updateProfile(form) {
  const formData = new FormData(form);
  const response = await fetch("/api/aluno/profile", {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    profileFeedback.textContent = data.message || "Não foi possível atualizar o perfil.";
    profileFeedback.classList.remove("text-muted", "text-success");
    profileFeedback.classList.add("text-danger");
    return;
  }

  profileAvatar.value = "";
  profileFeedback.textContent = data.message;
  profileFeedback.classList.remove("text-muted", "text-danger");
  profileFeedback.classList.add("text-success");
  profilePassword.value = "";
  profilePasswordConfirm.value = "";
  applyUser(data.user);
}

menuToggle.addEventListener("click", () => {
  shell.classList.toggle("sidebar-collapsed");
});

menuLinks.forEach((link) => {
  link.addEventListener("click", () => setModule(link.dataset.module));
});

eventForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createEvent(eventForm);
});

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateProfile(profileForm);
});

profileAvatar.addEventListener("change", () => {
  const file = profileAvatar.files?.[0];
  if (!file) {
    renderAvatar(currentUser);
    return;
  }

  profileAvatarPreview.src = URL.createObjectURL(file);
  profileAvatarPreview.hidden = false;
  profileAvatarIcon.hidden = true;
});

calendarPrev.addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  selectedDateKey = toDateKey(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1));
  renderCalendar();
});

calendarNext.addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  selectedDateKey = toDateKey(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1));
  renderCalendar();
});

calendarMonth.addEventListener("change", () => {
  calendarDate = new Date(Number(calendarYear.value), Number(calendarMonth.value), 1);
  selectedDateKey = toDateKey(calendarDate);
  renderCalendar();
});

calendarYear.addEventListener("change", () => {
  calendarDate = new Date(Number(calendarYear.value), Number(calendarMonth.value), 1);
  selectedDateKey = toDateKey(calendarDate);
  renderCalendar();
});

studentLogout.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/login.html?logout=1";
  }
});

loadStudentArea();
