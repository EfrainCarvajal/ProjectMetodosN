package Metodos_Numericos.example.Project_MetodosN.Model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
public class RegistroPoblacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    /** Sesión de simulación a la que pertenece este registro */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sesion_id")
    @JsonIgnore
    private SimulacionSesion sesion;

    private double tiempo;
    private double poblacion_x;
    private double poblacion_y;
    private double poblacion_z;

    public RegistroPoblacion() {}

    public RegistroPoblacion(double tiempo, double x, double y, double z) {
        this.tiempo      = tiempo;
        this.poblacion_x = x;
        this.poblacion_y = y;
        this.poblacion_z = z;
    }

    // ── Getters / Setters ─────────────────────────────────────────────────

    public long getId()                   { return id; }
    public void setId(long id)            { this.id = id; }

    public SimulacionSesion getSesion()   { return sesion; }
    public void setSesion(SimulacionSesion s) { this.sesion = s; }

    public double getTiempo()             { return tiempo; }
    public void setTiempo(double t)       { this.tiempo = t; }

    public double getPoblacion_x()        { return poblacion_x; }
    public void setPoblacion_x(double x)  { this.poblacion_x = x; }

    public double getPoblacion_y()        { return poblacion_y; }
    public void setPoblacion_y(double y)  { this.poblacion_y = y; }

    public double getPoblacion_z()        { return poblacion_z; }
    public void setPoblacion_z(double z)  { this.poblacion_z = z; }
}