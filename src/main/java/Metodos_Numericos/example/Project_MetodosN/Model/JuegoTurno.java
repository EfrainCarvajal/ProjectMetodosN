package Metodos_Numericos.example.Project_MetodosN.Model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
public class JuegoTurno {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sesion_id")
    private JuegoSesion sesion;

    private int    turno;
    private String amenazaId;
    private String amenazaNombre;
    private String claseNombre;
    private String nombrePersonalizado;

    private double xFinal;
    private double yFinal;
    private double zFinal;

    private LocalDateTime creadoEn;

    public JuegoTurno() {}

    public JuegoTurno(JuegoSesion sesion, int turno,
                      String amenazaId, String amenazaNombre,
                      String claseNombre, String nombrePersonalizado,
                      double xFinal, double yFinal, double zFinal) {
        this.sesion              = sesion;
        this.turno               = turno;
        this.amenazaId           = amenazaId;
        this.amenazaNombre       = amenazaNombre;
        this.claseNombre         = claseNombre;
        this.nombrePersonalizado = nombrePersonalizado;
        this.xFinal              = xFinal;
        this.yFinal              = yFinal;
        this.zFinal              = zFinal;
        this.creadoEn            = LocalDateTime.now();
    }

    // ── Getters / Setters ─────────────────────────────────────────────────

    public Long getId()                     { return id; }
    public JuegoSesion getSesion()          { return sesion; }
    public void setSesion(JuegoSesion s)    { this.sesion = s; }
    public int getTurno()                   { return turno; }
    public String getAmenazaId()            { return amenazaId; }
    public String getAmenazaNombre()        { return amenazaNombre; }
    public String getClaseNombre()          { return claseNombre; }
    public String getNombrePersonalizado()  { return nombrePersonalizado; }
    public double getXFinal()               { return xFinal; }
    public double getYFinal()               { return yFinal; }
    public double getZFinal()               { return zFinal; }
    public LocalDateTime getCreadoEn()      { return creadoEn; }
}