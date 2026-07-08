package Metodos_Numericos.example.Project_MetodosN.Controller;

import Metodos_Numericos.example.Project_MetodosN.DTO.IteracionValidacion;
import Metodos_Numericos.example.Project_MetodosN.Service.SimulacionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import Metodos_Numericos.example.Project_MetodosN.DTO.ValidacionResultado;
import Metodos_Numericos.example.Project_MetodosN.Model.DatosHistoricosINEC;
import Metodos_Numericos.example.Project_MetodosN.Model.RegistroPoblacion;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.List;

@Controller
public class PoblacionController {

    private static final double ANIO_BASE = 2010.0;

    @Autowired
    private SimulacionService simulacionService;

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("registros", simulacionService.obtenerHistorial());
        model.addAttribute("birthX", simulacionService.getBirthX());
        model.addAttribute("deathX", simulacionService.getDeathX());
        model.addAttribute("birthY", simulacionService.getBirthY());
        model.addAttribute("deathY", simulacionService.getDeathY());
        model.addAttribute("muBase", simulacionService.getMuBase());
        model.addAttribute("muStress", simulacionService.getMuStress());
        model.addAttribute("nuBase", simulacionService.getNuBase());
        model.addAttribute("tasaConsumo", simulacionService.getTasaConsumo());
        model.addAttribute("r", simulacionService.getR());
        model.addAttribute("K", simulacionService.getK());
        return "index";
    }

    @PostMapping("/simular")
    public String simular(
            @RequestParam(required = false) String provincia,
            @RequestParam double x0,
            @RequestParam double y0,
            @RequestParam double z0,
            @RequestParam double h,
            @RequestParam int pasos,
            @RequestParam(defaultValue = "0.03") double birthX,
            @RequestParam(defaultValue = "0.01") double deathX,
            @RequestParam(defaultValue = "0.04") double birthY,
            @RequestParam(defaultValue = "0.015") double deathY,
            @RequestParam(defaultValue = "0.005") double muBase,
            @RequestParam(defaultValue = "0.005") double muStress,
            @RequestParam(defaultValue = "0.013") double nuBase,
            @RequestParam(defaultValue = "0.0000006") double tasaConsumo,
            @RequestParam(defaultValue = "0.05") double r,
            @RequestParam(defaultValue = "1000.0") double K) {

        double finalX0 = x0;
        double finalY0 = y0;

        // Intercepción por provincia (datos INEC 2022)
        if (provincia != null && !provincia.isBlank()) {
            switch (provincia.toLowerCase()) {
                case "guayas" -> {
                    finalX0 = 3_134_917.0;
                    finalY0 = 1_255_913.0;
                }
                case "pichincha" -> {
                    finalX0 = 2_430_034.0;
                    finalY0 = 367_180.0;
                }
                case "pastaza" -> {
                    finalX0 = 41_515.0;
                    finalY0 = 62_820.0;
                }
                case "ecuador" -> {
                    finalX0 = 10_688_499.0;
                    finalY0 = 6_250_487.0;
                }
            }
        }

        simulacionService.actualizarParametros(
                birthX, deathX, birthY, deathY,
                muBase, muStress, nuBase,
                tasaConsumo, r, K);

        // Pasamos la provincia al servicio para que quede registrada en la sesión
        simulacionService.ejecutarSimulacion(
                provincia, 0.0, finalX0, finalY0, z0, h, pasos);

        return "redirect:/";
    }

    @GetMapping("/validacion")
    @ResponseBody
    public ValidacionResultado validacion(
            @RequestParam(defaultValue = "ecuador") String provincia,
            @RequestParam(defaultValue = "1.0") double h,
            @RequestParam(defaultValue = "12") int pasos,
            @RequestParam(required = false) Double z0) {

        String key = (provincia == null || provincia.isBlank())
                ? "ecuador" : provincia.toLowerCase();
        if (!DatosHistoricosINEC.OBTENER.containsKey(key)) {
            key = "ecuador";
        }
        DatosHistoricosINEC.Datos datos = DatosHistoricosINEC.OBTENER.get(key);

        double zInicial = (z0 != null) ? z0 : simulacionService.getK() * 0.5;

        List<SimulacionService.PasoDetalle> pasosDetalle = simulacionService.simularConDetalle(
                0.0, datos.x2010(), datos.y2010(), zInicial, h, pasos);

        List<IteracionValidacion> iteraciones = pasosDetalle.stream()
                .map(pd -> new IteracionValidacion(
                pd.paso(), pd.t(), ANIO_BASE + pd.t(),
                pd.x(), pd.y(), pd.z(),
                pd.deltaX(), pd.deltaY(), pd.deltaZ(),
                pd.k1x(), pd.k1y(), pd.k1z(),
                pd.k2x(), pd.k2y(), pd.k2z(),
                pd.k3x(), pd.k3y(), pd.k3z(),
                pd.k4x(), pd.k4y(), pd.k4z()))
                .toList();

        SimulacionService.PasoDetalle ultimo = pasosDetalle.get(pasosDetalle.size() - 1);

        double errAbsX = Math.abs(ultimo.x() - datos.x2022());
        double errPctX = errAbsX / datos.x2022() * 100.0;
        double errAbsY = Math.abs(ultimo.y() - datos.y2022());
        double errPctY = errAbsY / datos.y2022() * 100.0;

        double K = simulacionService.getK();
        double zMin = pasosDetalle.stream().mapToDouble(SimulacionService.PasoDetalle::z).min().orElse(0);
        double zMax = pasosDetalle.stream().mapToDouble(SimulacionService.PasoDetalle::z).max().orElse(0);

        return new ValidacionResultado(
                key, datos.x2010(), datos.y2010(),
                ultimo.x(), ultimo.y(),
                datos.x2022(), datos.y2022(),
                errAbsX, errPctX, errAbsY, errPctY,
                ultimo.z(), zMin, zMax,
                zMin >= 0, zMax <= K,
                h, pasos,
                iteraciones);
    }

    private String capitalizarProvincia(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    @GetMapping("/presentacion")
    public String presentacion() {
        return "presentacion";
    }

    @GetMapping("/simulacion")
    public String simulacion() {
        return "simulador";
    }
}
