// ================== Config ==================
const LIST_URL   = "/consultas/en-curso/api/";
const TOGGLE_URL = "/consultas/en-curso/toggle/";

const consultasState = new Map();
let firstPaintDone = false;
let refreshInflight = false;
let refreshQueued = false;

// ================== Helpers ==================
function getCSRFToken() {
  const name = "csrftoken=";
  const parts = document.cookie.split(";").map(c => c.trim());
  for (const p of parts) if (p.startsWith(name)) return decodeURIComponent(p.slice(name.length));
  console.error("⚠ No se encontró CSRF Token en cookies");
  return "";
}

function timeToMin(t) {
  if (!t) return 0;
  const [h = "0", m = "0"] = t.split(":");
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}
const collES = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
function normStr(s) { return (s ?? "").toString().trim(); }

function buildKey(c) {
  return {
    t: timeToMin((c.horainicio || "").slice(0,5)),
    box: normStr(c.box),
    med: normStr(c.medico),
  };
}
function setRowKey(tr, key) {
  tr.dataset.t   = String(key.t);
  tr.dataset.box = key.box;
  tr.dataset.med = key.med;
}
function rowToKey(tr) {
  return {
    t: Number(tr.dataset.t) || 0,
    box: tr.dataset.box || "",
    med: tr.dataset.med || "",
  };
}
function compareKeys(a, b) {
  if (a.t !== b.t) return a.t - b.t;
  const bcmp = collES.compare(a.box, b.box);
  if (bcmp !== 0) return bcmp;
  return collES.compare(a.med, b.med);
}

// ================== DOM ==================
function ensureTableSkeleton() {
  const cont = document.getElementById("contenedor_en_curso");
  let tbody = cont.querySelector("#tbodyConsultas");
  if (!tbody) {
    cont.innerHTML = `
      <div class="table-responsive">
        <table class="table consultas-table mb-0" id="tablaConsultas">
          <thead>
            <tr>
              <th><i class="fas fa-clock me-2"></i>${window.i18nConsultas.horario}</th>
              <th><i class="fas fa-user-md me-2"></i>${window.i18nConsultas.medico}</th>
              <th><i class="fas fa-door-open me-2"></i>${window.i18nConsultas.box}</th>
              <th><i class="fas fa-notes-medical me-2"></i>${window.i18nConsultas.tipoConsulta}</th>
              <th><i class="fas fa-info-circle me-2"></i>${window.i18nConsultas.estado}</th>
              <th style="width:1%"></th>
            </tr>
          </thead>
          <tbody id="tbodyConsultas"></tbody>
        </table>
      </div>`;
    tbody = cont.querySelector("#tbodyConsultas");
    tbody.addEventListener("click", onTbodyClick);
    document.getElementById("leyendaEstado").hidden = false;
  }
  return tbody;
}

function rowHTML(c) {
  const pend = Number(c.estado_id) === 2; // 2=pendiente, 1=confirmada
  const estado = pend
    ? `<span class="estado-badge estado-pendiente">${window.i18nConsultas.pendiente}</span>`
    : `<span class="estado-badge estado-confirmada">${window.i18nConsultas.confirmada}</span>`;
  const btn = pend
    ? `<button class="btn btn-confirmar btn-sm" data-action="toggle" data-to="1" data-id="${c.idagenda}">
         <i class="fas fa-check me-1"></i> ${window.i18nConsultas.confirmar}
       </button>`
    : `<button class="btn btn-desconfirmar btn-sm" data-action="toggle" data-to="2" data-id="${c.idagenda}">
         <i class="fas fa-undo me-1"></i> ${window.i18nConsultas.desconfirmar}
       </button>`;
  return `
    <td class="text-nowrap fw-semibold">${c.horainicio ?? "-"}–${c.horafin ?? "-"}</td>
    <td>${c.medico ?? "-"}</td>
    <td>${c.box ?? "-"}</td>
    <td>${c.tipoconsulta ?? "-"}</td>
    <td>${estado}</td>
    <td class="text-end">${btn}</td>`;
}

function pulseUpdate(tr) {
  tr.classList.remove("row-updated");
  tr.offsetWidth; // reflow
  tr.classList.add("row-updated");
  setTimeout(() => tr.classList.remove("row-updated"), 800);
}

function insertSorted(tbody, tr, key) {
  const rows = tbody.querySelectorAll("tr[data-id]");
  let inserted = false;
  for (const r of rows) {
    const rk = rowToKey(r);
    if (compareKeys(key, rk) < 0) {
      tbody.insertBefore(tr, r);
      inserted = true;
      break;
    }
  }
  if (!inserted) tbody.appendChild(tr);
}

// ================== Diff ==================
function applyDiff(consultas) {
  const tbody = ensureTableSkeleton();

  // Stats
  const p = consultas.filter(x => Number(x.estado_id) === 2).length;
  const c = consultas.filter(x => Number(x.estado_id) === 1).length;
  document.getElementById("stat-pendientes").textContent = p;
  document.getElementById("stat-confirmadas").textContent = c;
  document.getElementById("stat-total").textContent = consultas.length;

  const nextIds = new Set(consultas.map(c => String(c.idagenda)));

  for (const cta of consultas) {
    const id = String(cta.idagenda);
    const key = buildKey(cta);
    let tr = tbody.querySelector(`tr[data-id="${id}"]`);

    if (!tr) {
      tr = document.createElement("tr");
      tr.dataset.id = id;
      tr.classList.add("row-enter");
      tr.innerHTML = rowHTML(cta);
      setRowKey(tr, key);
      insertSorted(tbody, tr, key);
      requestAnimationFrame(() => tr.classList.add("row-enter-active"));
      setTimeout(() => tr.classList.remove("row-enter", "row-enter-active"), 350);
    } else {
      const oldKey = rowToKey(tr);
      tr.innerHTML = rowHTML(cta);
      setRowKey(tr, key);
      if (compareKeys(oldKey, key) !== 0) {
        insertSorted(tbody, tr, key);
      }
      pulseUpdate(tr);
    }
    consultasState.set(Number(id), cta);
  }

  // Remover los que ya no están
  tbody.querySelectorAll("tr[data-id]").forEach(tr => {
    if (!nextIds.has(tr.dataset.id)) {
      tr.classList.add("row-exit");
      tr.addEventListener("transitionend", () => tr.remove(), { once: true });
      consultasState.delete(Number(tr.dataset.id));
    }
  });

  firstPaintDone = true;
}

// ================== Carga ==================
async function cargarEnCurso() {
  if (!firstPaintDone) {
    document.getElementById("contenedor_en_curso").innerHTML =
      `<div class="loading-container">
         <div class="loading-spinner"></div>
         <div>${window.i18nConsultas.cargando}</div>
       </div>`;
  }
  if (refreshInflight) { refreshQueued = true; return; }
  refreshInflight = true;
  try {
    const r = await fetch(LIST_URL, { headers: { "X-Requested-With": "XMLHttpRequest" } });
    const { consultas = [] } = await r.json();
    if (!consultas.length) {
      document.getElementById("contenedor_en_curso").innerHTML = `
        <div class="empty-state">
          <i class="fas fa-calendar-check"></i>
          <h4>${window.i18nConsultas.noHay}</h4>
          <p>${window.i18nConsultas.noHayDesc}</p>
        </div>`;
      document.getElementById("leyendaEstado").hidden = true;
      consultasState.clear();
    } else {
      applyDiff(consultas);
    }
  } catch (e) {
    if (!firstPaintDone) {
      document.getElementById("contenedor_en_curso").innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle text-danger"></i>
          <h4>${window.i18nConsultas.errorCargar}</h4>
          <p>${e?.message || e}</p>
        </div>`;
    }
  } finally {
    refreshInflight = false;
    if (refreshQueued) { refreshQueued = false; cargarEnCurso(); }
  }
}

// ================== Toggle ==================
async function optimisticToggle(id, toEstado, btn) {
  const numId = Number(id);
  const cur = consultasState.get(numId);
  if (!cur) return;

  const tr = btn.closest("tr");
  btn.disabled = true;
  const clone = { ...cur, estado_id: Number(toEstado) };
  tr.innerHTML = rowHTML(clone);
  pulseUpdate(tr);

  try {
    const r = await fetch(TOGGLE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify({ idagenda: id, to_estado: toEstado })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error("No se pudo actualizar");

    consultasState.set(numId, clone);
    const arr = [...consultasState.values()];
    document.getElementById("stat-pendientes").textContent = arr.filter(x => Number(x.estado_id) === 2).length;
    document.getElementById("stat-confirmadas").textContent = arr.filter(x => Number(x.estado_id) === 1).length;
    document.getElementById("stat-total").textContent = arr.length;
  } catch (e) {
    tr.innerHTML = rowHTML(cur);
    alert("No se pudo actualizar el estado.\n" + (e?.message || e));
  }
}

function onTbodyClick(e) {
  const btn = e.target.closest("[data-action='toggle']");
  if (!btn) return;
  const id = btn.dataset.id;
  const to = btn.dataset.to;
  optimisticToggle(id, to, btn);
}
// ================== Init ==================
cargarEnCurso();
