package Metodos_Numericos.example.Project_MetodosN.Model;

import Metodos_Numericos.example.Project_MetodosN.Model.JuegoSesion;
import jakarta.persistence.*;

@Entity
public class JuegoDecision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "sesion_id")
    private JuegoSesion sesion;

    private int turno;
    private String decisionId;
    private String decisionNombre;
    private int costo;
    private int presupuestoRestante;

    public JuegoDecision() {}

    public JuegoDecision(JuegoSesion sesion, int turno, String decisionId,
                          String decisionNombre, int costo, int presupuestoRestante) {
        this.sesion = sesion;
        this.turno = turno;
        this.decisionId = decisionId;
        this.decisionNombre = decisionNombre;
        this.costo = costo;
        this.presupuestoRestante = presupuestoRestante;
    }

    // ── Getters / Setters ──
    public Long getId() { return id; }
    public JuegoSesion getSesion() { return sesion; }
    public void setSesion(JuegoSesion sesion) { this.sesion = sesion; }
    public int getTurno() { return turno; }
    public void setTurno(int turno) { this.turno = turno; }
    public String getDecisionId() { return decisionId; }
    public void setDecisionId(String decisionId) { this.decisionId = decisionId; }
    public String getDecisionNombre() { return decisionNombre; }
    public void setDecisionNombre(String decisionNombre) { this.decisionNombre = decisionNombre; }
    public int getCosto() { return costo; }
    public void setCosto(int costo) { this.costo = costo; }
    public int getPresupuestoRestante() { return presupuestoRestante; }
    public void setPresupuestoRestante(int presupuestoRestante) { this.presupuestoRestante = presupuestoRestante; }
}