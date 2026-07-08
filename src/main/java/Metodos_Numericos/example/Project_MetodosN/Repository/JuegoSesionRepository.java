package Metodos_Numericos.example.Project_MetodosN.Repository;

import Metodos_Numericos.example.Project_MetodosN.Model.JuegoSesion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JuegoSesionRepository extends JpaRepository<JuegoSesion, Long> {
}