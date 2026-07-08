package Metodos_Numericos.example.Project_MetodosN.Controller;

import Metodos_Numericos.example.Project_MetodosN.Service.ReporteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import java.time.LocalDateTime;
import java.util.List;

@Controller
@RequestMapping("/reportes")
public class ReporteController {

    @Autowired
    private ReporteService reporteService;

    /** GET /reportes — página de reportes */
    @GetMapping("")
    public String paginaReportes() {
        return "reportes";
    }

    /** GET /reportes/pdf — descarga el reporte en PDF */
    @GetMapping("/pdf")
    public ResponseEntity<byte[]> descargarPdf() throws Exception {
        byte[] pdf = reporteService.generarPdf();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "reporte_simulacion.pdf");
        headers.setContentLength(pdf.length);

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    /** GET /reportes/excel — descarga el reporte en Excel */
    @GetMapping("/excel")
    public ResponseEntity<byte[]> descargarExcel() throws Exception {
        byte[] excel = reporteService.generarExcel();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(
                MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", "reporte_simulacion.xlsx");
        headers.setContentLength(excel.length);

        return ResponseEntity.ok().headers(headers).body(excel);
    }

}