package Metodos_Numericos.example.Project_MetodosN.DTO;

import java.util.List;

public record ValidacionResultado(
        String provincia,
        double x2010,
        double y2010,
        double xSimulado2022,
        double ySimulado2022,
        double xReal2022,
        double yReal2022,
        double errorAbsolutoX,
        double errorPorcentualX,
        double errorAbsolutoY,
        double errorPorcentualY,
        double zFinal,
        double zMin,
        double zMax,
        boolean zSiemprePositivo,
        boolean zSiempreBajoK,
        double h,
        int pasos,
        List<IteracionValidacion> iteraciones
) {}