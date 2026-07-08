package Metodos_Numericos.example.Project_MetodosN.DTO;

public class DecisionRequest {
    private int turno;
    private String decisionId;
    private String decisionNombre;
    private int costo;
    private int presupuestoRestante;

    // Getters / Setters
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