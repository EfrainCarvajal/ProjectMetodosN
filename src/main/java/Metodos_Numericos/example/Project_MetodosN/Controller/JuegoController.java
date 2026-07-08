package Metodos_Numericos.example.Project_MetodosN.Controller;

import Metodos_Numericos.example.Project_MetodosN.Model.JuegoDecision;
import Metodos_Numericos.example.Project_MetodosN.Repository.JuegoDecisionRepository;
import Metodos_Numericos.example.Project_MetodosN.Model.JuegoSesion;
import Metodos_Numericos.example.Project_MetodosN.Repository.JuegoSesionRepository;
import Metodos_Numericos.example.Project_MetodosN.Model.JuegoTurno;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/juego")
@CrossOrigin(origins = "*")
public class JuegoController {

    @Autowired
    private JuegoSesionRepository sesionRepo;

    @Autowired
    private JuegoDecisionRepository decisionRepo;

    // ── 1. Crear sesión ───────────────────────────────────────────────────

    @PostMapping("/sesiones")
    public ResponseEntity<Map<String, Object>> crearSesion(
            @RequestBody Map<String, Object> body) {

        String provincia = (String) body.getOrDefault("provincia", "Manual");
        double xInicial  = toDouble(body.get("xInicial"));
        double yInicial  = toDouble(body.get("yInicial"));
        double zInicial  = toDouble(body.get("zInicial"));
        int maxTurnos    = toInt(body.getOrDefault("maxTurnos", 8));

        JuegoSesion sesion = new JuegoSesion(
                provincia, xInicial, yInicial, zInicial, maxTurnos);
        sesionRepo.save(sesion);

        return ResponseEntity.ok(Map.of("id", sesion.getId()));
    }

    // ── 2. Registrar turno ────────────────────────────────────────────────

    @PostMapping("/sesiones/{id}/turnos")
    public ResponseEntity<Map<String, Object>> registrarTurno(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        JuegoSesion sesion = sesionRepo.findById(id).orElse(null);
        if (sesion == null) return ResponseEntity.notFound().build();

        JuegoTurno turno = new JuegoTurno(
                sesion,
                toInt(body.getOrDefault("turno", 1)),
                (String) body.getOrDefault("amenazaId", ""),
                (String) body.getOrDefault("amenazaNombre", ""),
                (String) body.getOrDefault("claseNombre", ""),
                (String) body.getOrDefault("nombrePersonalizado", ""),
                toDouble(body.get("xFinal")),
                toDouble(body.get("yFinal")),
                toDouble(body.get("zFinal"))
        );
        sesion.getTurnos().add(turno);
        sesionRepo.save(sesion);

        return ResponseEntity.ok(Map.of("turnoId", turno.getId() != null ? turno.getId() : 0));
    }

    // ── 3. Finalizar sesión ───────────────────────────────────────────────

    @PatchMapping("/sesiones/{id}/finalizar")
    public ResponseEntity<Void> finalizarSesion(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        JuegoSesion sesion = sesionRepo.findById(id).orElse(null);
        if (sesion == null) return ResponseEntity.notFound().build();

        sesion.setVeredicto((String) body.getOrDefault("veredicto", "DESCONOCIDO"));
        sesion.setTurnosJugados(toInt(body.getOrDefault("turnosJugados", 0)));
        sesion.setFinalizadoEn(LocalDateTime.now());
        sesionRepo.save(sesion);

        return ResponseEntity.ok().build();
    }

    // ── 4. Registrar decisión ──────────────────────────────────────────────

    @PostMapping("/sesiones/{id}/decisiones")
    public ResponseEntity<Map<String, Object>> registrarDecision(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        JuegoSesion sesion = sesionRepo.findById(id).orElse(null);
        if (sesion == null) return ResponseEntity.notFound().build();

        JuegoDecision decision = new JuegoDecision(
                sesion,
                toInt(body.getOrDefault("turno", 0)),
                (String) body.getOrDefault("decisionId", ""),
                (String) body.getOrDefault("decisionNombre", ""),
                toInt(body.getOrDefault("costo", 0)),
                toInt(body.getOrDefault("presupuestoRestante", 0))
        );
        decisionRepo.save(decision);

        return ResponseEntity.ok(Map.of("decisionId", decision.getId() != null ? decision.getId() : 0));
    }

    // ── 5. Listar decisiones de una sesión ────────────────────────────────

    @GetMapping("/sesiones/{id}/decisiones")
    public ResponseEntity<?> listarDecisiones(@PathVariable Long id) {
        return ResponseEntity.ok(decisionRepo.findBySesionIdOrderByTurnoAsc(id));
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private double toDouble(Object val) {
        if (val == null) return 0.0;
        if (val instanceof Number) return ((Number) val).doubleValue();
        try { return Double.parseDouble(val.toString()); }
        catch (NumberFormatException e) { return 0.0; }
    }

    private int toInt(Object val) {
        if (val == null) return 0;
        if (val instanceof Number) return ((Number) val).intValue();
        try { return Integer.parseInt(val.toString()); }
        catch (NumberFormatException e) { return 0; }
    }
}