/* ============================================================
 analisis-numerico.js — EcuaSim · Métodos Numéricos en acción
 ------------------------------------------------------------
 v2 — Pulido visual + repurposeo del 3D (ver prompt de referencia):
 
 1. El 3D ya NO es un retrato de fase: el mismo <div id="plotly-fase-3d">
 (renombrado en runtime a "plotly-superficie-3d") ahora se reutiliza
 como superficie de heatmap (sensibilidad o error), alternable con
 la vista de grilla 2D mediante un botón toggle. Se agrega en runtime
 junto al selector de métrica de cada sección — no se tocó el HTML.
 2. Todas las líneas (comparación, convergencia, fases 2D) se dibujan
 progresivamente punto por punto.
 3. Comparación / convergencia / fases 2D reciben gradiente, glow y
 hover-fade igual que chartPop/chartZ. Crosshair combinado extendido
 a los 3 charts de comparación.
 4. Barras con gradiente, esquinas redondeadas y crecimiento escalonado.
 5. Celdas de heatmap con entrada escalonada (barrido).
 
 No se modifica el modal RK4 paso a paso ni el módulo Juego. Se carga
 DESPUÉS de simulador.js y envuelve renderCharts() en tiempo de
 ejecución, igual que la v1.
 ============================================================ */

(function () {
    "use strict";

    /* ══════════════════════════════════════════════════════════════
     7) HEATMAP DE ERROR DE RK4
     ══════════════════════════════════════════════════════════════ */
    const NOMBRE_PARAM_ERROR = {
        r: 'r (renovación)', K: 'K (capacidad)',
        muStress: 'α (μStress)', tasaConsumo: 'c (consumo)'
    };

    function actualizarVisibilidadColumnaError() {
        const tipo = document.getElementById('sel-columna-heatmap-error').value;
        const fgParam = document.getElementById('fg-param-heatmap-error');
        if (fgParam)
            fgParam.style.display = tipo === 'parametro' ? 'flex' : 'none';
    }

    // ── Guarda el último resultado de cada heatmap para poder togglear
    //    grilla <-> superficie 3D sin tener que recalcular nada.
    const _ultimoHeatmap = {
        error: null, // { data, tipo, paramNombre, metrica }
        sensibilidad: null, // { data, par, metrica }
        estabilidad: null, // { data, paramNombre }
    };
    const _vista = {error: 'grilla', sensibilidad: 'grilla', estabilidad: 'grilla'};
    async function calcularHeatmapError() {
        const tipo = document.getElementById('sel-columna-heatmap-error').value;
        const paramNombre = document.getElementById('sel-param-heatmap-error').value;
        const metrica = document.getElementById('sel-metrica-heatmap-error').value;
        const c = condicionesActuales();
        const p = paramsActuales();
        const btn = document.getElementById('btn-heatmap-error');
        const cont = document.getElementById('heatmap-error');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Calculando grilla…';
        }
        if (cont) {
            cont.innerHTML = '';
            cont.classList.add('heatmap-cargando');
        }

        const rangosParam = {
            r: {min: 0.01, max: 0.15},
            K: {min: 300, max: 2000},
            muStress: {min: 0.01, max: 0.3},
            tasaConsumo: {min: 0.00005, max: 0.0008},
        };

        try {
            const body = {
                x0: c.x0, y0: c.y0, z0: c.z0,
                hMin: c.h / 8, hMax: c.h * 4, hPasos: 8,
                columnaTipo: tipo,
                tFinalMin: c.h * c.pasos * 0.25, tFinalMax: c.h * c.pasos, tFinalPasos: 8,
                tFinalFijo: c.h * c.pasos,
                paramNombre, paramMin: rangosParam[paramNombre].min, paramMax: rangosParam[paramNombre].max, paramPasos: 8,
                ...p
            };
            const data = await postJSON('/api/simulacion/heatmap-error', body);
            _ultimoHeatmap.error = {data, tipo, paramNombre, metrica};
            renderVistaError();
        } catch (e) {
            console.error(e);
            alert('No se pudo calcular el heatmap de error: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔥 Calcular heatmap de error';
            }
            if (cont)
                cont.classList.remove('heatmap-cargando');
        }
    }

    function renderVistaError() {
        if (!_ultimoHeatmap.error)
            return;
        const {data, tipo, paramNombre, metrica} = _ultimoHeatmap.error;
        if (_vista.error === '3d') {
            mostrarSuperficieError(data, tipo, paramNombre, metrica);
        } else {
            const cont = document.getElementById('heatmap-error');
            if (cont)
                cont.style.display = '';
            ocultarSuperficie3D('error');
            renderHeatmapError(data, tipo, paramNombre, metrica);
        }
    }

    function renderHeatmapError(data, tipo, paramNombre, metrica) {
        const cont = document.getElementById('heatmap-error');
        const barraCont = document.getElementById('heatmap-error-barra');
        if (!cont)
            return;
        cont.innerHTML = '';
        if (barraCont)
            barraCont.innerHTML = '';

        const matriz = metrica === 'relativo' ? data.matrizRelativo
                : metrica === 'rms' ? data.matrizRMS
                : data.matrizAbsoluto;

        let min = Infinity, max = -Infinity;
        let minI = 0, minJ = 0;
        matriz.forEach((fila, i) => fila.forEach((v, j) => {
                if (v < min) {
                    min = v;
                    minI = i;
                    minJ = j;
                }
                if (v > max)
                    max = v;
            }));

        const reducido = window.EcuaSimVisual.prefiereMovimientoReducido();
        const numColumnas = data.valoresColumna.length;

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `90px repeat(${numColumnas}, 1fr)`;
        grid.style.gap = '2px';
        grid.style.fontSize = '10px';
        grid.style.fontFamily = "'Space Grotesk', monospace";

        grid.appendChild(celdaEtiqueta('h \\ col'));
        data.valoresColumna.forEach(vc => grid.appendChild(celdaEtiqueta(fmtCortoError(vc))));

        data.valoresH.forEach((h, i) => {
            grid.appendChild(celdaEtiqueta('h=' + fmtCortoError(h)));
            matriz[i].forEach((valor, j) => {
                const vc = data.valoresColumna[j];
                const logMin = Math.log10(Math.max(min, 1e-12));
                const logMax = Math.log10(Math.max(max, 1e-12));
                const logV = Math.log10(Math.max(valor, 1e-12));
                const t = logMax > logMin ? (logV - logMin) / (logMax - logMin) : 0.5;

                const esGanadora = (i === minI && j === minJ);

                const celda = document.createElement('div');
                celda.className = 'heatmap-celda' + (esGanadora ? ' celda-ganadora' : '')
                        + (reducido ? '' : ' heatmap-celda-entrada');
                celda.style.background = colorViridis(t);
                celda.style.padding = '6px 2px';
                celda.style.textAlign = 'center';
                celda.style.borderRadius = '3px';
                celda.style.color = luminanciaViridis(t);
                celda.textContent = valor.toExponential(1);
                if (!reducido)
                    celda.style.animationDelay = `${(i * numColumnas + j) * 12}ms`;

                const htmlTooltip = `
                    <div><span class="htf-label">h =</span> <span class="htf-val">${h.toFixed(4)}</span></div>
                    <div><span class="htf-label">${tipo === 'parametro' ? paramNombre : 't_final'} =</span> <span class="htf-val">${vc.toFixed(4)}</span></div>
                    <div><span class="htf-label">error =</span> <span class="htf-val">${valor.toExponential(3)}</span></div>
                    ${esGanadora ? '<div style="color:#fde725;margin-top:3px;">🏆 Menor error de la grilla</div>' : ''}`;

                celda.addEventListener('mouseenter', (e) => mostrarTooltipCelda(e, htmlTooltip));
                celda.addEventListener('mousemove', posicionarTooltip);
                celda.addEventListener('mouseleave', ocultarTooltipCelda);

                grid.appendChild(celda);
            });
        });

        cont.appendChild(grid);

        // ── Barra de colores (escala real con gradiente viridis) ──
        if (barraCont) {
            const nombreMetrica = metrica === 'relativo' ? 'Error relativo'
                    : metrica === 'rms' ? 'Error RMS' : 'Error absoluto';
            const nombreCol = tipo === 'parametro' ? NOMBRE_PARAM_ERROR[paramNombre] : 't_final';

            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.alignItems = 'center';
            wrap.style.gap = '.6rem';
            wrap.style.fontSize = '.7rem';
            wrap.style.color = 'var(--muted)';

            const barra = document.createElement('div');
            barra.style.height = '10px';
            barra.style.flex = '1';
            barra.style.borderRadius = '5px';
            barra.style.background = gradienteCSSViridis();

            const lblMin = document.createElement('span');
            lblMin.textContent = min.toExponential(1);
            const lblMax = document.createElement('span');
            lblMax.textContent = max.toExponential(1);

            wrap.appendChild(lblMin);
            wrap.appendChild(barra);
            wrap.appendChild(lblMax);
            barraCont.appendChild(wrap);

            const leyenda = document.createElement('div');
            leyenda.style.marginTop = '.4rem';
            leyenda.style.fontSize = '.7rem';
            leyenda.style.color = 'var(--muted)';
            leyenda.textContent = `Filas: h (paso) · Columnas: ${nombreCol} · Métrica: ${nombreMetrica} (escala de color logarítmica, paleta viridis) · 🏆 = menor error`;
            barraCont.appendChild(leyenda);
        }
    }

    function fmtCortoError(n) {
        if (Math.abs(n) >= 1000)
            return (n / 1000).toFixed(1) + 'K';
        if (Math.abs(n) < 0.01 && n !== 0)
            return n.toExponential(1);
        return n.toFixed(3);
    }


    // ── Paleta acorde a las variables CSS existentes ──────────────────
    function cssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
    }
    const COLOR = {
        accent1: () => cssVar('--accent1'),
        accent2: () => cssVar('--accent2'),
        accent3: () => cssVar('--accent3'),
        muted: () => cssVar('--muted'),
        border: () => cssVar('--border'),
        text: () => cssVar('--text'),
    };
    /* ══════════════════════════════════════════════════════════
     PALETA VIRIDIS SIMPLIFICADA — 5 stops interpolados en RGB.
     ══════════════════════════════════════════════════════════ */
    const VIRIDIS_STOPS = [
        [68, 1, 84], // morado oscuro (valor bajo)
        [59, 82, 139], // azul
        [33, 145, 140], // verde-azulado
        [94, 201, 98], // verde claro
        [253, 231, 37], // amarillo (valor alto)
    ];
    function colorViridis(t) {
        t = Math.max(0, Math.min(1, t));
        const n = VIRIDIS_STOPS.length - 1;
        const idx = Math.min(n - 1, Math.floor(t * n));
        const localT = (t * n) - idx;
        const [r1, g1, b1] = VIRIDIS_STOPS[idx];
        const [r2, g2, b2] = VIRIDIS_STOPS[idx + 1];
        const r = Math.round(r1 + (r2 - r1) * localT);
        const g = Math.round(g1 + (g2 - g1) * localT);
        const b = Math.round(b1 + (b2 - b1) * localT);
        return `rgb(${r},${g},${b})`;
    }
    function luminanciaViridis(t) {
        return t < 0.15 || t > 0.85 ? '#ffffff' : '#050b14';
    }
    function gradienteCSSViridis() {
        return `linear-gradient(to right, ${VIRIDIS_STOPS.map(([r, g, b]) => `rgb(${r},${g},${b})`).join(', ')})`;
    }
    // ── Mismos 5 stops, en formato colorscale de Plotly [0..1] ────────
    function viridisPlotlyColorscale() {
        const n = VIRIDIS_STOPS.length - 1;
        return VIRIDIS_STOPS.map(([r, g, b], i) => [i / n, `rgb(${r},${g},${b})`]);
    }

    /* ══════════════════════════════════════════════════════════
     TOOLTIP FLOTANTE PROPIO (reemplaza el title nativo del div)
     ══════════════════════════════════════════════════════════ */
    let _tooltipEl = null;
    function _getTooltip() {
        if (_tooltipEl)
            return _tooltipEl;
        _tooltipEl = document.createElement('div');
        _tooltipEl.id = 'heatmap-tooltip-flotante';
        document.body.appendChild(_tooltipEl);
        return _tooltipEl;
    }
    function mostrarTooltipCelda(evt, html) {
        const tt = _getTooltip();
        tt.innerHTML = html;
        tt.classList.add('visible');
        posicionarTooltip(evt);
    }
    function posicionarTooltip(evt) {
        const tt = _getTooltip();
        const margen = 14;
        let x = evt.clientX + margen;
        let y = evt.clientY + margen;
        const rect = tt.getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 8)
            x = evt.clientX - rect.width - margen;
        if (y + rect.height > window.innerHeight - 8)
            y = evt.clientY - rect.height - margen;
        tt.style.left = x + 'px';
        tt.style.top = y + 'px';
    }
    function ocultarTooltipCelda() {
        if (_tooltipEl)
            _tooltipEl.classList.remove('visible');
    }

    /* ══════════════════════════════════════════════════════════
     Reduced motion + animación progresiva compartida (punto 2)
     ══════════════════════════════════════════════════════════ */
    function prefiereMovimientoReducido() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // Animación de "trazado" punto por punto para gráficas de línea /
    // scatter con showLine:true. Ajusta el stagger para que la duración
    // total no supere ~1.5s incluso con muchos puntos.
    function opcionesAnimacionProgresiva(numPuntos) {
        const V = window.EcuaSimVisual;
        if (V.prefiereMovimientoReducido())
            return false;
        const n = Math.max(1, numPuntos || 1);
        const stagger = Math.min(6, Math.max(0.4, 900 / n));
        return {
            x: {type: 'number', duration: 900, from: NaN,
                delay: (ctx) => ctx.type === 'data' ? ctx.dataIndex * stagger : 0},
            y: {type: 'number', duration: 900, from: NaN,
                delay: (ctx) => ctx.type === 'data' ? ctx.dataIndex * stagger : 0},
        };
    }

    function condicionesHeatmap(par) {
        const p = paramsActuales();

        let Kref = p.K;
        if (par.p1 === 'K')
            Kref = (par.p1min + par.p1max) / 2;
        if (par.p2 === 'K')
            Kref = (par.p2min + par.p2max) / 2;

        return {
            x0: Kref * 2,
            y0: Kref * 0.5,
            z0: Kref * 0.6,
        };
    }

    function paramsActuales() {
        return {
            birthX: parseFloat(document.getElementById('birthX').value),
            deathX: parseFloat(document.getElementById('deathX').value),
            birthY: parseFloat(document.getElementById('birthY').value),
            deathY: parseFloat(document.getElementById('deathY').value),
            muBase: parseFloat(document.getElementById('muBase').value),
            muStress: parseFloat(document.getElementById('muStress').value),
            nuBase: parseFloat(document.getElementById('nuBase').value),
            tasaConsumo: parseFloat(document.getElementById('tasaConsumo').value),
            r: parseFloat(document.getElementById('r').value),
            K: parseFloat(document.getElementById('K').value),
        };
    }
    function condicionesActuales() {
        return {
            x0: parseFloat(document.getElementById('x0').value),
            y0: parseFloat(document.getElementById('y0').value),
            z0: parseFloat(document.getElementById('z0').value),
            h: parseFloat(document.getElementById('h').value),
            pasos: parseInt(document.getElementById('pasos').value),
        };
    }

    async function postJSON(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        if (!res.ok)
            throw new Error('HTTP ' + res.status + ' en ' + url);
        return res.json();
    }
    async function getJSON(url) {
        const res = await fetch(url);
        if (!res.ok)
            throw new Error('HTTP ' + res.status + ' en ' + url);
        return res.json();
    }

    /* ══════════════════════════════════════════════════════════════
     1) COMPARACIÓN EULER vs RK4
     ══════════════════════════════════════════════════════════════ */
    let chartsComparacion = {x: null, y: null, z: null};

    async function compararMetodos() {
        const c = condicionesActuales();
        const p = paramsActuales();
        const btn = document.getElementById('btn-comparar-metodos');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Calculando…';
        }
        try {
            const data = await postJSON('/api/simulacion/comparar-metodos', {
                t0: 0, x0: c.x0, y0: c.y0, z0: c.z0, h: c.h, pasos: c.pasos, ...p
            });
            renderComparacion(data);
        } catch (e) {
            console.error(e);
            alert('No se pudo calcular la comparación Euler vs RK4: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '⚖️ Comparar Euler vs RK4';
            }
        }
    }

    function renderComparacion(data) {
        const V = window.EcuaSimVisual;
        V.registrarZoomPlugin();
        const reducido = V.prefiereMovimientoReducido();
        const animacion = opcionesAnimacionProgresiva(data.tiempos.length);

        const specs = [
            {key: 'X', canvas: 'chart-comp-x', euler: data.eulerX, rk4: data.rk4X, color: COLOR.accent1()},
            {key: 'Y', canvas: 'chart-comp-y', euler: data.eulerY, rk4: data.rk4Y, color: COLOR.accent2()},
            {key: 'Z', canvas: 'chart-comp-z', euler: data.eulerZ, rk4: data.rk4Z, color: COLOR.accent3()},
        ];
        specs.forEach(s => {
            const canvas = document.getElementById(s.canvas);
            if (!canvas)
                return;
            const store = s.key.toLowerCase();
            if (chartsComparacion[store])
                chartsComparacion[store].destroy();

            chartsComparacion[store] = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: data.tiempos,
                    datasets: [
                        {
                            // Euler: sin relleno, punteada — para diferenciarse del RK4
                            label: s.key + ' — Euler', data: s.euler, borderColor: s.color,
                            borderDash: [6, 4], borderWidth: 2, pointRadius: 0, tension: 0,
                            fill: false, glow: false,
                        },
                        {
                            // RK4: gradiente + glow, igual que chartPop/chartZ
                            label: s.key + ' — RK4', data: s.rk4, borderColor: s.color,
                            backgroundColor: V.crearGradienteVertical(s.color, 0.24, 0.02),
                            borderWidth: 2.5, pointRadius: 0, tension: .25, fill: true,
                            glow: !reducido, glowColor: s.color, glowBlur: 7,
                        },
                    ]
                },
                plugins: [V.pluginGridOsciloscopio, V.pluginGlowLineas],
                options: {
                    ...chartOptionsLineas(s.key + ': divergencia entre métodos'),
                    animation: animacion,
                }
            });
            V.aplicarHoverFade(chartsComparacion[store]);
        });

        // Crosshair combinado entre los 3 charts de comparación (mismo t)
        V.activarCrosshairCombinado(
                [document.getElementById('chart-comp-x'), document.getElementById('chart-comp-y'), document.getElementById('chart-comp-z')],
                {ts: data.tiempos, xs: data.rk4X, ys: data.rk4Y, zs: data.rk4Z},
                [chartsComparacion.x, chartsComparacion.y, chartsComparacion.z]
                );
    }

    function chartOptionsBase(titulo) {
        const tick = COLOR.muted(), grid = COLOR.border();
        return {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {labels: {color: tick, boxWidth: 10}},
                title: {display: !!titulo, text: titulo, color: tick, font: {size: 11}}
            },
            scales: {
                x: {ticks: {color: tick, maxTicksLimit: 8}, grid: {color: grid}},
                y: {ticks: {color: tick}, grid: {color: grid}}
            }
        };
    }
    function chartOptionsLineas(titulo, extra = {}) {
        const V = window.EcuaSimVisual;
        const base = chartOptionsBase(titulo);
        base.plugins.gridOsciloscopio = {enabled: true, color: extra.gridColor || 'rgba(255,255,255,.04)', paso: 26};
        base.plugins.zoom = V.opcionesZoomPan();
        return base;
    }

    /* ══════════════════════════════════════════════════════════════
     2) ANÁLISIS DE CONVERGENCIA (log-log)
     ══════════════════════════════════════════════════════════════ */
    let chartConvergencia = null;

    async function analizarConvergencia() {
        const c = condicionesActuales();
        const p = paramsActuales();
        const tFinal = c.h * c.pasos;
        const btn = document.getElementById('btn-convergencia');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Calculando…';
        }
        try {
            const data = await postJSON('/api/simulacion/convergencia', {
                x0: c.x0, y0: c.y0, z0: c.z0, hBase: c.h, tFinal, ...p
            });
            renderConvergencia(data);
        } catch (e) {
            console.error(e);
            alert('No se pudo calcular la convergencia: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '📉 Analizar convergencia';
            }
        }
    }

    function renderConvergencia(data) {
        const V = window.EcuaSimVisual;
        V.registrarZoomPlugin();
        const reducido = V.prefiereMovimientoReducido();

        const canvas = document.getElementById('chart-convergencia');
        if (!canvas)
            return;
        if (chartConvergencia)
            chartConvergencia.destroy();

        const toXY = arr => arr.map(pt => ({x: pt.h, y: Math.max(pt.error, 1e-12)}));
        const numPuntos = Math.max(data.euler.length, data.rk4.length);
        const animacion = opcionesAnimacionProgresiva(numPuntos);

        chartConvergencia = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                datasets: [
                    {label: 'Euler (orden ≈ 1)', data: toXY(data.euler), borderColor: COLOR.accent2(),
                        backgroundColor: COLOR.accent2(), borderWidth: 2, pointRadius: 4, showLine: true,
                        pointHoverRadius: 7, hoverBorderWidth: 3},
                    {label: 'RK4 (orden ≈ 4)', data: toXY(data.rk4), borderColor: COLOR.accent1(),
                        backgroundColor: COLOR.accent1(), borderWidth: 2, pointRadius: 4, showLine: true,
                        pointHoverRadius: 7, hoverBorderWidth: 3,
                        glow: !reducido, glowColor: COLOR.accent1(), glowBlur: 6},
                ]
            },
            plugins: [V.pluginGridOsciloscopio, V.pluginGlowLineas],
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: animacion,
                // Resalta el punto/línea bajo el cursor aumentando su grosor
                onHover: (evt, elems, chart) => {
                    chart.data.datasets.forEach((ds, i) => {
                        const activo = elems.some(el => el.datasetIndex === i);
                        ds.borderWidth = activo ? 3.5 : 2;
                    });
                    chart.update('none');
                },
                plugins: {
                    legend: {labels: {color: COLOR.muted(), boxWidth: 10}},
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: h=${ctx.parsed.x}, error=${ctx.parsed.y.toExponential(3)}`
                        }
                    },
                    title: {
                        display: true,
                        text: 'Escala log-log: la pendiente ≈ orden del método (Euler≈1, RK4≈4)',
                        color: COLOR.muted(), font: {size: 11}
                    },
                    gridOsciloscopio: {enabled: true, color: 'rgba(255,255,255,.04)', paso: 30},
                    zoom: V.opcionesZoomPan(),
                },
                scales: {
                    x: {type: 'logarithmic', title: {display: true, text: 'h (paso)', color: COLOR.muted()},
                        ticks: {color: COLOR.muted()}, grid: {color: COLOR.border()}},
                    y: {type: 'logarithmic', title: {display: true, text: 'error (norma euclidiana en t_final)', color: COLOR.muted()},
                        ticks: {color: COLOR.muted()}, grid: {color: COLOR.border()}}
                }
            }
        });
        V.aplicarHoverFade(chartConvergencia);
    }

    /* ══════════════════════════════════════════════════════════════
     3) RETRATOS DE FASE 2D + SUPERFICIE 3D (repurposeada)
     Los 2D se alimentan de la ÚLTIMA corrida RK4 ya hecha por runSim(),
     capturada envolviendo renderCharts() (ver más abajo). El 3D ya NO
     dibuja la trayectoria de fase: ver sección "SUPERFICIE 3D" abajo.
     ══════════════════════════════════════════════════════════════ */
    let chartsFase = {xy: null, xz: null, yz: null};
    let puntoEquilibrio = null; // {x,y,z} si ya se calculó

    /* ══════════════════════════════════════════════════════════
     PULSO EN EL PUNTO DE EQUILIBRIO (solo 2D — el 3D ya no muestra
     la trayectoria/equilibrio, ver repurposeo de la superficie 3D)
     ══════════════════════════════════════════════════════════ */
    let _pulseEquilibrioRAF = null;

    function iniciarPulsoEquilibrio() {
        detenerPulsoEquilibrio();
        const V = window.EcuaSimVisual;
        if (V && V.prefiereMovimientoReducido())
            return;

        const t0 = performance.now();
        function loop() {
            if (!puntoEquilibrio) {
                _pulseEquilibrioRAF = null;
                return;
            }
            const t = (performance.now() - t0) / 1000;
            const radio2D = 6 + Math.sin(t * 3) * 2.2; // oscila 3.8 – 8.2

            Object.values(chartsFase).forEach(chart => {
                if (!chart)
                    return;
                const ds = chart.data.datasets.find(d => d.label === 'Punto de equilibrio');
                if (ds) {
                    ds.pointRadius = radio2D;
                    chart.update('none');
                }
            });
            _pulseEquilibrioRAF = requestAnimationFrame(loop);
        }
        _pulseEquilibrioRAF = requestAnimationFrame(loop);
    }
    function detenerPulsoEquilibrio() {
        if (_pulseEquilibrioRAF) {
            cancelAnimationFrame(_pulseEquilibrioRAF);
            _pulseEquilibrioRAF = null;
        }
    }

    /* ── Punto animado que recorre la trayectoria una vez (opcional,
     reusa el patrón de iniciarPulsoEquilibrio) ────────────────── */
    function recorrerTrayectoriaUnaVez(chart, puntos) {
        const V = window.EcuaSimVisual;
        if (!chart || V.prefiereMovimientoReducido() || !puntos.length)
            return;
        const idxDataset = chart.data.datasets.push({
            label: '_recorrido', data: [puntos[0]], showLine: false,
            pointRadius: 5, pointStyle: 'circle',
            backgroundColor: chart.data.datasets[0].borderColor,
            borderColor: '#ffffff', borderWidth: 1,
        }) - 1;
        const duracionMs = 1400;
        const t0 = performance.now();
        function frame(ahora) {
            const frac = Math.min(1, (ahora - t0) / duracionMs);
            const idx = Math.min(puntos.length - 1, Math.floor(frac * (puntos.length - 1)));
            chart.data.datasets[idxDataset].data = [puntos[idx]];
            chart.update('none');
            if (frac < 1)
                requestAnimationFrame(frame);
            else {
                chart.data.datasets.splice(idxDataset, 1);
                chart.update('none');
            }
        }
        requestAnimationFrame(frame);
    }

    function renderFase2D(ts, xs, ys, zs) {
        const V = window.EcuaSimVisual;
        const reducido = V.prefiereMovimientoReducido();
        const animacion = opcionesAnimacionProgresiva(xs.length);
        const specs = [
            {key: 'xy', canvas: 'chart-fase-xy', a: xs, b: ys, labelA: 'X', labelB: 'Y', color: COLOR.accent1()},
            {key: 'xz', canvas: 'chart-fase-xz', a: xs, b: zs, labelA: 'X', labelB: 'Z', color: COLOR.accent2()},
            {key: 'yz', canvas: 'chart-fase-yz', a: ys, b: zs, labelA: 'Y', labelB: 'Z', color: COLOR.accent3()},
        ];
        specs.forEach(s => {
            const canvas = document.getElementById(s.canvas);
            if (!canvas)
                return;
            if (chartsFase[s.key])
                chartsFase[s.key].destroy();

            const puntos = s.a.map((v, i) => ({x: v, y: s.b[i]}));
            const datasets = [{
                    label: `Trayectoria (${s.labelA}, ${s.labelB})`,
                    data: puntos, showLine: true, fill: false,
                    borderColor: s.color, backgroundColor: s.color,
                    borderWidth: 2, pointRadius: 0,
                    glow: !reducido, glowColor: s.color, glowBlur: 6,
                }];

            if (puntoEquilibrio) {
                const ejeA = s.labelA === 'X' ? puntoEquilibrio.x : puntoEquilibrio.y;
                const ejeB = s.labelB === 'Y' ? puntoEquilibrio.y : puntoEquilibrio.z;
                datasets.push({
                    label: 'Punto de equilibrio', data: [{x: ejeA, y: ejeB}],
                    showLine: false, pointRadius: 7, pointStyle: 'star',
                    backgroundColor: '#f87171', borderColor: '#f87171',
                });
            }

            const opciones = chartOptionsBase(`Retrato de fase ${s.labelA} vs ${s.labelB}`);
            opciones.plugins.tooltip = {
                callbacks: {
                    title: (items) => {
                        if (!items.length)
                            return '';
                        const item = items[0];
                        if (item.dataset.label === 'Punto de equilibrio')
                            return '🎯 Punto de equilibrio';
                        const idx = item.dataIndex;
                        return `t = ${ts && ts[idx] !== undefined ? ts[idx].toFixed(2) : '—'}`;
                    },
                    label: (ctx) => ` ${ctx.dataset.label}: (${V.fmtCortoVisual(ctx.parsed.x)}, ${V.fmtCortoVisual(ctx.parsed.y)})`,
                }
            };
            opciones.scales = {
                x: {title: {display: true, text: s.labelA, color: COLOR.muted()}, ticks: {color: COLOR.muted()}, grid: {color: COLOR.border()}},
                y: {title: {display: true, text: s.labelB, color: COLOR.muted()}, ticks: {color: COLOR.muted()}, grid: {color: COLOR.border()}}
            };
            opciones.animation = animacion;

            chartsFase[s.key] = new Chart(canvas.getContext('2d'), {
                type: 'scatter',
                data: {datasets},
                plugins: [V.pluginGlowLineas],
                options: opciones
            });
            V.aplicarHoverFade(chartsFase[s.key]);
            // Punto que recorre la trayectoria una vez al renderizar
            recorrerTrayectoriaUnaVez(chartsFase[s.key], puntos);
        });
    }

    /* ══════════════════════════════════════════════════════════
     SUPERFICIE 3D (repurposeo del retrato de fase 3D)
     El mismo <div id="plotly-fase-3d"> del HTML (dentro de la
     tarjeta "🌀 Retratos de fase") se reutiliza en runtime:
     · se oculta su bloque original (ya no muestra trayectoria)
     · se renombra a "plotly-superficie-3d"
     · se mueve dinámicamente a la sección (sensibilidad o error)
     donde el usuario active la vista "🧊 Superficie 3D"
     ══════════════════════════════════════════════════════════ */
    const SUP3D_ID = 'plotly-superficie-3d';
    let _sup3dDiv = null;

    function obtenerDivSuperficie3D() {
        if (_sup3dDiv)
            return _sup3dDiv;
        let div = document.getElementById('plotly-fase-3d');
        if (div) {
            // Repurposeo del div original: ocultar su viejo wrapper
            // (auto-rotate + título "Retrato de fase 3D") y quedarnos
            // solo con el <div> vacío para dibujar la superficie.
            const wrap = document.getElementById('plotly-fase-3d-wrap');
            if (wrap) {
                // El div de Plotly vive dentro del wrap; lo sacamos antes
                // de ocultar el wrap para no perderlo con display:none.
                wrap.parentNode.insertBefore(div, wrap);
                wrap.style.display = 'none';
            }
            // El botón viejo de auto-rotate del retrato 3D ya no aplica.
            const btnViejo = document.getElementById('btn-autorotate-3d');
            if (btnViejo)
                btnViejo.style.display = 'none';
            const tituloViejo = btnViejo ? btnViejo.closest('.chart-title') : null;
            if (tituloViejo)
                tituloViejo.style.display = 'none';

            div.id = SUP3D_ID;
            div.style.display = 'none'; // arranca oculto hasta que se pida la vista 3D
        } else {
            div = document.createElement('div');
            div.id = SUP3D_ID;
            div.style.width = '100%';
            div.style.height = '420px';
            div.style.display = 'none';
        }
        _sup3dDiv = div;
        return div;
    }

    function ocultarSuperficie3D(seccion) {
        const div = obtenerDivSuperficie3D();
        // Solo ocultar si la superficie visible pertenece a esta sección
        if (div._seccionActual === seccion) {
            div.style.display = 'none';
            pausarAutoRotateSuperficie();
        }
    }

    function moverSuperficieA(contenedor, seccion) {
        const div = obtenerDivSuperficie3D();
        contenedor.appendChild(div);
        div.style.display = 'block';
        div._seccionActual = seccion;
        return div;
    }

    // matriz[i][j]: i recorre ejeY (filas), j recorre ejeX (columnas)
    function renderSuperficie3D(contenedor, seccion, ejeX, ejeY, matriz, etiquetas) {
        const div = moverSuperficieA(contenedor, seccion);
        if (typeof Plotly === 'undefined')
            return;

        const traza = {
            type: 'surface',
            x: ejeX, y: ejeY, z: matriz,
            colorscale: viridisPlotlyColorscale(),
            showscale: true,
            hovertemplate: `${etiquetas.x}: %{x:.4g}<br>${etiquetas.y}: %{y:.4g}<br>${etiquetas.z}: %{z:.4g}<extra></extra>`,
        };
        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {color: COLOR.muted()},
            margin: {l: 0, r: 0, t: 10, b: 0},
            uirevision: 'ecuasim-superficie-3d',
            scene: {
                xaxis: {title: etiquetas.x, color: COLOR.muted(), gridcolor: COLOR.border()},
                yaxis: {title: etiquetas.y, color: COLOR.muted(), gridcolor: COLOR.border()},
                zaxis: {title: etiquetas.z, color: COLOR.muted(), gridcolor: COLOR.border()},
            },
        };
        if (rotacion3D.activa)
            rotacion3D.ignorarProximoRelayout = true;
        Plotly.react(div, [traza], layout, {displayModeBar: false, responsive: true});

        if (!div._rotateListenerAttached) {
            div.on('plotly_relayout', () => {
                if (rotacion3D.ignorarProximoRelayout) {
                    rotacion3D.ignorarProximoRelayout = false;
                    return;
                }
                if (rotacion3D.activa)
                    pausarAutoRotateSuperficie();
            });
            div._rotateListenerAttached = true;
        }
    }

    function mostrarSuperficieSensibilidad(data, par, metrica) {
        const cont = document.getElementById('heatmap-sensibilidad');
        const grillaCont = document.getElementById('heatmap-sensibilidad-grilla');
        if (grillaCont)
            grillaCont.style.display = 'none';
        const nombreMetrica = metrica === 'zFinal' ? 'Z final' : 'tiempo hasta crisis';
        renderSuperficie3D(cont, 'sensibilidad', data.valoresParam2, data.valoresParam1, data.matriz,
                {x: par.p2, y: par.p1, z: nombreMetrica});
    }

    function mostrarSuperficieError(data, tipo, paramNombre, metrica) {
        const cont = document.getElementById('heatmap-error');
        const matriz = metrica === 'relativo' ? data.matrizRelativo
                : metrica === 'rms' ? data.matrizRMS
                : data.matrizAbsoluto;
        const nombreCol = tipo === 'parametro' ? NOMBRE_PARAM_ERROR[paramNombre] : 't_final';
        const nombreMetrica = metrica === 'relativo' ? 'Error relativo'
                : metrica === 'rms' ? 'Error RMS' : 'Error absoluto';
        renderSuperficie3D(cont, 'error', data.valoresColumna, data.valoresH, matriz,
                {x: nombreCol, y: 'h', z: nombreMetrica});
    }

    /* ── Auto-rotate reusable para la superficie 3D (renombrado) ───── */
    const rotacion3D = {
        activa: false,
        intervalId: null,
        angulo: 0,
        ignorarProximoRelayout: false,
        _pausadaPorVisibilidad: false,
    };

    function iniciarAutoRotateSuperficie() {
        const V = window.EcuaSimVisual;
        if (V && V.prefiereMovimientoReducido())
            return;
        const div = document.getElementById(SUP3D_ID);
        if (!div || typeof Plotly === 'undefined')
            return;

        if (rotacion3D.intervalId)
            clearInterval(rotacion3D.intervalId);
        rotacion3D.activa = true;
        actualizarBotonesRotate();

        const radio = 1.8, elevacion = 0.9;
        rotacion3D.intervalId = setInterval(() => {
            rotacion3D.angulo += 0.006;
            const eye = {
                x: radio * Math.cos(rotacion3D.angulo),
                y: radio * Math.sin(rotacion3D.angulo),
                z: elevacion,
            };
            rotacion3D.ignorarProximoRelayout = true;
            Plotly.relayout(div, {'scene.camera.eye': eye});
        }, 45);
    }
    function pausarAutoRotateSuperficie() {
        if (rotacion3D.intervalId) {
            clearInterval(rotacion3D.intervalId);
            rotacion3D.intervalId = null;
        }
        rotacion3D.activa = false;
        actualizarBotonesRotate();
    }
    function toggleAutoRotateSuperficie() {
        if (rotacion3D.activa)
            pausarAutoRotateSuperficie();
        else
            iniciarAutoRotateSuperficie();
    }
    function actualizarBotonesRotate() {
        document.querySelectorAll('.btn-rotate-superficie').forEach(btn => {
            btn.textContent = rotacion3D.activa ? '⏸ Pausar rotación' : '⟳ Auto-rotar';
            btn.classList.toggle('activo', rotacion3D.activa);
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && rotacion3D.activa) {
            rotacion3D._pausadaPorVisibilidad = true;
            pausarAutoRotateSuperficie();
        } else if (!document.hidden && rotacion3D._pausadaPorVisibilidad) {
            rotacion3D._pausadaPorVisibilidad = false;
            iniciarAutoRotateSuperficie();
        }
    });

    /* ── Botón toggle "🔲 Grilla · 🧊 Superficie 3D" + botón de
     auto-rotate, insertados en runtime junto al selector de
     métrica de cada sección (no se tocó el HTML) ─────────────── */
    function crearControlesVista(seccion, contenedorControles, onCambiarVista) {
        const wrap = document.createElement('div');
        wrap.className = 'fg';
        wrap.style.minWidth = '160px';

        const label = document.createElement('label');
        label.textContent = 'Vista';
        wrap.appendChild(label);

        const fila = document.createElement('div');
        fila.style.display = 'flex';
        fila.style.gap = '.4rem';

        const btnToggle = document.createElement('button');
        btnToggle.type = 'button';
        btnToggle.className = 'btn-mini-3d';
        btnToggle.textContent = '🔲 Grilla · 🧊 Superficie 3D';

        const btnRotar = document.createElement('button');
        btnRotar.type = 'button';
        btnRotar.className = 'btn-mini-3d btn-rotate-superficie';
        btnRotar.textContent = '⟳ Auto-rotar';
        btnRotar.style.display = 'none';
        btnRotar.addEventListener('click', toggleAutoRotateSuperficie);

        btnToggle.addEventListener('click', () => {
            _vista[seccion] = _vista[seccion] === 'grilla' ? '3d' : 'grilla';
            btnToggle.classList.toggle('activo', _vista[seccion] === '3d');
            btnRotar.style.display = _vista[seccion] === '3d' ? '' : 'none';
            if (_vista[seccion] !== '3d')
                pausarAutoRotateSuperficie();
            onCambiarVista();
        });

        fila.appendChild(btnToggle);
        fila.appendChild(btnRotar);
        wrap.appendChild(fila);
        contenedorControles.appendChild(wrap);
    }

    /* ══════════════════════════════════════════════════════════════
     4) PUNTO DE EQUILIBRIO (Newton-Raphson)
     ══════════════════════════════════════════════════════════════ */
    async function calcularEquilibrio() {
        if (!window._ultimaCorridaRK4) {
            alert('Primero ejecutá una simulación RK4 para tener un punto inicial cercano.');
            return;
        }
        const ultima = window._ultimaCorridaRK4;
        const n = ultima.xs.length - 1;
        const p = paramsActuales();
        const btn = document.getElementById('btn-equilibrio');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Buscando…';
        }
        try {
            const data = await postJSON('/api/simulacion/equilibrio', {
                xInicial: ultima.xs[n], yInicial: ultima.ys[n], zInicial: ultima.zs[n],
                maxIteraciones: 200, tolerancia: 1e-6, ...p
            });
            mostrarResultadoEquilibrio(data);
            if (data.convergio) {
                puntoEquilibrio = {x: data.x, y: data.y, z: data.z};
                renderFase2D(ultima.ts, ultima.xs, ultima.ys, ultima.zs);
                iniciarPulsoEquilibrio();
            }
        } catch (e) {
            console.error(e);
            alert('No se pudo calcular el punto de equilibrio: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🎯 Buscar punto de equilibrio';
            }
        }
    }

    function mostrarResultadoEquilibrio(data) {
        const el = document.getElementById('resultado-equilibrio');
        if (!el)
            return;
        if (data.convergio) {
            el.innerHTML = `
                <div style="color:var(--accent3);font-weight:700;margin-bottom:.3rem;">✓ ${data.mensaje}</div>
                <div>X* = ${data.x.toFixed(2)} · Y* = ${data.y.toFixed(2)} · Z* = ${data.z.toFixed(2)}</div>
                <div style="color:var(--muted);font-size:.75rem;margin-top:.3rem;">
                    Residual: fX=${data.residualX.toExponential(2)}, fY=${data.residualY.toExponential(2)}, fZ=${data.residualZ.toExponential(2)}
                </div>`;
        } else {
            el.innerHTML = `<div style="color:#f87171;font-weight:700;">✗ ${data.mensaje}</div>`;
        }
    }

    /* ══════════════════════════════════════════════════════════════
     5) HEATMAP DE SENSIBILIDAD PARAMÉTRICA
     ══════════════════════════════════════════════════════════════ */
    const PARES_SENSIBILIDAD = {
        'r_K': {p1: 'r', p1min: 0.01, p1max: 0.1, p2: 'K', p2min: 500, p2max: 2000},
        'muStress_tasaConsumo': {p1: 'muStress', p1min: 0.01, p1max: 0.3, p2: 'tasaConsumo', p2min: 0.00005, p2max: 0.0008},
    };

    async function calcularSensibilidad() {
        const sel = document.getElementById('sel-par-sensibilidad');
        const metricaSel = document.getElementById('sel-metrica-sensibilidad');
        const par = PARES_SENSIBILIDAD[sel ? sel.value : 'r_K'];
        const metrica = metricaSel ? metricaSel.value : 'zFinal';
        const c = condicionesActuales();
        const p = paramsActuales();
        const cond = condicionesHeatmap(par);
        const btn = document.getElementById('btn-sensibilidad');
        const cont = document.getElementById('heatmap-sensibilidad');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Calculando grilla…';
        }
        if (cont) {
            cont.classList.add('heatmap-cargando');
        }
        try {
            const data = await postJSON('/api/simulacion/sensibilidad', {
                param1Nombre: par.p1, param1Min: par.p1min, param1Max: par.p1max, param1Pasos: 12,
                param2Nombre: par.p2, param2Min: par.p2min, param2Max: par.p2max, param2Pasos: 12,
                x0: cond.x0, y0: cond.y0, z0: cond.z0, h: c.h,
                pasosSimulacion: Math.max(c.pasos, 200),
                metrica, ...p
            });
            _ultimoHeatmap.sensibilidad = {data, par, metrica};
            renderVistaSensibilidad();
        } catch (e) {
            console.error(e);
            alert('No se pudo calcular la sensibilidad: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🌡️ Calcular heatmap';
            }
            if (cont)
                cont.classList.remove('heatmap-cargando');
        }
    }

    function renderVistaSensibilidad() {
        if (!_ultimoHeatmap.sensibilidad)
            return;
        const {data, par, metrica} = _ultimoHeatmap.sensibilidad;
        if (_vista.sensibilidad === '3d') {
            mostrarSuperficieSensibilidad(data, par, metrica);
        } else {
            ocultarSuperficie3D('sensibilidad');
            const grillaCont = document.getElementById('heatmap-sensibilidad-grilla');
            if (grillaCont)
                grillaCont.style.display = '';
            renderHeatmap(data, par, metrica);
        }
    }

    function renderHeatmap(data, par, metrica) {
        // Contenedor exclusivo de la grilla dentro de #heatmap-sensibilidad,
        // para poder ocultarlo/mostrarlo sin pisar el div de la superficie 3D.
        let cont = document.getElementById('heatmap-sensibilidad-grilla');
        const raiz = document.getElementById('heatmap-sensibilidad');
        if (!cont && raiz) {
            cont = document.createElement('div');
            cont.id = 'heatmap-sensibilidad-grilla';
            raiz.appendChild(cont);
        }
        if (!cont)
            return;
        cont.innerHTML = '';

        let min = Infinity, max = -Infinity;
        data.matriz.forEach(fila => fila.forEach(v => {
                if (v < min)
                    min = v;
                if (v > max)
                    max = v;
            }));

        const reducido = window.EcuaSimVisual.prefiereMovimientoReducido();
        const numColumnas = data.valoresParam2.length;

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `100px repeat(${numColumnas}, 1fr)`;
        grid.style.gap = '2px';
        grid.style.fontSize = '10px';
        grid.style.fontFamily = "'Space Grotesk', monospace";

        grid.appendChild(celdaEtiqueta(''));
        data.valoresParam2.forEach(v2 => grid.appendChild(celdaEtiqueta(fmtCorto(v2))));

        data.valoresParam1.forEach((v1, i) => {
            grid.appendChild(celdaEtiqueta(fmtCorto(v1)));
            data.matriz[i].forEach((valor, j) => {
                const v2 = data.valoresParam2[j];
                const t = max > min ? (valor - min) / (max - min) : 0.5;
                const celda = document.createElement('div');
                celda.className = 'heatmap-celda' + (reducido ? '' : ' heatmap-celda-entrada');
                celda.style.background = colorViridis(t);
                celda.style.padding = '6px 2px';
                celda.style.textAlign = 'center';
                celda.style.borderRadius = '3px';
                celda.style.color = luminanciaViridis(t);
                celda.textContent = fmtCorto(valor);
                if (!reducido)
                    celda.style.animationDelay = `${(i * numColumnas + j) * 12}ms`;

                const htmlTooltip = `
                    <div><span class="htf-label">${par.p1} =</span> <span class="htf-val">${v1.toFixed(4)}</span></div>
                    <div><span class="htf-label">${par.p2} =</span> <span class="htf-val">${v2.toFixed(4)}</span></div>
                    <div><span class="htf-label">valor =</span> <span class="htf-val">${valor.toFixed(4)}</span></div>`;

                celda.addEventListener('mouseenter', (e) => mostrarTooltipCelda(e, htmlTooltip));
                celda.addEventListener('mousemove', posicionarTooltip);
                celda.addEventListener('mouseleave', ocultarTooltipCelda);

                grid.appendChild(celda);
            });
        });

        cont.appendChild(grid);

        const barraWrap = document.createElement('div');
        barraWrap.style.display = 'flex';
        barraWrap.style.alignItems = 'center';
        barraWrap.style.gap = '.6rem';
        barraWrap.style.fontSize = '.7rem';
        barraWrap.style.color = 'var(--muted)';
        barraWrap.style.marginTop = '.7rem';

        const barra = document.createElement('div');
        barra.style.height = '10px';
        barra.style.flex = '1';
        barra.style.borderRadius = '5px';
        barra.style.background = gradienteCSSViridis();

        const lblMin = document.createElement('span');
        lblMin.textContent = fmtCorto(min);
        const lblMax = document.createElement('span');
        lblMax.textContent = fmtCorto(max);

        barraWrap.appendChild(lblMin);
        barraWrap.appendChild(barra);
        barraWrap.appendChild(lblMax);
        cont.appendChild(barraWrap);

        const leyenda = document.createElement('div');
        leyenda.style.marginTop = '.4rem';
        leyenda.style.fontSize = '.7rem';
        leyenda.style.color = 'var(--muted)';
        leyenda.textContent = `Filas: ${par.p1} · Columnas: ${par.p2} · Métrica: ${metrica === 'zFinal' ? 'Z final' : 'tiempo hasta crisis'} · paleta viridis`;
        cont.appendChild(leyenda);
    }

    function celdaEtiqueta(txt) {
        const d = document.createElement('div');
        d.textContent = txt;
        d.style.color = 'var(--muted)';
        d.style.padding = '4px 2px';
        d.style.textAlign = 'center';
        return d;
    }
    function fmtCorto(n) {
        if (Math.abs(n) >= 1000)
            return (n / 1000).toFixed(1) + 'K';
        if (Math.abs(n) < 1 && n !== 0)
            return n.toFixed(3);
        return n.toFixed(1);
    }

    /* ══════════════════════════════════════════════════════════════
     6) GRÁFICAS DE BARRAS — gradiente, esquinas redondeadas,
     crecimiento animado escalonado, hover más brillante
     ══════════════════════════════════════════════════════════════ */
    let chartBarrasProvincias = null;
    let chartBarrasSnapshot = null;

    function opcionesAnimacionBarras() {
        const V = window.EcuaSimVisual;
        if (V.prefiereMovimientoReducido())
            return false;
        return {
            delay: (ctx) => ctx.type === 'data' ? ctx.dataIndex * 60 + (ctx.datasetIndex * 120) : 0
        };
    }

    // Gradiente vertical simple para barras (top→bottom, opacidad decreciente),
    // reutilizando la misma paleta de color de cada dataset.
    function gradienteBarra(ctx, color) {
        const V = window.EcuaSimVisual;
        return V.crearGradienteVertical(color, 0.9, 0.35, ctx);
    }

    function datasetsBarras(specs, ctx) {
        return specs.map(s => ({
                label: s.label, data: s.data,
                backgroundColor: gradienteBarra(ctx, s.color) || s.color,
                borderRadius: 6,
                hoverBackgroundColor: s.color,
                hoverBorderWidth: 2,
                hoverBorderColor: '#ffffff',
            }));
    }

    async function cargarHistorialProvincias() {
        const btn = document.getElementById('btn-historial-provincias');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Cargando…';
        }
        try {
            const data = await getJSON('/api/simulacion/historial-provincias');
            renderBarrasProvincias(data);
        } catch (e) {
            console.error(e);
            alert('No se pudo cargar el historial de provincias: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🏙️ Cargar historial de provincias';
            }
        }
    }

    function renderBarrasProvincias(data) {
        const canvas = document.getElementById('chart-historial-provincias');
        if (!canvas)
            return;
        if (chartBarrasProvincias)
            chartBarrasProvincias.destroy();
        const ctx = canvas.getContext('2d');

        const specs = [
            {label: 'X final', data: data.map(d => d.x), color: COLOR.accent1()},
            {label: 'Y final', data: data.map(d => d.y), color: COLOR.accent2()},
            {label: 'Z final', data: data.map(d => d.z), color: COLOR.accent3()},
        ];

        chartBarrasProvincias = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.provincia),
                datasets: datasetsBarras(specs, ctx),
            },
            options: {
                ...chartOptionsBase('Última corrida por provincia'),
                animation: opcionesAnimacionBarras(),
            }
        });
    }

    function renderSnapshotTemporal(ts, xs, ys, zs) {
        const canvas = document.getElementById('chart-snapshot-temporal');
        if (!canvas)
            return;
        if (chartBarrasSnapshot)
            chartBarrasSnapshot.destroy();
        const ctx = canvas.getContext('2d');

        const n = ts.length - 1;
        const idxs = [0, 0.25, 0.5, 0.75, 1.0].map(f => Math.round(f * n));
        const etiquetas = idxs.map((idx, i) => `${(i * 25)}% (t=${ts[idx].toFixed(1)})`);

        const specs = [
            {label: 'X', data: idxs.map(i => xs[i]), color: COLOR.accent1()},
            {label: 'Y', data: idxs.map(i => ys[i]), color: COLOR.accent2()},
            {label: 'Z', data: idxs.map(i => zs[i]), color: COLOR.accent3()},
        ];

        chartBarrasSnapshot = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: datasetsBarras(specs, ctx),
            },
            options: {
                ...chartOptionsBase('Snapshot temporal (cortes cada 25% de la corrida)'),
                animation: opcionesAnimacionBarras(),
            }
        });
    }

    /* ══════════════════════════════════════════════════════════════
     8) MAPA DE ESTABILIDAD NUMÉRICA DE RK4
     ══════════════════════════════════════════════════════════════ */
    const COLOR_ESTABILIDAD = ['#4ade80', '#facc15', '#f87171']; // estable, oscilatorio, divergente
    const NOMBRE_ESTABILIDAD = ['🟢 Estable', '🟡 Oscilatorio', '🔴 Divergente'];

    async function calcularMapaEstabilidad() {
        const sel = document.getElementById('sel-param-estabilidad');
        const paramNombre = sel ? sel.value : 'r';
        const c = condicionesActuales();
        const p = paramsActuales();
        const btn = document.getElementById('btn-mapa-estabilidad');
        const cont = document.getElementById('mapa-estabilidad');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Calculando grilla…';
        }
        if (cont) {
            cont.innerHTML = '';
            cont.classList.add('heatmap-cargando');
        }

        const rangosParam = {
            r: {min: 0.01, max: 0.15},
            K: {min: 300, max: 2000},
            muStress: {min: 0.01, max: 0.3},
            tasaConsumo: {min: 0.00005, max: 0.0008},
        };

        try {
            const body = {
                x0: c.x0, y0: c.y0, z0: c.z0,
                hMin: c.h / 8, hMax: c.h * 4, hPasos: 10,
                paramNombre, paramMin: rangosParam[paramNombre].min, paramMax: rangosParam[paramNombre].max, paramPasos: 10,
                pasosSimulacion: Math.max(c.pasos, 300),
                ...p
            };
            const data = await postJSON('/api/simulacion/mapa-estabilidad', body);
            _ultimoHeatmap.estabilidad = {data, paramNombre};
            renderVistaEstabilidad();
        } catch (e) {
            console.error(e);
            alert('No se pudo calcular el mapa de estabilidad: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🗺️ Calcular mapa de estabilidad';
            }
            if (cont)
                cont.classList.remove('heatmap-cargando');
        }
    }

    function renderVistaEstabilidad() {
        if (!_ultimoHeatmap.estabilidad)
            return;
        const {data, paramNombre} = _ultimoHeatmap.estabilidad;
        if (_vista.estabilidad === '3d') {
            mostrarSuperficieEstabilidad(data, paramNombre);
        } else {
            const cont = document.getElementById('mapa-estabilidad');
            if (cont)
                cont.style.display = '';
            ocultarSuperficie3D('estabilidad');
            renderMapaEstabilidad(data, paramNombre);
        }
    }

    function renderMapaEstabilidad(data, paramNombre) {
        const cont = document.getElementById('mapa-estabilidad');
        const leyendaCont = document.getElementById('mapa-estabilidad-leyenda');
        if (!cont)
            return;
        cont.innerHTML = '';
        if (leyendaCont)
            leyendaCont.innerHTML = '';

        const reducido = window.EcuaSimVisual.prefiereMovimientoReducido();
        const numColumnas = data.valoresColumna.length;
        const nombreParam = NOMBRE_PARAM_ERROR[paramNombre] || paramNombre;

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `90px repeat(${numColumnas}, 1fr)`;
        grid.style.gap = '2px';
        grid.style.fontSize = '10px';
        grid.style.fontFamily = "'Space Grotesk', monospace";

        grid.appendChild(celdaEtiqueta('h \\ ' + paramNombre));
        data.valoresColumna.forEach(vc => grid.appendChild(celdaEtiqueta(fmtCortoError(vc))));

        data.valoresH.forEach((h, i) => {
            grid.appendChild(celdaEtiqueta('h=' + fmtCortoError(h)));
            data.matrizCategoria[i].forEach((cat, j) => {
                const vc = data.valoresColumna[j];
                const score = data.matrizScore[i][j];

                const celda = document.createElement('div');
                celda.className = 'heatmap-celda' + (reducido ? '' : ' heatmap-celda-entrada');
                celda.style.background = COLOR_ESTABILIDAD[cat];
                celda.style.padding = '6px 2px';
                celda.style.textAlign = 'center';
                celda.style.borderRadius = '3px';
                celda.style.color = cat === 1 ? '#050b14' : '#ffffff';
                celda.textContent = cat === 0 ? '🟢' : cat === 1 ? '🟡' : '🔴';
                if (!reducido)
                    celda.style.animationDelay = `${(i * numColumnas + j) * 12}ms`;

                const htmlTooltip = `
                    <div><span class="htf-label">h =</span> <span class="htf-val">${h.toFixed(4)}</span></div>
                    <div><span class="htf-label">${nombreParam} =</span> <span class="htf-val">${vc.toFixed(4)}</span></div>
                    <div><span class="htf-label">estado =</span> <span class="htf-val">${NOMBRE_ESTABILIDAD[cat]}</span></div>
                    <div><span class="htf-label">amplitud rel. =</span> <span class="htf-val">${score.toFixed(3)}</span></div>`;

                celda.addEventListener('mouseenter', (e) => mostrarTooltipCelda(e, htmlTooltip));
                celda.addEventListener('mousemove', posicionarTooltip);
                celda.addEventListener('mouseleave', ocultarTooltipCelda);

                grid.appendChild(celda);
            });
        });

        cont.appendChild(grid);

        if (leyendaCont) {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.gap = '1.2rem';
            wrap.style.fontSize = '.72rem';
            wrap.style.color = 'var(--muted)';
            wrap.style.flexWrap = 'wrap';
            NOMBRE_ESTABILIDAD.forEach((nombre, idx) => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.gap = '.4rem';
                const dot = document.createElement('span');
                dot.style.width = '10px';
                dot.style.height = '10px';
                dot.style.borderRadius = '50%';
                dot.style.background = COLOR_ESTABILIDAD[idx];
                dot.style.display = 'inline-block';
                item.appendChild(dot);
                const txt = document.createElement('span');
                txt.textContent = nombre.replace(/^[^\s]+\s/, '');
                item.appendChild(txt);
                wrap.appendChild(item);
            });
            leyendaCont.appendChild(wrap);

            const leyendaTexto = document.createElement('div');
            leyendaTexto.style.marginTop = '.4rem';
            leyendaTexto.style.fontSize = '.7rem';
            leyendaTexto.style.color = 'var(--muted)';
            leyendaTexto.textContent = `Filas: h (paso) · Columnas: ${nombreParam} · clasificación según comportamiento del tramo final de la simulación`;
            leyendaCont.appendChild(leyendaTexto);
        }
    }

    function mostrarSuperficieEstabilidad(data, paramNombre) {
        const cont = document.getElementById('mapa-estabilidad');
        const nombreParam = NOMBRE_PARAM_ERROR[paramNombre] || paramNombre;
        renderSuperficie3D(cont, 'estabilidad', data.valoresColumna, data.valoresH, data.matrizScore,
                {x: nombreParam, y: 'h', z: 'amplitud relativa (0=estable, ≥1=inestable/divergente)'});
    }

    /* ══════════════════════════════════════════════════════════════
     CAPTURA DE LA ÚLTIMA CORRIDA RK4 (sin tocar simulador.js)
     Nota: ya NO se llama a renderFase3D — el 3D fue repurposeado
     como superficie de heatmap (ver más arriba).
     ══════════════════════════════════════════════════════════════ */
    if (typeof renderCharts === 'function') {
        const _renderChartsOriginal = renderCharts;
        // eslint-disable-next-line no-global-assign
        renderCharts = function (ts, xs, ys, zs) {
            _renderChartsOriginal(ts, xs, ys, zs);
            window._ultimaCorridaRK4 = {ts, xs, ys, zs};
            puntoEquilibrio = null; // nueva corrida -> invalidar equilibrio anterior
            detenerPulsoEquilibrio();
            renderFase2D(ts, xs, ys, zs);
            renderSnapshotTemporal(ts, xs, ys, zs);
        };
    } else {
        console.warn('analisis-numerico.js: no se encontró renderCharts(); asegurate de cargar este script DESPUÉS de simulador.js');
    }

    /* ══════════════════════════════════════════════════════════════
     WIRING DE BOTONES + CONTROLES DE VISTA (grilla/3D) en runtime
     ══════════════════════════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', () => {
        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if (el)
                el.addEventListener('click', fn);
        };
        bind('btn-comparar-metodos', compararMetodos);
        bind('btn-convergencia', analizarConvergencia);
        bind('btn-equilibrio', calcularEquilibrio);
        bind('btn-sensibilidad', calcularSensibilidad);
        bind('btn-historial-provincias', cargarHistorialProvincias);
        bind('btn-heatmap-error', calcularHeatmapError);
        bind('btn-mapa-estabilidad', calcularMapaEstabilidad);

        const selParamEstabilidad = document.getElementById('sel-param-estabilidad');
        if (selParamEstabilidad && selParamEstabilidad.parentElement && selParamEstabilidad.parentElement.parentElement) {
            crearControlesVista('estabilidad', selParamEstabilidad.parentElement.parentElement, renderVistaEstabilidad);
        }

        const selColumna = document.getElementById('sel-columna-heatmap-error');
        if (selColumna)
            selColumna.addEventListener('change', actualizarVisibilidadColumnaError);

        // Repurposear el div 3D apenas carga el DOM (queda oculto hasta usarse)
        obtenerDivSuperficie3D();

        // Insertar el control de vista "Grilla / Superficie 3D" junto al
        // selector de métrica de cada sección de heatmap.
        const selMetricaSens = document.getElementById('sel-metrica-sensibilidad');
        if (selMetricaSens && selMetricaSens.parentElement && selMetricaSens.parentElement.parentElement) {
            crearControlesVista('sensibilidad', selMetricaSens.parentElement.parentElement, renderVistaSensibilidad);
        }
        const selMetricaError = document.getElementById('sel-metrica-heatmap-error');
        if (selMetricaError && selMetricaError.parentElement && selMetricaError.parentElement.parentElement) {
            crearControlesVista('error', selMetricaError.parentElement.parentElement, renderVistaError);
        }
    });
})();