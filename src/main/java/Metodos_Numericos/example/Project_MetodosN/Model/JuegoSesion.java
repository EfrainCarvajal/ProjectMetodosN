package Metodos_Numericos.example.Project_MetodosN.Model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
public class JuegoSesion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String provincia;
    private double xInicial;
    private double yInicial;
    private double zInicial;
    private int    maxTurnos;

    private String        veredicto;      // RESISTENTE | DANIO | COLAPSO
    private int           turnosJugados;
    private LocalDateTime creadoEn;
    private LocalDateTime finalizadoEn;

    @OneToMany(mappedBy = "sesion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("turno ASC")
    private List<JuegoTurno> turnos = new ArrayList<>();

    public JuegoSesion() {}

    public JuegoSesion(String provincia, double xInicial, double yInicial,
                       double zInicial, int maxTurnos) {
        this.provincia  = provincia;
        this.xInicial   = xInicial;
        this.yInicial   = yInicial;
        this.zInicial   = zInicial;
        this.maxTurnos  = maxTurnos;
        this.creadoEn   = LocalDateTime.now();
    }

    // ── Getters / Setters ─────────────────────────────────────────────────

    public Long getId()                         { return id; }
    public String getProvincia()                { return provincia; }
    public void setProvincia(String p)          { this.provincia = p; }
    public double getXInicial()                 { return xInicial; }
    public double getYInicial()                 { return yInicial; }
    public double getZInicial()                 { return zInicial; }
    public int getMaxTurnos()                   { return maxTurnos; }
    public String getVeredicto()                { return veredicto; }
    public void setVeredicto(String v)          { this.veredicto = v; }
    public int getTurnosJugados()               { return turnosJugados; }
    public void setTurnosJugados(int t)         { this.turnosJugados = t; }
    public LocalDateTime getCreadoEn()          { return creadoEn; }
    public LocalDateTime getFinalizadoEn()      { return finalizadoEn; }
    public void setFinalizadoEn(LocalDateTime f){ this.finalizadoEn = f; }
    public List<JuegoTurno> getTurnos()         { return turnos; }
}