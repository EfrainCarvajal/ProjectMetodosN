package Metodos_Numericos.example.Project_MetodosN.DTO;

/**
 * Representa un paso (año) de la validación histórica, incluyendo los
 * 4 sub-cálculos k1..k4 que RK4 promedia para avanzar de un año al
 * siguiente. Se usa solo para la tabla interactiva del frontend;
 * no persiste nada.
 */
public record IteracionValidacion(
        int paso,
        double t,
        double anio,
        double x, double y, double z,
        double deltaX, double deltaY, double deltaZ,
        double k1x, double k1y, double k1z,
        double k2x, double k2y, double k2z,
        double k3x, double k3y, double k3z,
        double k4x, double k4y, double k4z
) {}