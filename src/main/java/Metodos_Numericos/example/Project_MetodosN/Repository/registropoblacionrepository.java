    package Metodos_Numericos.example.Project_MetodosN.Repository;

    import Metodos_Numericos.example.Project_MetodosN.Model.RegistroPoblacion;
    import org.springframework.data.jpa.repository.JpaRepository;
    import org.springframework.stereotype.Repository;

    @Repository
    public interface registropoblacionrepository extends JpaRepository<RegistroPoblacion, Long> {
        // Listo, ya expone saveAll(), findAll(), etc. sin moverlo de donde lo tienes
    }