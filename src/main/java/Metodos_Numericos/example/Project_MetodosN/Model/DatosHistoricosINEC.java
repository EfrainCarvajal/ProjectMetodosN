package Metodos_Numericos.example.Project_MetodosN.Model;

import java.util.Map;

/**
 * Tabla de datos históricos INEC usada por /validacion. Centraliza los
 * valores reales de población 2010 y 2022 por provincia. Los valores de
 * 2022 son los mismos "datos INEC 2022" que ya estaban hardcodeados en
 * PoblacionController.simular(); se replican aquí tal cual, sin tocar
 * ese endpoint.
 */
public class DatosHistoricosINEC {

    public record Datos(double x2010, double y2010, double x2022, double y2022) {}

    public static final Map<String, Datos> OBTENER = Map.of(
            "guayas",    new Datos(3_080_055.0,   565_428.0, 3_134_917.0, 1_255_913.0),
            "pichincha", new Datos(1_761_867.0,   814_420.0, 2_430_034.0,   367_180.0),
            "pastaza",   new Datos(   36_927.0,    47_006.0,    41_515.0,    62_820.0),
            "ecuador",   new Datos(9_090_786.0, 5_392_713.0, 10_688_499.0, 6_250_487.0)
    );
}