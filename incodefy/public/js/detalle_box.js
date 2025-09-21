let fechaActual = new Date(new Date().toISOString().split("T")[0]); 
let graficoUso = null;
let graficoCumplimiento = null;

// ========= Modal Instrumentos =========
function abrirModalInstrumentos() {
    const modal = document.getElementById('modalInstrumentos');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    filtrarInstrumentos('MEDICO');
}

function cerrarModalInstrumentos() {
    const modal = document.getElementById('modalInstrumentos');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

function filtrarInstrumentos(tipo) {
    const lista = document.getElementById('lista-instrumentos');
    const msgVacio = document.getElementById('msg-vacio');
    const tabMed = document.getElementById('tab-medico');
    const tabInm = document.getElementById('tab-inmobiliario');

    if (!lista) {
        if (msgVacio) msgVacio.style.display = 'block';
        tabMed.classList.toggle('active', tipo === 'MEDICO');
        tabInm.classList.toggle('active', tipo === 'INMOBILIARIO');
        return;
    }

    const items = lista.querySelectorAll('.instrument-item-enhanced');
    let visibles = 0;
    items.forEach(li => {
        const coincide = (li.dataset.tipo || 'MEDICO').toUpperCase() === tipo.toUpperCase();
        li.style.display = coincide ? 'flex' : 'none';
        if (coincide) visibles++;
    });

    if (msgVacio) msgVacio.style.display = visibles ? 'none' : 'block';

    tabMed.classList.toggle('active', tipo === 'MEDICO');
    tabInm.classList.toggle('active', tipo === 'INMOBILIARIO');
}

// ========= Fechas =========
function cambiarFecha(dias) {
    fechaActual.setDate(fechaActual.getDate() + dias);
    actualizarVista();
}

function seleccionarFecha(valor) {
    if (!valor) return;
    const partes = valor.split('-');
    if (partes.length !== 3) return;
    const nuevaFecha = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    if (!isNaN(nuevaFecha.getTime())) {
        fechaActual = nuevaFecha;
        actualizarVista();
    }
}

// ========= Actualización principal =========
function actualizarVista() {
    const boxId = document.body.dataset.boxId;

    const fechaStr = fechaActual.toISOString().split("T")[0]; 

    document.getElementById("selectorFecha").value = fechaStr;

    fetch(`/api/box-info?box_id=${boxId}&fecha=${fechaStr}`)
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                alert("Error al cargar la información: " + data.error);
                return;
            }

            document.getElementById("fechaLabel").innerText = data.fecha;

            // Tabla
            const tabla = document.getElementById("tablaHorarios");
            tabla.innerHTML = "";
            for (const hora in data.horarios) {
                const fila = document.createElement("tr");
                const bloque = data.horarios[hora];
                fila.innerHTML = `
                    <td>${hora}</td>
                    <td>${bloque.medico || "-"}</td>
                    <td>${bloque.especialidad || "-"}</td>
                    <td>${bloque.estado || "-"}</td>
                    <td>${bloque.tipo_consulta || "-"}</td>
                `;
                tabla.appendChild(fila);
            }

            actualizarMetricas(data);
            renderGraficos(data.uso_box, data.consultas_no_realizadas, data.total_consultas);
        })
        .catch(err => console.error("Error:", err));
}

// ========= Métricas =========
function actualizarMetricas(data) {
    document.getElementById("totalConsultas").innerText = data.total_consultas;
    document.getElementById("noRealizadas").innerText = data.consultas_no_realizadas;
    document.getElementById("usoBox").innerHTML = `${parseFloat(data.uso_box).toFixed(0)}<span style="font-size:1.5rem;">%</span>`;
    document.getElementById("cumplimiento").innerHTML = `${parseFloat(data.cumplimiento).toFixed(0)}<span style="font-size:1.5rem;">%</span>`;
}

// ========= Gráficos =========
function renderGraficos(uso, noRealizadas, total) {
    const realizadas = total - noRealizadas;
    if (graficoUso) graficoUso.destroy();
    if (graficoCumplimiento) graficoCumplimiento.destroy();

    const ctxUso = document.getElementById("graficoUso").getContext("2d");
    graficoUso = new Chart(ctxUso, {
        type: "doughnut",
        data: { labels: ["Usado", "Libre"], datasets: [{ data: [uso, 100 - uso], backgroundColor: ["#142c59", "#e8f2ff"], cutout: '70%' }] },
        plugins: [ChartDataLabels],
        options: { plugins: { legend: { position: 'bottom' } } }
    });

    const ctxCumplimiento = document.getElementById("graficoCumplimiento").getContext("2d");
    graficoCumplimiento = new Chart(ctxCumplimiento, {
        type: "doughnut",
        data: { labels: ["Realizadas", "No Realizadas"], datasets: [{ data: [realizadas, noRealizadas], backgroundColor: ["#1d428a", "#dc3545"], cutout: '70%' }] },
        plugins: [ChartDataLabels],
        options: { plugins: { legend: { position: 'bottom' } } }
    });
}

// ========= Tabs =========
function mostrarTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick*="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Mantener el tab en la URL sin recargar
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
}

// ========= Init =========
document.addEventListener("DOMContentLoaded", () => {
    actualizarVista();

    const urlParams = new URLSearchParams(window.location.search);
    mostrarTab(urlParams.get('tab') || 'consultas');
});
