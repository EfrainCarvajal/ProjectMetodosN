package Metodos_Numericos.example.Project_MetodosN.Repository;

import Metodos_Numericos.example.Project_MetodosN.Model.JuegoDecision;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface JuegoDecisionRepository extends JpaRepository<JuegoDecision, Long> {
    List<JuegoDecision> findBySesionIdOrderByTurnoAsc(Long sesionId);
}