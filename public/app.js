const state = {
  user: null,
  jobs: [],
  applications: [],
  currentView: "jobs",
  authMode: "login",
  selectedJob: null,
  toastTimer: null,
  jobRequestId: 0,
  previousFocus: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers }
    });
    const payload = response.status === 204 ? {} : await response.json();
    if (!response.ok) {
      if (response.status === 401 && state.user) {
        state.user = null;
        renderHeader();
      }
      throw new Error(payload.error || "Something went wrong. Please try again.");
    }
    return payload;
  } catch (err) {
    if (err instanceof TypeError || err.name === "NetworkError") {
      throw new Error("We couldn't connect to the portal. Check that the server is running, then try again.");
    }
    throw err;
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function initials(value = "") {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "JT";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
}

function showModal(modal) {
  state.previousFocus = document.activeElement;
  modal.classList.remove("hidden");
  modal.querySelector("button, input, textarea, select")?.focus();
}

function hideModal(modal) {
  modal.classList.add("hidden");
  state.previousFocus?.focus?.();
}

function setView(view) {
  if (view === "applications" || view === "profile") {
    if (!state.user) {
      openAuth("login");
      showToast("Sign in to view your candidate account.");
      return;
    }
  }
  state.currentView = view;
  $("#jobs-view").classList.toggle("hidden", view !== "jobs");
  $("#applications-view").classList.toggle("hidden", view !== "applications");
  $("#profile-view").classList.toggle("hidden", view !== "profile");
  $$("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  if (view === "applications") loadApplications();
  if (view === "profile") populateProfile();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHeader() {
  const actions = $("#header-actions");
  if (!state.user) {
    actions.innerHTML = '<button class="button button-quiet" data-open-auth="login">Log in</button><button class="button button-dark" data-open-auth="register">Create account <span aria-hidden="true">↗</span></button>';
  } else {
    actions.innerHTML = `<button class="button button-quiet profile-shortcut" data-view="profile"><span class="avatar">${escapeHtml(initials(state.user.name))}</span><span>${escapeHtml(state.user.name.split(" ")[0])}</span></button><button class="button button-dark" id="logout-button">Log out</button>`;
  }
}

function jobCard(job) {
  const tags = job.skills.slice(0, 3).map((skill) => `<span class="job-tag">${escapeHtml(skill)}</span>`).join("");
  return `<article class="job-card">
    <div class="job-card-top"><div class="company-badge">${escapeHtml(initials(job.company))}</div><span class="posted-label">${escapeHtml(formatDate(job.postedAt))}</span></div>
    <p class="job-company">${escapeHtml(job.company)} · ${escapeHtml(job.category)}</p>
    <h3>${escapeHtml(job.title)}</h3>
    <div class="job-meta"><span>${escapeHtml(job.location)}</span><span>${escapeHtml(job.workMode)}</span><span>${escapeHtml(job.type)}</span><span>${escapeHtml(job.experience)}</span></div>
    <div class="job-tags">${tags}</div>
    <div class="job-card-footer"><span class="salary">${escapeHtml(job.salary)}</span><button class="apply-link" data-job-details="${escapeHtml(job.id)}">View role details →</button></div>
  </article>`;
}

async function loadJobs() {
  const requestId = ++state.jobRequestId;
  const searchButton = $("#search-form button[type=submit]");
  const errorPanel = $("#jobs-error");
  errorPanel.classList.add("hidden");
  $("#jobs-empty").classList.add("hidden");
  $("#job-grid").classList.remove("hidden");
  $("#job-grid").setAttribute("aria-busy", "true");
  searchButton.disabled = true;
  searchButton.textContent = "Searching…";
  const params = new URLSearchParams();
  const query = $("#search-query").value.trim();
  const location = $("#search-location").value.trim();
  if (query) params.set("q", query);
  if (location) params.set("location", location);
  if ($("#filter-type").value) params.set("type", $("#filter-type").value);
  if ($("#filter-mode").value) params.set("workMode", $("#filter-mode").value);
  if ($("#filter-experience").value) params.set("experience", $("#filter-experience").value);
  try {
    const { jobs } = await api(`/api/jobs?${params}`);
    if (requestId !== state.jobRequestId) return;
    state.jobs = jobs;
    if ($("#sort-jobs").value === "company") jobs.sort((a, b) => a.company.localeCompare(b.company));
    else jobs.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
    $("#job-count").textContent = jobs.length;
    $("#section-note-text").textContent = `opportunit${jobs.length === 1 ? "y" : "ies"} to explore`;
    $("#results-label").textContent = query || location ? "Search results" : "All opportunities";
    $("#job-grid").innerHTML = jobs.map(jobCard).join("");
    $("#job-grid").classList.toggle("hidden", jobs.length === 0);
    $("#jobs-empty").classList.toggle("hidden", jobs.length > 0);
  } catch (err) {
    if (requestId !== state.jobRequestId) return;
    $("#job-grid").classList.add("hidden");
    $("#jobs-empty").classList.add("hidden");
    $("#jobs-error-message").textContent = err.message;
    errorPanel.classList.remove("hidden");
  } finally {
    if (requestId === state.jobRequestId) {
      $("#job-grid").setAttribute("aria-busy", "false");
      searchButton.disabled = false;
      searchButton.innerHTML = 'Search jobs <span aria-hidden="true">→</span>';
    }
  }
}

function showJobDetails(job) {
  state.selectedJob = job;
  $("#job-detail-company").innerHTML = `<span class="company-badge">${escapeHtml(initials(job.company))}</span><span>${escapeHtml(job.company)} · ${escapeHtml(job.category)}</span>`;
  $("#job-detail-title").textContent = job.title;
  $("#job-detail-meta").textContent = [job.location, job.workMode, job.type, job.experience].join(" · ");
  $("#job-detail-salary").textContent = job.salary;
  $("#job-detail-description").textContent = job.description;
  $("#job-detail-skills").innerHTML = job.skills.map((skill) => `<span class="job-tag">${escapeHtml(skill)}</span>`).join("");
  $("#job-detail-posted").textContent = `Posted ${formatDate(job.postedAt)}`;
  showModal($("#job-detail-modal"));
}

async function openApply(jobId) {
  const job = state.jobs.find((item) => item.id === jobId) || (await api(`/api/jobs/${encodeURIComponent(jobId)}`)).job;
  state.selectedJob = job;
  $("#apply-job-summary").innerHTML = `<strong>${escapeHtml(job.title)}</strong>${escapeHtml(job.company)} · ${escapeHtml(job.location)} · ${escapeHtml(job.workMode)}`;
  $("#apply-error").textContent = "";
  $("#apply-form").reset();
  showModal($("#apply-modal"));
  if (!state.user) {
    $("#apply-modal").classList.add("hidden");
    state.pendingJobId = jobId;
    openAuth("login");
    showToast("Log in or create an account to apply.");
  }
}

function openAuth(mode) {
  state.authMode = mode;
  $("#auth-error").textContent = "";
  showModal($("#auth-modal"));
  updateAuthMode();
  setTimeout(() => $("#auth-form").elements.email.focus(), 50);
}

function updateAuthMode() {
  const isRegister = state.authMode === "register";
  $("#auth-title").textContent = isRegister ? "Let's get started." : "Welcome back.";
  $("#auth-copy").textContent = isRegister ? "Create your free candidate account." : "Sign in to pick up where you left off.";
  $(".auth-name").classList.toggle("hidden", !isRegister);
  $("#auth-form").elements.name.required = isRegister;
  $("#auth-form").elements.password.autocomplete = isRegister ? "new-password" : "current-password";
  $("#auth-form").querySelector(".auth-submit").innerHTML = isRegister ? 'Create account <span aria-hidden="true">→</span>' : 'Log in <span aria-hidden="true">→</span>';
  $$(".auth-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.authMode === state.authMode));
}

function populateProfile() {
  if (!state.user) return;
  const form = $("#profile-form");
  for (const key of ["name", "email", "phone", "location", "headline", "bio", "linkedin", "resumeUrl"]) {
    form.elements[key].value = state.user[key] || "";
  }
  form.elements.skills.value = (state.user.skills || []).join(", ");
  $("#profile-message").textContent = "";
}

async function loadApplications() {
  try {
    const { applications } = await api("/api/applications");
    state.applications = applications;
    const total = applications.length;
    const active = applications.filter((item) => !["Rejected", "Accepted"].includes(item.status)).length;
    const interviews = applications.filter((item) => item.status === "Interview").length;
    $("#application-summary").innerHTML = `<div class="summary-chip"><strong>${total}</strong><span>Total applications</span></div><div class="summary-chip"><strong>${active}</strong><span>In progress</span></div><div class="summary-chip"><strong>${interviews}</strong><span>Interviews</span></div>`;
    $("#application-list").innerHTML = applications.map((application) => {
      const statusClass = application.status.toLowerCase();
      return `<article class="application-card"><div class="company-badge">${escapeHtml(initials(application.job.company))}</div><div class="application-info"><h3>${escapeHtml(application.job.title)}</h3><p>${escapeHtml(application.job.company)} · ${escapeHtml(application.job.location)}</p></div><span class="application-date">Applied ${escapeHtml(formatDate(application.appliedAt))}</span><span class="status-pill ${escapeHtml(statusClass)}">${escapeHtml(application.status)}</span></article>`;
    }).join("");
    $("#application-list").classList.toggle("hidden", total === 0);
    $("#applications-empty").classList.toggle("hidden", total > 0);
  } catch (err) {
    showToast(err.message);
  }
}

$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  loadJobs();
});

["filter-type", "filter-mode", "filter-experience"].forEach((id) => {
  $(`#${id}`).addEventListener("change", loadJobs);
});
$("#sort-jobs").addEventListener("change", loadJobs);
$("#clear-filters").addEventListener("click", () => {
  $("#search-query").value = "";
  $("#search-location").value = "";
  $("#filter-type").value = "";
  $("#filter-mode").value = "";
  $("#filter-experience").value = "";
  loadJobs();
});
$("#empty-clear").addEventListener("click", () => $("#clear-filters").click());
$("#retry-jobs").addEventListener("click", loadJobs);
$$("[data-search]").forEach((button) => button.addEventListener("click", () => {
  $("#search-query").value = button.dataset.search === "Remote" ? "" : button.dataset.search;
  $("#search-location").value = button.dataset.search === "Remote" ? "remote" : "";
  loadJobs();
  $("#browse").scrollIntoView({ behavior: "smooth" });
}));

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) setView(viewButton.dataset.view);
  const authButton = event.target.closest("[data-open-auth]");
  if (authButton) openAuth(authButton.dataset.openAuth);
  const authTab = event.target.closest("[data-auth-mode]");
  if (authTab) {
    state.authMode = authTab.dataset.authMode;
    updateAuthMode();
  }
  const detailsButton = event.target.closest("[data-job-details]");
  if (detailsButton) {
    const job = state.jobs.find((item) => item.id === detailsButton.dataset.jobDetails);
    if (job) showJobDetails(job);
  }
  if (event.target.id === "logout-button") {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      state.user = null;
      state.applications = [];
      renderHeader();
      setView("jobs");
      showToast("You've been logged out.");
    } catch (err) { showToast(err.message); }
  }
});

$("#close-auth").addEventListener("click", () => hideModal($("#auth-modal")));
$("#close-apply").addEventListener("click", () => hideModal($("#apply-modal")));
$("#close-job-detail").addEventListener("click", () => hideModal($("#job-detail-modal")));
$("#job-detail-apply").addEventListener("click", async () => {
  if (!state.selectedJob) return;
  const jobId = state.selectedJob.id;
  hideModal($("#job-detail-modal"));
  try {
    await openApply(jobId);
  } catch (err) {
    showToast(err.message);
  }
});
["auth-modal", "apply-modal", "job-detail-modal"].forEach((id) => $(`#${id}`).addEventListener("click", (event) => {
  if (event.target.id === id) hideModal($(`#${id}`));
}));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    for (const id of ["auth-modal", "apply-modal", "job-detail-modal"]) {
      if (!$(`#${id}`).classList.contains("hidden")) {
        hideModal($(`#${id}`));
        break;
      }
    }
  }
});

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  const endpoint = state.authMode === "register" ? "/api/auth/register" : "/api/auth/login";
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.textContent = state.authMode === "register" ? "Creating account…" : "Signing in…";
  try {
    const result = await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
    state.user = result.user;
    renderHeader();
    hideModal($("#auth-modal"));
    form.reset();
    showToast(state.authMode === "register" ? "Your candidate account is ready." : "Welcome back.");
    if (state.pendingJobId) {
      const jobId = state.pendingJobId;
      state.pendingJobId = null;
      await openApply(jobId);
    } else if (state.currentView === "applications") {
      loadApplications();
    }
  } catch (err) {
    $("#auth-error").textContent = err.message;
  } finally {
    submit.disabled = false;
    updateAuthMode();
  }
});

$("#apply-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedJob) return;
  const submit = event.currentTarget.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.textContent = "Submitting application…";
  $("#apply-error").textContent = "";
  try {
    await api(`/api/jobs/${encodeURIComponent(state.selectedJob.id)}/apply`, {
      method: "POST",
      body: JSON.stringify({ coverLetter: event.currentTarget.elements.coverLetter.value })
    });
    hideModal($("#apply-modal"));
    showToast("Application submitted. Good luck!");
    if (state.currentView === "applications") loadApplications();
  } catch (err) {
    $("#apply-error").textContent = err.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Submit application <span aria-hidden="true">→</span>';
  }
});

$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  payload.skills = payload.skills.split(",").map((skill) => skill.trim()).filter(Boolean);
  delete payload.email;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.textContent = "Saving…";
  try {
    const result = await api("/api/profile", { method: "PATCH", body: JSON.stringify(payload) });
    state.user = result.user;
    renderHeader();
    $("#profile-message").textContent = "Profile saved successfully.";
  } catch (err) {
    $("#profile-message").textContent = err.message;
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Save profile <span aria-hidden="true">→</span>';
  }
});

async function start() {
  renderHeader();
  try {
    const { user } = await api("/api/auth/me");
    state.user = user;
    renderHeader();
  } catch (err) {
    if (err.message !== "Please sign in to continue.") showToast(err.message);
  }
  await loadJobs();
}

start().catch((err) => showToast(err.message));
