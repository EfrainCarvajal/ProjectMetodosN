package Metodos_Numericos.example.Project_MetodosN.Model;

import Metodos_Numericos.example.Project_MetodosN.Model.RegistroPoblacion;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * SimulacionSesion — agrupa un conjunto de RegistroPoblacion bajo una misma
 * corrida de simulación, identificada por provincia, parámetros y timestamp.
 *
 * Relación: una sesión tiene muchos registros (1:N).
 */
@Entity
public class SimulacionSesion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre legible: "Pichincha", "Guayas", "Pastaza", "Manual", etc. */
    private String provincia;

    /** Timestamp en que se lanzó la simulación */
    private LocalDateTime fechaSimulacion;

    // ── Condiciones iniciales capturadas en el momento de simular ─────────
    private double x0;
    private double y0;
    private double z0;
    private double h;
    private int    pasos;

    // ── Parámetros del modelo en esa sesión ───────────────────────────────
    private double birthX;
    private double deathX;
    private double birthY;
    private double deathY;
    private double muBase;
    private double muStress;
    private double nuBase;
    private double tasaConsumo;
    private double r;
    private double k;

    /** Registros RK4 pertenecientes a esta sesión */
    @OneToMany(mappedBy = "sesion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("tiempo ASC")
    private List<RegistroPoblacion> registros = new ArrayList<>();

    // ── Constructores ─────────────────────────────────────────────────────

    public SimulacionSesion() {}

    public SimulacionSesion(String provincia, double x0, double y0, double z0,
                            double h, int pasos,
                            double birthX, double deathX,
                            double birthY, double deathY,
                            double muBase, double muStress, double nuBase,
                            double tasaConsumo, double r, double k) {
        this.provincia       = provincia;
        this.fechaSimulacion = LocalDateTime.now();
        this.x0 = x0; this.y0 = y0; this.z0 = z0;
        this.h  = h;  this.pasos = pasos;
        this.birthX      = birthX;   this.deathX     = deathX;
        this.birthY      = birthY;   this.deathY     = deathY;
        this.muBase      = muBase;   this.muStress   = muStress;
        this.nuBase      = nuBase;   this.tasaConsumo = tasaConsumo;
        this.r = r; this.k = k;
    }

    // ── Helper ────────────────────────────────────────────────────────────

    public void addRegistro(RegistroPoblacion r) {
        r.setSesion(this);
        this.registros.add(r);
    }

    /** Etiqueta corta para encabezados de columna en el reporte comparativo */
    public String etiqueta() {
        if (provincia == null || provincia.isBlank()) return "Sesión #" + id;
        return provincia;
    }

    // ── Getters / Setters ─────────────────────────────────────────────────

    public Long getId()                        { return id; }
    public String getProvincia()               { return provincia; }
    public void setProvincia(String p)         { this.provincia = p; }
    public LocalDateTime getFechaSimulacion()  { return fechaSimulacion; }
    public void setFechaSimulacion(LocalDateTime f) { this.fechaSimulacion = f; }
    public double getX0()            { return x0; }
    public double getY0()            { return y0; }
    public double getZ0()            { return z0; }
    public double getH()             { return h; }
    public int    getPasos()         { return pasos; }
    public double getBirthX()        { return birthX; }
    public double getDeathX()        { return deathX; }
    public double getBirthY()        { return birthY; }
    public double getDeathY()        { return deathY; }
    public double getMuBase()        { return muBase; }
    public double getMuStress()      { return muStress; }
    public double getNuBase()        { return nuBase; }
    public double getTasaConsumo()   { return tasaConsumo; }
    public double getR()             { return r; }
    public double getK()             { return k; }
    public List<RegistroPoblacion> getRegistros() { return registros; }
}