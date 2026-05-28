const tableBody = document.getElementById("payments-table");
const usersTableBody = document.getElementById("users-table");
const feedback = document.getElementById("gestao-feedback");
const statusFilter = document.getElementById("status-filter");
const accessFilter = document.getElementById("access-filter");
const refreshBtn = document.getElementById("refresh-btn");
const professorLogout = document.getElementById("professor-logout");
const shell = document.querySelector(".gestao-shell");
const menuToggle = document.getElementById("menu-toggle");
const moduleLinks = document.querySelectorAll(".module-link");
const modulePanels = document.querySelectorAll(".module-panel");
const moduleKicker = document.getElementById("module-kicker");
const moduleTitle = document.getElementById("module-title");
const paymentsTableView = document.getElementById("payments-table-view");
const usersTableView = document.getElementById("users-table-view");
const pdfForm = document.getElementById("pdf-form");
const videoForm = document.getElementById("video-form");
const announcementForm = document.getElementById("announcement-form");
const gradeForm = document.getElementById("grade-form");
const teacherEventForm = document.getElementById("teacher-event-form");
const courseForm = document.getElementById("course-form");
const planForm = document.getElementById("plan-form");
const pdfFeedback = document.getElementById("pdf-feedback");
const videoFeedback = document.getElementById("video-feedback");
const announcementFeedback = document.getElementById("announcement-feedback");
const gradeFeedback = document.getElementById("grade-feedback");
const teacherEventsFeedback = document.getElementById("teacher-events-feedback");
const catalogFeedback = document.getElementById("catalog-feedback");
const pdfList = document.getElementById("pdf-list");
const videoList = document.getElementById("video-list");
const announcementList = document.getElementById("announcement-list");
const gradeList = document.getElementById("grade-list");
const teacherEventsList = document.getElementById("teacher-events-list");
const teacherEventsCalendar = document.getElementById("teacher-events-calendar");
const teacherSelectedDayEvents = document.getElementById("teacher-selected-day-events");
const teacherCalendarPrev = document.getElementById("teacher-calendar-prev");
const teacherCalendarNext = document.getElementById("teacher-calendar-next");
const teacherCalendarMonth = document.getElementById("teacher-calendar-month");
const teacherCalendarYear = document.getElementById("teacher-calendar-year");
const catalogList = document.getElementById("catalog-list");
const gradeUser = document.getElementById("grade-user");
const teacherEventTarget = document.getElementById("teacher-event-target");
const pdfTarget = document.getElementById("pdf-target");
const videoTarget = document.getElementById("video-target");
const announcementTarget = document.getElementById("announcement-target");
const planCourse = document.getElementById("plan-course");
const courseCancel = document.getElementById("course-cancel");
const planCancel = document.getElementById("plan-cancel");
const addCourseShortcut = document.getElementById("add-course-shortcut");
const catalogEditor = document.getElementById("catalog-editor");
const catalogEditorTitle = document.getElementById("catalog-editor-title");
const catalogEditorClose = document.getElementById("catalog-editor-close");
const tabs = document.querySelectorAll(".tab");
let currentView = "payments";
let currentModule = "access";
let gradeUsers = [];
let audienceUsers = [];
let paymentCatalog = [];
let teacherEvents = [];
let teacherCalendarDate = new Date();
let teacherSelectedDateKey = toDateKey(new Date());

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

const statusLabels = {
  pendente: "Por pagar",
  em_atendimento: "Em atendimento",
  pago: "Pago",
  cancelado: "Cancelado",
};

const accessLabels = {
  aguardando_pagamento: "Aguardando pagamento",
  ativo: "Ativo",
  pausado: "Pausado",
  bloqueado: "Bloqueado",
};

const subjectOptions = ["Português", "História", "Espanhol"];

if (window.matchMedia("(max-width: 720px)").matches) {
  shell.classList.add("sidebar-collapsed");
}

const moduleLabels = {
  access: {
    kicker: "Principal",
    title: "Gestão de acesso",
  },
  pdfs: {
    kicker: "Módulos",
    title: "Postar PDFs",
  },
  videos: {
    kicker: "Vídeo aulas",
    title: "Postar vídeo aulas",
  },
  announcements: {
    kicker: "Comunicados",
    title: "Comunicados para alunos",
  },
  events: {
    kicker: "Calendário",
    title: "Eventos dos alunos",
  },
  grades: {
    kicker: "Notas",
    title: "Notas dos alunos",
  },
  paymentCatalog: {
    kicker: "Pagamentos",
    title: "Cursos e planos",
  },
};

function setFeedback(message = "", type = "") {
  feedback.textContent = message;
  feedback.classList.remove("is-success", "is-error");

  if (type) {
    feedback.classList.add(type === "error" ? "is-error" : "is-success");
  }
}

function setLocalFeedback(target, message = "", type = "") {
  target.textContent = message;
  target.classList.remove("is-success", "is-error");

  if (type) {
    target.classList.add(type === "error" ? "is-error" : "is-success");
  }
}

function setModule(moduleName) {
  currentModule = moduleName;
  moduleLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.module === moduleName);
  });
  modulePanels.forEach((panel) => {
    panel.hidden = panel.id !== `${moduleName}-module`;
  });

  moduleKicker.textContent = moduleLabels[moduleName].kicker;
  moduleTitle.textContent = moduleLabels[moduleName].title;
  moduleKicker.parentElement.hidden = false;

  if (moduleName === "access") {
    loadCurrentView().catch((error) => setFeedback(error.message, "error"));
  }

  if (moduleName === "pdfs") {
    loadMaterials("pdf").catch((error) => setLocalFeedback(pdfFeedback, error.message, "error"));
  }

  if (moduleName === "videos") {
    loadMaterials("video").catch((error) => setLocalFeedback(videoFeedback, error.message, "error"));
  }

  if (moduleName === "announcements") {
    loadAnnouncements().catch((error) => {
      setLocalFeedback(announcementFeedback, error.message, "error");
    });
  }

  if (moduleName === "events") {
    loadTeacherEvents().catch((error) => {
      setLocalFeedback(teacherEventsFeedback, error.message, "error");
    });
  }

  if (moduleName === "grades") {
    loadGrades().catch((error) => {
      setLocalFeedback(gradeFeedback, error.message, "error");
    });
  }

  if (moduleName === "paymentCatalog") {
    loadPaymentCatalog().catch((error) => {
      setLocalFeedback(catalogFeedback, error.message, "error");
    });
  }

  if (window.matchMedia("(max-width: 720px)").matches) {
    shell.classList.add("sidebar-collapsed");
  }
}

function setView(view) {
  currentView = view;
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === view);
  });
  paymentsTableView.hidden = view !== "payments";
  usersTableView.hidden = view !== "users";
  statusFilter.hidden = view !== "payments";
  accessFilter.hidden = view !== "users";
  loadCurrentView().catch((error) => setFeedback(error.message, "error"));
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

function getPaymentClosingLabel() {
  const today = new Date();
  const closingDate = new Date(today.getFullYear(), today.getMonth(), 5, 12);

  if (today.getDate() > 5) {
    closingDate.setMonth(closingDate.getMonth() + 1);
  }

  return `Fecha dia 5 · ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(closingDate)}`;
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameMonth(first, second) {
  return first.getMonth() === second.getMonth() && first.getFullYear() === second.getFullYear();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function renderUserAvatar(user) {
  if (user.avatarUrl) {
    return `
      <img
        class="student-login-avatar"
        src="${escapeHtml(user.avatarUrl)}"
        alt="Foto de ${escapeHtml(user.name)}"
      >
    `;
  }

  return `
    <span class="student-login-avatar student-login-avatar-fallback">
      <i class="bi bi-person"></i>
    </span>
  `;
}

function renderMaterials(type, materials) {
  const list = type === "pdf" ? pdfList : videoList;
  const emptyMessage = type === "pdf"
    ? "Nenhum PDF publicado ainda."
    : "Nenhuma vídeo aula publicada ainda.";

  if (!materials.length) {
    list.innerHTML = `<p class="text-muted mb-0">${emptyMessage}</p>`;
    return;
  }

  list.innerHTML = materials
    .map((material) => {
      const subjectOptionsHtml = subjectOptions
        .map((subject) => {
          const selected = material.subject === subject ? "selected" : "";
          return `<option value="${escapeHtml(subject)}" ${selected}>${escapeHtml(subject)}</option>`;
        })
        .join("");
      const targetOptionsHtml = buildAudienceOptions(material.target_user_id || "");
      const audience = material.target_user
        ? `${material.target_user.email || material.target_user.phoneNumber || material.target_user.name}`
        : "Todos os alunos";

      return `
        <article class="material-item" data-material-id="${material.id}" data-material-type="${type}">
          <div class="material-summary">
            <h3>${escapeHtml(material.title)}</h3>
            <div class="material-meta">
              ${escapeHtml(audience)} · ${escapeHtml(material.subject || "Sem matéria")} · ${escapeHtml(material.module || "Sem módulo")} · ${formatFileSize(material.size_bytes)} · ${formatDate(material.created_at)}
            </div>
            <p class="mb-0 mt-2 text-muted">${escapeHtml(material.description || "Sem descrição.")}</p>
          </div>
          <div class="material-actions">
            <a class="btn btn-outline-dark rounded-pill btn-sm" href="/api/gestao/materials/${material.id}/file" target="_blank" rel="noreferrer">
              <i class="bi bi-box-arrow-up-right"></i>
              Abrir
            </a>
            <button class="btn btn-outline-dark rounded-pill btn-sm material-edit-toggle" type="button" data-material-id="${material.id}">
              <i class="bi bi-pencil"></i>
              Editar
            </button>
            <button class="btn btn-outline-danger rounded-pill btn-sm material-delete" type="button" data-material-id="${material.id}" data-material-type="${type}">
              <i class="bi bi-trash"></i>
              Apagar
            </button>
          </div>
          <form class="material-edit-form mt-3" data-material-id="${material.id}" data-material-type="${type}" hidden>
            <div class="row g-3">
              <div class="col-md-5">
                <label class="form-label">Título</label>
                <input class="form-control" type="text" name="title" value="${escapeHtml(material.title)}" required>
              </div>
              <div class="col-md-4">
                <label class="form-label">Enviar para</label>
                <select class="form-select" name="targetUserId" required>
                  ${targetOptionsHtml}
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label">Disciplina</label>
                <select class="form-select" name="subject" required>
                  ${subjectOptionsHtml}
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label">Módulo</label>
                <input class="form-control" type="text" name="module" value="${escapeHtml(material.module || "")}">
              </div>
              <div class="col-md-12">
                <label class="form-label">Descrição</label>
                <input class="form-control" type="text" name="description" value="${escapeHtml(material.description || "")}">
              </div>
            </div>
            <div class="d-flex gap-2 flex-wrap mt-3">
              <button class="btn btn-dark rounded-pill btn-sm" type="submit">Salvar alterações</button>
              <button class="btn btn-outline-dark rounded-pill btn-sm material-edit-cancel" type="button">Cancelar</button>
            </div>
          </form>
        </article>
      `;
    })
    .join("");

  list.querySelectorAll(".material-edit-toggle").forEach((button) => {
    button.addEventListener("click", () => toggleMaterialEdit(button.dataset.materialId));
  });

  list.querySelectorAll(".material-edit-cancel").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(".material-edit-form").hidden = true;
    });
  });

  list.querySelectorAll(".material-edit-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      updateMaterial(form);
    });
  });

  list.querySelectorAll(".material-delete").forEach((button) => {
    button.addEventListener("click", () => deleteMaterial(button));
  });
}

function renderAnnouncements(announcements) {
  if (!announcements.length) {
    announcementList.innerHTML = `<p class="text-muted mb-0">Nenhum comunicado publicado ainda.</p>`;
    return;
  }

  announcementList.innerHTML = announcements
    .map((announcement) => {
      const media =
        announcement.media_type === "video"
          ? `<video class="announcement-media" controls src="/api/gestao/announcements/${announcement.id}/media"></video>`
          : announcement.media_type === "audio"
            ? `<audio class="announcement-media" controls src="/api/gestao/announcements/${announcement.id}/media"></audio>`
          : "";
      const audience = announcement.target_user
        ? `${announcement.target_user.email || announcement.target_user.phoneNumber || announcement.target_user.name}`
        : "Todos os alunos";
      return `
        <article class="material-item">
          <div class="material-summary">
            <h3>${escapeHtml(announcement.title)}</h3>
            <div class="material-meta">
              ${escapeHtml(audience)} · ${escapeHtml(announcement.subject || "Todas as matérias")} · ${escapeHtml(announcement.module || "Sem módulo")} · ${formatDate(announcement.created_at)}
            </div>
            <p class="mb-0 mt-2 text-muted">${escapeHtml(announcement.body)}</p>
            ${media}
          </div>
          <div class="material-actions">
            <button class="btn btn-outline-danger rounded-pill btn-sm announcement-delete" type="button" data-announcement-id="${announcement.id}">
              <i class="bi bi-trash"></i>
              Apagar
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  announcementList.querySelectorAll(".announcement-delete").forEach((button) => {
    button.addEventListener("click", () => deleteAnnouncement(button));
  });
}

function buildAudienceOptions(selectedUserId = "") {
  const students = audienceUsers.filter((user) => user.role !== "gestao");
  const options = students
    .map((user) => {
      const login = user.email || user.phoneNumber || user.id;
      const name = user.name ? ` - ${user.name}` : "";
      const selected = String(user.id) === String(selectedUserId) ? "selected" : "";
      return `<option value="${escapeHtml(user.id)}" ${selected}>${escapeHtml(login)}${escapeHtml(name)}</option>`;
    })
    .join("");

  return `<option value="" ${selectedUserId ? "" : "selected"}>Todos os alunos</option>${options}`;
}

function renderAudienceTargets(users) {
  audienceUsers = users;
  const options = buildAudienceOptions("");
  [pdfTarget, videoTarget, announcementTarget].forEach((select) => {
    if (select) {
      select.innerHTML = options;
    }
  });
}

function formatGradeValue(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  });
}

function renderGradeUsers(users) {
  gradeUsers = users
    .filter((user) => user.email || user.phoneNumber || user.id)
    .sort((first, second) => {
      const firstName = first.name || first.email || first.phoneNumber || first.id;
      const secondName = second.name || second.email || second.phoneNumber || second.id;
      return firstName.localeCompare(secondName, "pt-BR");
    });

  if (!gradeUsers.length) {
    gradeUser.innerHTML = `<option value="">Nenhum login cadastrado</option>`;
    return;
  }

  gradeUser.innerHTML = `
    <option value="">Selecione pelo nome</option>
    ${gradeUsers
      .map((user) => {
        const login = user.email || user.phoneNumber || user.id;
        const name = user.name || "Aluno sem nome";
        return `
          <option value="${escapeHtml(user.id)}">
            ${escapeHtml(name)} - ${escapeHtml(login)}
          </option>
        `;
      })
      .join("")}
  `;
}

function renderGrades(grades) {
  if (!grades.length) {
    gradeList.innerHTML = `<p class="text-muted mb-0">Nenhuma nota registrada ainda.</p>`;
    return;
  }

  gradeList.innerHTML = grades
    .map((grade) => {
      const percentage = Math.round((Number(grade.score) / Number(grade.max_score || 1)) * 100);
      const studentName = grade.user?.name || grade.user_id;
      const studentContact = grade.user?.email || grade.user?.phoneNumber || "Sem contato";

      return `
        <article class="material-item">
          <div class="material-summary">
            <h3>${escapeHtml(grade.title)}</h3>
            <div class="material-meta">
              ${escapeHtml(studentName)} · ${escapeHtml(studentContact)} · ${escapeHtml(grade.subject)} · ${formatDate(grade.created_at)}
            </div>
            <p class="mb-0 mt-2">
              <strong>${formatGradeValue(grade.score)}</strong> de ${formatGradeValue(grade.max_score)}
              <span class="grade-percent">${percentage}%</span>
            </p>
            <p class="mb-0 mt-2 text-muted">${escapeHtml(grade.notes || "Sem observação.")}</p>
          </div>
          <div class="material-actions">
            <button class="btn btn-outline-danger rounded-pill btn-sm grade-delete" type="button" data-grade-id="${grade.id}">
              <i class="bi bi-trash"></i>
              Apagar
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  gradeList.querySelectorAll(".grade-delete").forEach((button) => {
    button.addEventListener("click", () => deleteGrade(button));
  });
}

function renderTeacherEventTargets(users) {
  const students = users.filter((user) => user.role !== "gestao");
  const options = students
    .map((user) => {
      const login = user.email || user.phoneNumber || user.id;
      const name = user.name ? ` - ${user.name}` : "";
      return `<option value="${escapeHtml(login)}">${escapeHtml(login)}${escapeHtml(name)}</option>`;
    })
    .join("");

  teacherEventTarget.innerHTML = `
    <option value="all">Todos os alunos</option>
    <option value="professor">Minha agenda (professor)</option>
    ${options}
  `;
}

function setupTeacherCalendarControls() {
  teacherCalendarMonth.innerHTML = monthNames
    .map((month, index) => `<option value="${index}">${month}</option>`)
    .join("");
  teacherCalendarMonth.value = String(teacherCalendarDate.getMonth());
  teacherCalendarYear.value = String(teacherCalendarDate.getFullYear());
}

function teacherEventsByDate() {
  return teacherEvents.reduce((groups, event) => {
    const key = toDateKey(event.starts_at);
    groups[key] = groups[key] || [];
    groups[key].push(event);
    return groups;
  }, {});
}

function setTeacherEventFormDate(dateKey) {
  const field = teacherEventForm.elements.startsAt;
  if (!field.value || field.value.slice(0, 10) !== dateKey) {
    field.value = `${dateKey}T09:00`;
  }
}

function renderTeacherSelectedDayEvents(groups) {
  const events = groups[teacherSelectedDateKey] || [];
  const dateLabel = formatDate(`${teacherSelectedDateKey}T12:00:00`);

  if (!events.length) {
    teacherSelectedDayEvents.innerHTML = `
      <article class="material-item">
        <div class="material-summary">
          <h3>${dateLabel}</h3>
          <p class="text-muted mb-0">Nenhum evento neste dia. Clique em um dia e preencha o formulário abaixo para adicionar.</p>
        </div>
      </article>
    `;
    return;
  }

  teacherSelectedDayEvents.innerHTML = events
    .map((event) => {
      const owner = event.user?.name || event.user_id;
      const login = event.user?.email || event.user?.phoneNumber || "";
      return `
        <article class="material-item">
          <div class="material-summary">
            <h3>${escapeHtml(event.title)}</h3>
            <div class="material-meta">
              ${escapeHtml(owner)} ${login ? `· ${escapeHtml(login)}` : ""} · ${escapeHtml(event.subject || "Sem disciplina")} · ${formatDate(event.starts_at)}
            </div>
            <p class="mb-0 mt-2 text-muted">${escapeHtml(event.notes || "Sem observação.")}</p>
          </div>
          <div class="material-actions">
            <button class="btn btn-outline-danger rounded-pill btn-sm teacher-event-delete" type="button" data-event-id="${event.id}">
              <i class="bi bi-trash"></i>
              Apagar
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  teacherSelectedDayEvents.querySelectorAll(".teacher-event-delete").forEach((button) => {
    button.addEventListener("click", () => deleteTeacherEvent(button));
  });
}

function renderTeacherCalendar() {
  setupTeacherCalendarControls();
  const groups = teacherEventsByDate();
  const year = teacherCalendarDate.getFullYear();
  const month = teacherCalendarDate.getMonth();
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
    const muted = sameMonth(date, teacherCalendarDate) ? "" : " is-muted";
    const selected = key === teacherSelectedDateKey ? " is-selected" : "";
    const today = key === todayKey ? " is-today" : "";
    const expanded = key === teacherSelectedDateKey && dayEvents.length ? " is-expanded" : "";
    const labels = dayEvents
      .slice(0, 2)
      .map((event) => {
        const owner = event.user?.email || event.user?.phoneNumber || event.user?.name || "Agenda";
        return `<span class="calendar-event-chip">${escapeHtml(event.title)} · ${escapeHtml(owner)}</span>`;
      })
      .join("");
    const extra = dayEvents.length > 2
      ? `<span class="calendar-event-more">+${dayEvents.length - 2}</span>`
      : "";
    const expandedDetails = expanded
      ? `<span class="calendar-expanded-events">
          ${dayEvents
            .map((event) => {
              const owner = event.user?.email || event.user?.phoneNumber || event.user?.name || "Agenda";
              return `<span class="calendar-expanded-item">
                <strong>${escapeHtml(event.title)}</strong>
                <small>${escapeHtml(owner)} · ${escapeHtml(event.subject || "Sem disciplina")} · ${formatDate(event.starts_at)}</small>
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

  teacherEventsCalendar.innerHTML = cells.join("");
  teacherEventsCalendar.querySelectorAll(".calendar-day").forEach((button) => {
    button.addEventListener("click", () => {
      teacherSelectedDateKey = button.dataset.date;
      const nextDate = new Date(`${teacherSelectedDateKey}T12:00:00`);
      if (!sameMonth(nextDate, teacherCalendarDate)) {
        teacherCalendarDate = nextDate;
      }
      setTeacherEventFormDate(teacherSelectedDateKey);
      renderTeacherCalendar();
    });
  });
  renderTeacherSelectedDayEvents(groups);
}

function renderTeacherEvents(events) {
  teacherEvents = events;
  renderTeacherCalendar();

  if (!events.length) {
    teacherEventsList.innerHTML = `<p class="text-muted mb-0">Nenhum evento cadastrado ainda.</p>`;
    return;
  }

  teacherEventsList.innerHTML = events
    .map((event) => {
      const owner = event.user?.name || event.user_id;
      const login = event.user?.email || event.user?.phoneNumber || "";
      return `
        <article class="material-item">
          <div class="material-summary">
            <h3>${escapeHtml(event.title)}</h3>
            <div class="material-meta">
              ${escapeHtml(owner)} ${login ? `· ${escapeHtml(login)}` : ""} · ${escapeHtml(event.subject || "Sem disciplina")} · ${formatDate(event.starts_at)}
            </div>
            <p class="mb-0 mt-2 text-muted">${escapeHtml(event.notes || "Sem observação.")}</p>
          </div>
          <div class="material-actions">
            <button class="btn btn-outline-danger rounded-pill btn-sm teacher-event-delete" type="button" data-event-id="${event.id}">
              <i class="bi bi-trash"></i>
              Apagar
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  teacherEventsList.querySelectorAll(".teacher-event-delete").forEach((button) => {
    button.addEventListener("click", () => deleteTeacherEvent(button));
  });
}

function renderPlanCourseOptions() {
  const courses = [...paymentCatalog].sort((first, second) => {
    return String(first.name || "").localeCompare(String(second.name || ""), "pt-BR");
  });

  if (!courses.length) {
    planCourse.innerHTML = `<option value="">Cadastre um curso primeiro</option>`;
    return;
  }

  planCourse.innerHTML = `
    <option value="">Selecione o curso</option>
    ${courses
      .map((course) => {
        const status = course.is_active ? "" : " (oculto)";
        return `<option value="${course.id}">${escapeHtml(course.name)}${status}</option>`;
      })
      .join("")}
  `;
}

function renderPaymentCatalog(courses, allCourses = courses) {
  paymentCatalog = allCourses.length ? allCourses : courses;
  renderPlanCourseOptions();

  if (!courses.length) {
    catalogList.innerHTML = `<p class="text-muted mb-0">Nenhum curso cadastrado ainda.</p>`;
    return;
  }

  const courseSections = courses
    .map((course) => {
      const status = course.is_active ? "Visível" : "Oculto";
      const plans = (course.plans || [])
        .map((plan) => {
          const features = (plan.features || [])
            .map((feature) => `<li>✓ ${escapeHtml(feature)}</li>`)
            .join("");
          const badge = plan.badge
            ? `<span class="badge-highlight catalog-badge">${escapeHtml(plan.badge)}</span>`
            : "";
          const highlighted = plan.is_highlighted ? " destaque" : "";

          return `
            <div class="catalog-preview-card${highlighted}" data-plan-id="${plan.id}">
              ${badge}
              <div class="catalog-preview-body">
                <h4>${escapeHtml(plan.title)}</h4>
                <p class="text-muted">${escapeHtml(plan.subtitle || course.name)}</p>
                <div class="catalog-preview-price">${escapeHtml(plan.price_text)}</div>
                ${
                  plan.secondary_price_text
                    ? `<small class="text-muted">${escapeHtml(plan.secondary_price_text)}</small>`
                    : ""
                }
                <ul class="list-unstyled mt-4">${features}</ul>
              </div>
              <div class="catalog-preview-actions">
                <button class="btn btn-plan-admin plan-edit" type="button" data-plan-id="${plan.id}">
                  <i class="bi bi-pencil"></i>
                  Editar
                </button>
                <button class="btn btn-outline-danger rounded-circle btn-sm icon-btn plan-delete" type="button" data-plan-id="${plan.id}" aria-label="Apagar plano">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      return `
        <section class="catalog-preview-section" data-course-id="${course.id}">
          <div class="catalog-course-header">
            <div>
              <h3>${escapeHtml(course.icon)} ${escapeHtml(course.name)}</h3>
              <p class="text-muted mb-0">
                ${escapeHtml(course.description || "Sem descrição.")} · Ordem ${course.sort_order} · ${status}
              </p>
            </div>
            <div class="catalog-course-actions">
              <button class="btn btn-dark rounded-pill btn-sm course-add-plan" type="button" data-course-id="${course.id}">
                <i class="bi bi-plus-lg"></i>
                Adicionar plano
              </button>
              <button class="btn btn-outline-dark rounded-pill btn-sm course-edit" type="button" data-course-id="${course.id}">
                <i class="bi bi-pencil"></i>
                Editar curso
              </button>
              <button class="btn btn-outline-danger rounded-pill btn-sm course-delete" type="button" data-course-id="${course.id}">
                <i class="bi bi-trash"></i>
                Apagar curso
              </button>
            </div>
          </div>
          <div class="catalog-preview-grid">
            ${plans || `<p class="text-muted mb-0">Nenhum plano neste curso. Clique em Adicionar plano.</p>`}
          </div>
        </section>
      `;
    })
    .join("");

  catalogList.innerHTML = `
    <div class="catalog-payment-hero">
      <h3>Escolha seu plano de estudos</h3>
      <p>Selecione a matéria e o plano desejado</p>
    </div>
    ${courseSections}
  `;

  catalogList.querySelectorAll(".course-edit").forEach((button) => {
    button.addEventListener("click", () => editCourse(button.dataset.courseId));
  });
  catalogList.querySelectorAll(".course-delete").forEach((button) => {
    button.addEventListener("click", () => deleteCourse(button));
  });
  catalogList.querySelectorAll(".course-add-plan").forEach((button) => {
    button.addEventListener("click", () => startPlanForCourse(button.dataset.courseId));
  });
  catalogList.querySelectorAll(".plan-edit").forEach((button) => {
    button.addEventListener("click", () => editPlan(button.dataset.planId));
  });
  catalogList.querySelectorAll(".plan-delete").forEach((button) => {
    button.addEventListener("click", () => deletePlan(button));
  });
}

function renderUsers(users) {
  if (!users.length) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">Nenhum login encontrado.</td>
      </tr>
    `;
    return;
  }

  usersTableBody.innerHTML = users
    .map((user) => {
      const accessOptions = Object.entries(accessLabels)
        .map(([value, label]) => {
          const selected = user.accessStatus === value ? "selected" : "";
          return `<option value="${value}" ${selected}>${label}</option>`;
        })
        .join("");
      const userSubjects = Array.isArray(user.subjects) ? user.subjects : [];
      const subjectControls = subjectOptions
        .map((subject) => {
          const checked = userSubjects.some((item) => {
            return item.toLowerCase() === subject.toLowerCase();
          })
            ? "checked"
            : "";
          return `
            <label class="subject-check">
              <input type="checkbox" value="${escapeHtml(subject)}" ${checked}>
              <span>${escapeHtml(subject)}</span>
            </label>
          `;
        })
        .join("");

      return `
        <tr>
          <td>
            <div class="student-login-cell">
              ${renderUserAvatar(user)}
              <div>
                <div class="fw-semibold">${escapeHtml(user.name)}</div>
                <small class="text-muted">${escapeHtml(user.id)}</small>
              </div>
            </div>
          </td>
          <td>
            <div>${escapeHtml(user.email || "Sem e-mail")}</div>
            <small class="text-muted">${escapeHtml(user.phoneNumber || "Sem telefone")}</small>
          </td>
          <td>
            <div class="subject-access" data-user-id="${user.id}">
              ${subjectControls}
              <button class="btn btn-outline-dark rounded-pill btn-sm subject-save" type="button" data-user-id="${user.id}">
                Salvar
              </button>
            </div>
          </td>
          <td><span class="badge-status">${accessLabels[user.accessStatus] || user.accessStatus}</span></td>
          <td>${formatDate(user.paidAt)}</td>
          <td>
            <select class="form-select access-select" data-user-id="${user.id}">
              ${accessOptions}
            </select>
          </td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll(".access-select").forEach((select) => {
    select.addEventListener("change", () => updateUserAccess(select));
  });

  document.querySelectorAll(".subject-save").forEach((button) => {
    button.addEventListener("click", () => updateUserSubjects(button));
  });
}

function renderPayments(payments) {
  if (!payments.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted py-4">Nenhum pedido encontrado.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = payments
    .map((payment) => {
      const statusOptions = Object.entries(statusLabels)
        .map(([value, label]) => {
          const selected = payment.status === value ? "selected" : "";
          return `<option value="${value}" ${selected}>${label}</option>`;
        })
        .join("");

      return `
        <tr>
          <td class="fw-semibold">#${payment.id}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(payment.user_name)}</div>
            <small class="text-muted">${escapeHtml(payment.user_id)}</small>
          </td>
          <td>
            <div>${escapeHtml(payment.user_email || "Sem e-mail")}</div>
            <small class="text-muted">${escapeHtml(payment.user_phone || "Sem telefone")}</small>
          </td>
          <td>
            <div class="fw-semibold">${escapeHtml(payment.materia)}</div>
            <small class="text-muted">${escapeHtml(payment.plano)}</small>
          </td>
          <td>
            <span class="badge-status">${getPaymentClosingLabel()}</span>
          </td>
          <td><span class="badge-status">${statusLabels[payment.status] || payment.status}</span></td>
          <td>${formatDate(payment.created_at)}</td>
          <td>
            <select class="form-select status-select" data-payment-id="${payment.id}">
              ${statusOptions}
            </select>
          </td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", () => updatePaymentStatus(select));
  });

}

async function loadUsers() {
  setFeedback("Carregando logins...", "success");
  const params = new URLSearchParams();

  if (accessFilter.value) {
    params.set("accessStatus", accessFilter.value);
  }

  const response = await fetch(`/api/gestao/users?${params}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível carregar os logins.");
  }

  renderUsers(data.users || []);
  setFeedback("Logins atualizados.", "success");
}

async function loadPayments() {
  setFeedback("Carregando pedidos...", "success");
  const params = new URLSearchParams();

  if (statusFilter.value) {
    params.set("status", statusFilter.value);
  }

  const response = await fetch(`/api/gestao/payments?${params}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível carregar os pedidos.");
  }

  renderPayments(data.payments || []);
  setFeedback("Pedidos atualizados.", "success");
}

async function loadMaterials(type) {
  const target = type === "pdf" ? pdfFeedback : videoFeedback;
  setLocalFeedback(target, "Carregando materiais...", "success");
  const response = await fetch(`/api/gestao/materials?type=${encodeURIComponent(type)}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível carregar os materiais.");
  }

  renderAudienceTargets(data.users || audienceUsers);
  renderMaterials(type, data.materials || []);
  setLocalFeedback(target, "Materiais atualizados.", "success");
}

async function loadAnnouncements() {
  setLocalFeedback(announcementFeedback, "Carregando comunicados...", "success");
  const response = await fetch("/api/gestao/announcements");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível carregar os comunicados.");
  }

  renderAudienceTargets(data.users || audienceUsers);
  renderAnnouncements(data.announcements || []);
  setLocalFeedback(announcementFeedback, "Comunicados atualizados.", "success");
}

async function loadGrades() {
  setLocalFeedback(gradeFeedback, "Carregando notas...", "success");
  const response = await fetch("/api/gestao/grades");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível carregar as notas.");
  }

  renderGradeUsers(data.users || []);
  renderGrades(data.grades || []);
  setLocalFeedback(gradeFeedback, "Notas atualizadas.", "success");
}

async function loadTeacherEvents() {
  setLocalFeedback(teacherEventsFeedback, "Carregando eventos...", "success");
  const response = await fetch("/api/gestao/events");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível carregar os eventos.");
  }

  renderTeacherEventTargets(data.users || []);
  renderTeacherEvents(data.events || []);
  setLocalFeedback(teacherEventsFeedback, "Eventos atualizados.", "success");
}

async function loadPaymentCatalog() {
  setLocalFeedback(catalogFeedback, "Carregando cursos e planos...", "success");
  const [publicResponse, managementResponse] = await Promise.all([
    fetch("/api/payment-catalog"),
    fetch("/api/gestao/payment-catalog"),
  ]);
  const publicData = await publicResponse.json().catch(() => ({}));
  const managementData = await managementResponse.json().catch(() => ({}));

  if (!publicResponse.ok) {
    throw new Error(publicData.message || "Não foi possível carregar os planos da tela de pagamento.");
  }

  if (!managementResponse.ok) {
    throw new Error(managementData.message || "Não foi possível carregar os dados de edição.");
  }

  const managementCourses = managementData.courses || [];
  const publicCourses = publicData.courses || [];
  const visibleManagementCourses = managementCourses
    .filter((course) => course.is_active)
    .map((course) => ({
      ...course,
      plans: (course.plans || []).filter((plan) => plan.is_active),
    }))
    .filter((course) => course.plans.length);
  const coursesToPreview = publicCourses.length
    ? publicCourses
    : visibleManagementCourses.length
      ? visibleManagementCourses
      : managementCourses;

  renderPaymentCatalog(coursesToPreview, managementCourses);
  setLocalFeedback(catalogFeedback, "Planos cadastrados carregados.", "success");
}

function loadCurrentView() {
  return currentView === "users" ? loadUsers() : loadPayments();
}

async function updatePaymentStatus(select) {
  const id = select.dataset.paymentId;
  const status = select.value;
  select.disabled = true;

  try {
    const response = await fetch(`/api/gestao/payments/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível atualizar o pedido.");
    }

    setFeedback(`Pedido #${id} atualizado.`, "success");
    await loadPayments();
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    select.disabled = false;
  }
}

async function updateUserAccess(select) {
  const id = select.dataset.userId;
  const accessStatus = select.value;
  select.disabled = true;

  try {
    const response = await fetch(`/api/gestao/users/${id}/access`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accessStatus }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível atualizar o acesso.");
    }

    setFeedback("Acesso do aluno atualizado.", "success");
    await loadUsers();
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    select.disabled = false;
  }
}

async function updateUserSubjects(button) {
  const id = button.dataset.userId;
  const container = document.querySelector(
    `.subject-access[data-user-id="${CSS.escape(id)}"]`
  );
  const subjects = Array.from(
    container.querySelectorAll("input[type='checkbox']:checked")
  ).map((input) => input.value);
  button.disabled = true;

  try {
    const response = await fetch(`/api/gestao/users/${id}/subjects`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subjects }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível atualizar as matérias.");
    }

    setFeedback("Matérias do aluno atualizadas.", "success");
    await loadUsers();
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

function toggleMaterialEdit(materialId) {
  const form = document.querySelector(
    `.material-edit-form[data-material-id="${CSS.escape(materialId)}"]`
  );
  form.hidden = !form.hidden;
}

async function updateMaterial(form) {
  const id = form.dataset.materialId;
  const type = form.dataset.materialType;
  const feedbackTarget = type === "pdf" ? pdfFeedback : videoFeedback;
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);

  try {
    submitButton.disabled = true;
    setLocalFeedback(feedbackTarget, "Salvando alterações...", "success");
    const response = await fetch(`/api/gestao/materials/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: formData.get("title"),
        subject: formData.get("subject"),
        module: formData.get("module"),
        description: formData.get("description"),
        targetUserId: formData.get("targetUserId"),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível editar o material.");
    }

    setLocalFeedback(feedbackTarget, data.message, "success");
    await loadMaterials(type);
  } catch (error) {
    setLocalFeedback(feedbackTarget, error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function publishAnnouncement(form) {
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);

  try {
    submitButton.disabled = true;
    setLocalFeedback(announcementFeedback, "Publicando comunicado...", "success");
    const response = await fetch("/api/gestao/announcements", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível publicar o comunicado.");
    }

    form.reset();
    setLocalFeedback(announcementFeedback, data.message, "success");
    await loadAnnouncements();
  } catch (error) {
    setLocalFeedback(announcementFeedback, error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function createGrade(form) {
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);

  try {
    submitButton.disabled = true;
    setLocalFeedback(gradeFeedback, "Registrando nota...", "success");
    const response = await fetch("/api/gestao/grades", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: formData.get("userId"),
        subject: formData.get("subject"),
        title: formData.get("title"),
        score: formData.get("score"),
        maxScore: formData.get("maxScore"),
        notes: formData.get("notes"),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível registrar a nota.");
    }

    const selectedUserId = gradeUser.value;
    form.reset();
    gradeUser.value = selectedUserId;
    form.elements.maxScore.value = "10";
    setLocalFeedback(gradeFeedback, data.message, "success");
    await loadGrades();
  } catch (error) {
    setLocalFeedback(gradeFeedback, error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function createTeacherEvent(form) {
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);

  try {
    if (!formData.get("target")) {
      throw new Error("Selecione um login ou escolha todos os alunos.");
    }

    if (!formData.get("title") || !formData.get("startsAt")) {
      throw new Error("Preencha o título, a data e a hora do evento.");
    }

    submitButton.disabled = true;
    setLocalFeedback(teacherEventsFeedback, "Criando evento...", "success");
    const response = await fetch("/api/gestao/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: formData.get("target"),
        title: formData.get("title"),
        subject: formData.get("subject"),
        startsAt: formData.get("startsAt"),
        notes: formData.get("notes"),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Não foi possível criar o evento. Código ${response.status}.`);
    }

    const selectedTarget = teacherEventTarget.value;
    const selectedDate = form.elements.startsAt.value;
    form.reset();
    teacherEventTarget.value = selectedTarget;
    form.elements.startsAt.value = selectedDate;
    setLocalFeedback(teacherEventsFeedback, data.message, "success");
    await loadTeacherEvents();
  } catch (error) {
    setLocalFeedback(teacherEventsFeedback, error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteAnnouncement(button) {
  if (!window.confirm("Apagar este comunicado?")) {
    return;
  }

  try {
    button.disabled = true;
    const response = await fetch(`/api/gestao/announcements/${button.dataset.announcementId}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível apagar o comunicado.");
    }

    setLocalFeedback(announcementFeedback, data.message, "success");
    await loadAnnouncements();
  } catch (error) {
    setLocalFeedback(announcementFeedback, error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function deleteGrade(button) {
  if (!window.confirm("Apagar esta nota?")) {
    return;
  }

  try {
    button.disabled = true;
    const response = await fetch(`/api/gestao/grades/${button.dataset.gradeId}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível apagar a nota.");
    }

    setLocalFeedback(gradeFeedback, data.message, "success");
    await loadGrades();
  } catch (error) {
    setLocalFeedback(gradeFeedback, error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function deleteTeacherEvent(button) {
  if (!window.confirm("Apagar este evento?")) {
    return;
  }

  try {
    button.disabled = true;
    const response = await fetch(`/api/gestao/events/${button.dataset.eventId}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível apagar o evento.");
    }

    setLocalFeedback(teacherEventsFeedback, data.message, "success");
    await loadTeacherEvents();
  } catch (error) {
    setLocalFeedback(teacherEventsFeedback, error.message, "error");
  } finally {
    button.disabled = false;
  }
}

function resetCourseForm() {
  courseForm.reset();
  courseForm.elements.id.value = "";
  courseForm.elements.sortOrder.value = "0";
  courseForm.elements.isActive.checked = true;
  courseCancel.hidden = true;
}

function resetPlanForm() {
  planForm.reset();
  planForm.elements.id.value = "";
  planForm.elements.sortOrder.value = "0";
  planForm.elements.isActive.checked = true;
  planForm.elements.isHighlighted.checked = false;
  planCancel.hidden = true;
}

function showCatalogEditor(title) {
  renderPlanCourseOptions();
  catalogEditor.hidden = false;
  catalogEditorTitle.textContent = title;
}

function hideCatalogEditor() {
  catalogEditor.hidden = true;
  resetCourseForm();
  resetPlanForm();
}

function findCourse(courseId) {
  return paymentCatalog.find((course) => String(course.id) === String(courseId));
}

function findPlan(planId) {
  for (const course of paymentCatalog) {
    const plan = (course.plans || []).find((item) => String(item.id) === String(planId));
    if (plan) {
      return plan;
    }
  }
  return null;
}

function editCourse(courseId) {
  const course = findCourse(courseId);
  if (!course) {
    return;
  }

  courseForm.elements.id.value = course.id;
  courseForm.elements.name.value = course.name || "";
  courseForm.elements.icon.value = course.icon || "";
  courseForm.elements.description.value = course.description || "";
  courseForm.elements.sortOrder.value = course.sort_order || 0;
  courseForm.elements.isActive.checked = Boolean(course.is_active);
  courseCancel.hidden = false;
  showCatalogEditor(`Editar curso: ${course.name}`);
  courseForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editPlan(planId) {
  const plan = findPlan(planId);
  if (!plan) {
    return;
  }

  planForm.elements.id.value = plan.id;
  planForm.elements.courseId.value = plan.course_id;
  planForm.elements.title.value = plan.title || "";
  planForm.elements.subtitle.value = plan.subtitle || "";
  planForm.elements.priceText.value = plan.price_text || "";
  planForm.elements.secondaryPriceText.value = plan.secondary_price_text || "";
  planForm.elements.features.value = (plan.features || []).join("\n");
  planForm.elements.badge.value = plan.badge || "";
  planForm.elements.sortOrder.value = plan.sort_order || 0;
  planForm.elements.isHighlighted.checked = Boolean(plan.is_highlighted);
  planForm.elements.isActive.checked = Boolean(plan.is_active);
  planCancel.hidden = false;
  showCatalogEditor(`Editar plano: ${plan.title}`);
  planForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function startPlanForCourse(courseId) {
  resetPlanForm();
  let course = findCourse(courseId);

  if (!course) {
    const previewCourses = Array.from(catalogList.querySelectorAll(".catalog-preview-section"))
      .map((section) => {
        return {
          id: section.dataset.courseId,
          name: section.querySelector("h3")?.textContent?.trim() || "Curso",
          is_active: true,
        };
      });
    paymentCatalog = previewCourses;
    renderPlanCourseOptions();
    course = findCourse(courseId);
  }

  planForm.elements.courseId.value = courseId;
  showCatalogEditor(`Adicionar plano${course ? ` em ${course.name}` : ""}`);
  planForm.scrollIntoView({ behavior: "smooth", block: "start" });
  planForm.elements.title.focus();
}

async function saveCourse(form) {
  const formData = new FormData(form);
  const id = formData.get("id");
  const endpoint = id ? `/api/gestao/payment-courses/${id}` : "/api/gestao/payment-courses";
  const method = id ? "PATCH" : "POST";

  const response = await fetch(endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: formData.get("name"),
      icon: formData.get("icon"),
      description: formData.get("description"),
      sortOrder: formData.get("sortOrder"),
      isActive: form.elements.isActive.checked,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível salvar o curso.");
  }

  setLocalFeedback(catalogFeedback, data.message, "success");
  resetCourseForm();
  catalogEditor.hidden = true;
  await loadPaymentCatalog();
}

async function savePlan(form) {
  const formData = new FormData(form);
  const id = formData.get("id");
  const endpoint = id ? `/api/gestao/payment-plans/${id}` : "/api/gestao/payment-plans";
  const method = id ? "PATCH" : "POST";

  const response = await fetch(endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      courseId: formData.get("courseId"),
      title: formData.get("title"),
      subtitle: formData.get("subtitle"),
      priceText: formData.get("priceText"),
      secondaryPriceText: formData.get("secondaryPriceText"),
      features: String(formData.get("features") || "").split("\n"),
      badge: formData.get("badge"),
      sortOrder: formData.get("sortOrder"),
      isHighlighted: form.elements.isHighlighted.checked,
      isActive: form.elements.isActive.checked,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível salvar o plano.");
  }

  setLocalFeedback(catalogFeedback, data.message, "success");
  resetPlanForm();
  catalogEditor.hidden = true;
  await loadPaymentCatalog();
}

async function deleteCourse(button) {
  if (!window.confirm("Apagar este curso? Os planos dele também serão apagados.")) {
    return;
  }

  const response = await fetch(`/api/gestao/payment-courses/${button.dataset.courseId}`, {
    method: "DELETE",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível apagar o curso.");
  }

  setLocalFeedback(catalogFeedback, data.message, "success");
  await loadPaymentCatalog();
}

async function deletePlan(button) {
  if (!window.confirm("Apagar este plano?")) {
    return;
  }

  const response = await fetch(`/api/gestao/payment-plans/${button.dataset.planId}`, {
    method: "DELETE",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Não foi possível apagar o plano.");
  }

  setLocalFeedback(catalogFeedback, data.message, "success");
  await loadPaymentCatalog();
}

async function deleteMaterial(button) {
  const id = button.dataset.materialId;
  const type = button.dataset.materialType;
  const feedbackTarget = type === "pdf" ? pdfFeedback : videoFeedback;

  if (!window.confirm("Apagar este material? Essa ação remove o registro e o arquivo.")) {
    return;
  }

  try {
    button.disabled = true;
    setLocalFeedback(feedbackTarget, "Apagando material...", "success");
    const response = await fetch(`/api/gestao/materials/${id}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível apagar o material.");
    }

    setLocalFeedback(feedbackTarget, data.message, "success");
    await loadMaterials(type);
  } catch (error) {
    setLocalFeedback(feedbackTarget, error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function uploadMaterial(type, form) {
  const feedbackTarget = type === "pdf" ? pdfFeedback : videoFeedback;
  const endpoint = type === "pdf"
    ? "/api/gestao/materials/pdf"
    : "/api/gestao/materials/video";
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);

  try {
    submitButton.disabled = true;
    setLocalFeedback(feedbackTarget, "Enviando material...", "success");
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Não foi possível publicar o material.");
    }

    form.reset();
    setLocalFeedback(feedbackTarget, data.message, "success");
    await loadMaterials(type);
  } catch (error) {
    setLocalFeedback(feedbackTarget, error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

menuToggle.addEventListener("click", () => {
  shell.classList.toggle("sidebar-collapsed");
});

moduleLinks.forEach((link) => {
  link.addEventListener("click", () => setModule(link.dataset.module));
});

pdfForm.addEventListener("submit", (event) => {
  event.preventDefault();
  uploadMaterial("pdf", pdfForm);
});

videoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  uploadMaterial("video", videoForm);
});

announcementForm.addEventListener("submit", (event) => {
  event.preventDefault();
  publishAnnouncement(announcementForm);
});

gradeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createGrade(gradeForm);
});

teacherEventForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createTeacherEvent(teacherEventForm);
});

teacherCalendarPrev.addEventListener("click", () => {
  teacherCalendarDate = new Date(teacherCalendarDate.getFullYear(), teacherCalendarDate.getMonth() - 1, 1);
  renderTeacherCalendar();
});

teacherCalendarNext.addEventListener("click", () => {
  teacherCalendarDate = new Date(teacherCalendarDate.getFullYear(), teacherCalendarDate.getMonth() + 1, 1);
  renderTeacherCalendar();
});

teacherCalendarMonth.addEventListener("change", () => {
  teacherCalendarDate = new Date(
    teacherCalendarDate.getFullYear(),
    Number(teacherCalendarMonth.value),
    1
  );
  renderTeacherCalendar();
});

teacherCalendarYear.addEventListener("change", () => {
  const nextYear = Number(teacherCalendarYear.value);
  if (!Number.isNaN(nextYear) && nextYear >= 2020 && nextYear <= 2100) {
    teacherCalendarDate = new Date(nextYear, teacherCalendarDate.getMonth(), 1);
    renderTeacherCalendar();
  }
});

courseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCourse(courseForm).catch((error) => {
    setLocalFeedback(catalogFeedback, error.message, "error");
  });
});

planForm.addEventListener("submit", (event) => {
  event.preventDefault();
  savePlan(planForm).catch((error) => {
    setLocalFeedback(catalogFeedback, error.message, "error");
  });
});

courseCancel.addEventListener("click", resetCourseForm);
planCancel.addEventListener("click", resetPlanForm);
catalogEditorClose.addEventListener("click", hideCatalogEditor);

addCourseShortcut.addEventListener("click", () => {
  resetCourseForm();
  showCatalogEditor("Adicionar curso");
  courseForm.scrollIntoView({ behavior: "smooth", block: "start" });
  courseForm.elements.name.focus();
});

refreshBtn.addEventListener("click", () => {
  loadCurrentView().catch((error) => setFeedback(error.message, "error"));
});

statusFilter.addEventListener("change", () => {
  loadPayments().catch((error) => setFeedback(error.message, "error"));
});

accessFilter.addEventListener("change", () => {
  loadUsers().catch((error) => setFeedback(error.message, "error"));
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setView(tab.dataset.view));
});

professorLogout.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/professor-login.html";
});

setModule(currentModule);
