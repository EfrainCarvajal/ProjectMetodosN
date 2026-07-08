/* ============================================================
 simulador.js  —  EcuaSim RK4
 v3:
 · Modal más grande, fórmulas con estilos reales (ver CSS)
 · VOZ CORREGIDA: se activa en el click real del botón
 "Iniciar" (sin pasar por setTimeout), y se selecciona
 explícitamente una voz en español cuando está disponible.
 ============================================================ */

/* ===== MAPA CLICABLE ===== */
function guardarSesionEnBackend(provincia, p, h, pasos, x0, y0, z0) {
    fetch('/api/simulacion', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            provincia, h, pasos, x0, y0, z0,
            birthX: p.birthX, deathX: p.deathX,
            birthY: p.birthY, deathY: p.deathY,
            muBase: p.muBase, muStress: p.muStress,
            nuBase: p.nuBase, tasaConsumo: p.tasaConsumo,
            r: p.r, k: p.K
        })
    })
            .then(res => {
                if (!res.ok)
                    throw new Error('HTTP ' + res.status);
            })
            .catch(err => console.error('No se pudo guardar la simulación:', err));
}

const mapClickIds = {'EC-G': 'GY', 'EC-P': 'PI', 'EC-Y': 'PA'};
Object.entries(mapClickIds).forEach(([pathId, code]) => {
    const path = document.getElementById(pathId);
    if (path)
        path.addEventListener('click', () => selectProv(code));
});

/* ===== CONFIG ===== */
const REGIONS = {
    GY: {name: 'Guayas', sub: 'Provincia de Guayas · Costa ecuatoriana', icon: '🌊', chip: 'Costa · Guayaquil', cls: 'gy',
        x0: 4000000, y0: 400000, z0: 800},
    PI: {name: 'Pichincha', sub: 'Provincia de Pichincha · Sierra Norte', icon: '⛰️', chip: 'Sierra · Quito', cls: 'pi',
        x0: 2800000, y0: 300000, z0: 700},
    PA: {name: 'Pastaza', sub: 'Provincia de Pastaza · Región Amazónica', icon: '🌿', chip: 'Amazonía · Puyo', cls: 'pa',
        x0: 50000, y0: 60000, z0: 2000}
};

let currentProv = null;
let chartPop = null, chartZ = null;

/* ===== SLIDER HELPERS ===== */
function sv(id, val, dec = 3) {
    document.getElementById('sv-' + id).textContent = parseFloat(val).toFixed(dec);
}
function hid(id, val) {
    document.getElementById(id).value = val;
}

/* ===== SELECT PROVINCE ===== */
function selectProv(code) {
    currentProv = code;
    const r = REGIONS[code];

    document.querySelectorAll('.prov-btn').forEach(b => b.classList.remove('active'));
    const btns = document.querySelectorAll('.prov-btn');
    if (code === 'GY')
        btns[0].classList.add('active');
    if (code === 'PI')
        btns[1].classList.add('active');
    if (code === 'PA')
        btns[2].classList.add('active');

    document.querySelectorAll('#ecuador-map path').forEach(p => p.classList.remove('active'));
    const mapIds = {GY: 'EC-G', PI: 'EC-P', PA: 'EC-Y'};
    const mapPath = document.getElementById(mapIds[code]);
    if (mapPath)
        mapPath.classList.add('active');

    document.getElementById('x0').value = r.x0;
    document.getElementById('y0').value = r.y0;
    document.getElementById('z0').value = r.z0;

    document.getElementById('rb-icon').textContent = r.icon;
    document.getElementById('rb-name').textContent = r.name;
    document.getElementById('rb-sub').textContent = r.sub;
    const chip = document.getElementById('rb-chip');
    chip.textContent = r.chip;
    chip.className = 'rb-chip ' + r.cls;
    document.getElementById('region-banner').className = 'region-banner show';

    const btn = document.getElementById('btn-run');
    btn.disabled = false;
    btn.textContent = '▶ Ejecutar simulación RK4';

    document.getElementById('results-section').style.display = 'none';
    document.getElementById('verdict').classList.remove('show');
}

/* ===== RK4 ENGINE ===== */
function getParam(id) {
    return parseFloat(document.getElementById(id).value);
}

function derivatives(x, y, z, p) {
    const zCrit = p.K * 0.3;
    const mu = p.muBase + p.muStress * Math.max(0, (zCrit - z) / (zCrit + 1));
    const dX = (p.birthX - p.deathX) * x - mu * x + p.nuBase * y;
    const dY = (p.birthY - p.deathY) * y + mu * x - p.nuBase * y;
    const dZ = p.r * z * (1 - z / p.K) - p.tasaConsumo * (x + y);
    return [dX, dY, dZ];
}

function rk4Step(x, y, z, h, p) {
    const [k1x, k1y, k1z] = derivatives(x, y, z, p);
    const [k2x, k2y, k2z] = derivatives(x + h / 2 * k1x, y + h / 2 * k1y, z + h / 2 * k1z, p);
    const [k3x, k3y, k3z] = derivatives(x + h / 2 * k2x, y + h / 2 * k2y, z + h / 2 * k2z, p);
    const [k4x, k4y, k4z] = derivatives(x + h * k3x, y + h * k3y, z + h * k3z, p);
    return [
        x + h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x),
        y + h / 6 * (k1y + 2 * k2y + 2 * k3y + k4y),
        z + h / 6 * (k1z + 2 * k2z + 2 * k3z + k4z)
    ];
}

function runSim() {
    if (!currentProv)
        return;

    const p = {
        birthX: getParam('birthX'), deathX: getParam('deathX'),
        birthY: getParam('birthY'), deathY: getParam('deathY'),
        muBase: getParam('muBase'), muStress: getParam('muStress'),
        nuBase: getParam('nuBase'), tasaConsumo: getParam('tasaConsumo'),
        r: getParam('r'), K: getParam('K'),
    };
    const h = getParam('h');
    const pasos = parseInt(document.getElementById('pasos').value);
    const x0 = getParam('x0'), y0 = getParam('y0'), z0 = getParam('z0');

    abrirModalRK4({x0, y0, z0, h, pasos, p});

    setTimeout(() => {
        let x = x0, y = y0, z = z0;
        const ts = [0], xs = [x0], ys = [y0], zs = [z0];

        for (let i = 0; i < pasos; i++) {
            [x, y, z] = rk4Step(x, y, z, h, p);
            x = Math.max(0, x);
            y = Math.max(0, y);
            z = Math.max(0, z);
            ts.push(+(ts[ts.length - 1] + h).toFixed(2));
            xs.push(x);
            ys.push(y);
            zs.push(z);
        }

        const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(1);
        document.getElementById('kpi-x').textContent = fmt(x);
        document.getElementById('kpi-y').textContent = fmt(y);
        document.getElementById('kpi-z').textContent = fmt(z);
        document.getElementById('kpi-t').textContent = (pasos * h).toFixed(1) + ' años';

        const zFrac = z / p.K;
        let vIcon, vTitle, vSub;
        if (zFrac > 0.6) {
            vIcon = '🟢';
            vTitle = 'Sistema estable';
            vSub = 'Los recursos se mantienen por encima del 60 % de la capacidad máxima.';
        } else if (zFrac > 0.3) {
            vIcon = '🟡';
            vTitle = 'Estrés moderado de recursos';
            vSub = 'Los recursos caen en la zona de advertencia. Migración urbano-periférica se acelera.';
        } else {
            vIcon = '🔴';
            vTitle = 'Crisis de recursos críticos';
            vSub = 'Recursos por debajo del 30 % de K. Migración masiva proyectada.';
        }

        document.getElementById('v-icon').textContent = vIcon;
        document.getElementById('v-title').textContent = vTitle;
        document.getElementById('v-sub').textContent = vSub;
        document.getElementById('verdict').classList.add('show');

        renderCharts(ts, xs, ys, zs);
        document.getElementById('results-section').style.display = 'flex';
        guardarSesionEnBackend(REGIONS[currentProv].name, p, h, pasos, x0, y0, z0);
    }, 100);
}

function renderCharts(ts, xs, ys, zs) {
    const gridColor = 'rgba(26,45,69,.7)';
    const tickColor = '#6b8098';
    const baseFont = {family: "'Space Grotesk', monospace", size: 10};
    if (chartPop)
        chartPop.destroy();
    if (chartZ)
        chartZ.destroy();

    const V = window.EcuaSimVisual;
    V.registrarZoomPlugin();
    const reducido = V.prefiereMovimientoReducido();
    const K = getParam('K');
    const umbralCrisis = K * 0.3;

    chartPop = new Chart(document.getElementById('chartPop').getContext('2d'), {
        type: 'line',
        data: {
            labels: ts,
            datasets: [
                {
                    label: 'X — Urbana', data: xs,
                    borderColor: '#00d4ff',
                    backgroundColor: V.crearGradienteVertical('#00d4ff', 0.30, 0.02),
                    borderWidth: 2, pointRadius: 0, tension: .3, fill: true,
                    glow: !reducido, glowColor: '#00d4ff', glowBlur: 6,
                },
                {
                    label: 'Y — Periférica', data: ys,
                    borderColor: '#fb923c',
                    backgroundColor: V.crearGradienteVertical('#fb923c', 0.24, 0.02),
                    borderWidth: 2, pointRadius: 0, tension: .3, fill: true,
                    glow: !reducido, glowColor: '#fb923c', glowBlur: 6,
                }
            ]
        },
        plugins: [V.pluginGridOsciloscopio, V.pluginGlowLineas],
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: {mode: 'index', intersect: false},
            animation: reducido ? false : undefined,
            plugins: {
                legend: {labels: {color: tickColor, font: baseFont, boxWidth: 10}},
                tooltip: {enabled: false}, // reemplazado por el crosshair combinado
                gridOsciloscopio: {enabled: true, color: 'rgba(0,212,255,.05)', paso: 26},
                zoom: V.opcionesZoomPan(),
            },
            scales: {
                x: {ticks: {color: tickColor, font: baseFont, maxTicksLimit: 10}, grid: {color: gridColor}},
                y: {ticks: {color: tickColor, font: baseFont, callback: v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v},
                    grid: {color: gridColor}}
            }
        }
    });
    V.aplicarHoverFade(chartPop);

    chartZ = new Chart(document.getElementById('chartZ').getContext('2d'), {
        type: 'line',
        data: {
            labels: ts,
            datasets: [
                {
                    label: 'Z — Recursos', data: zs,
                    borderColor: '#4ade80',
                    backgroundColor: V.crearGradienteVertical('#4ade80', 0.28, 0.02),
                    borderWidth: 2, pointRadius: 0, tension: .3, fill: true,
                    glow: !reducido, glowColor: '#4ade80', glowBlur: 6,
                },
                {
                    label: 'Umbral de crisis (30% de K)',
                    data: ts.map(() => umbralCrisis),
                    borderColor: 'rgba(248,113,113,.65)',
                    borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0,
                    tension: 0, fill: false,
                }
            ]
        },
        plugins: [V.pluginGridOsciloscopio, V.pluginGlowLineas],
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: {mode: 'index', intersect: false},
            animation: reducido ? false : undefined,
            plugins: {
                legend: {labels: {color: tickColor, font: baseFont, boxWidth: 10}},
                tooltip: {enabled: false}, // reemplazado por el crosshair combinado
                gridOsciloscopio: {enabled: true, color: 'rgba(74,222,128,.05)', paso: 26},
                zoom: V.opcionesZoomPan(),
            },
            scales: {
                x: {ticks: {color: tickColor, font: baseFont, maxTicksLimit: 8}, grid: {color: gridColor}},
                y: {ticks: {color: tickColor, font: baseFont}, grid: {color: gridColor}}
            }
        }
    });
    V.aplicarHoverFade(chartZ);

    V.activarCrosshairCombinado(
            [document.getElementById('chartPop'), document.getElementById('chartZ')],
            {ts, xs, ys, zs},
            [chartPop, chartZ]
            );
}

/* ══════════════════════════════════════════════════════════════════
 MODAL RK4 — PASO A PASO CON FÓRMULAS Y VOZ
 ══════════════════════════════════════════════════════════════════ */

let _rk4 = {
    corriendo: false, timer: null,
    paso: 0, totalPasos: 0,
    x: 0, y: 0, z: 0, t: 0,
    h: 0, p: null, K: 1000,
    vozActiva: false,
    vozDisponible: false, // true solo tras desbloqueo con gesto real
    vozEs: null              // voz en español seleccionada
};

/* ── Helpers de formato ─────────────────────────────────────────── */
function fmtN(n) {
    if (Math.abs(n) >= 1e6)
        return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e3)
        return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(1);
}
function fmtHablar(n) {
    if (Math.abs(n) >= 1e6)
        return (n / 1e6).toFixed(1) + ' millones';
    if (Math.abs(n) >= 1e3)
        return (n / 1e3).toFixed(0) + ' mil';
    return Math.round(n).toString();
}
function fmtC(n, dec = 4) { // formato compacto para coeficientes
    return n.toFixed(dec);
}
function pct(val, K) {
    return Math.min(100, Math.max(0, val / K * 100)).toFixed(1) + '%';
}
function sci(n) { // notación científica corta
    if (Math.abs(n) >= 1e6 || (Math.abs(n) < 0.001 && n !== 0))
        return n.toExponential(2);
    return n.toFixed(4);
}

/* ── PUNTO DE ENTRADA ───────────────────────────────────────────── */
function abrirModalRK4(params) {
    _rk4.paso = 0;
    _rk4.totalPasos = params.pasos;
    _rk4.x = params.x0;
    _rk4.y = params.y0;
    _rk4.z = params.z0;
    _rk4.t = 0;
    _rk4.h = params.h;
    _rk4.p = params.p;
    _rk4.K = params.p.K;
    _rk4.corriendo = false;

    _setEstado(params.x0, params.y0, params.z0, 0);
    _resetTimeline();

    document.getElementById('rk4m-counter').textContent = `paso 0 / ${params.pasos}`;
    document.getElementById('rk4m-progress').style.width = '0%';
    _setNarracionHTML('Haz clic en <strong style="color:var(--text);">▶ Iniciar</strong> para ver cómo RK4 resuelve las EDOs paso a paso con fórmulas reales.');
    document.getElementById('rk4m-voice-icon').textContent = _rk4.vozActiva ? '🔈' : '🔇';
    // (la voz se reactiva sola en iniciarRK4Modal si ya estaba encendida)

    document.getElementById('rk4m-btn-play').disabled = false;
    document.getElementById('rk4m-btn-pause').disabled = true;

    document.getElementById('rk4-modal').style.display = 'flex';

    // NOTA: ya NO arrancamos el modal automáticamente con setTimeout.
    // Esperamos a que el usuario haga clic en "▶ Iniciar" — ese clic
    // es el gesto real que el navegador necesita para permitir el audio.
}

function cerrarModalRK4() {
    pararRK4Modal();
    document.getElementById('rk4-modal').style.display = 'none';
    if (window.speechSynthesis)
        speechSynthesis.cancel();
}

function _resetTimeline() {
    ['f1', 'f2', 'f3', 'f4'].forEach(f => {
        const el = document.getElementById('tl-' + f);
        if (el)
            el.className = 'tl-fase tl-inactiva';
    });
    document.getElementById('tl-f1-vals').innerHTML = '';
    document.getElementById('tl-f2-vals').innerHTML = '';
    document.getElementById('tl-f3-vals').innerHTML = '';
    document.getElementById('tl-f4-vals').innerHTML = '';
    ['k1', 'k2', 'k3', 'k4'].forEach(k => {
        const kc = document.getElementById('tl-' + k);
        if (kc)
            kc.className = 'tl-kcard';
        const kv = document.getElementById('tl-' + k + 'v');
        if (kv)
            kv.innerHTML = '—';
    });
}

/* ── CONTROL ─────────────────────────────────────────────────────── */
function iniciarRK4Modal() {
    if (_rk4.corriendo)
        return;
    // Este handler corre directamente dentro de un click real del usuario
    // (el botón ▶ Iniciar) → es el gesto válido para el audio.
    if (_rk4.vozActiva && window.speechSynthesis) {
        speechSynthesis.cancel();
        _narrar('Iniciando simulación paso a paso.');
    }
    _rk4.corriendo = true;
    document.getElementById('rk4m-btn-play').disabled = true;
    document.getElementById('rk4m-btn-pause').disabled = false;
    loopRK4();
}

function pausarRK4Modal() {
    _rk4.corriendo = false;
    clearTimeout(_rk4.timer);
    document.getElementById('rk4m-btn-play').disabled = false;
    document.getElementById('rk4m-btn-pause').disabled = true;
    if (window.speechSynthesis)
        speechSynthesis.cancel();
}

function pararRK4Modal() {
    _rk4.corriendo = false;
    clearTimeout(_rk4.timer);
}

function reiniciarRK4Modal() {
    pararRK4Modal();
    if (window.speechSynthesis)
        speechSynthesis.cancel();
    abrirModalRK4({
        x0: parseFloat(document.getElementById('x0').value),
        y0: parseFloat(document.getElementById('y0').value),
        z0: parseFloat(document.getElementById('z0').value),
        h: _rk4.h, pasos: _rk4.totalPasos, p: _rk4.p
    });
}

/* ── LOOP ─────────────────────────────────────────────────────────── */
function loopRK4() {
    if (!_rk4.corriendo)
        return;
    ejecutarPasoModal();
    if (_rk4.paso < _rk4.totalPasos) {
        let delay = Math.round(2200 / parseInt(document.getElementById('rk4m-speed').value));
        // Con la voz activa, la narración necesita tiempo para terminar
        // de hablar antes de que el siguiente paso la corte (cancel()).
        if (_rk4.vozActiva)
            delay = Math.max(delay, 3200);
        _rk4.timer = setTimeout(loopRK4, delay);
    }
}

/* ═══════════════════════════════════════════════════════════════════
 PASO COMPLETO — FÓRMULAS CON VALORES REALES
 ═══════════════════════════════════════════════════════════════════ */
function ejecutarPasoModal() {
    const {x, y, z, h, p} = _rk4;
    const K = _rk4.K;

    // ── Calcular μ actual ──────────────────────────────────────────
    const zCrit = K * 0.3;
    const muActual = p.muBase + p.muStress * Math.max(0, (zCrit - z) / (zCrit + 1));

    /* ─────────────────────────────────────────
     FASE 1: Variables de estado
     ───────────────────────────────────────── */
    _activarFase('f1');
    document.getElementById('tl-f1-vals').innerHTML = `
        <div class="formula-blk">
          <span class="f-label">Estado actual en t = ${_rk4.t.toFixed(2)}</span>
          <div class="f-row"><span class="f-var fy-x">X</span><span class="f-eq">= ${fmtN(x)}</span><span class="f-hint">pob. urbana</span></div>
          <div class="f-row"><span class="f-var fy-y">Y</span><span class="f-eq">= ${fmtN(y)}</span><span class="f-hint">pob. periférica</span></div>
          <div class="f-row"><span class="f-var fy-z">Z</span><span class="f-eq">= ${fmtN(z)}</span><span class="f-hint">recursos (${(z / K * 100).toFixed(1)}% de K)</span></div>
          <div class="f-row mu-row"><span class="f-var">μ</span><span class="f-eq">= ${p.muBase.toFixed(4)} + ${p.muStress.toFixed(3)}·max(0, (${fmtN(zCrit)} − ${fmtN(z)}) / ${fmtN(zCrit + 1)})</span></div>
          <div class="f-row mu-row"><span class="f-var" style="visibility:hidden">μ</span><span class="f-eq" style="color:var(--accent1)">= ${muActual.toFixed(5)}</span></div>
        </div>`;

    /* ─────────────────────────────────────────
     FASE 2: EDOs — derivadas en (x, y, z)
     ───────────────────────────────────────── */
    const [dx, dy, dz] = derivatives(x, y, z, p);

    setTimeout(() => {
        _activarFase('f2');
        _completarFase('f1');
        document.getElementById('tl-f2-vals').innerHTML = `
            <div class="formula-blk">
              <span class="f-label">dX/dt = (β<sub>X</sub> − δ<sub>X</sub>)·X − μ·X + ν·Y</span>
              <div class="f-subst">(${p.birthX} − ${p.deathX})·<b>${fmtN(x)}</b> − ${muActual.toFixed(4)}·<b>${fmtN(x)}</b> + ${p.nuBase}·<b>${fmtN(y)}</b></div>
              <div class="f-result fy-x">= ${sci(dx)}</div>

              <span class="f-label" style="margin-top:10px;display:block">dY/dt = (β<sub>Y</sub> − δ<sub>Y</sub>)·Y + μ·X − ν·Y</span>
              <div class="f-subst">(${p.birthY} − ${p.deathY})·<b>${fmtN(y)}</b> + ${muActual.toFixed(4)}·<b>${fmtN(x)}</b> − ${p.nuBase}·<b>${fmtN(y)}</b></div>
              <div class="f-result fy-y">= ${sci(dy)}</div>

              <span class="f-label" style="margin-top:10px;display:block">dZ/dt = r·Z·(1 − Z/K) − c·(X+Y)</span>
              <div class="f-subst">${p.r}·${fmtN(z)}·(1 − ${fmtN(z)}/${fmtN(K)}) − ${p.tasaConsumo}·(${fmtN(x)}+${fmtN(y)})</div>
              <div class="f-result fy-z">= ${sci(dz)}</div>
            </div>`;
        _narrar(`EDOs evaluadas. X crece ${dx > 0 ? 'positivamente' : 'negativamente'} a razón de ${fmtHablar(Math.abs(dx))} por año. Los recursos ${dz > 0 ? 'se regeneran' : 'se agotan'}.`);
    }, 200);

    /* ─────────────────────────────────────────
     FASE 3: Coeficientes k1..k4 de RK4
     ───────────────────────────────────────── */
    const [k1x, k1y, k1z] = derivatives(x, y, z, p);
    const [k2x, k2y, k2z] = derivatives(x + h / 2 * k1x, y + h / 2 * k1y, z + h / 2 * k1z, p);
    const [k3x, k3y, k3z] = derivatives(x + h / 2 * k2x, y + h / 2 * k2y, z + h / 2 * k2z, p);
    const [k4x, k4y, k4z] = derivatives(x + h * k3x, y + h * k3y, z + h * k3z, p);

    setTimeout(() => {
        _activarFase('f3');
        _completarFase('f2');

        document.getElementById('tl-f3-vals').innerHTML = `
            <div class="formula-blk">
              <span class="f-label">Fórmula RK4 (para X):</span>
              <div class="f-subst small">k₁ = h·f(x, y, z)</div>
              <div class="f-subst small">k₂ = h·f(x+k₁/2, y+k₁/2, z+k₁/2)</div>
              <div class="f-subst small">k₃ = h·f(x+k₂/2, …)</div>
              <div class="f-subst small">k₄ = h·f(x+k₃, …)</div>
            </div>
            <div class="kcards-grid" id="tl-kcards-grid">
              <div class="tl-kcard" id="tl-k1"><div>k₁</div><div class="tl-kval" id="tl-k1v">—</div></div>
              <div class="tl-kcard" id="tl-k2"><div>k₂</div><div class="tl-kval" id="tl-k2v">—</div></div>
              <div class="tl-kcard" id="tl-k3"><div>k₃</div><div class="tl-kval" id="tl-k3v">—</div></div>
              <div class="tl-kcard" id="tl-k4"><div>k₄</div><div class="tl-kval" id="tl-k4v">—</div></div>
            </div>`;

        _animarKDetallado('k1', h, k1x, k1y, k1z, 0);
        _animarKDetallado('k2', h, k2x, k2y, k2z, 100);
        _animarKDetallado('k3', h, k3x, k3y, k3z, 200);
        _animarKDetallado('k4', h, k4x, k4y, k4z, 300);

        _narrar(`RK4 evalúa las pendientes en cuatro puntos del intervalo. k1 al inicio, k2 y k3 en el centro, k4 al final. Así elimina el error de Euler.`);
    }, 400);

    /* ─────────────────────────────────────────
     FASE 4: Combinación → nuevo estado
     ───────────────────────────────────────── */
    const nx = Math.max(0, x + h / 6 * (k1x + 2 * k2x + 2 * k3x + k4x));
    const ny = Math.max(0, y + h / 6 * (k1y + 2 * k2y + 2 * k3y + k4y));
    const nz = Math.max(0, z + h / 6 * (k1z + 2 * k2z + 2 * k3z + k4z));
    const nt = parseFloat((_rk4.t + h).toFixed(4));

    const dX = nx - x, dY = ny - y, dZ = nz - z;

    setTimeout(() => {
        _activarFase('f4');
        _completarFase('f3');

        document.getElementById('tl-f4-vals').innerHTML = `
            <div class="formula-blk">
              <span class="f-label">x_nuevo = x + h/6·(k₁ + 2k₂ + 2k₃ + k₄)</span>

              <div class="f-subst">X: ${fmtN(x)} + ${h}/6·(${fmtC(k1x)}+2·${fmtC(k2x)}+2·${fmtC(k3x)}+${fmtC(k4x)})</div>
              <div class="f-result fy-x">${fmtN(x)} → <strong>${fmtN(nx)}</strong>
                <span class="f-delta ${dX >= 0 ? 'pos' : 'neg'}">${dX >= 0 ? '+' : ''}${fmtN(dX)}</span>
              </div>

              <div class="f-subst" style="margin-top:8px">Y: ${fmtN(y)} + ${h}/6·(${fmtC(k1y)}+2·${fmtC(k2y)}+2·${fmtC(k3y)}+${fmtC(k4y)})</div>
              <div class="f-result fy-y">${fmtN(y)} → <strong>${fmtN(ny)}</strong>
                <span class="f-delta ${dY >= 0 ? 'pos' : 'neg'}">${dY >= 0 ? '+' : ''}${fmtN(dY)}</span>
              </div>

              <div class="f-subst" style="margin-top:8px">Z: ${fmtN(z)} + ${h}/6·(${fmtC(k1z)}+2·${fmtC(k2z)}+2·${fmtC(k3z)}+${fmtC(k4z)})</div>
              <div class="f-result fy-z">${fmtN(z)} → <strong>${fmtN(nz)}</strong>
                <span class="f-delta ${dZ >= 0 ? 'pos' : 'neg'}">${dZ >= 0 ? '+' : ''}${fmtN(dZ)}</span>
              </div>
            </div>`;

        _setEstado(nx, ny, nz, nt);

        _rk4.paso++;
        _rk4.x = nx;
        _rk4.y = ny;
        _rk4.z = nz;
        _rk4.t = nt;

        const prog = (_rk4.paso / _rk4.totalPasos * 100).toFixed(1);
        document.getElementById('rk4m-progress').style.width = prog + '%';
        document.getElementById('rk4m-counter').textContent = `paso ${_rk4.paso} / ${_rk4.totalPasos}`;

        _setNarracionPaso(_rk4.paso, _rk4.totalPasos, nt, nx, ny, nz, K, dX, dY, dZ, muActual);
        _completarFase('f4');

        if (_rk4.paso >= _rk4.totalPasos) {
            pararRK4Modal();
            document.getElementById('rk4m-btn-play').disabled = true;
            document.getElementById('rk4m-btn-pause').disabled = true;
            _setNarracionHTML(`✓ <strong>Simulación completa</strong> — ${_rk4.totalPasos} iteraciones RK4 aplicadas.<br>
                X = <strong style="color:var(--accent1)">${fmtN(nx)}</strong> · 
                Y = <strong style="color:var(--accent2)">${fmtN(ny)}</strong> · 
                Z = <strong style="color:var(--accent3)">${fmtN(nz)}</strong>`);
            _narrar(`Simulación completa. Después de ${_rk4.totalPasos} pasos, la población urbana quedó en ${fmtHablar(nx)}, la periférica en ${fmtHablar(ny)}, y los recursos en ${fmtHablar(nz)}.`);
        }
    }, 650);
}

/* ── Animación de tarjetas k con valores ─────────────────────────── */
function _animarKDetallado(k, h, kdx, kdy, kdz, delayMs) {
    setTimeout(() => {
        const kc = document.getElementById('tl-' + k);
        const kv = document.getElementById('tl-' + k + 'v');
        if (kc)
            kc.className = 'tl-kcard k-activa';
        if (kv)
            kv.innerHTML = `
            <span class="kd-line fy-x">ΔX = ${fmtC(h * kdx, 3)}</span>
            <span class="kd-line fy-y">ΔY = ${fmtC(h * kdy, 3)}</span>
            <span class="kd-line fy-z">ΔZ = ${fmtC(h * kdz, 3)}</span>`;
        setTimeout(() => {
            if (kc)
                kc.className = 'tl-kcard k-done';
        }, 700);
    }, delayMs);
}

/* ── NARRACIÓN EDUCATIVA DINÁMICA ────────────────────────────────── */
const _mensajesNar = [
    (p, T, t, x, y, z, K, dX, dY, dZ, mu) =>
            `Paso ${p}/${T} · t = ${t.toFixed(1)} año${t !== 1 ? 's' : ''}. La tasa de migración μ es ${mu.toFixed(4)}: mientras más escasos sean los recursos, más gente sale de la ciudad.`,
    (p, T, t, x, y, z, K, dX, dY, dZ, mu) => {
        const zPct = (z / K * 100).toFixed(0);
        return `Paso ${p}/${T}. Los recursos Z representan el ${zPct} % de la capacidad máxima K. La EDO de Z tiene dos fuerzas: regeneración logística y consumo por (X+Y).`;
    },
    (p, T, t, x, y, z, K, dX, dY, dZ, mu) =>
            `Paso ${p}/${T}. El promedio ponderado de RK4 da más peso a k₂ y k₃ porque están en el centro del intervalo, donde la curvatura importa más.`,
    (p, T, t, x, y, z, K, dX, dY, dZ, mu) =>
            `Paso ${p}/${T}. La población urbana ${dX >= 0 ? 'creció' : 'decreció'} en ${fmtHablar(Math.abs(dX))} y la periférica ${dY >= 0 ? 'creció' : 'decreció'} en ${fmtHablar(Math.abs(dY))}. Las tres EDOs están acopladas: Z afecta a μ, μ afecta a X e Y.`,
    (p, T, t, x, y, z, K, dX, dY, dZ, mu) =>
            `Paso ${p}/${T}. Sin RK4, Euler acumularía error O(h²) por paso. Con RK4 el error es O(h⁵), millones de veces menor para el mismo h.`,
];

function _setNarracionPaso(paso, total, t, x, y, z, K, dX, dY, dZ, mu) {
    const idx = (paso - 1) % _mensajesNar.length;
    const texto = _mensajesNar[idx](paso, total, t, x, y, z, K, dX, dY, dZ, mu);
    _setNarracionHTML(`<strong>Paso ${paso}/${total}</strong> · ${texto.replace(/^Paso \d+\/\d+\. ?/, '')}`);
    if (paso % 3 === 0 || paso === 1 || paso === total) {
        _narrar(texto);
    }
}

function _setNarracionHTML(html) {
    document.getElementById('rk4m-narration').innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════════════
 VOZ — Web Speech API (CORREGIDA)
 
 Causa real del bug anterior: el modal arrancaba la simulación con
 un setTimeout(), y la primera llamada a speechSynthesis.speak()
 ocurría DENTRO de ese setTimeout — eso ya no cuenta como "gesto
 del usuario" para el navegador, así que el audio se bloqueaba
 en silencio (el onerror vacío ocultaba el problema).
 
 Solución:
 1. _intentarActivarVoz() ahora se llama directamente dentro de
 iniciarRK4Modal() y alternarVoz(), que SOLO se ejecutan desde
 un onclick real → gesto válido.
 2. Se espera a que las voces del navegador estén cargadas
 (evento 'voiceschanged') antes de elegir una voz en español,
 porque en Chrome la lista de voces llega de forma asíncrona.
 ═══════════════════════════════════════════════════════════════════ */

function _elegirVozEspanol() {
    if (!window.speechSynthesis)
        return null;
    const voces = speechSynthesis.getVoices();
    if (!voces.length)
        return null;
    return voces.find(v => v.lang === 'es-ES')
            || voces.find(v => v.lang && v.lang.startsWith('es'))
            || null;
}

if (window.speechSynthesis) {
    speechSynthesis.onvoiceschanged = () => {
        _rk4.vozEs = _elegirVozEspanol();
    };
    _rk4.vozEs = _elegirVozEspanol();

    // Parche para el bug de Chrome: speechSynthesis se autopausa si pasa
    // demasiado tiempo "hablando" sin interacción. Esto la mantiene activa.
    setInterval(() => {
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            speechSynthesis.pause();
            speechSynthesis.resume();
        }
    }, 4000);
}

/* Ya NO usamos una utterance fantasma silenciosa para "desbloquear":
 esas a veces nunca disparan onend en Chrome y dejaban la voz bloqueada
 para siempre. Ahora se habla directo, dentro del click real. */
function _intentarActivarVoz() {
    if (!window.speechSynthesis)
        return;
    if (!_rk4.vozEs)
        _rk4.vozEs = _elegirVozEspanol();
    document.getElementById('rk4m-voice-icon').textContent = '🔈';
    speechSynthesis.cancel();
    _narrar('Narración activada. Iniciando simulación paso a paso.');
}

function alternarVoz() {
    if (!window.speechSynthesis) {
        alert('Tu navegador no soporta síntesis de voz (Web Speech API). Probá en Chrome o Edge.');
        return;
    }
    if (!_rk4.vozActiva) {
        _rk4.vozActiva = true;
        _intentarActivarVoz();
    } else {
        _rk4.vozActiva = false;
        speechSynthesis.cancel();
        document.getElementById('rk4m-voice-icon').textContent = '🔇';
    }
}

function _narrar(texto) {
    if (!_rk4.vozActiva || !window.speechSynthesis)
        return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto.replace(/<[^>]+>/g, ''));
    u.lang = 'es-ES';
    if (_rk4.vozEs)
        u.voice = _rk4.vozEs;
    u.rate = 0.35;
    u.pitch = 1.0;
    u.volume = 1.0;
    u.onerror = (e) => console.warn('Error de síntesis de voz:', e.error);
    speechSynthesis.speak(u);
}

/* ── Glosario (sección explicativa para público no técnico) ─────── */
function alternarGlosario() {
    const box = document.getElementById('rk4m-glosario');
    const btn = document.getElementById('rk4m-glosario-btn');
    const abierto = box.style.display !== 'none';
    box.style.display = abierto ? 'none' : 'block';
    btn.textContent = abierto ? '📖 ¿Qué significa cada cosa? (clic para ver)' : '📖 Ocultar explicación';
}

/* ── Animaciones del timeline ────────────────────────────────────── */
function _activarFase(id) {
    const el = document.getElementById('tl-' + id);
    if (el)
        el.className = 'tl-fase tl-activa';
}
function _completarFase(id) {
    const el = document.getElementById('tl-' + id);
    if (el)
        el.className = 'tl-fase tl-completa';
}

/* ── Barras de estado ────────────────────────────────────────────── */
function _setEstado(x, y, z, t) {
    const K = _rk4.K || 1000;
    document.getElementById('rk4m-t').textContent = parseFloat(t).toFixed(2);
    document.getElementById('rk4m-x').textContent = fmtN(x);
    document.getElementById('rk4m-y').textContent = fmtN(y);
    document.getElementById('rk4m-z').textContent = fmtN(z);
    document.getElementById('rk4m-xbar').style.width = pct(x, K);
    document.getElementById('rk4m-ybar').style.width = pct(y, K);
    document.getElementById('rk4m-zbar').style.width = pct(z, K);
}

/* ── Cerrar al clic en el fondo ──────────────────────────────────── */
document.getElementById('rk4-modal').addEventListener('click', function (e) {
    if (e.target === this)
        cerrarModalRK4();
});