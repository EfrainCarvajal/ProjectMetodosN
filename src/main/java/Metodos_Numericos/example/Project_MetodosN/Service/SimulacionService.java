package Metodos_Numericos.example.Project_MetodosN.Service;

import Metodos_Numericos.example.Project_MetodosN.Model.RegistroPoblacion;
import Metodos_Numericos.example.Project_MetodosN.Model.SimulacionSesion;
import Metodos_Numericos.example.Project_MetodosN.Repository.SimulacionSesionRepository;
import Metodos_Numericos.example.Project_MetodosN.Repository.registropoblacionrepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SimulacionService {

    @Autowired
    private registropoblacionrepository registroRepo;

    @Autowired
    private SimulacionSesionRepository sesionRepo;

    // ── Parámetros del modelo (configurables desde el frontend) ───────────
    private double birthX = 0.03;
    private double deathX = 0.01;
    private double birthY = 0.04;
    private double deathY = 0.015;
    private double muBase = 0.005;
    private double muStress = 0.005;
    private double nuBase = 0.013;
    private double tasaConsumo = 0.0000006;
    private double r = 0.05;
    private double K = 1000.0;

    // ── Actualización de parámetros ───────────────────────────────────────
    public void actualizarParametros(
            double birthX, double deathX,
            double birthY, double deathY,
            double muBase, double muStress, double nuBase,
            double tasaConsumo, double r, double K) {
        this.birthX = birthX;
        this.deathX = deathX;
        this.birthY = birthY;
        this.deathY = deathY;
        this.muBase = muBase;
        this.muStress = muStress;
        this.nuBase = nuBase;
        this.tasaConsumo = tasaConsumo;
        this.r = r;
        this.K = K;
    }

    // ── EDOs ──────────────────────────────────────────────────────────────
    private double migXY(double z) {
        double zCrit = K * 0.3;
        return muBase + muStress * Math.max(0.0, (zCrit - z) / (zCrit + 1.0));
    }

    private double fX(double x, double y, double z) {
        return (birthX - deathX) * x - migXY(z) * x + nuBase * y;
    }

    private double fY(double x, double y, double z) {
        return (birthY - deathY) * y + migXY(z) * x - nuBase * y;
    }

    private double fZ(double x, double y, double z) {
        return r * z * (1.0 - z / K) - tasaConsumo * (x + y);
    }

    // ── RK4 + persistencia ────────────────────────────────────────────────
    /**
     * Ejecuta la simulación y la guarda como una sesión nueva.
     *
     * @param provincia nombre de la provincia (o "Manual" si no vino del mapa)
     */
    @Transactional
    public List<RegistroPoblacion> ejecutarSimulacion(
            String provincia,
            double t0, double x0, double y0, double z0,
            double h, int pasos) {

        // Crear y persistir la sesión con metadatos
        SimulacionSesion sesion = new SimulacionSesion(
                provincia == null || provincia.isBlank() ? "Manual" : capitalize(provincia),
                x0, y0, z0, h, pasos,
                birthX, deathX, birthY, deathY,
                muBase, muStress, nuBase,
                tasaConsumo, r, K);

        double t = t0, x = x0, y = y0, z = z0;
        sesion.addRegistro(new RegistroPoblacion(t, x, y, z));

        for (int i = 0; i < pasos; i++) {
            double k1x = h * fX(x, y, z);
            double k1y = h * fY(x, y, z);
            double k1z = h * fZ(x, y, z);

            double k2x = h * fX(x + k1x / 2, y + k1y / 2, z + k1z / 2);
            double k2y = h * fY(x + k1x / 2, y + k1y / 2, z + k1z / 2);
            double k2z = h * fZ(x + k1x / 2, y + k1y / 2, z + k1z / 2);

            double k3x = h * fX(x + k2x / 2, y + k2y / 2, z + k2z / 2);
            double k3y = h * fY(x + k2x / 2, y + k2y / 2, z + k2z / 2);
            double k3z = h * fZ(x + k2x / 2, y + k2y / 2, z + k2z / 2);

            double k4x = h * fX(x + k3x, y + k3y, z + k3z);
            double k4y = h * fY(x + k3x, y + k3y, z + k3z);
            double k4z = h * fZ(x + k3x, y + k3y, z + k3z);

            x += (k1x + 2 * k2x + 2 * k3x + k4x) / 6.0;
            y += (k1y + 2 * k2y + 2 * k3y + k4y) / 6.0;
            z += (k1z + 2 * k2z + 2 * k3z + k4z) / 6.0;
            t += h;

            x = Math.max(x, 0.0);
            y = Math.max(y, 0.0);
            z = Math.max(z, 0.0);

            sesion.addRegistro(new RegistroPoblacion(t, x, y, z));
        }

        sesionRepo.save(sesion);
        return sesion.getRegistros();
    }

    /**
     * Mantiene compatibilidad con el controller existente (sin provincia)
     */
    @Transactional
    public List<RegistroPoblacion> ejecutarSimulacion(
            double t0, double x0, double y0, double z0,
            double h, int pasos) {
        return ejecutarSimulacion("Manual", t0, x0, y0, z0, h, pasos);
    }

    public List<RegistroPoblacion> obtenerHistorial() {
        SimulacionSesion ultima = sesionRepo.findTopByOrderByFechaSimulacionDesc()
                .orElse(null);
        if (ultima == null) {
            return List.of();
        }
        return ultima.getRegistros();
    }

    // ── Getters ───────────────────────────────────────────────────────────
    public double getBirthX() {
        return birthX;
    }

    public double getDeathX() {
        return deathX;
    }

    public double getBirthY() {
        return birthY;
    }

    public double getDeathY() {
        return deathY;
    }

    public double getMuBase() {
        return muBase;
    }

    public double getMuStress() {
        return muStress;
    }

    public double getNuBase() {
        return nuBase;
    }

    public double getTasaConsumo() {
        return tasaConsumo;
    }

    public double getR() {
        return r;
    }

    public double getK() {
        return K;
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private String capitalize(String s) {
        if (s == null || s.isBlank()) {
            return s;
        }
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase();
    }

    // ════════════════════════════════════════════════════════════════════
    // ANÁLISIS NUMÉRICO — Euler vs RK4, convergencia, equilibrio (Newton-
    // Raphson) y sensibilidad paramétrica. Nada de esto persiste sesiones;
    // son cálculos de análisis puros. No se toca el motor RK4 de arriba.
    // ════════════════════════════════════════════════════════════════════
    /**
     * Snapshot inmutable de los 10 parámetros del modelo. Se usa para que los
     * barridos (sensibilidad) puedan variar r, K, etc. sin tocar el estado
     * mutable de la instancia del service (que es un @Service singleton
     * compartido).
     */
    public static class ParametrosModelo {

        public double birthX, deathX, birthY, deathY;
        public double muBase, muStress, nuBase, tasaConsumo, r, K;

        public ParametrosModelo(double birthX, double deathX, double birthY, double deathY,
                double muBase, double muStress, double nuBase,
                double tasaConsumo, double r, double K) {
            this.birthX = birthX;
            this.deathX = deathX;
            this.birthY = birthY;
            this.deathY = deathY;
            this.muBase = muBase;
            this.muStress = muStress;
            this.nuBase = nuBase;
            this.tasaConsumo = tasaConsumo;
            this.r = r;
            this.K = K;
        }
    }

    public ParametrosModelo getParametrosActuales() {
        return new ParametrosModelo(birthX, deathX, birthY, deathY,
                muBase, muStress, nuBase, tasaConsumo, r, K);
    }

    /**
     * Devuelve una COPIA de base con el parámetro `nombre` cambiado a `valor`.
     * Usado por el barrido de sensibilidad (r/K, muStress/tasaConsumo, etc).
     */
    private ParametrosModelo conParametro(ParametrosModelo base, String nombre, double valor) {
        ParametrosModelo p = new ParametrosModelo(base.birthX, base.deathX, base.birthY, base.deathY,
                base.muBase, base.muStress, base.nuBase, base.tasaConsumo, base.r, base.K);
        switch (nombre) {
            case "r" ->
                p.r = valor;
            case "K" ->
                p.K = valor;
            case "muStress" ->
                p.muStress = valor;
            case "tasaConsumo" ->
                p.tasaConsumo = valor;
            case "muBase" ->
                p.muBase = valor;
            case "nuBase" ->
                p.nuBase = valor;
            case "birthX" ->
                p.birthX = valor;
            case "deathX" ->
                p.deathX = valor;
            case "birthY" ->
                p.birthY = valor;
            case "deathY" ->
                p.deathY = valor;
            default ->
                throw new IllegalArgumentException("Parámetro de sensibilidad desconocido: " + nombre);
        }
        return p;
    }

    // ── EDOs "puras", parametrizadas explícitamente (no dependen del
    //    estado mutable de la instancia). Son una copia intencional de
    //    fX/fY/fZ/migXY de arriba — no se tocan esos métodos originales,
    //    que siguen siendo usados exclusivamente por ejecutarSimulacion. ──
    private double migXYcalc(double z, ParametrosModelo p) {
        double zCrit = p.K * 0.3;
        return p.muBase + p.muStress * Math.max(0.0, (zCrit - z) / (zCrit + 1.0));
    }

    private double fXcalc(double x, double y, double z, ParametrosModelo p) {
        return (p.birthX - p.deathX) * x - migXYcalc(z, p) * x + p.nuBase * y;
    }

    private double fYcalc(double x, double y, double z, ParametrosModelo p) {
        return (p.birthY - p.deathY) * y + migXYcalc(z, p) * x - p.nuBase * y;
    }

    private double fZcalc(double x, double y, double z, ParametrosModelo p) {
        return p.r * z * (1.0 - z / p.K) - p.tasaConsumo * (x + y);
    }

    private double[] derivCalc(double x, double y, double z, ParametrosModelo p) {
        return new double[]{fXcalc(x, y, z, p), fYcalc(x, y, z, p), fZcalc(x, y, z, p)};
    }

    private double[] rk4StepCalc(double x, double y, double z, double h, ParametrosModelo p) {
        double[] k1 = derivCalc(x, y, z, p);
        double[] k2 = derivCalc(x + h / 2 * k1[0], y + h / 2 * k1[1], z + h / 2 * k1[2], p);
        double[] k3 = derivCalc(x + h / 2 * k2[0], y + h / 2 * k2[1], z + h / 2 * k2[2], p);
        double[] k4 = derivCalc(x + h * k3[0], y + h * k3[1], z + h * k3[2], p);
        return new double[]{
            x + h / 6.0 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
            y + h / 6.0 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
            z + h / 6.0 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
        };
    }

    private double[] eulerStepCalc(double x, double y, double z, double h, ParametrosModelo p) {
        double[] d = derivCalc(x, y, z, p);
        return new double[]{x + h * d[0], y + h * d[1], z + h * d[2]};
    }

    // ── 1) Comparación Euler explícito vs RK4 ──────────────────────────
    public static class TrayectoriaComparacion {

        public List<Double> tiempos = new ArrayList<>();
        public List<Double> eulerX = new ArrayList<>(), eulerY = new ArrayList<>(), eulerZ = new ArrayList<>();
        public List<Double> rk4X = new ArrayList<>(), rk4Y = new ArrayList<>(), rk4Z = new ArrayList<>();
    }

    /**
     * Corre Euler explícito y RK4 en paralelo, con el mismo h y pasos, usando
     * los parámetros actualmente configurados en el service. No persiste
     * ninguna sesión.
     */
    public TrayectoriaComparacion compararMetodos(double t0, double x0, double y0, double z0,
            double h, int pasos) {
        ParametrosModelo p = getParametrosActuales();
        TrayectoriaComparacion out = new TrayectoriaComparacion();

        double xe = x0, ye = y0, ze = z0;
        double xr = x0, yr = y0, zr = z0;
        double t = t0;

        out.tiempos.add(t);
        out.eulerX.add(xe);
        out.eulerY.add(ye);
        out.eulerZ.add(ze);
        out.rk4X.add(xr);
        out.rk4Y.add(yr);
        out.rk4Z.add(zr);

        for (int i = 0; i < pasos; i++) {
            double[] ne = eulerStepCalc(xe, ye, ze, h, p);
            xe = Math.max(0, ne[0]);
            ye = Math.max(0, ne[1]);
            ze = Math.max(0, ne[2]);

            double[] nr = rk4StepCalc(xr, yr, zr, h, p);
            xr = Math.max(0, nr[0]);
            yr = Math.max(0, nr[1]);
            zr = Math.max(0, nr[2]);

            t += h;
            out.tiempos.add(t);
            out.eulerX.add(xe);
            out.eulerY.add(ye);
            out.eulerZ.add(ze);
            out.rk4X.add(xr);
            out.rk4Y.add(yr);
            out.rk4Z.add(zr);
        }
        return out;
    }

    /**
     * Alias explícito pedido en el enunciado: misma firma que
     * ejecutarSimulacion, aplica solo Euler explícito, sin persistir.
     */
    public TrayectoriaComparacion resolverEuler(double t0, double x0, double y0, double z0,
            double h, int pasos) {
        return compararMetodos(t0, x0, y0, z0, h, pasos);
    }

    // ── 2) Análisis de convergencia (orden del método) ─────────────────
    public static class PuntoError {

        public double h, error;

        public PuntoError(double h, double error) {
            this.h = h;
            this.error = error;
        }
    }

    public static class ConvergenciaResultado {

        public List<PuntoError> euler = new ArrayList<>();
        public List<PuntoError> rk4 = new ArrayList<>();
    }

    private double[] correrEulerFinal(double x0, double y0, double z0, double h, int pasos, ParametrosModelo p) {
        double x = x0, y = y0, z = z0;
        for (int i = 0; i < pasos; i++) {
            double[] n = eulerStepCalc(x, y, z, h, p);
            x = Math.max(0, n[0]);
            y = Math.max(0, n[1]);
            z = Math.max(0, n[2]);
        }
        return new double[]{x, y, z};
    }

    private double[] correrRK4Final(double x0, double y0, double z0, double h, int pasos, ParametrosModelo p) {
        double x = x0, y = y0, z = z0;
        for (int i = 0; i < pasos; i++) {
            double[] n = rk4StepCalc(x, y, z, h, p);
            x = Math.max(0, n[0]);
            y = Math.max(0, n[1]);
            z = Math.max(0, n[2]);
        }
        return new double[]{x, y, z};
    }

    private double normaError(double[] a, double[] b) {
        double dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Corre una solución de referencia con RK4 y h/128, y calcula el error
     * (norma euclidiana en t_final) de Euler y RK4 para h, h/2, h/4, h/8, h/16,
     * recalculando el número de pasos en cada caso para mantener el mismo
     * t_final.
     */
    public ConvergenciaResultado analizarConvergencia(double x0, double y0, double z0,
            double hBase, double tFinal) {
        ParametrosModelo p = getParametrosActuales();

        double hRef = hBase / 128.0;
        int pasosRef = (int) Math.round(tFinal / hRef);
        double[] referencia = correrRK4Final(x0, y0, z0, hRef, pasosRef, p);

        ConvergenciaResultado out = new ConvergenciaResultado();
        double[] divisores = {1, 2, 4, 8, 16};

        for (double d : divisores) {
            double h = hBase / d;
            int pasos = (int) Math.round(tFinal / h);

            double[] finalEuler = correrEulerFinal(x0, y0, z0, h, pasos, p);
            double[] finalRk4 = correrRK4Final(x0, y0, z0, h, pasos, p);

            out.euler.add(new PuntoError(h, normaError(finalEuler, referencia)));
            out.rk4.add(new PuntoError(h, normaError(finalRk4, referencia)));
        }
        return out;
    }

    // ── 4) Punto de equilibrio vía Newton-Raphson multivariable ────────
    public static class ResultadoEquilibrio {

        public boolean convergio;
        public double x, y, z;
        public double residualX, residualY, residualZ;
        public int iteraciones;
        public String mensaje;
    }

    /**
     * Newton-Raphson multivariable con jacobiano numérico (diferencias finitas
     * hacia adelante) para resolver fX=0, fY=0, fZ=0 simultáneamente.
     */
    public ResultadoEquilibrio calcularEquilibrio(double xInicial, double yInicial, double zInicial,
            int maxIteraciones, double tolerancia) {
        ParametrosModelo p = getParametrosActuales();
        double[] v = {xInicial, yInicial, zInicial};
        double epsJ = 1e-4;

        ResultadoEquilibrio res = new ResultadoEquilibrio();

        for (int iter = 0; iter < maxIteraciones; iter++) {
            double[] Fv = derivCalc(v[0], v[1], v[2], p);
            double normaF = Math.sqrt(Fv[0] * Fv[0] + Fv[1] * Fv[1] + Fv[2] * Fv[2]);

            if (normaF < tolerancia) {
                res.convergio = true;
                res.x = v[0];
                res.y = v[1];
                res.z = v[2];
                res.residualX = Fv[0];
                res.residualY = Fv[1];
                res.residualZ = Fv[2];
                res.iteraciones = iter;
                res.mensaje = "Convergió en " + iter + " iteraciones.";
                return res;
            }

            // Jacobiano numérico 3x3
            double[][] J = new double[3][3];
            for (int col = 0; col < 3; col++) {
                double[] vPert = v.clone();
                vPert[col] += epsJ;
                double[] FvPert = derivCalc(vPert[0], vPert[1], vPert[2], p);
                for (int row = 0; row < 3; row++) {
                    J[row][col] = (FvPert[row] - Fv[row]) / epsJ;
                }
            }

            double[] delta = resolverSistemaLineal(J, new double[]{-Fv[0], -Fv[1], -Fv[2]});
            if (delta == null) {
                res.convergio = false;
                res.x = v[0];
                res.y = v[1];
                res.z = v[2];
                res.residualX = Fv[0];
                res.residualY = Fv[1];
                res.residualZ = Fv[2];
                res.mensaje = "El jacobiano es singular; Newton-Raphson no puede continuar.";
                res.iteraciones = iter;
                return res;
            }

            for (int i = 0; i < 3; i++) {
                v[i] += delta[i];
            }
        }

        double[] FvFinal = derivCalc(v[0], v[1], v[2], p);
        res.convergio = false;
        res.x = v[0];
        res.y = v[1];
        res.z = v[2];
        res.residualX = FvFinal[0];
        res.residualY = FvFinal[1];
        res.residualZ = FvFinal[2];
        res.iteraciones = maxIteraciones;
        res.mensaje = "No convergió en " + maxIteraciones + " iteraciones.";
        return res;
    }

    /**
     * Elimina Gauss con pivoteo parcial para resolver J·x = b (NxN). Devuelve
     * null si la matriz resulta singular.
     */
    private double[] resolverSistemaLineal(double[][] J, double[] b) {
        int n = b.length;
        double[][] A = new double[n][n + 1];
        for (int i = 0; i < n; i++) {
            System.arraycopy(J[i], 0, A[i], 0, n);
            A[i][n] = b[i];
        }
        for (int col = 0; col < n; col++) {
            int pivote = col;
            for (int row = col + 1; row < n; row++) {
                if (Math.abs(A[row][col]) > Math.abs(A[pivote][col])) {
                    pivote = row;
                }
            }
            if (Math.abs(A[pivote][col]) < 1e-12) {
                return null;
            }
            double[] tmp = A[col];
            A[col] = A[pivote];
            A[pivote] = tmp;

            for (int row = col + 1; row < n; row++) {
                double factor = A[row][col] / A[col][col];
                for (int k = col; k <= n; k++) {
                    A[row][k] -= factor * A[col][k];
                }
            }
        }
        double[] x = new double[n];
        for (int row = n - 1; row >= 0; row--) {
            double suma = A[row][n];
            for (int col = row + 1; col < n; col++) {
                suma -= A[row][col] * x[col];
            }
            x[row] = suma / A[row][row];
        }
        return x;
    }

    // ── 5) Heatmap de sensibilidad paramétrica ─────────────────────────
    public static class SensibilidadResultado {

        public double[] valoresParam1;
        public double[] valoresParam2;
        public double[][] matriz; // matriz[i][j] -> métrica en (param1[i], param2[j])
    }

    /**
     * @param metrica "zFinal" (valor final de Z) o "tiempoCrisis" (primer
     * instante en que Z cae bajo 0.3*K)
     */
    public SensibilidadResultado calcularSensibilidad(
            String param1Nombre, double param1Min, double param1Max, int param1Pasos,
            String param2Nombre, double param2Min, double param2Max, int param2Pasos,
            double x0, double y0, double z0, double h, int pasosSimulacion,
            String metrica) {

        ParametrosModelo base = getParametrosActuales();
        SensibilidadResultado out = new SensibilidadResultado();
        out.valoresParam1 = new double[param1Pasos];
        out.valoresParam2 = new double[param2Pasos];
        out.matriz = new double[param1Pasos][param2Pasos];

        for (int i = 0; i < param1Pasos; i++) {
            double v1 = param1Pasos == 1 ? param1Min
                    : param1Min + (param1Max - param1Min) * i / (double) (param1Pasos - 1);
            out.valoresParam1[i] = v1;

            for (int j = 0; j < param2Pasos; j++) {
                double v2 = param2Pasos == 1 ? param2Min
                        : param2Min + (param2Max - param2Min) * j / (double) (param2Pasos - 1);
                out.valoresParam2[j] = v2;

                ParametrosModelo p = conParametro(base, param1Nombre, v1);
                p = conParametro(p, param2Nombre, v2);

                out.matriz[i][j] = simularMetrica(x0, y0, z0, h, pasosSimulacion, p, metrica);
            }
        }
        return out;
    }

    private double simularMetrica(double x0, double y0, double z0, double h, int pasos,
            ParametrosModelo p, String metrica) {
        double x = x0, y = y0, z = z0;
        double zCrisis = p.K * 0.3;
        double tiempoCrisis = -1;

        for (int i = 0; i < pasos; i++) {
            double[] n = rk4StepCalc(x, y, z, h, p);
            x = Math.max(0, n[0]);
            y = Math.max(0, n[1]);
            z = Math.max(0, n[2]);
            if (tiempoCrisis < 0 && z < zCrisis) {
                tiempoCrisis = (i + 1) * h;
            }
        }

        if ("tiempoCrisis".equals(metrica)) {
            // Si nunca cruza el umbral, se reporta el horizonte total simulado
            return tiempoCrisis < 0 ? pasos * h : tiempoCrisis;
        }
        return z; // "zFinal" por defecto
    }

    // ── 6) Historial de provincias (última corrida por provincia) ─────
    public static class UltimoRegistroProvincia {

        public String provincia;
        public double x, y, z;

        public UltimoRegistroProvincia(String provincia, double x, double y, double z) {
            this.provincia = provincia;
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }

    /**
     * Última sesión de CADA provincia, con su registro final (x,y,z).
     */
    public List<UltimoRegistroProvincia> obtenerHistorialProvincias() {
        List<SimulacionSesion> sesiones = sesionRepo.findAll();

        Map<String, SimulacionSesion> ultimasPorProvincia = new LinkedHashMap<>();
        for (SimulacionSesion s : sesiones) {
            SimulacionSesion actual = ultimasPorProvincia.get(s.getProvincia());
            if (actual == null || s.getFechaSimulacion().isAfter(actual.getFechaSimulacion())) {
                ultimasPorProvincia.put(s.getProvincia(), s);
            }
        }

        List<UltimoRegistroProvincia> out = new ArrayList<>();
        for (SimulacionSesion s : ultimasPorProvincia.values()) {
            List<RegistroPoblacion> regs = s.getRegistros();
            if (regs.isEmpty()) {
                continue;
            }
            RegistroPoblacion ultimo = regs.get(regs.size() - 1);
            out.add(new UltimoRegistroProvincia(s.getProvincia(), ultimo.getPoblacion_x(), ultimo.getPoblacion_y(), ultimo.getPoblacion_z()));
        }
        return out;
    }
    // ── 7) Heatmap de error de RK4 (filas = h, columnas = t_final o parámetro) ──

    public static class HeatmapErrorResultado {

        public double[] valoresH;
        public double[] valoresColumna;
        public double[][] matrizAbsoluto;  // error absoluto (norma euclidiana)
        public double[][] matrizRelativo;  // error relativo (normalizado contra la referencia)
        public double[][] matrizRMS;       // error RMS por componente
    }

    /**
     * Filas: distintos tamaños de paso h. Columnas: distintos t_final
     * (columnaTipo="tFinal") o distintos valores de un parámetro del modelo
     * (columnaTipo="parametro"), a t_final fijo.
     *
     * Para cada celda (h_i, col_j): 1. Referencia = RK4 con h_i/128 hasta el
     * t_final de esa celda. 2. Resultado = RK4 con h_i hasta el mismo t_final.
     * 3. Error = norma euclidiana entre ambos en (X,Y,Z).
     *
     * Devuelve las 3 métricas (absoluto, relativo, RMS) en una sola pasada para
     * no recalcular la simulación si el usuario cambia de vista en el frontend.
     */
    public HeatmapErrorResultado calcularHeatmapError(
            double x0, double y0, double z0,
            double hMin, double hMax, int hPasos,
            String columnaTipo, // "tFinal" | "parametro"
            double tFinalMin, double tFinalMax, int tFinalPasos,
            double tFinalFijo,
            String paramNombre, double paramMin, double paramMax, int paramPasos) {

        ParametrosModelo base = getParametrosActuales();
        boolean esParametro = "parametro".equals(columnaTipo);

        HeatmapErrorResultado out = new HeatmapErrorResultado();
        int colPasos = esParametro ? paramPasos : tFinalPasos;

        out.valoresH = new double[hPasos];
        out.valoresColumna = new double[colPasos];
        out.matrizAbsoluto = new double[hPasos][colPasos];
        out.matrizRelativo = new double[hPasos][colPasos];
        out.matrizRMS = new double[hPasos][colPasos];

        for (int i = 0; i < hPasos; i++) {
            double h = hPasos == 1 ? hMin : hMin + (hMax - hMin) * i / (double) (hPasos - 1);
            out.valoresH[i] = h;

            for (int j = 0; j < colPasos; j++) {
                double tFinal;
                ParametrosModelo p;

                if (esParametro) {
                    double v = paramPasos == 1 ? paramMin
                            : paramMin + (paramMax - paramMin) * j / (double) (paramPasos - 1);
                    out.valoresColumna[j] = v;
                    p = conParametro(base, paramNombre, v);
                    tFinal = tFinalFijo;
                } else {
                    double v = tFinalPasos == 1 ? tFinalMin
                            : tFinalMin + (tFinalMax - tFinalMin) * j / (double) (tFinalPasos - 1);
                    out.valoresColumna[j] = v;
                    p = base;
                    tFinal = v;
                }

                // Referencia: RK4 muy fino, mismo patrón que analizarConvergencia
                double hRef = h / 128.0;
                int pasosRef = (int) Math.round(tFinal / hRef);
                double[] referencia = correrRK4Final(x0, y0, z0, hRef, pasosRef, p);
                double normaRef = Math.sqrt(
                        referencia[0] * referencia[0] + referencia[1] * referencia[1] + referencia[2] * referencia[2]);

                // Resultado con el h de esta fila
                int pasos = (int) Math.round(tFinal / h);
                double[] finalRk4 = correrRK4Final(x0, y0, z0, h, pasos, p);

                double errAbs = normaError(finalRk4, referencia);
                double errRel = errAbs / (normaRef > 1e-9 ? normaRef : 1e-9);
                double errRMS = errAbs / Math.sqrt(3);

                out.matrizAbsoluto[i][j] = errAbs;
                out.matrizRelativo[i][j] = errRel;
                out.matrizRMS[i][j] = errRMS;
            }
        }
        return out;
    }

    // ── 8) Mapa de estabilidad numérica de RK4 ─────────────────────────
    // Clasifica cada combinación (h, parámetro) en estable / oscilatorio /
    // divergente, corriendo RK4 puro (rk4StepCalc, sin clamping a 0, para
    // no ocultar una divergencia hacia negativos) y analizando la cola de
    // la simulación (últimos pasos) en busca de: valores no finitos o
    // desbordados (divergente), cambios de signo reiterados en la
    // trayectoria de Z (oscilatorio), o asentamiento (estable). También
    // calcula un score continuo (amplitud relativa) para la superficie 3D.
    public static class MapaEstabilidadResultado {

        public double[] valoresH;
        public double[] valoresColumna;
        public int[][] matrizCategoria;  // 0=estable, 1=oscilatorio, 2=divergente
        public double[][] matrizScore;   // amplitud relativa (para superficie 3D); divergente => 2.0
    }

    private static class EstabilidadCelda {

        int categoria;
        double score;

        EstabilidadCelda(int categoria, double score) {
            this.categoria = categoria;
            this.score = score;
        }
    }

    private EstabilidadCelda evaluarEstabilidadCelda(double x0, double y0, double z0,
            double h, int pasos, ParametrosModelo p) {
        double x = x0, y = y0, z = z0;
        double limite = Math.max(p.K, Math.abs(x0) + Math.abs(y0) + Math.abs(z0) + 1.0) * 100.0;

        int colaDesde = Math.max(0, pasos - Math.max(10, pasos / 5));
        List<Double> colaZ = new ArrayList<>();

        for (int i = 0; i < pasos; i++) {
            double[] n = rk4StepCalc(x, y, z, h, p);
            x = n[0];
            y = n[1];
            z = n[2];

            if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(z)
                    || Math.abs(x) > limite || Math.abs(y) > limite || Math.abs(z) > limite) {
                return new EstabilidadCelda(2, 2.0); // divergente
            }
            if (i >= colaDesde) {
                colaZ.add(z);
            }
        }

        if (colaZ.isEmpty()) {
            colaZ.add(z);
        }

        double minZ = Double.MAX_VALUE, maxZ = -Double.MAX_VALUE;
        int cambiosSigno = 0;
        double deltaAnterior = 0;
        boolean deltaAnteriorSet = false;

        for (int k = 0; k < colaZ.size(); k++) {
            double zz = colaZ.get(k);
            minZ = Math.min(minZ, zz);
            maxZ = Math.max(maxZ, zz);
            if (k > 0) {
                double delta = colaZ.get(k) - colaZ.get(k - 1);
                if (deltaAnteriorSet && delta != 0 && deltaAnterior != 0
                        && Math.signum(delta) != Math.signum(deltaAnterior)) {
                    cambiosSigno++;
                }
                if (delta != 0) {
                    deltaAnterior = delta;
                    deltaAnteriorSet = true;
                }
            }
        }

        double escala = Math.max(Math.abs(maxZ), Math.abs(minZ));
        escala = Math.max(escala, 1e-6);
        double amplitudRelativa = (maxZ - minZ) / escala;
        double score = Math.min(1.0, amplitudRelativa);

        int categoria;
        if (cambiosSigno >= 2 || amplitudRelativa > 0.02) {
            categoria = 1; // oscilatorio (o no llega a asentarse)
        } else {
            categoria = 0; // estable
        }

        return new EstabilidadCelda(categoria, score);
    }

    public MapaEstabilidadResultado calcularMapaEstabilidad(
            double x0, double y0, double z0,
            double hMin, double hMax, int hPasos,
            String paramNombre, double paramMin, double paramMax, int paramPasos,
            int pasosSimulacion) {

        ParametrosModelo base = getParametrosActuales();
        MapaEstabilidadResultado out = new MapaEstabilidadResultado();
        out.valoresH = new double[hPasos];
        out.valoresColumna = new double[paramPasos];
        out.matrizCategoria = new int[hPasos][paramPasos];
        out.matrizScore = new double[hPasos][paramPasos];

        for (int i = 0; i < hPasos; i++) {
            double h = hPasos == 1 ? hMin : hMin + (hMax - hMin) * i / (double) (hPasos - 1);
            out.valoresH[i] = h;

            for (int j = 0; j < paramPasos; j++) {
                double v = paramPasos == 1 ? paramMin
                        : paramMin + (paramMax - paramMin) * j / (double) (paramPasos - 1);
                out.valoresColumna[j] = v;

                ParametrosModelo p = conParametro(base, paramNombre, v);
                EstabilidadCelda celda = evaluarEstabilidadCelda(x0, y0, z0, h, pasosSimulacion, p);

                out.matrizCategoria[i][j] = celda.categoria;
                out.matrizScore[i][j] = celda.score;
            }
        }
        return out;
    }

    /**
     * Igual que ejecutarSimulacion, pero NO persiste sesión. Usado por
     * /validacion, que corre una condición inicial histórica (2010) solo para
     * comparar contra datos reales de 2022 — no es una "corrida" que el usuario
     * haya pedido guardar. Reusa exactamente las mismas EDOs (fX/fY/fZ) y el
     * mismo esquema RK4 que ejecutarSimulacion.
     */
    public List<RegistroPoblacion> simularSinPersistir(
            double t0, double x0, double y0, double z0,
            double h, int pasos) {

        List<RegistroPoblacion> registros = new ArrayList<>();
        double t = t0, x = x0, y = y0, z = z0;
        registros.add(new RegistroPoblacion(t, x, y, z));

        for (int i = 0; i < pasos; i++) {
            double k1x = h * fX(x, y, z);
            double k1y = h * fY(x, y, z);
            double k1z = h * fZ(x, y, z);

            double k2x = h * fX(x + k1x / 2, y + k1y / 2, z + k1z / 2);
            double k2y = h * fY(x + k1x / 2, y + k1y / 2, z + k1z / 2);
            double k2z = h * fZ(x + k1x / 2, y + k1y / 2, z + k1z / 2);

            double k3x = h * fX(x + k2x / 2, y + k2y / 2, z + k2z / 2);
            double k3y = h * fY(x + k2x / 2, y + k2y / 2, z + k2z / 2);
            double k3z = h * fZ(x + k2x / 2, y + k2y / 2, z + k2z / 2);

            double k4x = h * fX(x + k3x, y + k3y, z + k3z);
            double k4y = h * fY(x + k3x, y + k3y, z + k3z);
            double k4z = h * fZ(x + k3x, y + k3y, z + k3z);

            x += (k1x + 2 * k2x + 2 * k3x + k4x) / 6.0;
            y += (k1y + 2 * k2y + 2 * k3y + k4y) / 6.0;
            z += (k1z + 2 * k2z + 2 * k3z + k4z) / 6.0;
            t += h;

            x = Math.max(x, 0.0);
            y = Math.max(y, 0.0);
            z = Math.max(z, 0.0);

            registros.add(new RegistroPoblacion(t, x, y, z));
        }

        return registros;
    }

    /**
     * Igual que simularSinPersistir, pero capturando los 4 sub-cálculos k1..k4
     * de cada paso RK4 (en vez de descartarlos), para poder mostrarlos en la
     * tabla interactiva de validación histórica.
     */
    public record PasoDetalle(
            int paso, double t, double x, double y, double z,
            double deltaX, double deltaY, double deltaZ,
            double k1x, double k1y, double k1z,
            double k2x, double k2y, double k2z,
            double k3x, double k3y, double k3z,
            double k4x, double k4y, double k4z
            ) {

    }

    public List<PasoDetalle> simularConDetalle(
            double t0, double x0, double y0, double z0,
            double h, int pasos) {

        List<PasoDetalle> out = new ArrayList<>();
        double t = t0, x = x0, y = y0, z = z0;

        // Paso 0: estado inicial, todavía no hubo ningún sub-cálculo RK4
        out.add(new PasoDetalle(0, t, x, y, z, 0, 0, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));

        for (int i = 0; i < pasos; i++) {
            double k1x = h * fX(x, y, z);
            double k1y = h * fY(x, y, z);
            double k1z = h * fZ(x, y, z);

            double k2x = h * fX(x + k1x / 2, y + k1y / 2, z + k1z / 2);
            double k2y = h * fY(x + k1x / 2, y + k1y / 2, z + k1z / 2);
            double k2z = h * fZ(x + k1x / 2, y + k1y / 2, z + k1z / 2);

            double k3x = h * fX(x + k2x / 2, y + k2y / 2, z + k2z / 2);
            double k3y = h * fY(x + k2x / 2, y + k2y / 2, z + k2z / 2);
            double k3z = h * fZ(x + k2x / 2, y + k2y / 2, z + k2z / 2);

            double k4x = h * fX(x + k3x, y + k3y, z + k3z);
            double k4y = h * fY(x + k3x, y + k3y, z + k3z);
            double k4z = h * fZ(x + k3x, y + k3y, z + k3z);

            double dx = (k1x + 2 * k2x + 2 * k3x + k4x) / 6.0;
            double dy = (k1y + 2 * k2y + 2 * k3y + k4y) / 6.0;
            double dz = (k1z + 2 * k2z + 2 * k3z + k4z) / 6.0;

            x = Math.max(x + dx, 0.0);
            y = Math.max(y + dy, 0.0);
            z = Math.max(z + dz, 0.0);
            t += h;

            out.add(new PasoDetalle(i + 1, t, x, y, z, dx, dy, dz,
                    k1x, k1y, k1z, k2x, k2y, k2z, k3x, k3y, k3z, k4x, k4y, k4z));
        }
        return out;
    }

}
