package Metodos_Numericos.example.Project_MetodosN.Repository;

import Metodos_Numericos.example.Project_MetodosN.Model.SimulacionSesion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SimulacionSesionRepository extends JpaRepository<SimulacionSesion, Long> {

    /** Todas las sesiones ordenadas de más reciente a más antigua */
    List<SimulacionSesion> findAllByOrderByFechaSimulacionDesc();

    /** Últimas N sesiones (para el reporte comparativo) */
    @Query("SELECT s FROM SimulacionSesion s ORDER BY s.fechaSimulacion DESC LIMIT :n")
    List<SimulacionSesion> findUltimasN(int n);

    /** Sesiones de una provincia concreta */
    List<SimulacionSesion> findByProvinciaIgnoreCaseOrderByFechaSimulacionDesc(String provincia);

    /** La sesión más reciente de cada provincia distinta */
    @Query("""
        SELECT s FROM SimulacionSesion s
        WHERE s.fechaSimulacion = (
            SELECT MAX(s2.fechaSimulacion)
            FROM SimulacionSesion s2
            WHERE LOWER(s2.provincia) = LOWER(s.provincia)
        )
        ORDER BY s.fechaSimulacion DESC
    """)
    List<SimulacionSesion> findUltimasPorProvincia();

    Optional<SimulacionSesion> findTopByOrderByFechaSimulacionDesc();
}