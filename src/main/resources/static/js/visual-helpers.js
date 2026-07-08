/* ============================================================
   visual-helpers.js — EcuaSim
   Helpers visuales compartidos entre simulador.js y
   analisis-numerico.js: gradientes, glow, grid osciloscopio,
   hover-fade, tooltip crosshair combinado, registro de zoom/pan.
   No contiene lógica de cálculo (RK4/Euler/Newton-Raphson).
   Debe cargarse DESPUÉS de Chart.js y chartjs-plugin-zoom,
   y ANTES de simulador.js.
   ============================================================ */
(function () {
    "use strict";

    function prefiereMovimientoReducido() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /* ── Registro del plugin de zoom/pan (una sola vez, defensivo) ─── */
    function registrarZoomPlugin() {
        if (typeof Chart === 'undefined') return;
        if (Chart.registry.plugins.get('zoom')) return; // ya auto-registrado por el CDN
        const zoomPlugin = window.ChartZoom || window.chartjsPluginZoom;
        if (zoomPlugin) Chart.register(zoomPlugin);
    }

    function opcionesZoomPan() {
        if (prefiereMovimientoReducido()) return {}; // sin zoom si el usuario prefiere menos movimiento
        return {
            zoom: {
                wheel: {enabled: true, speed: 0.08},
                pinch: {enabled: true},
                drag: {enabled: false},
                mode: 'x',
            },
            pan: {
                enabled: true,
                mode: 'x',
            },
            limits: {
                x: {min: 'original', max: 'original'},
            }
        };
    }

    /* ── Gradiente vertical para el fill de un dataset ──────────────── */
    function crearGradienteVertical(colorHex, alphaTop = 0.32, alphaBottom = 0.02) {
        return function (ctx) {
            const {chart} = ctx;
            const {chartArea} = chart;
            if (!chartArea) return 'transparent'; // primer render, aún no hay área
            const gradiente = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradiente.addColorStop(0, hexConAlpha(colorHex, alphaTop));
            gradiente.addColorStop(1, hexConAlpha(colorHex, alphaBottom));
            return gradiente;
        };
    }
    function hexConAlpha(hex, alpha) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    function atenuarColor(color, alpha) {
        if (!color) return color;
        if (color.startsWith('#')) return hexConAlpha(color, alpha);
        if (color.startsWith('rgba')) return color.replace(/[\d.]+\)$/, alpha + ')');
        if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
        return color;
    }

    /* ── Plugin: glow (resplandor) en datasets marcados con .glow ────── */
    const pluginGlowLineas = {
        id: 'glowLineas',
        beforeDatasetDraw(chart, args) {
            const ds = chart.data.datasets[args.index];
            if (!ds || !ds.glow) return;
            const ctx = chart.ctx;
            ctx.save();
            ctx.shadowColor = ds.glowColor || ds.borderColor || '#fff';
            ctx.shadowBlur = ds.glowBlur || 8;
        },
        afterDatasetDraw(chart, args) {
            const ds = chart.data.datasets[args.index];
            if (!ds || !ds.glow) return;
            chart.ctx.restore();
        }
    };

    /* ── Plugin: grid tipo "osciloscopio" (líneas finas de fondo) ────── */
    const pluginGridOsciloscopio = {
        id: 'gridOsciloscopio',
        beforeDraw(chart, args, opts) {
            if (!opts || opts.enabled === false) return;
            const {ctx, chartArea} = chart;
            if (!chartArea) return;
            const {left, right, top, bottom} = chartArea;
            const paso = opts.paso || 26;
            ctx.save();
            ctx.strokeStyle = opts.color || 'rgba(255,255,255,.04)';
            ctx.lineWidth = 1;
            for (let x = left; x <= right; x += paso) {
                ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
            }
            for (let y = top; y <= bottom; y += paso) {
                ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
            }
            ctx.restore();
        }
    };

    /* ── Hover-fade: atenúa datasets no activos al pasar el mouse ─────── */
    function aplicarHoverFade(chart) {
        chart.options.onHover = (evt, activeElements) => {
            const datasets = chart.data.datasets;
            datasets.forEach(ds => { if (!ds._colorBase) ds._colorBase = ds.borderColor; });
            if (!activeElements.length) {
                datasets.forEach(ds => { ds.borderColor = ds._colorBase; });
            } else {
                const idxActivo = activeElements[0].datasetIndex;
                datasets.forEach((ds, i) => {
                    ds.borderColor = i === idxActivo ? ds._colorBase : atenuarColor(ds._colorBase, 0.18);
                });
            }
            chart.update('none');
        };
    }

    /* ── Tooltip crosshair combinado (X,Y,Z al mismo t, entre 2 charts) ── */
    let _crosshairEl = null;
    function _getCrosshairTooltip() {
        if (_crosshairEl) return _crosshairEl;
        _crosshairEl = document.createElement('div');
        _crosshairEl.id = 'crosshair-tooltip-flotante';
        document.body.appendChild(_crosshairEl);
        return _crosshairEl;
    }
    function fmtCortoVisual(n) {
        if (n === undefined || n === null) return '—';
        const abs = Math.abs(n);
        if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return Number(n).toFixed(1);
    }
    // series = {ts, xs, ys, zs}; chartsRefs = [chartPop, chartZ]
    function activarCrosshairCombinado(canvases, series, chartsRefs) {
        const tt = _getCrosshairTooltip();
        function mostrar(evt, canvas) {
            const chart = chartsRefs.find(c => c.canvas === canvas);
            if (!chart || !chart.scales.x) return;
            const rect = canvas.getBoundingClientRect();
            const xPix = evt.clientX - rect.left;
            let idx = Math.round(chart.scales.x.getValueForPixel(xPix));
            idx = Math.max(0, Math.min(series.ts.length - 1, idx));

            tt.innerHTML = `
                <div style="color:var(--muted); margin-bottom:3px;">t = ${series.ts[idx]}</div>
                <div><span style="color:#00d4ff;">X</span> = ${fmtCortoVisual(series.xs[idx])}</div>
                <div><span style="color:#fb923c;">Y</span> = ${fmtCortoVisual(series.ys[idx])}</div>
                <div><span style="color:#4ade80;">Z</span> = ${fmtCortoVisual(series.zs[idx])}</div>`;
            tt.classList.add('visible');

            const margen = 14;
            let x = evt.clientX + margen, y = evt.clientY + margen;
            const tr = tt.getBoundingClientRect();
            if (x + tr.width > window.innerWidth - 8) x = evt.clientX - tr.width - margen;
            if (y + tr.height > window.innerHeight - 8) y = evt.clientY - tr.height - margen;
            tt.style.left = x + 'px';
            tt.style.top = y + 'px';
        }
        function ocultar() { tt.classList.remove('visible'); }
        canvases.forEach(canvas => {
            canvas.addEventListener('mousemove', (e) => mostrar(e, canvas));
            canvas.addEventListener('mouseleave', ocultar);
        });
    }

    window.EcuaSimVisual = {
        prefiereMovimientoReducido,
        registrarZoomPlugin,
        opcionesZoomPan,
        crearGradienteVertical,
        hexConAlpha,
        atenuarColor,
        pluginGlowLineas,
        pluginGridOsciloscopio,
        aplicarHoverFade,
        activarCrosshairCombinado,
        fmtCortoVisual,
    };
})();
