package Metodos_Numericos.example.Project_MetodosN.Controller;

import Metodos_Numericos.example.Project_MetodosN.Service.SimulacionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * AnalisisNumericoController — endpoints nuevos para comparar métodos,
 * analizar convergencia, ubicar puntos de equilibrio (Newton-Raphson),
 * hacer barridos de sensibilidad paramétrica y consultar el historial
 * de provincias. Se dejó como un controller separado (en vez de tocar
 * SimulacionController, cuyo contenido original no estaba disponible
 * para editar con seguridad) para no arriesgar romper /api/simulacion
 * existente. Las rutas siguen bajo el mismo prefijo /api/simulacion/...
 * pedido en el enunciado.
 *
 * NINGUNO de estos endpoints persiste sesiones en base de datos, salvo
 * historial-provincias que solo LEE sesiones ya guardadas por el
 * SimulacionController existente.
 */
@RestController
@RequestMapping("/api/simulacion")
public class AnalisisNumericoController {

    @Autowired
    private SimulacionService simulacionService;

    // ── 1) Comparación Euler vs RK4 ─────────────────────────────────────

    public static class ComparacionRequest {
        public double t0 = 0, x0, y0, z0, h;
        public int pasos;
        public double birthX, deathX, birthY, deathY;
        public double muBase, muStress, nuBase, tasaConsumo, r, K;
    }

    @PostMapping("/comparar-metodos")
    public SimulacionService.TrayectoriaComparacion compararMetodos(@RequestBody ComparacionRequest req) {
        simulacionService.actualizarParametros(
                req.birthX, req.deathX, req.birthY, req.deathY,
                req.muBase, req.muStress, req.nuBase,
                req.tasaConsumo, req.r, req.K);
        return simulacionService.compararMetodos(req.t0, req.x0, req.y0, req.z0, req.h, req.pasos);
    }

    // ── 2) Análisis de convergencia ─────────────────────────────────────

    public static class ConvergenciaRequest {
        public double x0, y0, z0;
        public double hBase;
        public double tFinal;
        public double birthX, deathX, birthY, deathY;
        public double muBase, muStress, nuBase, tasaConsumo, r, K;
    }

    @PostMapping("/convergencia")
    public SimulacionService.ConvergenciaResultado convergencia(@RequestBody ConvergenciaRequest req) {
        simulacionService.actualizarParametros(
                req.birthX, req.deathX, req.birthY, req.deathY,
                req.muBase, req.muStress, req.nuBase,
                req.tasaConsumo, req.r, req.K);
        return simulacionService.analizarConvergencia(req.x0, req.y0, req.z0, req.hBase, req.tFinal);
    }

    // ── 4) Punto de equilibrio (Newton-Raphson) ─────────────────────────

    public static class EquilibrioRequest {
        public double xInicial, yInicial, zInicial;
        public Integer maxIteraciones; // opcional, default 100
        public Double tolerancia;      // opcional, default 1e-6
        public double birthX, deathX, birthY, deathY;
        public double muBase, muStress, nuBase, tasaConsumo, r, K;
    }

    @PostMapping("/equilibrio")
    public SimulacionService.ResultadoEquilibrio equilibrio(@RequestBody EquilibrioRequest req) {
        simulacionService.actualizarParametros(
                req.birthX, req.deathX, req.birthY, req.deathY,
                req.muBase, req.muStress, req.nuBase,
                req.tasaConsumo, req.r, req.K);
        int maxIter = req.maxIteraciones != null ? req.maxIteraciones : 100;
        double tol = req.tolerancia != null ? req.tolerancia : 1e-6;
        return simulacionService.calcularEquilibrio(req.xInicial, req.yInicial, req.zInicial, maxIter, tol);
    }

    // ── 5) Heatmap de sensibilidad paramétrica ──────────────────────────

    public static class SensibilidadRequest {
        public String param1Nombre; public double param1Min, param1Max; public int param1Pasos;
        public String param2Nombre; public double param2Min, param2Max; public int param2Pasos;
        public double x0, y0, z0, h;
        public int pasosSimulacion;
        public String metrica; // "zFinal" | "tiempoCrisis"
        public double birthX, deathX, birthY, deathY;
        public double muBase, muStress, nuBase, tasaConsumo, r, K;
    }

    @PostMapping("/sensibilidad")
    public SimulacionService.SensibilidadResultado sensibilidad(@RequestBody SensibilidadRequest req) {
        simulacionService.actualizarParametros(
                req.birthX, req.deathX, req.birthY, req.deathY,
                req.muBase, req.muStress, req.nuBase,
                req.tasaConsumo, req.r, req.K);
        return simulacionService.calcularSensibilidad(
                req.param1Nombre, req.param1Min, req.param1Max, req.param1Pasos,
                req.param2Nombre, req.param2Min, req.param2Max, req.param2Pasos,
                req.x0, req.y0, req.z0, req.h, req.pasosSimulacion, req.metrica);
    }

    // ── 6) Historial de provincias ──────────────────────────────────────

    @GetMapping("/historial-provincias")
    public List<SimulacionService.UltimoRegistroProvincia> historialProvincias() {
        return simulacionService.obtenerHistorialProvincias();
    }
    // ── 7) Heatmap de error de RK4 ───────────────────────────────────────

    public static class HeatmapErrorRequest {
        public double x0, y0, z0;
        public double hMin, hMax; public int hPasos;
        public String columnaTipo; // "tFinal" | "parametro"
        public double tFinalMin, tFinalMax; public int tFinalPasos; // si columnaTipo="tFinal"
        public double tFinalFijo;                                    // si columnaTipo="parametro"
        public String paramNombre; public double paramMin, paramMax; public int paramPasos; // si columnaTipo="parametro"
        public double birthX, deathX, birthY, deathY;
        public double muBase, muStress, nuBase, tasaConsumo, r, K;
    }

    @PostMapping("/heatmap-error")
    public SimulacionService.HeatmapErrorResultado heatmapError(@RequestBody HeatmapErrorRequest req) {
        simulacionService.actualizarParametros(
                req.birthX, req.deathX, req.birthY, req.deathY,
                req.muBase, req.muStress, req.nuBase,
                req.tasaConsumo, req.r, req.K);
        return simulacionService.calcularHeatmapError(
                req.x0, req.y0, req.z0,
                req.hMin, req.hMax, req.hPasos,
                req.columnaTipo,
                req.tFinalMin, req.tFinalMax, req.tFinalPasos,
                req.tFinalFijo,
                req.paramNombre, req.paramMin, req.paramMax, req.paramPasos);
    }
    // ── 8) Mapa de estabilidad numérica de RK4 ──────────────────────────

    public static class EstabilidadRequest {
        public double x0, y0, z0;
        public double hMin, hMax; public int hPasos;
        public String paramNombre; public double paramMin, paramMax; public int paramPasos;
        public int pasosSimulacion;
        public double birthX, deathX, birthY, deathY;
        public double muBase, muStress, nuBase, tasaConsumo, r, K;
    }

    @PostMapping("/mapa-estabilidad")
    public SimulacionService.MapaEstabilidadResultado mapaEstabilidad(@RequestBody EstabilidadRequest req) {
        simulacionService.actualizarParametros(
                req.birthX, req.deathX, req.birthY, req.deathY,
                req.muBase, req.muStress, req.nuBase,
                req.tasaConsumo, req.r, req.K);
        return simulacionService.calcularMapaEstabilidad(
                req.x0, req.y0, req.z0,
                req.hMin, req.hMax, req.hPasos,
                req.paramNombre, req.paramMin, req.paramMax, req.paramPasos,
                req.pasosSimulacion);
    }
}