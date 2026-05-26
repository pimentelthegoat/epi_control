const API_URL = "/api/epis";
const OLD_STORAGE_KEY = "controle-epi-items";
const THEME_KEY = "controle-epi-theme";
const EXPIRY_WARNING_DAYS = 30;

const fields = [
  "name",
  "ca",
  "category",
  "lot",
  "validUntil",
  "totalStock",
  "inUse",
  "minStock",
  "department",
  "supplier",
  "notes"
];

const state = {
  items: [],
  search: "",
  status: "all",
  editingId: null,
  loading: true,
  loadError: ""
};

const elements = {
  inventoryBody: document.querySelector("#inventoryBody"),
  emptyState: document.querySelector("#emptyState"),
  resultSummary: document.querySelector("#resultSummary"),
  alertsBand: document.querySelector("#alertsBand"),
  totalItems: document.querySelector("#totalItems"),
  inUseItems: document.querySelector("#inUseItems"),
  expiringItems: document.querySelector("#expiringItems"),
  lowStockItems: document.querySelector("#lowStockItems"),
  form: document.querySelector("#epiForm"),
  formTitle: document.querySelector("#formTitle"),
  formSubtitle: document.querySelector("#formSubtitle"),
  recordId: document.querySelector("#recordId"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  newButton: document.querySelector("#newButton"),
  cancelButton: document.querySelector("#cancelButton"),
  exportButton: document.querySelector("#exportButton"),
  saveButton: document.querySelector("#saveButton"),
  modal: document.querySelector("#epiModal"),
  closeModalButton: document.querySelector("#closeModalButton"),
  themeToggle: document.querySelector("#themeToggle"),
  themeLabel: document.querySelector("#themeLabel"),
  toast: document.querySelector("#toast")
};

discardOldBrowserInventory();
applyTheme(loadTheme());
render();
loadItems();

async function loadItems() {
  state.loading = true;
  state.loadError = "";
  render();

  try {
    const items = await requestJson(API_URL);
    state.items = Array.isArray(items) ? items.map(normalizeItem) : [];
  } catch (error) {
    console.error(error);
    state.items = [];
    state.loadError = error.message || "Nao foi possivel carregar os EPIs do Supabase.";
    showToast(state.loadError);
  } finally {
    state.loading = false;
    render();
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const payload = parseResponseBody(text);

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Erro HTTP ${response.status}`);
  }

  return payload;
}

function parseResponseBody(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 220) };
  }
}

function normalizeItem(item) {
  return {
    id: String(item.id),
    name: item.name ?? "",
    ca: item.ca ?? "",
    category: item.category ?? "",
    lot: item.lot ?? "",
    validUntil: String(item.validUntil ?? item.valid_until ?? "").slice(0, 10),
    totalStock: Number(item.totalStock ?? item.total_stock ?? 0),
    inUse: Number(item.inUse ?? item.in_use ?? 0),
    minStock: Number(item.minStock ?? item.min_stock ?? 0),
    department: item.department ?? "",
    supplier: item.supplier ?? "",
    notes: item.notes ?? ""
  };
}

function toSupabasePayload(item) {
  return {
    name: item.name,
    ca: item.ca,
    category: item.category,
    lot: item.lot,
    valid_until: item.validUntil,
    total_stock: item.totalStock,
    in_use: item.inUse,
    min_stock: item.minStock,
    department: item.department,
    supplier: item.supplier,
    notes: item.notes
  };
}

function todayAtMidnight() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysUntil(dateValue) {
  const target = new Date(`${dateValue}T00:00:00`);
  const diff = target - todayAtMidnight();
  return Math.ceil(diff / 86400000);
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${dateValue}T00:00:00Z`));
}

function statusFor(item) {
  const days = daysUntil(item.validUntil);
  const available = item.totalStock - item.inUse;
  return {
    days,
    available,
    expired: days < 0,
    expiring: days >= 0 && days <= EXPIRY_WARNING_DAYS,
    low: available <= item.minStock,
    ok: days > EXPIRY_WARNING_DAYS && available > item.minStock
  };
}

function matchesFilters(item) {
  const status = statusFor(item);
  const haystack = [
    item.name,
    item.ca,
    item.category,
    item.lot,
    item.department,
    item.supplier
  ].join(" ").toLowerCase();
  const matchesSearch = haystack.includes(state.search);

  if (!matchesSearch) {
    return false;
  }

  if (state.status === "all") {
    return true;
  }

  return Boolean(status[state.status]);
}

function render() {
  const filtered = state.items.filter(matchesFilters).sort(sortByRisk);
  renderMetrics();
  renderAlerts();
  renderTable(filtered);
}

function sortByRisk(a, b) {
  const statusA = statusFor(a);
  const statusB = statusFor(b);
  const scoreA = (statusA.expired ? 100 : 0) + (statusA.expiring ? 50 : 0) + (statusA.low ? 25 : 0);
  const scoreB = (statusB.expired ? 100 : 0) + (statusB.expiring ? 50 : 0) + (statusB.low ? 25 : 0);

  if (scoreA !== scoreB) {
    return scoreB - scoreA;
  }

  return statusA.days - statusB.days;
}

function renderMetrics() {
  const totals = state.items.reduce(
    (acc, item) => {
      const status = statusFor(item);
      acc.total += 1;
      acc.inUse += item.inUse;
      acc.expiring += status.expiring || status.expired ? 1 : 0;
      acc.low += status.low ? 1 : 0;
      return acc;
    },
    { total: 0, inUse: 0, expiring: 0, low: 0 }
  );

  elements.totalItems.textContent = totals.total;
  elements.inUseItems.textContent = totals.inUse;
  elements.expiringItems.textContent = totals.expiring;
  elements.lowStockItems.textContent = totals.low;
}

function renderAlerts() {
  const alerts = state.items
    .filter((item) => {
      const status = statusFor(item);
      return status.expired || status.expiring;
    })
    .sort((a, b) => statusFor(a).days - statusFor(b).days)
    .slice(0, 3);

  if (!alerts.length || state.loading || state.loadError) {
    elements.alertsBand.innerHTML = "";
    return;
  }

  elements.alertsBand.innerHTML = `
    <div class="alert-list">
      ${alerts
        .map((item) => {
          const status = statusFor(item);
          const label = status.expired
            ? `Vencido ha ${Math.abs(status.days)} dia${Math.abs(status.days) === 1 ? "" : "s"}`
            : `Vence em ${status.days} dia${status.days === 1 ? "" : "s"}`;

          return `
            <article class="alert-item ${status.expired ? "expired" : ""}">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${label} - Lote ${escapeHtml(item.lot)} - CA ${escapeHtml(item.ca)}</span>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderTable(items) {
  if (state.loading) {
    elements.inventoryBody.innerHTML = `<tr><td class="table-message" colspan="7">Carregando dados do Supabase...</td></tr>`;
    elements.emptyState.hidden = true;
    elements.resultSummary.textContent = "Conectando ao Supabase";
    return;
  }

  if (state.loadError) {
    elements.inventoryBody.innerHTML = `<tr><td class="table-message error" colspan="7">${escapeHtml(state.loadError)}</td></tr>`;
    elements.emptyState.hidden = true;
    elements.resultSummary.textContent = "Falha ao carregar dados";
    return;
  }

  elements.inventoryBody.innerHTML = items.map(rowTemplate).join("");
  elements.emptyState.hidden = items.length > 0;
  elements.resultSummary.textContent = `${items.length} registro${items.length === 1 ? "" : "s"} encontrado${items.length === 1 ? "" : "s"}`;
}

function rowTemplate(item) {
  const status = statusFor(item);
  const available = Math.max(item.totalStock - item.inUse, 0);
  const stockWidth = item.totalStock > 0 ? Math.round((available / item.totalStock) * 100) : 0;

  return `
    <tr>
      <td>
        <div class="item-title">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.category)} - ${escapeHtml(item.department)}</span>
        </div>
      </td>
      <td>${escapeHtml(item.ca)}</td>
      <td>${escapeHtml(item.lot)}</td>
      <td>
        <strong>${formatDate(item.validUntil)}</strong>
        <div class="date-detail">${validityText(status.days)}</div>
      </td>
      <td>
        <strong>${available} disponiveis</strong>
        <div class="stock-detail">${item.inUse} em uso de ${item.totalStock}</div>
        <div class="stock-bar ${status.low ? "low" : ""}" style="--stock-width: ${stockWidth}%"><span></span></div>
      </td>
      <td><div class="status-stack">${statusChips(status)}</div></td>
      <td>
        <div class="row-actions">
          <button class="text-button" type="button" data-action="edit" data-id="${item.id}">Editar</button>
          <button class="text-button danger" type="button" data-action="delete" data-id="${item.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `;
}

function validityText(days) {
  if (days < 0) {
    return `Vencido ha ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}`;
  }

  if (days === 0) {
    return "Vence hoje";
  }

  return `Vence em ${days} dia${days === 1 ? "" : "s"}`;
}

function statusChips(status) {
  const chips = [];

  if (status.expired) {
    chips.push('<span class="chip expired">Vencido</span>');
  } else if (status.expiring) {
    chips.push('<span class="chip expiring">A vencer</span>');
  }

  if (status.low) {
    chips.push('<span class="chip low">Estoque critico</span>');
  }

  if (!chips.length) {
    chips.push('<span class="chip ok">Em dia</span>');
  }

  return chips.join("");
}

async function handleSubmit(event) {
  event.preventDefault();
  clearErrors();

  const item = readForm();
  const errors = validate(item);

  if (Object.keys(errors).length) {
    showErrors(errors);
    showToast("Revise os campos destacados.");
    return;
  }

  elements.saveButton.disabled = true;

  try {
    if (state.editingId) {
      const updatedItems = await requestJson(`${API_URL}/${encodeURIComponent(state.editingId)}`, {
        method: "PUT",
        body: JSON.stringify(toSupabasePayload(item))
      });
      const normalized = normalizeItem(updatedItems[0]);
      state.items = state.items.map((current) => (current.id === state.editingId ? normalized : current));
      showToast("EPI atualizado no Supabase.");
    } else {
      const createdItems = await requestJson(API_URL, {
        method: "POST",
        body: JSON.stringify(toSupabasePayload(item))
      });
      state.items = [normalizeItem(createdItems[0]), ...state.items];
      showToast("EPI cadastrado no Supabase.");
    }

    resetForm();
    closeModal();
    render();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Nao foi possivel salvar no Supabase.");
  } finally {
    elements.saveButton.disabled = false;
  }
}

function readForm() {
  return {
    name: valueOf("name"),
    ca: valueOf("ca"),
    category: valueOf("category"),
    lot: valueOf("lot"),
    validUntil: valueOf("validUntil"),
    totalStock: numberValue("totalStock"),
    inUse: numberValue("inUse"),
    minStock: numberValue("minStock"),
    department: valueOf("department"),
    supplier: valueOf("supplier"),
    notes: valueOf("notes")
  };
}

function validate(item) {
  const errors = {};
  const requiredFields = ["name", "ca", "category", "lot", "validUntil", "department", "supplier"];

  requiredFields.forEach((field) => {
    if (!item[field]) {
      errors[field] = "Campo obrigatorio.";
    }
  });

  ["totalStock", "inUse", "minStock"].forEach((field) => {
    if (!Number.isInteger(item[field]) || item[field] < 0) {
      errors[field] = "Informe um numero inteiro maior ou igual a zero.";
    }
  });

  if (Number.isInteger(item.inUse) && Number.isInteger(item.totalStock) && item.inUse > item.totalStock) {
    errors.inUse = "Em uso nao pode ser maior que o estoque total.";
  }

  return errors;
}

function showErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const target = document.querySelector(`[data-error-for="${field}"]`);
    const input = document.querySelector(`#${field}`);

    if (target) {
      target.textContent = message;
    }

    if (input) {
      input.setAttribute("aria-invalid", "true");
    }
  });
}

function clearErrors() {
  document.querySelectorAll("[data-error-for]").forEach((error) => {
    error.textContent = "";
  });
  document.querySelectorAll("[aria-invalid]").forEach((input) => {
    input.removeAttribute("aria-invalid");
  });
}

function editItem(id) {
  const item = state.items.find((current) => current.id === id);

  if (!item) {
    return;
  }

  state.editingId = id;
  elements.recordId.value = id;
  fields.forEach((field) => {
    document.querySelector(`#${field}`).value = item[field] ?? "";
  });
  elements.formTitle.textContent = "Editar EPI";
  elements.formSubtitle.textContent = `${item.name} - lote ${item.lot}`;
  elements.saveButton.textContent = "Atualizar EPI";
  clearErrors();
  openModal();
}

async function deleteItem(id) {
  const item = state.items.find((current) => current.id === id);

  if (!item) {
    return;
  }

  const confirmed = window.confirm(`Excluir ${item.name} do Supabase?`);

  if (!confirmed) {
    return;
  }

  try {
    await requestJson(`${API_URL}/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.items = state.items.filter((current) => current.id !== id);
    if (state.editingId === id) {
      resetForm();
    }
    render();
    showToast("EPI excluido do Supabase.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Nao foi possivel excluir no Supabase.");
  }
}

function resetForm() {
  state.editingId = null;
  elements.form.reset();
  elements.recordId.value = "";
  elements.formTitle.textContent = "Cadastrar EPI";
  elements.formSubtitle.textContent = "Inclua lote, validade e estoque para acompanhamento.";
  elements.saveButton.textContent = "Salvar EPI";
  clearErrors();
}

function openModal() {
  elements.modal.hidden = false;
  document.body.classList.add("modal-open");

  const firstField = document.querySelector("#name");
  if (firstField && typeof firstField.focus === "function") {
    firstField.focus({ preventScroll: true });
  }
}

function closeModal() {
  elements.modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function discardOldBrowserInventory() {
  localStorage.removeItem(OLD_STORAGE_KEY);
}

function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  elements.themeLabel.textContent = theme === "dark" ? "Claro" : "Escuro";
  elements.themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

function valueOf(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function numberValue(id) {
  const value = document.querySelector(`#${id}`).value;
  return value === "" ? NaN : Number(value);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 2600);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function exportCsv() {
  const headers = ["Nome", "CA", "Categoria", "Lote", "Validade", "Estoque total", "Em uso", "Disponivel", "Minimo", "Setor", "Fornecedor", "Observacoes"];
  const rows = state.items.map((item) => [
    item.name,
    item.ca,
    item.category,
    item.lot,
    formatDate(item.validUntil),
    item.totalStock,
    item.inUse,
    item.totalStock - item.inUse,
    item.minStock,
    item.department,
    item.supplier,
    item.notes
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `controle-epi-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Arquivo CSV gerado.");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

elements.form.addEventListener("submit", handleSubmit);
elements.cancelButton.addEventListener("click", () => {
  resetForm();
  closeModal();
});
elements.newButton.addEventListener("click", () => {
  resetForm();
  openModal();
});
elements.exportButton.addEventListener("click", exportCsv);
elements.themeToggle.addEventListener("click", toggleTheme);
elements.closeModalButton.addEventListener("click", () => {
  resetForm();
  closeModal();
});
elements.modal.addEventListener("click", (event) => {
  if (event.target === elements.modal) {
    resetForm();
    closeModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.modal.hidden) {
    resetForm();
    closeModal();
  }
});
elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value.trim().toLowerCase();
  render();
});
elements.statusFilter.addEventListener("change", (event) => {
  state.status = event.target.value;
  render();
});
elements.inventoryBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  if (button.dataset.action === "edit") {
    editItem(button.dataset.id);
  }

  if (button.dataset.action === "delete") {
    deleteItem(button.dataset.id);
  }
});
