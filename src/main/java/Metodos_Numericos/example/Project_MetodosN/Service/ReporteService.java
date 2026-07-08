package Metodos_Numericos.example.Project_MetodosN.Service;

import Metodos_Numericos.example.Project_MetodosN.Model.RegistroPoblacion;
import Metodos_Numericos.example.Project_MetodosN.Model.SimulacionSesion;
import Metodos_Numericos.example.Project_MetodosN.Repository.SimulacionSesionRepository;
import com.itextpdf.text.*;
import com.itextpdf.text.pdf.*;
import com.itextpdf.text.pdf.draw.LineSeparator;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.itextpdf.text.Font;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.DoubleSummaryStatistics;
import java.util.List;

/**
 * ReporteService — genera PDF y Excel inteligentes:
 *
 *  • 1 sesión guardada  → reporte individual de esa provincia/corrida
 *  • 2+ sesiones        → reporte comparativo entre todas ellas
 *
 * La decisión se toma automáticamente al momento de generar el reporte;
 * no se borra el historial de sesiones previas.
 */
@Service
public class ReporteService {

    @Autowired
    private SimulacionSesionRepository sesionRepo;

    // ── Paleta ────────────────────────────────────────────────────────────
    private static final BaseColor AZUL_PRIMARIO  = new BaseColor(30,  90, 160);
    private static final BaseColor AZUL_CLARO     = new BaseColor(210, 228, 255);
    private static final BaseColor VERDE_ACENTO   = new BaseColor(34,  139, 87);
    private static final BaseColor NARANJA_ACENTO = new BaseColor(204, 102, 0);
    private static final BaseColor GRIS_CABECERA  = new BaseColor(245, 245, 250);
    private static final BaseColor GRIS_FILA      = new BaseColor(250, 250, 252);

    // Colores para diferenciar sesiones en la comparativa (hasta 6)
    private static final BaseColor[] COLORES_SESION = {
            new BaseColor(30,  90,  160),  // Azul
            new BaseColor(34,  139, 87),   // Verde
            new BaseColor(204, 102, 0),    // Naranja
            new BaseColor(140, 50,  160),  // Morado
            new BaseColor(190, 30,  45),   // Rojo
            new BaseColor(20,  140, 140),  // Teal
    };

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // ═══════════════════════════════════════════════════════════════════════
    //  PDF — punto de entrada
    // ═══════════════════════════════════════════════════════════════════════

    public byte[] generarPdf() throws Exception {
        List<SimulacionSesion> sesiones = sesionRepo.findUltimasPorProvincia();
        if (sesiones.isEmpty()) {
            sesiones = sesionRepo.findAllByOrderByFechaSimulacionDesc();
        }
        if (sesiones.isEmpty()) return generarPdfVacio();
        if (sesiones.size() == 1) return generarPdfIndividual(sesiones.get(0));
        return generarPdfComparativo(sesiones);
    }

    // ── PDF vacío (sin datos) ─────────────────────────────────────────────
    private byte[] generarPdfVacio() throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 50, 50, 60, 40);
        PdfWriter.getInstance(doc, baos);
        doc.open();
        addTitulo(doc, "REPORTE DE SIMULACIÓN POBLACIONAL");
        addParrafo(doc, "No hay datos de simulación disponibles. Ejecute al menos una simulación desde el dashboard.");
        doc.close();
        return baos.toByteArray();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PDF INDIVIDUAL
    // ═══════════════════════════════════════════════════════════════════════

    private byte[] generarPdfIndividual(SimulacionSesion sesion) throws Exception {
        List<RegistroPoblacion> datos = sesion.getRegistros();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4.rotate(), 36, 36, 60, 40);
        PdfWriter writer = PdfWriter.getInstance(doc, baos);
        agregarEventosPagina(writer, "Sistema de Simulación Poblacional — " + sesion.etiqueta());
        doc.open();

        // ── Portada ──────────────────────────────────────────────────────
        doc.add(Chunk.NEWLINE);
        addTitulo(doc, "REPORTE DE SIMULACIÓN POBLACIONAL");
        addSubtitulo(doc, sesion.etiqueta() + " — Modelo RK4 con 3 EDOs acopladas");
        doc.add(Chunk.NEWLINE);

        addParrafo(doc, String.format(
                "Simulación ejecutada el %s con paso h=%.3f y %d pasos de integración. "
                        + "Población urbana inicial: %,.0f · Periférica inicial: %,.0f · Recursos iniciales: %.2f.",
                sesion.getFechaSimulacion().format(FMT),
                sesion.getH(), sesion.getPasos(),
                sesion.getX0(), sesion.getY0(), sesion.getZ0()));

        // ── Descripción del modelo ────────────────────────────────────────
        addSeccion(doc, "1. Modelo Demográfico-Ecológico — Ecuaciones Diferenciales");
        doc.add(buildTablaModelo());

        // ── Parámetros usados ─────────────────────────────────────────────
        addSeccion(doc, "2. Parámetros de la Simulación");
        doc.add(buildTablaParametros(sesion));

        // ── Estadísticas ──────────────────────────────────────────────────
        addSeccion(doc, "3. Estadísticas del Historial");
        doc.add(buildTablaEstadisticas(datos));

        // ── Análisis ──────────────────────────────────────────────────────
        addSeccion(doc, "4. Análisis de Resultados");
        addParrafo(doc, generarAnalisisIndividual(sesion, datos));

        // ── Historial muestreal ───────────────────────────────────────────
        doc.newPage();
        addSeccion(doc, "5. Evolución Temporal (muestra representativa)");
        doc.add(buildTablaHistorial(datos));

        addParrafo(doc, "Nota: se muestran hasta 30 puntos distribuidos uniformemente sobre los "
                + datos.size() + " pasos calculados.");

        doc.close();
        return baos.toByteArray();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PDF COMPARATIVO
    // ═══════════════════════════════════════════════════════════════════════

    private byte[] generarPdfComparativo(List<SimulacionSesion> sesiones) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4.rotate(), 36, 36, 60, 40);
        PdfWriter writer = PdfWriter.getInstance(doc, baos);

        String titulo = "Comparativa: " + String.join(" vs ", sesiones.stream()
                .map(SimulacionSesion::etiqueta).toList());
        agregarEventosPagina(writer, titulo);
        doc.open();

        // ── Portada ──────────────────────────────────────────────────────
        doc.add(Chunk.NEWLINE);
        addTitulo(doc, "ANÁLISIS COMPARATIVO POBLACIONAL");
        addSubtitulo(doc, String.join("  ·  ", sesiones.stream()
                .map(SimulacionSesion::etiqueta).toList()));
        doc.add(Chunk.NEWLINE);
        addParrafo(doc, String.format(
                "Este reporte compara %d simulaciones independientes resueltas con Runge-Kutta 4.° orden (RK4). "
                        + "Cada fila de las tablas corresponde a una corrida distinta identificada por su provincia o configuración.",
                sesiones.size()));

        // ── Resumen de sesiones ───────────────────────────────────────────
        addSeccion(doc, "1. Sesiones Incluidas en el Análisis");
        doc.add(buildTablaSesiones(sesiones));

        // ── Comparativa de valores iniciales y finales ────────────────────
        addSeccion(doc, "2. Comparativa de Población Urbana (X)");
        doc.add(buildTablaComparativa(sesiones, "X"));

        addSeccion(doc, "3. Comparativa de Población Periférica (Y)");
        doc.add(buildTablaComparativa(sesiones, "Y"));

        addSeccion(doc, "4. Comparativa de Recursos Críticos (Z)");
        doc.add(buildTablaComparativa(sesiones, "Z"));

        // ── Variaciones porcentuales ──────────────────────────────────────
        addSeccion(doc, "5. Variación Porcentual  (inicio → fin)");
        doc.add(buildTablaVariaciones(sesiones));

        // ── Ranking ──────────────────────────────────────────────────────
        addSeccion(doc, "6. Rankings");
        doc.add(buildTablaRankings(sesiones));

        // ── Análisis narrativo ────────────────────────────────────────────
        addSeccion(doc, "7. Interpretación Comparativa");
        addParrafo(doc, generarAnalisisComparativo(sesiones));

        // ── Historial por sesión (nueva página por sesión) ────────────────
        for (int i = 0; i < sesiones.size(); i++) {
            SimulacionSesion s = sesiones.get(i);
            doc.newPage();
            addSeccion(doc, "Anexo " + (char)('A' + i) + " — Evolución temporal: " + s.etiqueta());
            addParrafo(doc, String.format(
                    "Simulación del %s · h=%.3f · %d pasos · X₀=%,.0f · Y₀=%,.0f · Z₀=%.2f",
                    s.getFechaSimulacion().format(FMT),
                    s.getH(), s.getPasos(),
                    s.getX0(), s.getY0(), s.getZ0()));
            doc.add(buildTablaHistorial(s.getRegistros()));
        }

        doc.close();
        return baos.toByteArray();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  EXCEL — punto de entrada
    // ═══════════════════════════════════════════════════════════════════════

    public byte[] generarExcel() throws Exception {
        List<SimulacionSesion> sesiones = sesionRepo.findUltimasPorProvincia();
        if (sesiones.isEmpty()) {
            sesiones = sesionRepo.findAllByOrderByFechaSimulacionDesc();
        }

        XSSFWorkbook wb = new XSSFWorkbook();

        if (sesiones.isEmpty()) {
            XSSFSheet s = wb.createSheet("Sin datos");
            s.createRow(0).createCell(0).setCellValue("No hay simulaciones guardadas.");
        } else {
            // Hoja comparativa siempre va primero
            if (sesiones.size() > 1) crearHojaComparativa(wb, sesiones);

            // Luego una hoja por sesión
            for (SimulacionSesion sesion : sesiones) {
                crearHojaSesion(wb, sesion);
            }

            // Hoja de datos brutos para graficar (última sesión o todas combinadas)
            crearHojaGraficaMulti(wb, sesiones);
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        wb.write(baos);
        wb.close();
        return baos.toByteArray();
    }

    // ── Excel: hoja comparativa ───────────────────────────────────────────
    private void crearHojaComparativa(XSSFWorkbook wb, List<SimulacionSesion> sesiones) {
        XSSFSheet sheet = wb.createSheet("Comparativa");
        sheet.setColumnWidth(0, 28 * 256);
        for (int i = 1; i <= sesiones.size(); i++) sheet.setColumnWidth(i, 22 * 256);

        CellStyle cTit = estiloTituloExcel(wb);
        Row tit = sheet.createRow(0); tit.setHeightInPoints(28);
        Cell ct = tit.createCell(0);
        ct.setCellValue("Comparativa de Simulaciones Poblacionales");
        ct.setCellStyle(cTit);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, sesiones.size()));

        // Fecha
        Row sub = sheet.createRow(1);
        Cell cs = sub.createCell(0);
        cs.setCellValue("Generado: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")));
        cs.setCellStyle(estiloSubtituloExcel(wb));
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, sesiones.size()));

        int row = 3;

        // ── Cabecera de sesiones ──────────────────────────────────────────
        Row cabSesion = sheet.createRow(row++);
        cabSesion.createCell(0).setCellValue("Sesión");
        for (int i = 0; i < sesiones.size(); i++) {
            XSSFColor bg = excelColor(COLORES_SESION[i % COLORES_SESION.length]);
            CellStyle cab = estiloCabeceraExcel(wb, bg);
            Cell c = cabSesion.createCell(i + 1);
            c.setCellValue(sesiones.get(i).etiqueta());
            c.setCellStyle(cab);
        }

        // ── Secciones de métricas ─────────────────────────────────────────
        String[] metricas = {
                "Fecha simulación", "Pasos RK4", "Paso h",
                "X₀ (Urbana inicial)", "Y₀ (Periférica inicial)", "Z₀ (Recursos iniciales)",
                "X final (Urbana)", "Y final (Periférica)", "Z final (Recursos)",
                "Variación X %", "Variación Y %", "Variación Z %",
                "Promedio X", "Promedio Y", "Promedio Z",
                "Máx. X", "Máx. Y", "Máx. Z",
                "Mín. X", "Mín. Y", "Mín. Z",
        };

        CellStyle eNum  = estiloNumericoExcel(wb, false);
        CellStyle eNumA = estiloNumericoExcel(wb, true);
        CellStyle ePct  = estiloPorcentajeExcel(wb);
        CellStyle eLbl  = estiloSeccionExcel(wb);

        for (int m = 0; m < metricas.length; m++) {
            Row r = sheet.createRow(row++);
            CellStyle csLbl = (m % 2 == 0) ? eNum : eNumA;
            r.createCell(0).setCellValue(metricas[m]);
            r.getCell(0).setCellStyle(csLbl);

            for (int si = 0; si < sesiones.size(); si++) {
                SimulacionSesion s = sesiones.get(si);
                List<RegistroPoblacion> reg = s.getRegistros();
                Cell c = r.createCell(si + 1);

                if (reg.isEmpty()) { c.setCellValue("—"); continue; }

                RegistroPoblacion ini = reg.get(0);
                RegistroPoblacion fin = reg.get(reg.size() - 1);
                DoubleSummaryStatistics sx = reg.stream().mapToDouble(RegistroPoblacion::getPoblacion_x).summaryStatistics();
                DoubleSummaryStatistics sy = reg.stream().mapToDouble(RegistroPoblacion::getPoblacion_y).summaryStatistics();
                DoubleSummaryStatistics sz = reg.stream().mapToDouble(RegistroPoblacion::getPoblacion_z).summaryStatistics();

                switch (m) {
                    case 0  -> { c.setCellValue(s.getFechaSimulacion().format(FMT)); c.setCellStyle(csLbl); }
                    case 1  -> { c.setCellValue(s.getPasos()); c.setCellStyle(eNum); }
                    case 2  -> { c.setCellValue(s.getH()); c.setCellStyle(eNum); }
                    case 3  -> { c.setCellValue(ini.getPoblacion_x()); c.setCellStyle(eNum); }
                    case 4  -> { c.setCellValue(ini.getPoblacion_y()); c.setCellStyle(eNum); }
                    case 5  -> { c.setCellValue(ini.getPoblacion_z()); c.setCellStyle(eNum); }
                    case 6  -> { c.setCellValue(fin.getPoblacion_x()); c.setCellStyle(eNumA); }
                    case 7  -> { c.setCellValue(fin.getPoblacion_y()); c.setCellStyle(eNumA); }
                    case 8  -> { c.setCellValue(fin.getPoblacion_z()); c.setCellStyle(eNumA); }
                    case 9  -> { c.setCellValue(pctCambio(ini.getPoblacion_x(), fin.getPoblacion_x()) / 100.0); c.setCellStyle(ePct); }
                    case 10 -> { c.setCellValue(pctCambio(ini.getPoblacion_y(), fin.getPoblacion_y()) / 100.0); c.setCellStyle(ePct); }
                    case 11 -> { c.setCellValue(pctCambio(ini.getPoblacion_z(), fin.getPoblacion_z()) / 100.0); c.setCellStyle(ePct); }
                    case 12 -> { c.setCellValue(sx.getAverage()); c.setCellStyle(eNum); }
                    case 13 -> { c.setCellValue(sy.getAverage()); c.setCellStyle(eNum); }
                    case 14 -> { c.setCellValue(sz.getAverage()); c.setCellStyle(eNum); }
                    case 15 -> { c.setCellValue(sx.getMax()); c.setCellStyle(eNum); }
                    case 16 -> { c.setCellValue(sy.getMax()); c.setCellStyle(eNum); }
                    case 17 -> { c.setCellValue(sz.getMax()); c.setCellStyle(eNum); }
                    case 18 -> { c.setCellValue(sx.getMin()); c.setCellStyle(eNum); }
                    case 19 -> { c.setCellValue(sy.getMin()); c.setCellStyle(eNum); }
                    case 20 -> { c.setCellValue(sz.getMin()); c.setCellStyle(eNum); }
                }
            }
        }
    }

    // ── Excel: hoja por sesión ────────────────────────────────────────────
    private void crearHojaSesion(XSSFWorkbook wb, SimulacionSesion sesion) {
        String nombre = sesion.etiqueta();
        // Evitar nombres de hoja duplicados o muy largos
        if (nombre.length() > 28) nombre = nombre.substring(0, 28);
        XSSFSheet sheet = wb.createSheet(nombre);
        sheet.setColumnWidth(0, 12 * 256);
        sheet.setColumnWidth(1, 18 * 256);
        sheet.setColumnWidth(2, 18 * 256);
        sheet.setColumnWidth(3, 18 * 256);
        sheet.setColumnWidth(4, 18 * 256);

        CellStyle cTit = estiloTituloExcel(wb);
        Row tit = sheet.createRow(0); tit.setHeightInPoints(28);
        Cell ct = tit.createCell(0);
        ct.setCellValue("Simulación: " + sesion.etiqueta() + " — " + sesion.getFechaSimulacion().format(FMT));
        ct.setCellStyle(cTit);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 4));

        // Parámetros de la sesión en filas de cabecera
        Row pRow = sheet.createRow(1);
        pRow.createCell(0).setCellValue(String.format(
                "h=%.3f  ·  pasos=%d  ·  X₀=%,.0f  ·  Y₀=%,.0f  ·  Z₀=%.2f  ·  αX=%.3f  ·  δX=%.3f  ·  αY=%.3f  ·  δY=%.3f",
                sesion.getH(), sesion.getPasos(),
                sesion.getX0(), sesion.getY0(), sesion.getZ0(),
                sesion.getBirthX(), sesion.getDeathX(),
                sesion.getBirthY(), sesion.getDeathY()));
        pRow.getCell(0).setCellStyle(estiloSubtituloExcel(wb));
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 4));

        // Cabeceras de datos
        CellStyle cab = estiloCabeceraExcel(wb, new XSSFColor(new byte[]{(byte)30,(byte)90,(byte)160}, null));
        Row hRow = sheet.createRow(3); hRow.setHeightInPoints(20);
        String[] cols = {"Paso", "Tiempo (t)", "X — Urbana", "Y — Periférica", "Z — Recursos"};
        for (int i = 0; i < cols.length; i++) {
            Cell c = hRow.createCell(i); c.setCellValue(cols[i]); c.setCellStyle(cab);
        }

        CellStyle eNum  = estiloNumericoExcel(wb, false);
        CellStyle eNumA = estiloNumericoExcel(wb, true);
        CellStyle eTmp  = estiloTiempoExcel(wb);

        List<RegistroPoblacion> datos = sesion.getRegistros();
        for (int i = 0; i < datos.size(); i++) {
            RegistroPoblacion r = datos.get(i);
            Row row = sheet.createRow(i + 4);
            CellStyle num = (i % 2 == 0) ? eNum : eNumA;
            Cell c0 = row.createCell(0); c0.setCellValue(i + 1);            c0.setCellStyle(eTmp);
            Cell c1 = row.createCell(1); c1.setCellValue(r.getTiempo());    c1.setCellStyle(num);
            Cell c2 = row.createCell(2); c2.setCellValue(r.getPoblacion_x()); c2.setCellStyle(num);
            Cell c3 = row.createCell(3); c3.setCellValue(r.getPoblacion_y()); c3.setCellStyle(num);
            Cell c4 = row.createCell(4); c4.setCellValue(r.getPoblacion_z()); c4.setCellStyle(num);
        }

        // Fila de promedios
        if (!datos.isEmpty()) {
            int last = datos.size() + 4;
            Row tot = sheet.createRow(last);
            CellStyle eT = estiloTotalExcel(wb);
            tot.createCell(0).setCellValue("PROMEDIO"); tot.getCell(0).setCellStyle(eT);
            tot.createCell(1).setCellStyle(eT);
            Cell ax = tot.createCell(2); ax.setCellFormula("AVERAGE(C5:C" + last + ")"); ax.setCellStyle(eT);
            Cell ay = tot.createCell(3); ay.setCellFormula("AVERAGE(D5:D" + last + ")"); ay.setCellStyle(eT);
            Cell az = tot.createCell(4); az.setCellFormula("AVERAGE(E5:E" + last + ")"); az.setCellStyle(eT);
        }
    }

    // ── Excel: hoja para graficar (datos limpios, todas las sesiones) ─────
    private void crearHojaGraficaMulti(XSSFWorkbook wb, List<SimulacionSesion> sesiones) {
        XSSFSheet sheet = wb.createSheet("Datos para Gráfica");

        // Columna Tiempo + (X, Y, Z) × sesión
        int cols = 1 + sesiones.size() * 3;
        for (int i = 0; i < cols; i++) sheet.setColumnWidth(i, 16 * 256);

        // Cabeceras
        Row hRow = sheet.createRow(0);
        hRow.createCell(0).setCellValue("Tiempo");
        for (int si = 0; si < sesiones.size(); si++) {
            String etq = sesiones.get(si).etiqueta();
            XSSFColor bg = excelColor(COLORES_SESION[si % COLORES_SESION.length]);
            CellStyle cab = estiloCabeceraExcel(wb, bg);
            Cell cx = hRow.createCell(1 + si * 3); cx.setCellValue("X_" + etq); cx.setCellStyle(cab);
            Cell cy = hRow.createCell(2 + si * 3); cy.setCellValue("Y_" + etq); cy.setCellStyle(cab);
            Cell cz = hRow.createCell(3 + si * 3); cz.setCellValue("Z_" + etq); cz.setCellStyle(cab);
        }

        // Datos — alineamos por índice de paso (hasta 200 puntos)
        int maxPasos = sesiones.stream().mapToInt(s -> s.getRegistros().size()).max().orElse(0);
        int step = Math.max(1, maxPasos / 200);

        int rowIdx = 1;
        for (int i = 0; i < maxPasos; i += step) {
            Row row = sheet.createRow(rowIdx++);
            // Tiempo de la primera sesión como referencia
            SimulacionSesion ref = sesiones.get(0);
            double t = i < ref.getRegistros().size() ? ref.getRegistros().get(i).getTiempo() : i * ref.getH();
            row.createCell(0).setCellValue(t);

            for (int si = 0; si < sesiones.size(); si++) {
                List<RegistroPoblacion> reg = sesiones.get(si).getRegistros();
                if (i < reg.size()) {
                    row.createCell(1 + si * 3).setCellValue(reg.get(i).getPoblacion_x());
                    row.createCell(2 + si * 3).setCellValue(reg.get(i).getPoblacion_y());
                    row.createCell(3 + si * 3).setCellValue(reg.get(i).getPoblacion_z());
                }
            }
        }

        // Instrucción
        Row instr = sheet.createRow(rowIdx + 2);
        Cell instrCell = instr.createCell(0);
        instrCell.setCellValue(
                "Selecciona Tiempo + columnas X/Y/Z de cada sesión → Insertar → Gráfico de líneas para comparar.");
        sheet.addMergedRegion(new CellRangeAddress(rowIdx + 2, rowIdx + 2, 0, cols - 1));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Builders PDF — tablas
    // ═══════════════════════════════════════════════════════════════════════

    private PdfPTable buildTablaModelo() throws Exception {
        PdfPTable t = new PdfPTable(2);
        t.setWidthPercentage(88);
        t.setSpacingBefore(6); t.setSpacingAfter(10);
        t.setWidths(new float[]{1.4f, 3.6f});
        addFilaModelo(t, "X  (Urbana)",     "dX/dt = (α_X − δ_X)·X  − μ(Z)·X  + ν·Y");
        addFilaModelo(t, "Y  (Periférica)", "dY/dt = (α_Y − δ_Y)·Y  + μ(Z)·X  − ν·Y");
        addFilaModelo(t, "Z  (Recursos)",   "dZ/dt = r·Z·(1 − Z/K)  − τ·(X + Y)");
        addFilaModelo(t, "μ(Z) (Migración)","μ(Z) = μ_base + μ_stress · max(0, (zCrit − Z)/(zCrit + 1)), zCrit = K·0.3");
        return t;
    }

    private PdfPTable buildTablaParametros(SimulacionSesion s) throws Exception {
        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        t.setSpacingBefore(6); t.setSpacingAfter(10);
        addCeldaCabecera(t, "Parámetro", AZUL_PRIMARIO);
        addCeldaCabecera(t, "Valor",     AZUL_PRIMARIO);
        addCeldaCabecera(t, "Parámetro", AZUL_PRIMARIO);
        addCeldaCabecera(t, "Valor",     AZUL_PRIMARIO);
        addParamRow(t, "α_X (natalidad urbana)",       fmt4(s.getBirthX()),
                "δ_X (mortalidad urbana)",      fmt4(s.getDeathX()));
        addParamRow(t, "α_Y (natalidad periférica)",   fmt4(s.getBirthY()),
                "δ_Y (mortalidad periférica)",  fmt4(s.getDeathY()));
        addParamRow(t, "μ_base (migración base)",      fmt4(s.getMuBase()),
                "μ_stress (amplif. migración)", fmt4(s.getMuStress()));
        addParamRow(t, "ν (retorno urbano)",            fmt4(s.getNuBase()),
                "τ (consumo per cápita)",       fmt4(s.getTasaConsumo()));
        addParamRow(t, "r (renovación recursos)",      fmt4(s.getR()),
                "K (capacidad máx. recursos)",  fmt2(s.getK()));
        return t;
    }

    private PdfPTable buildTablaEstadisticas(List<RegistroPoblacion> datos) throws Exception {
        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(100);
        t.setSpacingBefore(6); t.setSpacingAfter(10);
        addCeldaCabecera(t, "Estadístico",    AZUL_PRIMARIO);
        addCeldaCabecera(t, "X (Urbana)",     AZUL_PRIMARIO);
        addCeldaCabecera(t, "Y (Periférica)", AZUL_PRIMARIO);
        addCeldaCabecera(t, "Z (Recursos)",   AZUL_PRIMARIO);

        if (datos.isEmpty()) return t;
        DoubleSummaryStatistics sx = datos.stream().mapToDouble(RegistroPoblacion::getPoblacion_x).summaryStatistics();
        DoubleSummaryStatistics sy = datos.stream().mapToDouble(RegistroPoblacion::getPoblacion_y).summaryStatistics();
        DoubleSummaryStatistics sz = datos.stream().mapToDouble(RegistroPoblacion::getPoblacion_z).summaryStatistics();

        RegistroPoblacion ini = datos.get(0);
        RegistroPoblacion fin = datos.get(datos.size() - 1);

        addFilaStats(t, "Valor inicial", ini.getPoblacion_x(), ini.getPoblacion_y(), ini.getPoblacion_z());
        addFilaStats(t, "Valor final",   fin.getPoblacion_x(), fin.getPoblacion_y(), fin.getPoblacion_z());
        addFilaStats(t, "Mínimo",        sx.getMin(),   sy.getMin(),   sz.getMin());
        addFilaStats(t, "Máximo",        sx.getMax(),   sy.getMax(),   sz.getMax());
        addFilaStats(t, "Promedio",      sx.getAverage(), sy.getAverage(), sz.getAverage());
        addFilaStatsPct(t, "Variación %",
                pctCambio(ini.getPoblacion_x(), fin.getPoblacion_x()),
                pctCambio(ini.getPoblacion_y(), fin.getPoblacion_y()),
                pctCambio(ini.getPoblacion_z(), fin.getPoblacion_z()));
        return t;
    }

    private PdfPTable buildTablaSesiones(List<SimulacionSesion> sesiones) throws Exception {
        PdfPTable t = new PdfPTable(6);
        t.setWidthPercentage(100);
        t.setSpacingBefore(6); t.setSpacingAfter(10);
        t.setWidths(new float[]{1.5f, 2.5f, 1.5f, 1.5f, 1.5f, 1.5f});
        addCeldaCabecera(t, "Provincia",  AZUL_PRIMARIO);
        addCeldaCabecera(t, "Fecha",      AZUL_PRIMARIO);
        addCeldaCabecera(t, "X₀ Urbana",  AZUL_PRIMARIO);
        addCeldaCabecera(t, "Y₀ Periférica", AZUL_PRIMARIO);
        addCeldaCabecera(t, "Z₀ Recursos",AZUL_PRIMARIO);
        addCeldaCabecera(t, "Pasos",      AZUL_PRIMARIO);

        Font fV = new Font(Font.FontFamily.HELVETICA, 9, Font.NORMAL, BaseColor.DARK_GRAY);
        for (int i = 0; i < sesiones.size(); i++) {
            SimulacionSesion s = sesiones.get(i);
            BaseColor bg = i % 2 == 0 ? BaseColor.WHITE : GRIS_FILA;
            addCeldaColor(t, s.etiqueta(), COLORES_SESION[i % COLORES_SESION.length]);
            addCeldaDato(t, s.getFechaSimulacion().format(FMT), bg, fV, Element.ALIGN_CENTER);
            addCeldaDato(t, fmt0(s.getX0()), bg, fV, Element.ALIGN_RIGHT);
            addCeldaDato(t, fmt0(s.getY0()), bg, fV, Element.ALIGN_RIGHT);
            addCeldaDato(t, fmt2(s.getZ0()), bg, fV, Element.ALIGN_RIGHT);
            addCeldaDato(t, String.valueOf(s.getPasos()), bg, fV, Element.ALIGN_CENTER);
        }
        return t;
    }

    private PdfPTable buildTablaComparativa(List<SimulacionSesion> sesiones, String variable) throws Exception {
        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        t.setSpacingBefore(6); t.setSpacingAfter(10);
        t.setWidths(new float[]{2f, 2f, 2f, 2f, 2f});
        addCeldaCabecera(t, "Sesión",       AZUL_PRIMARIO);
        addCeldaCabecera(t, "Inicial",      AZUL_PRIMARIO);
        addCeldaCabecera(t, "Final",        AZUL_PRIMARIO);
        addCeldaCabecera(t, "Promedio",     AZUL_PRIMARIO);
        addCeldaCabecera(t, "Variación %",  AZUL_PRIMARIO);

        Font fV = new Font(Font.FontFamily.HELVETICA, 9, Font.NORMAL, BaseColor.DARK_GRAY);
        for (int i = 0; i < sesiones.size(); i++) {
            SimulacionSesion s = sesiones.get(i);
            List<RegistroPoblacion> reg = s.getRegistros();
            if (reg.isEmpty()) continue;

            RegistroPoblacion ini = reg.get(0);
            RegistroPoblacion fin = reg.get(reg.size() - 1);

            double vIni, vFin, vProm;
            switch (variable) {
                case "Y"  -> { vIni = ini.getPoblacion_y(); vFin = fin.getPoblacion_y();
                    vProm = reg.stream().mapToDouble(RegistroPoblacion::getPoblacion_y).average().orElse(0); }
                case "Z"  -> { vIni = ini.getPoblacion_z(); vFin = fin.getPoblacion_z();
                    vProm = reg.stream().mapToDouble(RegistroPoblacion::getPoblacion_z).average().orElse(0); }
                default   -> { vIni = ini.getPoblacion_x(); vFin = fin.getPoblacion_x();
                    vProm = reg.stream().mapToDouble(RegistroPoblacion::getPoblacion_x).average().orElse(0); }
            }
            double pct = pctCambio(vIni, vFin);
            BaseColor bg = i % 2 == 0 ? BaseColor.WHITE : GRIS_FILA;
            addCeldaColor(t, s.etiqueta(), COLORES_SESION[i % COLORES_SESION.length]);
            addCeldaDato(t, fmt0(vIni),           bg, fV, Element.ALIGN_RIGHT);
            addCeldaDato(t, fmt0(vFin),           bg, fV, Element.ALIGN_RIGHT);
            addCeldaDato(t, fmt0(vProm),          bg, fV, Element.ALIGN_RIGHT);
            addCeldaDatoColor(t, String.format("%+.2f%%", pct), pct >= 0 ? VERDE_ACENTO : NARANJA_ACENTO);
        }
        return t;
    }

    private PdfPTable buildTablaVariaciones(List<SimulacionSesion> sesiones) throws Exception {
        PdfPTable t = new PdfPTable(4);
        t.setWidthPercentage(80);
        t.setSpacingBefore(6); t.setSpacingAfter(10);
        addCeldaCabecera(t, "Sesión",      AZUL_PRIMARIO);
        addCeldaCabecera(t, "ΔX %",        AZUL_PRIMARIO);
        addCeldaCabecera(t, "ΔY %",        AZUL_PRIMARIO);
        addCeldaCabecera(t, "ΔZ %",        AZUL_PRIMARIO);

        for (int i = 0; i < sesiones.size(); i++) {
            SimulacionSesion s = sesiones.get(i);
            List<RegistroPoblacion> reg = s.getRegistros();
            if (reg.isEmpty()) continue;
            RegistroPoblacion ini = reg.get(0);
            RegistroPoblacion fin = reg.get(reg.size() - 1);
            addCeldaColor(t, s.etiqueta(), COLORES_SESION[i % COLORES_SESION.length]);
            addFilaStatsPctCeldas(t,
                    pctCambio(ini.getPoblacion_x(), fin.getPoblacion_x()),
                    pctCambio(ini.getPoblacion_y(), fin.getPoblacion_y()),
                    pctCambio(ini.getPoblacion_z(), fin.getPoblacion_z()));
        }
        return t;
    }

    private PdfPTable buildTablaRankings(List<SimulacionSesion> sesiones) throws Exception {
        PdfPTable t = new PdfPTable(3);
        t.setWidthPercentage(70);
        t.setSpacingBefore(6); t.setSpacingAfter(10);
        addCeldaCabecera(t, "Indicador",              AZUL_PRIMARIO);
        addCeldaCabecera(t, "Mayor valor",            AZUL_PRIMARIO);
        addCeldaCabecera(t, "Menor valor",            AZUL_PRIMARIO);

        Font fV = new Font(Font.FontFamily.HELVETICA, 9, Font.NORMAL, BaseColor.DARK_GRAY);

        // Mayor/menor crecimiento X
        SimulacionSesion mayX = sesiones.stream().max((a, b) -> Double.compare(
                pctCambio(first(a).getPoblacion_x(), last(a).getPoblacion_x()),
                pctCambio(first(b).getPoblacion_x(), last(b).getPoblacion_x()))).orElse(sesiones.get(0));
        SimulacionSesion menX = sesiones.stream().min((a, b) -> Double.compare(
                pctCambio(first(a).getPoblacion_x(), last(a).getPoblacion_x()),
                pctCambio(first(b).getPoblacion_x(), last(b).getPoblacion_x()))).orElse(sesiones.get(0));

        SimulacionSesion mayZ = sesiones.stream().max((a, b) -> Double.compare(
                last(a).getPoblacion_z(), last(b).getPoblacion_z())).orElse(sesiones.get(0));
        SimulacionSesion menZ = sesiones.stream().min((a, b) -> Double.compare(
                last(a).getPoblacion_z(), last(b).getPoblacion_z())).orElse(sesiones.get(0));

        addFilaRanking(t, "Mayor crecim. urbano (ΔX%)", mayX.etiqueta(), menX.etiqueta(), fV);
        addFilaRanking(t, "Mayor stock recursos final",  mayZ.etiqueta(), menZ.etiqueta(), fV);
        return t;
    }

    private PdfPTable buildTablaHistorial(List<RegistroPoblacion> datos) throws Exception {
        int total  = datos.size();
        int muestra = Math.min(30, total);
        int step   = Math.max(1, total / muestra);

        PdfPTable t = new PdfPTable(5);
        t.setWidthPercentage(100);
        t.setWidths(new float[]{1.2f, 1.8f, 2.5f, 2.5f, 2.5f});
        addCeldaCabecera(t, "Paso",           AZUL_PRIMARIO);
        addCeldaCabecera(t, "Tiempo",         AZUL_PRIMARIO);
        addCeldaCabecera(t, "X (Urbana)",     AZUL_PRIMARIO);
        addCeldaCabecera(t, "Y (Periférica)", AZUL_PRIMARIO);
        addCeldaCabecera(t, "Z (Recursos)",   AZUL_PRIMARIO);

        Font fV = new Font(Font.FontFamily.HELVETICA, 8, Font.NORMAL, BaseColor.DARK_GRAY);
        boolean alt = false;
        for (int i = 0; i < total; i += step) {
            RegistroPoblacion r = datos.get(i);
            BaseColor bg = alt ? GRIS_FILA : BaseColor.WHITE;
            addCeldaDato(t, String.valueOf(i),                bg, fV, Element.ALIGN_CENTER);
            addCeldaDato(t, fmt2(r.getTiempo()),              bg, fV, Element.ALIGN_RIGHT);
            addCeldaDato(t, fmt0(r.getPoblacion_x()),         bg, fV, Element.ALIGN_RIGHT);
            addCeldaDato(t, fmt0(r.getPoblacion_y()),         bg, fV, Element.ALIGN_RIGHT);
            addCeldaDato(t, String.format("%,.2f", r.getPoblacion_z()), bg, fV, Element.ALIGN_RIGHT);
            alt = !alt;
        }
        return t;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Análisis narrativo
    // ═══════════════════════════════════════════════════════════════════════

    private String generarAnalisisIndividual(SimulacionSesion s, List<RegistroPoblacion> datos) {
        if (datos.isEmpty()) return "Sin datos para analizar.";
        RegistroPoblacion ini = datos.get(0);
        RegistroPoblacion fin = datos.get(datos.size() - 1);
        double varX = pctCambio(ini.getPoblacion_x(), fin.getPoblacion_x());
        double varY = pctCambio(ini.getPoblacion_y(), fin.getPoblacion_y());
        double varZ = pctCambio(ini.getPoblacion_z(), fin.getPoblacion_z());

        StringBuilder sb = new StringBuilder();
        sb.append(String.format(
                "La simulación de %s abarcó %.2f unidades de tiempo (%d pasos RK4 con h=%.3f). ",
                s.etiqueta(), fin.getTiempo(), s.getPasos(), s.getH()));
        sb.append(String.format(
                "La población urbana (X) %s un %.1f%% pasando de %,.0f a %,.0f habitantes. ",
                varX >= 0 ? "creció" : "decreció", Math.abs(varX), ini.getPoblacion_x(), fin.getPoblacion_x()));
        sb.append(String.format(
                "La población periférica (Y) %s un %.1f%% (%,.0f → %,.0f). ",
                varY >= 0 ? "creció" : "decreció", Math.abs(varY), ini.getPoblacion_y(), fin.getPoblacion_y()));

        if (varZ < -15)
            sb.append("Los recursos críticos (Z) sufrieron una reducción importante (").append(String.format("%.1f%%", varZ))
                    .append("), señal de presión demográfica sostenida. Se recomienda revisar τ (consumo per cápita) y r (renovación).");
        else if (varZ > 15)
            sb.append("Los recursos (Z) aumentaron considerablemente (").append(String.format("+%.1f%%", varZ))
                    .append("), lo que sugiere subutilización o baja densidad demográfica respecto a la capacidad K.");
        else
            sb.append("Los recursos (Z) se mantuvieron relativamente estables (").append(String.format("%+.1f%%", varZ))
                    .append("), indicando un sistema en equilibrio dinámico.");
        return sb.toString();
    }

    private String generarAnalisisComparativo(List<SimulacionSesion> sesiones) {
        StringBuilder sb = new StringBuilder();
        sb.append("El análisis comparativo de ").append(sesiones.size())
                .append(" simulaciones revela patrones diferenciados de dinámica poblacional:\n\n");

        for (SimulacionSesion s : sesiones) {
            List<RegistroPoblacion> reg = s.getRegistros();
            if (reg.isEmpty()) continue;
            RegistroPoblacion ini = reg.get(0);
            RegistroPoblacion fin = reg.get(reg.size() - 1);
            double varX = pctCambio(ini.getPoblacion_x(), fin.getPoblacion_x());
            double varY = pctCambio(ini.getPoblacion_y(), fin.getPoblacion_y());
            double varZ = pctCambio(ini.getPoblacion_z(), fin.getPoblacion_z());
            sb.append(String.format("• %s: ΔX=%+.1f%%, ΔY=%+.1f%%, ΔZ=%+.1f%%. ",
                    s.etiqueta(), varX, varY, varZ));
            if (varZ < -10) sb.append("Presión alta sobre recursos.");
            else if (varZ > 10) sb.append("Recursos en superávit.");
            else sb.append("Sistema en equilibrio.");
            sb.append("\n");
        }

        // Identificar la de mayor crecimiento urbano
        sesiones.stream()
                .filter(s -> !s.getRegistros().isEmpty())
                .max((a, b) -> Double.compare(
                        pctCambio(first(a).getPoblacion_x(), last(a).getPoblacion_x()),
                        pctCambio(first(b).getPoblacion_x(), last(b).getPoblacion_x())))
                .ifPresent(s -> sb.append("\nMayor crecimiento urbano: ").append(s.etiqueta()).append("."));

        return sb.toString();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Helpers PDF
    // ═══════════════════════════════════════════════════════════════════════

    private void agregarEventosPagina(PdfWriter writer, String tituloHeader) {
        writer.setPageEvent(new PdfPageEventHelper() {
            @Override public void onEndPage(PdfWriter w, Document d) {
                try {
                    PdfContentByte cb = w.getDirectContent();
                    cb.setColorFill(AZUL_PRIMARIO);
                    cb.rectangle(d.left(), d.top() + 5, d.right() - d.left(), 22);
                    cb.fill();
                    Font fTit = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, BaseColor.WHITE);
                    ColumnText.showTextAligned(cb, Element.ALIGN_LEFT,
                            new Phrase(tituloHeader, fTit), d.left() + 6, d.top() + 11, 0);
                    ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT,
                            new Phrase(LocalDateTime.now().format(FMT),
                                    new Font(Font.FontFamily.HELVETICA, 8, Font.NORMAL, BaseColor.WHITE)),
                            d.right(), d.top() + 11, 0);
                    cb.setColorFill(AZUL_PRIMARIO);
                    cb.rectangle(d.left(), d.bottom() - 18, d.right() - d.left(), 14);
                    cb.fill();
                    ColumnText.showTextAligned(cb, Element.ALIGN_CENTER,
                            new Phrase("Página " + w.getPageNumber(),
                                    new Font(Font.FontFamily.HELVETICA, 8, Font.NORMAL, BaseColor.WHITE)),
                            (d.left() + d.right()) / 2, d.bottom() - 12, 0);
                } catch (Exception ignored) {}
            }
        });
    }

    private void addTitulo(Document doc, String texto) throws Exception {
        Font f = new Font(Font.FontFamily.HELVETICA, 22, Font.BOLD, AZUL_PRIMARIO);
        Paragraph p = new Paragraph(texto, f);
        p.setAlignment(Element.ALIGN_CENTER); p.setSpacingAfter(4); doc.add(p);
    }
    private void addSubtitulo(Document doc, String texto) throws Exception {
        Font f = new Font(Font.FontFamily.HELVETICA, 13, Font.ITALIC, VERDE_ACENTO);
        Paragraph p = new Paragraph(texto, f);
        p.setAlignment(Element.ALIGN_CENTER); p.setSpacingAfter(16); doc.add(p);
    }
    private void addSeccion(Document doc, String texto) throws Exception {
        Font f = new Font(Font.FontFamily.HELVETICA, 13, Font.BOLD, AZUL_PRIMARIO);
        Paragraph p = new Paragraph(texto, f);
        p.setSpacingBefore(14); p.setSpacingAfter(6); doc.add(p);
        doc.add(new Chunk(new LineSeparator(1.5f, 100, AZUL_CLARO, Element.ALIGN_LEFT, -2)));
    }
    private void addParrafo(Document doc, String texto) throws Exception {
        Font f = new Font(Font.FontFamily.HELVETICA, 10, Font.NORMAL, BaseColor.DARK_GRAY);
        Paragraph p = new Paragraph(texto, f);
        p.setAlignment(Element.ALIGN_JUSTIFIED); p.setLeading(14); p.setSpacingAfter(6); doc.add(p);
    }
    private void addCeldaCabecera(PdfPTable t, String texto, BaseColor bg) {
        Font f = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, BaseColor.WHITE);
        PdfPCell c = new PdfPCell(new Phrase(texto, f));
        c.setBackgroundColor(bg); c.setHorizontalAlignment(Element.ALIGN_CENTER);
        c.setPadding(5); c.setBorderColor(BaseColor.WHITE); t.addCell(c);
    }
    private void addCeldaColor(PdfPTable t, String texto, BaseColor bg) {
        Font f = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, BaseColor.WHITE);
        PdfPCell c = new PdfPCell(new Phrase(texto, f));
        c.setBackgroundColor(bg); c.setHorizontalAlignment(Element.ALIGN_CENTER);
        c.setPadding(4); t.addCell(c);
    }
    private void addCeldaDatoColor(PdfPTable t, String texto, BaseColor fg) {
        Font f = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, fg);
        PdfPCell c = new PdfPCell(new Phrase(texto, f));
        c.setHorizontalAlignment(Element.ALIGN_RIGHT); c.setPadding(4); t.addCell(c);
    }
    private void addFilaStats(PdfPTable t, String label, double vx, double vy, double vz) {
        Font fL = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, AZUL_PRIMARIO);
        Font fV = new Font(Font.FontFamily.HELVETICA, 9, Font.NORMAL, BaseColor.DARK_GRAY);
        PdfPCell cLabel = new PdfPCell(new Phrase(label, fL));
        cLabel.setBackgroundColor(GRIS_CABECERA); cLabel.setPadding(4); t.addCell(cLabel);
        for (double v : new double[]{vx, vy, vz}) {
            PdfPCell c = new PdfPCell(new Phrase(String.format("%,.2f", v), fV));
            c.setHorizontalAlignment(Element.ALIGN_RIGHT); c.setPadding(4); t.addCell(c);
        }
    }
    private void addFilaStatsPct(PdfPTable t, String label, double vx, double vy, double vz) {
        Font fL = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, NARANJA_ACENTO);
        Font fV = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, NARANJA_ACENTO);
        PdfPCell cLabel = new PdfPCell(new Phrase(label, fL));
        cLabel.setBackgroundColor(AZUL_CLARO); cLabel.setPadding(4); t.addCell(cLabel);
        for (double v : new double[]{vx, vy, vz}) {
            PdfPCell c = new PdfPCell(new Phrase(String.format("%+.2f%%", v), fV));
            c.setHorizontalAlignment(Element.ALIGN_RIGHT);
            c.setBackgroundColor(AZUL_CLARO); c.setPadding(4); t.addCell(c);
        }
    }
    private void addFilaStatsPctCeldas(PdfPTable t, double vx, double vy, double vz) {
        for (double v : new double[]{vx, vy, vz}) {
            Font fV = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD,
                    v >= 0 ? VERDE_ACENTO : NARANJA_ACENTO);
            PdfPCell c = new PdfPCell(new Phrase(String.format("%+.2f%%", v), fV));
            c.setHorizontalAlignment(Element.ALIGN_RIGHT); c.setPadding(4); t.addCell(c);
        }
    }
    private void addFilaModelo(PdfPTable t, String variable, String ecuacion) {
        Font fV = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, VERDE_ACENTO);
        Font fE = new Font(Font.FontFamily.COURIER,   9, Font.NORMAL, BaseColor.DARK_GRAY);
        PdfPCell cv = new PdfPCell(new Phrase(variable, fV));
        cv.setBackgroundColor(GRIS_CABECERA); cv.setPadding(5); t.addCell(cv);
        PdfPCell ce = new PdfPCell(new Phrase(ecuacion, fE));
        ce.setPadding(5); t.addCell(ce);
    }
    private void addParamRow(PdfPTable t, String l1, String v1, String l2, String v2) {
        Font fL = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, AZUL_PRIMARIO);
        Font fV = new Font(Font.FontFamily.HELVETICA, 9, Font.NORMAL, BaseColor.DARK_GRAY);
        PdfPCell cL1 = new PdfPCell(new Phrase(l1, fL)); cL1.setBackgroundColor(GRIS_CABECERA); cL1.setPadding(4); t.addCell(cL1);
        PdfPCell cV1 = new PdfPCell(new Phrase(v1, fV)); cV1.setHorizontalAlignment(Element.ALIGN_RIGHT); cV1.setPadding(4); t.addCell(cV1);
        PdfPCell cL2 = new PdfPCell(new Phrase(l2, fL)); cL2.setBackgroundColor(GRIS_CABECERA); cL2.setPadding(4); t.addCell(cL2);
        PdfPCell cV2 = new PdfPCell(new Phrase(v2, fV)); cV2.setHorizontalAlignment(Element.ALIGN_RIGHT); cV2.setPadding(4); t.addCell(cV2);
    }
    private void addFilaRanking(PdfPTable t, String label, String mayor, String menor, Font fV) {
        Font fL = new Font(Font.FontFamily.HELVETICA, 9, Font.BOLD, AZUL_PRIMARIO);
        PdfPCell cL = new PdfPCell(new Phrase(label, fL)); cL.setBackgroundColor(GRIS_CABECERA); cL.setPadding(4); t.addCell(cL);
        PdfPCell cM = new PdfPCell(new Phrase(mayor, fV)); cM.setPadding(4); t.addCell(cM);
        PdfPCell cm = new PdfPCell(new Phrase(menor, fV)); cm.setPadding(4); t.addCell(cm);
    }
    private void addCeldaDato(PdfPTable t, String v, BaseColor bg, Font f, int align) {
        PdfPCell c = new PdfPCell(new Phrase(v, f));
        c.setBackgroundColor(bg); c.setHorizontalAlignment(align); c.setPadding(3.5f); t.addCell(c);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Helpers Excel (estilos)
    // ═══════════════════════════════════════════════════════════════════════

    private CellStyle estiloTituloExcel(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle(); XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short)16);
        f.setColor(new XSSFColor(new byte[]{(byte)30,(byte)90,(byte)160}, null));
        s.setFont(f); s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte)210,(byte)228,(byte)255}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }
    private CellStyle estiloSubtituloExcel(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle(); XSSFFont f = wb.createFont();
        f.setItalic(true); f.setFontHeightInPoints((short)10);
        f.setColor(new XSSFColor(new byte[]{(byte)100,(byte)100,(byte)110}, null));
        s.setFont(f); s.setAlignment(HorizontalAlignment.CENTER);
        return s;
    }
    private CellStyle estiloCabeceraExcel(XSSFWorkbook wb, XSSFColor bg) {
        CellStyle s = wb.createCellStyle(); XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short)10);
        f.setColor(IndexedColors.WHITE.getIndex());
        s.setFont(f); s.setFillForegroundColor(bg);
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        setBordes(s); return s;
    }
    private CellStyle estiloNumericoExcel(XSSFWorkbook wb, boolean alt) {
        CellStyle s = wb.createCellStyle();
        s.setDataFormat(wb.createDataFormat().getFormat("#,##0.00"));
        if (alt) {
            s.setFillForegroundColor(new XSSFColor(new byte[]{(byte)245,(byte)245,(byte)250}, null));
            s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }
        s.setAlignment(HorizontalAlignment.RIGHT); setBordes(s); return s;
    }
    private CellStyle estiloTiempoExcel(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setAlignment(HorizontalAlignment.CENTER); setBordes(s); return s;
    }
    private CellStyle estiloTotalExcel(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle(); XSSFFont f = wb.createFont(); f.setBold(true);
        f.setColor(new XSSFColor(new byte[]{(byte)30,(byte)90,(byte)160}, null));
        s.setFont(f); s.setDataFormat(wb.createDataFormat().getFormat("#,##0.00"));
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte)210,(byte)228,(byte)255}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(HorizontalAlignment.RIGHT); setBordes(s); return s;
    }
    private CellStyle estiloSeccionExcel(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle(); XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short)11);
        f.setColor(new XSSFColor(new byte[]{(byte)30,(byte)90,(byte)160}, null));
        s.setFont(f);
        s.setFillForegroundColor(new XSSFColor(new byte[]{(byte)230,(byte)240,(byte)255}, null));
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND); setBordes(s); return s;
    }
    private CellStyle estiloPorcentajeExcel(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setDataFormat(wb.createDataFormat().getFormat("0.00%"));
        XSSFFont f = wb.createFont(); f.setBold(true);
        f.setColor(new XSSFColor(new byte[]{(byte)204,(byte)102,(byte)0}, null));
        s.setFont(f); s.setAlignment(HorizontalAlignment.RIGHT); setBordes(s); return s;
    }
    private void setBordes(CellStyle s) {
        s.setBorderBottom(BorderStyle.THIN); s.setBorderTop(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);  s.setBorderRight(BorderStyle.THIN);
    }
    private XSSFColor excelColor(BaseColor c) {
        return new XSSFColor(new byte[]{(byte)c.getRed(),(byte)c.getGreen(),(byte)c.getBlue()}, null);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Utilidades
    // ═══════════════════════════════════════════════════════════════════════

    private double pctCambio(double ini, double fin) {
        return ini == 0 ? 0 : (fin - ini) / ini * 100.0;
    }
    private RegistroPoblacion first(SimulacionSesion s) { return s.getRegistros().get(0); }
    private RegistroPoblacion last(SimulacionSesion s)  { return s.getRegistros().get(s.getRegistros().size() - 1); }

    private String fmt0(double v)  { return String.format("%,.0f", v); }
    private String fmt2(double v)  { return String.format("%.2f", v); }
    private String fmt4(double v)  { return String.format("%.4f", v); }
}