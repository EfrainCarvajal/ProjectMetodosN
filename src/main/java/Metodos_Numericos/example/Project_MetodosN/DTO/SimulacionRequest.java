package Metodos_Numericos.example.Project_MetodosN.DTO;

public class SimulacionRequest {

    private String provincia;
    private double h;
    private int pasos;
    private double x0, y0, z0;
    private double birthX, deathX, birthY, deathY;
    private double muBase, muStress, nuBase, tasaConsumo;
    private double r, k;

    public String getProvincia() { return provincia; }
    public void setProvincia(String provincia) { this.provincia = provincia; }
    public double getH() { return h; }
    public void setH(double h) { this.h = h; }
    public int getPasos() { return pasos; }
    public void setPasos(int pasos) { this.pasos = pasos; }
    public double getX0() { return x0; }
    public void setX0(double x0) { this.x0 = x0; }
    public double getY0() { return y0; }
    public void setY0(double y0) { this.y0 = y0; }
    public double getZ0() { return z0; }
    public void setZ0(double z0) { this.z0 = z0; }
    public double getBirthX() { return birthX; }
    public void setBirthX(double birthX) { this.birthX = birthX; }
    public double getDeathX() { return deathX; }
    public void setDeathX(double deathX) { this.deathX = deathX; }
    public double getBirthY() { return birthY; }
    public void setBirthY(double birthY) { this.birthY = birthY; }
    public double getDeathY() { return deathY; }
    public void setDeathY(double deathY) { this.deathY = deathY; }
    public double getMuBase() { return muBase; }
    public void setMuBase(double muBase) { this.muBase = muBase; }
    public double getMuStress() { return muStress; }
    public void setMuStress(double muStress) { this.muStress = muStress; }
    public double getNuBase() { return nuBase; }
    public void setNuBase(double nuBase) { this.nuBase = nuBase; }
    public double getTasaConsumo() { return tasaConsumo; }
    public void setTasaConsumo(double tasaConsumo) { this.tasaConsumo = tasaConsumo; }
    public double getR() { return r; }
    public void setR(double r) { this.r = r; }
    public double getK() { return k; }
    public void setK(double k) { this.k = k; }
}