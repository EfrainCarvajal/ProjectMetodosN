package Metodos_Numericos.example.Project_MetodosN.Controller;

import Metodos_Numericos.example.Project_MetodosN.DTO.SimulacionRequest;
import Metodos_Numericos.example.Project_MetodosN.Service.SimulacionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SimulacionController {

    @Autowired
    private SimulacionService simulacionService;

    @PostMapping("/simulacion")
    public ResponseEntity<Void> guardarSimulacion(@RequestBody SimulacionRequest req) {

        simulacionService.actualizarParametros(
                req.getBirthX(), req.getDeathX(),
                req.getBirthY(), req.getDeathY(),
                req.getMuBase(), req.getMuStress(), req.getNuBase(),
                req.getTasaConsumo(), req.getR(), req.getK());

        simulacionService.ejecutarSimulacion(
                req.getProvincia(),
                0.0, req.getX0(), req.getY0(), req.getZ0(),
                req.getH(), req.getPasos());

        return ResponseEntity.ok().build();
    }
}