/* ============================================================
 juego.js — EcuaSim Modo Amenaza v7.0
 CAMBIOS v7.0:
 - AMENAZAS GEOGRÁFICAMENTE CORRECTAS por provincia
   • Guayas: SIN volcán (Costa), con inundación/El Niño
   • Pichincha: SIN tsunami (Sierra), con volcán/deslizamiento
   • Pastaza: SIN tsunami, volcán leve (Reventador/Sangay), con deforestación
 - MULTIPLICADORES REALISTAS: bajas moderadas (~5-20% por turno en amenaza media)
 - CONDICIÓN DE DERROTA: si X+Y < 20% del inicial → colapso demográfico
 - NUEVAS AMENAZAS: inundacion (costa), deslizamiento (sierra/amazonia)
 - RULETA: sectores grises + tooltip para amenazas no disponibles en esa provincia
 - COMBO DE AMENAZAS: 15% de probabilidad de doble impacto en dificil
 - INDICADOR DE AMENAZAS DISPONIBLES con badge "No aplica aquí"
 ============================================================ */

/* ══════════════════════════════════════════════════════════════
 MAPA DE AMENAZAS POR PROVINCIA (basado en datos reales Ecuador)
 Fuentes: SNGRE, IRD cartografía amenazas, GK.city 2024
 ══════════════════════════════════════════════════════════════ */
const AMENAZAS_PROVINCIA = {
    // GUAYAS — Costa: inundaciones frecuentes, tsunami posible, terremotos,
    //           pandemia, conflicto, sequía (Fenómeno El Niño). SIN volcán.
    GY: {
        disponibles: ['pandemia', 'terremoto', 'sequia', 'tsunami', 'conflicto', 'inundacion'],
        nodisponibles: {
            erupcion:    { razon: 'No hay volcanes en la Costa ecuatoriana' },
            deslizamiento: { razon: 'Terreno plano costero, sin montañas' },
        }
    },
    // PICHINCHA — Sierra: volcanes activos (Guagua Pichincha, Cotopaxi),
    //              terremotos, deslizamientos, conflicto, pandemia, sequía.
    //              SIN tsunami (Andes de por medio), inundaciones menores.
    PI: {
        disponibles: ['pandemia', 'terremoto', 'sequia', 'erupcion', 'conflicto', 'deslizamiento'],
        nodisponibles: {
            tsunami:    { razon: 'La cordillera andina impide que el mar llegue a Quito' },
            inundacion: { razon: 'Quito está a 2.850 m de altitud, sin ríos costeros' },
        }
    },
    // PASTAZA — Amazonía: inundaciones por ríos, conflicto social/indígena,
    //            sequía amazónica, volcanes lejanos (Reventador/Sangay) con
    //            ceniza posible, pandemia. SIN tsunami.
    PA: {
        disponibles: ['pandemia', 'sequia', 'conflicto', 'erupcion', 'inundacion', 'deslizamiento'],
        nodisponibles: {
            tsunami:  { razon: 'Amazonía interior, sin acceso al océano' },
            terremoto: { razon: 'Sismicidad baja en llanura amazónica' },
        }
    },
};

/* ══════════════════════════════════════════════════════════════
 CONFIGURACIÓN DE DIFICULTAD
 ══════════════════════════════════════════════════════════════ */
const DIFICULTADES = {
    facil: {
        id: 'facil', nombre: 'Fácil', emoji: '🟢',
        desc: 'Economía sana. Infraestructura robusta. Las amenazas duelen pero no colapsan.',
        rMod: 1.30,
        tasaConsumoMod: 0.70,
        muStressMod: 0.50,
        deathXMod: 0.80,
        deathYMod: 0.80,
        birthXMod: 1.10,
        birthYMod: 1.10,
        presupuesto: 700,
        color: '#4ade80',
    },
    normal: {
        id: 'normal', nombre: 'Normal', emoji: '🟡',
        desc: 'El equilibrio real. Cada decisión importa.',
        rMod: 1.00,
        tasaConsumoMod: 1.00,
        muStressMod: 1.00,
        deathXMod: 1.00,
        deathYMod: 1.00,
        birthXMod: 1.00,
        birthYMod: 1.00,
        presupuesto: 500,
        color: '#fbbf24',
    },
    dificil: {
        id: 'dificil', nombre: 'Difícil', emoji: '🔴',
        desc: 'Sin margen de error. Infraestructura frágil. Las EDOs colapsan rápido.',
        rMod: 0.65,
        tasaConsumoMod: 1.50,
        muStressMod: 1.70,
        deathXMod: 1.40,
        deathYMod: 1.40,
        birthXMod: 0.85,
        birthYMod: 0.85,
        presupuesto: 350,
        color: '#f87171',
    },
};

/* ══════════════════════════════════════════════════════════════
 PARÁMETROS BASE POR PROVINCIA
 ══════════════════════════════════════════════════════════════ */
const PARAMS_PROVINCIA = {
    GY: {
        K: 1_100_000,
        z0Override: 880_000,
        tasaConsumo: 0.000018,
        r: 0.055,
        h: 0.5,
        pasos: 60,
        birthX: 0.018,
        deathX: 0.016,
        birthY: 0.022,
        deathY: 0.019,
        muBase: 0.008,
        muStress: 0.12,
        nuBase: 0.004,
    },
    PI: {
        K: 750_000,
        z0Override: 600_000,
        tasaConsumo: 0.000020,
        r: 0.050,
        h: 0.5,
        pasos: 60,
        birthX: 0.017,
        deathX: 0.015,
        birthY: 0.021,
        deathY: 0.018,
        muBase: 0.007,
        muStress: 0.11,
        nuBase: 0.004,
    },
    PA: {
        K: 12_000,
        z0Override: 8_500,
        tasaConsumo: 0.000045,
        r: 0.040,
        h: 0.5,
        pasos: 60,
        birthX: 0.020,
        deathX: 0.018,
        birthY: 0.024,
        deathY: 0.021,
        muBase: 0.010,
        muStress: 0.15,
        nuBase: 0.005,
    },
};

/* ══════════════════════════════════════════════════════════════
 CAPÍTULOS
 ══════════════════════════════════════════════════════════════ */
const CAPITULOS = [
    {
        id: 'intro',
        titulo: 'Prólogo — El Nombramiento',
        provincia: null,
        narrativa: `
            <div class="cap-portada">
                <div class="cap-numero">PRÓLOGO</div>
                <div class="cap-titulo-grande">Crisis Nacional</div>
                <div class="cap-subtitulo">El Simulador</div>
                <div class="cap-cita">
                    "Señor/a Ministro/a, acaba de aterrizar en Quito.<br>
                    Tres provincias están en alerta máxima.<br>
                    El presidente necesita respuestas — ahora."
                </div>
                <div class="cap-instuccion" style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1rem 1.2rem;text-align:left;">
                    <div class="cap-inst-titulo">¿Cómo funciona el simulador?</div>
                    <div class="cap-inst-pasos">
                        <div class="cap-paso">
                            <span class="cap-paso-num">1</span>
                            <div><strong>Elige dificultad</strong> — ajusta los parámetros base del modelo.</div>
                        </div>
                        <div class="cap-paso">
                            <span class="cap-paso-num">2</span>
                            <div><strong>Gira la ruleta</strong> — solo aparecen amenazas <em>reales</em> para esa provincia. Las grises no aplican.</div>
                        </div>
                        <div class="cap-paso">
                            <span class="cap-paso-num">3</span>
                            <div><strong>Toma una decisión</strong> — hospitales, evacuación o recursos.</div>
                        </div>
                        <div class="cap-paso">
                            <span class="cap-paso-num">4</span>
                            <div><strong>Sobrevive 8 turnos</strong> — si Z llega a 0 o la población cae al 20%, el sistema colapsa.</div>
                        </div>
                    </div>
                </div>
                <div class="cap-vars-explainer">
                    <div class="cap-var-item" style="color:#00d4ff"><strong>X — Población Urbana</strong>: ciudad. Baja con pandemias y conflictos.</div>
                    <div class="cap-var-item" style="color:#fb923c"><strong>Y — Población Periférica</strong>: alrededores. Absorbe el éxodo urbano.</div>
                    <div class="cap-var-item" style="color:#4ade80"><strong>Z — Recursos</strong>: agua, comida, salud. Si llega a 0, colapso total.</div>
                </div>
            </div>`,
        btnTexto: '🇪🇨 Comenzar misión',
        saltable: false,
    },
    {
        id: 'guayas',
        titulo: 'Capítulo 1 — Guayas: El Puerto en Crisis',
        provincia: 'GY',
        narrativa: `
            <div class="cap-chapter">
                <div class="cap-numero">CAPÍTULO 1</div>
                <div class="cap-titulo-grande" style="color:#00d4ff">El Puerto en Crisis</div>
                <div class="cap-ubicacion">📍 Guayaquil · Costa ecuatoriana · 4,000,000 hab.</div>
                <div class="cap-texto">
                    Un caso de fiebre hemorrágica apareció en el mercado de Río Daule hace tres días.
                    Hoy hay 47 confirmados y el hospital más grande de la ciudad está al 90% de capacidad.
                    <br><br>
                    El Puerto Principal del Ecuador nunca había cerrado. Pero los estibadores no se presentaron esta mañana.
                </div>
                <div class="cap-leccion-box">
                    <div class="cap-leccion-titulo">📐 Lo que aprenderás aquí</div>
                    <div class="cap-leccion-texto">
                        La ruleta solo incluye amenazas <strong>reales para Guayas</strong>: inundaciones (El Niño),
                        terremoto, tsunami, pandemia, conflicto y sequía. El volcán está desactivado —
                        no hay volcanes en la Costa ecuatoriana.
                    </div>
                </div>
                <div class="cap-objetivo">
                    <strong>🎯 Objetivo:</strong> Mantener Z por encima del 40% y la población sobre el 20% al final.<br>
                    <strong>💡 Consejo:</strong> El Fenómeno El Niño puede combinar inundación + epidemia.
                </div>
            </div>`,
        btnTexto: '⚡ Activar modo Guayas',
        saltable: true,
    },
    {
        id: 'pichincha',
        titulo: 'Capítulo 2 — Pichincha: La Sierra Tiembla',
        provincia: 'PI',
        narrativa: `
            <div class="cap-chapter">
                <div class="cap-numero">CAPÍTULO 2</div>
                <div class="cap-titulo-grande" style="color:#fb923c">La Sierra Tiembla</div>
                <div class="cap-ubicacion">📍 Quito · Capital andina · 2,800,000 hab.</div>
                <div class="cap-texto">
                    3:17 AM. Un sismo M7.5 sacudió Quito durante 48 segundos.
                    El Centro Histórico tiene edificios del siglo XVII colapsados.
                    <br><br>
                    El Guagua Pichincha, volcán activo a 16 km de la ciudad, registra actividad inusual.
                </div>
                <div class="cap-leccion-box">
                    <div class="cap-leccion-titulo">📐 Lo que aprenderás aquí</div>
                    <div class="cap-leccion-texto">
                        Quito es <strong>"la ciudad más vulnerable a volcanes del planeta"</strong> (geólogo Toulkeridis, 2024).
                        El tsunami está desactivado — la cordillera andina bloquea el acceso del mar.
                        Aquí el volcán y los deslizamientos son amenazas prioritarias.
                    </div>
                </div>
                <div class="cap-objetivo">
                    <strong>🎯 Objetivo:</strong> Evitar que Z llegue por debajo del 30% y preservar el 20% de población.<br>
                    <strong>💡 Consejo:</strong> La erupción volcánica destruye r — inyecta recursos urgente.
                </div>
            </div>`,
        btnTexto: '🌍 Activar modo Pichincha',
        saltable: true,
    },
    {
        id: 'pastaza',
        titulo: 'Capítulo 3 — Pastaza: El Último Recurso',
        provincia: 'PA',
        narrativa: `
            <div class="cap-chapter">
                <div class="cap-numero">CAPÍTULO 3</div>
                <div class="cap-titulo-grande" style="color:#4ade80">El Último Recurso</div>
                <div class="cap-ubicacion">📍 Puyo · Amazonía ecuatoriana · 50,000 hab.</div>
                <div class="cap-texto">
                    La Amazonía lleva 8 meses sin lluvia. Los ríos están al 20% de su caudal.
                    Comunidades Shuar bloquean las vías. Grupos armados controlan tres cantones.
                    <br><br>
                    El Reventador emite columnas de ceniza que alcanzan la provincia.
                </div>
                <div class="cap-leccion-box">
                    <div class="cap-leccion-titulo">📐 Lo que aprenderás aquí</div>
                    <div class="cap-leccion-texto">
                        El <strong>sistema acoplado completo</strong>: amenazas aleatorias crean efectos no lineales.
                        El tsunami no aplica aquí. La deforestación y los conflictos indígenas son
                        amenazas endémicas de la Amazonía ecuatoriana.
                    </div>
                </div>
                <div class="cap-objetivo">
                    <strong>🎯 Objetivo:</strong> Sobrevivir con Z &gt; 0 y población &gt; 20% — la Amazonía es frágil.<br>
                    <strong>💡 Consejo:</strong> Pastaza tiene la menor población base — cada decisión importa más.
                </div>
            </div>`,
        btnTexto: '🌿 Activar modo Pastaza',
        saltable: true,
    },
];

/* ══════════════════════════════════════════════════════════════
 CATÁLOGO DE AMENAZAS — REBALANCEADAS para impacto realista
 
 FILOSOFÍA DE MULTIPLICADORES v7.0:
 - Amenaza LEVE: X baja ~3-8% por turno, Z baja ~5-10%
 - Amenaza MODERADA: X baja ~8-15%, Z baja ~12-20%
 - Amenaza SEVERA: X baja ~15-25%, Z baja ~20-35%
 - Esto es realista: un terremoto M7.5 no mata al 50% de la población urbana
   pero sí desplaza al 15-20% y destruye infraestructura masivamente
 
 Para que X BAJE: (birthX*bMul - deathX*dMul) < 0
 birthX=0.018, deathX=0.016 (base normal)
 Con deathXMul=2.0: neto = 0.018 - 0.032 = -0.014 → X baja moderado ✓
 Con deathXMul=3.0: neto = 0.018 - 0.048 = -0.030 → X baja fuerte ✓
 ══════════════════════════════════════════════════════════════ */
const AMENAZAS = {
    pandemia: {
        id: 'pandemia', nombre: 'Pandemia', emoji: '🦠',
        desc: 'Virus de alta transmisión. Cuarentena restringe movimientos. Colapso sanitario.',
        color: '#f87171',
        clases: [
            {
                nombre: 'Parásito intestinal', bonus: 'Baja mortalidad, cuarentena parcial', emoji: '🟡',
                // Impacto leve: X baja ~4-6%, Z baja ~6%
                birthXMul: 0.93,
                deathXMul: 1.8,
                deathYMul: 1.4,
                consumoMul: 1.18,
                muBaseMul: 0.60,
                muStressMul: 0.70,
                rMul: 0.94,
            },
            {
                nombre: 'Brote bacteriano', bonus: 'Mortalidad moderada, cuarentena estricta', emoji: '🟠',
                // Impacto moderado: X baja ~10%, Z baja ~14%
                birthXMul: 0.85,
                deathXMul: 2.5,
                deathYMul: 1.9,
                consumoMul: 1.30,
                muBaseMul: 0.40,
                muStressMul: 0.50,
                rMul: 0.87,
            },
            {
                nombre: 'Virus hemorrágico', bonus: 'Alta mortalidad, toque de queda total', emoji: '🔴',
                // Impacto severo: X baja ~18-22%, Z baja ~25%
                birthXMul: 0.70,
                deathXMul: 3.8,
                deathYMul: 3.0,
                consumoMul: 1.48,
                muBaseMul: 0.20,
                muStressMul: 0.25,
                rMul: 0.80,
            },
        ],
        narrativas: [
            "Los primeros casos aparecen en el mercado central. La gente empieza a usar mascarillas improvisadas.",
            "Los hospitales reportan saturación. Médicos trabajan turnos dobles sin descanso.",
            "La tasa de contagio supera la capacidad del sistema. Se declara cuarentena total.",
            "Escasean los insumos médicos. Las calles están vacías — nadie se atreve a salir.",
            "Investigadores locales trabajan contra el reloj para encontrar tratamientos.",
        ]
    },
    terremoto: {
        id: 'terremoto', nombre: 'Terremoto', emoji: '🌍',
        desc: 'Sismo destructivo. Destruye infraestructura, colapsa renovación, fuerza migración masiva.',
        color: '#fb923c',
        clases: [
            {
                nombre: 'M 5.8 — Moderado', bonus: 'Daño parcial, éxodo menor', emoji: '🟡',
                // Impacto leve: X baja ~5%, Y sube por migración
                consumoMul: 1.15,
                rMul: 0.80,
                muStressMul: 1.5,
                muBaseMul: 1.4,
                deathXMul: 1.5,
                deathYMul: 1.2,
                birthXMul: 0.90,
            },
            {
                nombre: 'M 7.1 — Destructivo', bonus: 'Infraestructura severa, éxodo masivo', emoji: '🟠',
                // Impacto moderado: X baja ~12-15%, r colapsa
                consumoMul: 1.35,
                rMul: 0.55,
                muStressMul: 2.2,
                muBaseMul: 2.0,
                deathXMul: 2.2,
                deathYMul: 1.6,
                birthXMul: 0.78,
            },
            {
                nombre: 'M 7.8 — Catastrófico', bonus: 'Como Pedernales 2016: destrucción masiva', emoji: '🔴',
                // Impacto severo: X baja ~20%, basado en terremoto Pedernales 2016
                consumoMul: 1.60,
                rMul: 0.35,
                muStressMul: 3.2,
                muBaseMul: 2.8,
                deathXMul: 3.2,
                deathYMul: 2.4,
                birthXMul: 0.60,
                birthYMul: 0.70,
            },
        ],
        narrativas: [
            "El suelo tiembla durante 40 segundos. Edificios antiguos colapsan en el centro histórico.",
            "Las réplicas siguen llegando. Los escombros atrapan a cientos de familias.",
            "El sistema de agua potable queda destruido. Se forman colas kilométricas por alimentos.",
            "Brigadas internacionales llegan, pero el acceso es difícil por los derrumbes.",
            "La ciudad intenta reorganizarse. Carpas y albergues improvisados surgen en los parques.",
        ]
    },
    sequia: {
        id: 'sequia', nombre: 'Sequía', emoji: '☀️',
        desc: 'Colapso hídrico. r colapsa porque no hay agua para producir. Hambre y éxodo masivo.',
        color: '#fbbf24',
        clases: [
            {
                nombre: 'Estrés hídrico', bonus: 'Agricultura afectada, racionamiento parcial', emoji: '🟡',
                rMul: 0.72,
                consumoMul: 1.14,
                muStressMul: 1.4,
                muBaseMul: 1.3,
                deathXMul: 1.3,
                deathYMul: 1.5,
                birthXMul: 0.93,
                birthYMul: 0.90,
            },
            {
                nombre: 'Sequía severa', bonus: 'Crisis agrícola, racionamiento de agua', emoji: '🟠',
                rMul: 0.50,
                consumoMul: 1.28,
                muStressMul: 1.9,
                muBaseMul: 1.7,
                deathXMul: 1.8,
                deathYMul: 2.2,
                birthXMul: 0.84,
                birthYMul: 0.78,
            },
            {
                nombre: 'Sequía extrema', bonus: 'Desertificación, colapso productivo total', emoji: '🔴',
                rMul: 0.28,
                consumoMul: 1.45,
                muStressMul: 2.8,
                muBaseMul: 2.4,
                deathXMul: 2.8,
                deathYMul: 3.2,
                birthXMul: 0.70,
                birthYMul: 0.62,
            },
        ],
        narrativas: [
            "Los ríos bajan a niveles históricos. Los agricultores miran el cielo sin nubes.",
            "Las cosechas se pierden. Las familias rurales comienzan a migrar hacia la ciudad.",
            "El racionamiento de agua llega a los barrios. Colas de madrugada frente a las piletas.",
            "El precio de los alimentos básicos se triplica. Los mercados están casi vacíos.",
            "Se implementan planes de emergencia hídrica. Camiones cisterna recorren los barrios.",
        ]
    },
    tsunami: {
        id: 'tsunami', nombre: 'Tsunami', emoji: '🌊',
        desc: 'Ola devastadora en zona costera. Solo posible en provincias costeras ecuatorianas.',
        color: '#60a5fa',
        // Solo disponible en GUAYAS (Costa). Ver AMENAZAS_PROVINCIA
        clases: [
            {
                nombre: 'Alerta costera', bonus: 'Zona baja inundada, evacuación parcial', emoji: '🟡',
                // Basado en tsunamis históricos en Ecuador (1906, 1958, 1979)
                deathYMul: 2.2,
                deathXMul: 1.4,
                consumoMul: 1.22,
                rMul: 0.75,
                muStressMul: 2.0,
                muBaseMul: 1.6,
                birthYMul: 0.78,
            },
            {
                nombre: 'Impacto directo', bonus: 'Ciudad costera arrasada, como el de 1906', emoji: '🔴',
                // El tsunami de 1906 fue el más grande en Ecuador
                deathYMul: 3.8,
                deathXMul: 2.4,
                consumoMul: 1.50,
                rMul: 0.50,
                muStressMul: 3.0,
                muBaseMul: 2.4,
                birthXMul: 0.68,
                birthYMul: 0.50,
            },
        ],
        narrativas: [
            "Las alarmas costeras suenan a las 3am. Los pescadores ven el mar retirarse.",
            "La ola de 12 metros barre los barrios junto al río. El sonido es ensordecedor.",
            "Los sobrevivientes se refugian en las partes altas. El agua llega hasta la autopista.",
            "Los equipos de rescate trabajan entre el lodo y los escombros bajo el sol.",
            "La reconstrucción comenzará, pero miles han perdido todo lo que tenían.",
        ]
    },
    conflicto: {
        id: 'conflicto', nombre: 'Conflicto social', emoji: '⚔️',
        desc: 'Inestabilidad y violencia. Natalidad cae, éxodo acelerado, recursos escasean.',
        color: '#c084fc',
        clases: [
            {
                nombre: 'Protestas ciudadanas', bonus: 'Malestar civil, comercio afectado', emoji: '🟡',
                birthXMul: 0.88,
                muBaseMul: 1.5,
                muStressMul: 1.3,
                consumoMul: 1.12,
                rMul: 0.87,
                deathXMul: 1.3,
            },
            {
                nombre: 'Crisis institucional', bonus: 'Éxodo urbano, saqueos', emoji: '🟠',
                birthXMul: 0.72,
                muBaseMul: 2.2,
                muStressMul: 1.8,
                consumoMul: 1.25,
                rMul: 0.70,
                deathXMul: 1.9,
                deathYMul: 1.4,
            },
            {
                nombre: 'Estado fallido', bonus: 'Violencia masiva, colapso de servicios', emoji: '🔴',
                birthXMul: 0.50,
                muBaseMul: 3.2,
                muStressMul: 2.5,
                consumoMul: 1.42,
                rMul: 0.52,
                deathXMul: 2.8,
                deathYMul: 2.0,
            },
        ],
        narrativas: [
            "Las calles se llenan de manifestantes. Los comercios cierran sus persianas.",
            "Los enfrentamientos dejan heridos en el parque central. Hay toque de queda.",
            "Familias empiezan a irse hacia el campo huyendo de la violencia urbana.",
            "Los servicios públicos colapsan. La basura se acumula, el agua no llega.",
            "Líderes comunitarios intentan mediar. La tensión es palpable en cada esquina.",
        ]
    },
    erupcion: {
        id: 'erupcion', nombre: 'Erupción volcánica', emoji: '🌋',
        desc: 'Ceniza y flujos destruyen cultivos. r colapsa por contaminación. Solo en Sierra y Amazonía.',
        color: '#f97316',
        // Solo disponible en PICHINCHA y PASTAZA. Ver AMENAZAS_PROVINCIA
        clases: [
            {
                nombre: 'Lluvia de ceniza', bonus: 'Contaminación aérea, cultivos dañados', emoji: '🟡',
                // Basado en Cotopaxi 2015, Reventador 2002
                rMul: 0.65,
                consumoMul: 1.18,
                muBaseMul: 1.4,
                muStressMul: 1.3,
                deathXMul: 1.3,
                deathYMul: 1.5,
                birthXMul: 0.90,
            },
            {
                nombre: 'Erupción activa', bonus: 'Evacuación masiva, destrucción agrícola', emoji: '🟠',
                // Basado en Tungurahua 1999-2016: ~25.000 evacuados
                rMul: 0.38,
                consumoMul: 1.40,
                muBaseMul: 2.5,
                muStressMul: 2.0,
                deathXMul: 2.0,
                deathYMul: 2.4,
                birthXMul: 0.72,
                birthYMul: 0.78,
            },
            {
                nombre: 'Flujos piroclásticos', bonus: 'Destrucción total zona de influencia', emoji: '🔴',
                // Escenario catastrófico: Cotopaxi erupción mayor (estimado: 105k muertos, 500k sin hogar)
                rMul: 0.20,
                consumoMul: 1.60,
                muBaseMul: 3.8,
                muStressMul: 3.0,
                deathXMul: 3.0,
                deathYMul: 3.5,
                birthXMul: 0.55,
                birthYMul: 0.60,
            },
        ],
        narrativas: [
            "El volcán ruge. Una columna de ceniza de 8km oscurece el cielo al mediodía.",
            "La lluvia de ceniza cubre techos y cultivos. Los niños no van a la escuela.",
            "Se ordena la evacuación de 3 parroquias. Carreteras colapsadas por flujos piroclásticos.",
            "El agua del río sabe a azufre. Los animales mueren en las faldas del volcán.",
            "Miles se instalan en albergues de la ciudad. El volcán sigue activo sin dar tregua.",
        ]
    },
    // ══ NUEVA AMENAZA: INUNDACIÓN / EL NIÑO ══
    inundacion: {
        id: 'inundacion', nombre: 'Inundación / El Niño', emoji: '🌧️',
        desc: 'Guayas es la provincia más inundada del Ecuador (>100 eventos históricos). El Niño agrava todo.',
        color: '#38bdf8',
        // Disponible en GUAYAS y PASTAZA (ríos amazónicos). No en Sierra.
        clases: [
            {
                nombre: 'Lluvias intensas', bonus: 'Desbordamiento de ríos, barrios inundados', emoji: '🟡',
                // Inundaciones menores: afectan mayormente a Y (periférica/rural)
                deathYMul: 1.8,
                deathXMul: 1.2,
                rMul: 0.72,
                consumoMul: 1.20,
                muBaseMul: 1.4,
                muStressMul: 1.2,
                birthYMul: 0.85,
            },
            {
                nombre: 'El Niño fuerte', bonus: 'Inundaciones masivas, epidemias secundarias', emoji: '🟠',
                // El Niño 1997-1998: devastó costas ecuatorianas
                deathYMul: 2.8,
                deathXMul: 1.8,
                rMul: 0.50,
                consumoMul: 1.35,
                muBaseMul: 2.0,
                muStressMul: 1.8,
                birthXMul: 0.80,
                birthYMul: 0.68,
            },
            {
                nombre: 'Catástrofe hídrica', bonus: 'Guayas bajo el agua, colapso total', emoji: '🔴',
                // Escenario extremo: inundación masiva + brote epidémico secundario
                deathYMul: 4.0,
                deathXMul: 2.5,
                rMul: 0.30,
                consumoMul: 1.50,
                muBaseMul: 2.8,
                muStressMul: 2.5,
                birthXMul: 0.65,
                birthYMul: 0.45,
            },
        ],
        narrativas: [
            "El Río Daule se desborda. Las primeras familias suben sus pertenencias a los techos.",
            "El agua llega a las rodillas en el centro de Guayaquil. El tráfico está paralizado.",
            "Cuarenta barrios bajo el agua. Los helicópteros rescatan familias atrapadas.",
            "Aparecen los primeros casos de cólera y leptospirosis por el agua contaminada.",
            "El agua baja lentamente, dejando lodo, escombros y enfermedades en cada calle.",
        ]
    },
    // ══ NUEVA AMENAZA: DESLIZAMIENTO DE TIERRA ══
    deslizamiento: {
        id: 'deslizamiento', nombre: 'Deslizamiento', emoji: '⛰️',
        desc: 'Deslave o aluvión. Frecuentes en Sierra y Amazonía por lluvias intensas y deforestación.',
        color: '#a3a3a3',
        // Disponible en PICHINCHA y PASTAZA. No en Costa plana.
        clases: [
            {
                nombre: 'Deslave menor', bonus: 'Vías cortadas, viviendas afectadas', emoji: '🟡',
                // Como el deslave de La Gasca (Quito) o deslaves frecuentes en sierra
                rMul: 0.78,
                consumoMul: 1.12,
                muBaseMul: 1.3,
                muStressMul: 1.2,
                deathXMul: 1.2,
                deathYMul: 1.6,
                birthXMul: 0.93,
            },
            {
                nombre: 'Aluvión severo', bonus: 'Zonas destruidas, comunidades aisladas', emoji: '🟠',
                // Como el aluvión de Quito 2022: parroquia La Gasca destruida parcialmente
                rMul: 0.55,
                consumoMul: 1.28,
                muBaseMul: 2.0,
                muStressMul: 1.8,
                deathXMul: 1.8,
                deathYMul: 2.4,
                birthXMul: 0.78,
                birthYMul: 0.82,
            },
            {
                nombre: 'Catástrofe geológica', bonus: 'Como Alausí 2023: comunidades enterradas', emoji: '🔴',
                // Deslave de Alausí 2023: más de 70 muertos, comunidad enterrada
                rMul: 0.32,
                consumoMul: 1.45,
                muBaseMul: 3.0,
                muStressMul: 2.5,
                deathXMul: 2.5,
                deathYMul: 3.5,
                birthXMul: 0.60,
                birthYMul: 0.55,
            },
        ],
        narrativas: [
            "La ladera cede. El lodo engulle la vía principal y tres casas desaparecen.",
            "Las brigadas de rescate trabajan con palas entre el barro. Hay desaparecidos.",
            "Comunidades enteras quedan aisladas. El helicóptero tarda días en llegar.",
            "Los deslaves secundarios impiden el paso. Los sobrevivientes esperan en las alturas.",
            "La montaña sigue moviéndose. Los geólogos piden evacuar el perímetro completo.",
        ]
    },
};

/* ══════════════════════════════════════════════════════════════
 HISTORIAS INICIALES
 ══════════════════════════════════════════════════════════════ */
const HISTORIAS_INICIO = {
    GY: "Guayaquil, la ciudad-puerto. <strong>4 millones de personas</strong> viven en esta metrópolis costera donde el calor y el caos conviven con la esperanza. La ruleta incluye amenazas reales para la Costa: inundaciones, terremotos, tsunamis. El volcán no aplica aquí.",
    PI: "Quito, la capital andina. Entre volcanes y nubes, <strong>2.8 millones de quiteños</strong> habitan la ciudad más alta del mundo. Rodeada de volcanes activos — <em>'no hay ciudad más vulnerable al volcán que Quito'</em>. El tsunami no puede cruzar los Andes.",
    PA: "Puyo y la Amazonía. Solo <strong>50,000 personas</strong> viven en este territorio inmenso. El equilibrio con la naturaleza es frágil — deforestación, ríos desbordados y ceniza del Reventador. Sin riesgo de tsunami aquí.",
};

/* ══════════════════════════════════════════════════════════════
 ESTADO DEL JUEGO
 ══════════════════════════════════════════════════════════════ */
const JUEGO = {
    activo: false,
    amenazaId: null,
    claseIdx: null,
    nombre: '',
    turno: 0,
    maxTurnos: 8,
    xInicial: 0, yInicial: 0, zInicial: 0,
    xActual: 0, yActual: 0, zActual: 0,
    historial: [],
    historialEuler: [],
    logEventos: [],
    paramsBase: null,
    personas: [],
    particulas: [],
    animFrameId: null,
    globalCanvas: null,
    globalCtx: null,
    svgRect: null,
    miniChart: null,
    sessionId: null,
    presupuesto: 500,
    dificultad: 'normal',
    esperandoDecision: false,
    modoCapitulos: false,
    capituloActual: 0,
    capitulosCompletados: [],
    // Ruleta
    ruletaGirando: false,
    ruletaCanvas: null,
    ruletaCtx: null,
    ruletaAngle: 0,
    ruletaVelocidad: 0,
    ruletaAnimId: null,
    ruletaAmenazaIds: [],      // todos (incluyendo no disponibles)
    ruletaDisponibles: [],     // solo los disponibles para esta provincia
    // Combo de amenazas (doble impacto)
    comboActivo: false,
    comboAmenazaId: null,
};

/* ══════════════════════════════════════════════════════════════
 PANEL DE DIFICULTAD
 ══════════════════════════════════════════════════════════════ */
function renderPanelDificultad() {
    const cont = document.getElementById('juego-dificultad-cards');
    if (!cont) return;
    cont.innerHTML = '';
    Object.values(DIFICULTADES).forEach(d => {
        const activa = JUEGO.dificultad === d.id;
        const card = document.createElement('div');
        card.className = 'dif-card' + (activa ? ' dif-activa' : '');
        card.style.setProperty('--dif-color', d.color);
        card.onclick = () => seleccionarDificultad(d.id);
        card.innerHTML = `
            <div class="dif-emoji">${d.emoji}</div>
            <div class="dif-nombre">${d.nombre}</div>
            <div class="dif-desc">${d.desc}</div>
            <div class="dif-budget" style="color:${d.color}">💰 $${d.presupuesto}M</div>`;
        cont.appendChild(card);
    });
}

function seleccionarDificultad(id) {
    if (JUEGO.turno > 0) return;
    JUEGO.dificultad = id;
    JUEGO.presupuesto = DIFICULTADES[id].presupuesto;
    actualizarPresupuestoUI();
    renderPanelDificultad();
    agregarLogEvento({
        turno: 0,
        texto: `${DIFICULTADES[id].emoji} Dificultad: <strong>${DIFICULTADES[id].nombre}</strong> — ${DIFICULTADES[id].desc}`,
        tipo: 'info',
    });
}

/* ══════════════════════════════════════════════════════════════
 MODAL DE CAPÍTULOS
 ══════════════════════════════════════════════════════════════ */
function abrirModalCapitulos() {
    const modal = document.getElementById('cap-modal');
    if (!modal) return;
    mostrarCapitulo(JUEGO.capituloActual);
    modal.style.display = 'flex';
}
function cerrarModalCapitulos() {
    const modal = document.getElementById('cap-modal');
    if (modal) modal.style.display = 'none';
}
function mostrarCapitulo(idx) {
    const cap = CAPITULOS[idx];
    if (!cap) return;
    document.getElementById('cap-contenido').innerHTML = cap.narrativa;
    document.getElementById('cap-btn-accion').textContent = cap.btnTexto;
    const btnSaltar = document.getElementById('cap-btn-saltar');
    if (btnSaltar)
        btnSaltar.style.display = (cap.saltable && idx < CAPITULOS.length - 1) ? 'block' : 'none';
    const dots = document.getElementById('cap-dots');
    if (dots) {
        dots.innerHTML = CAPITULOS.map((c, i) => {
            const completado = JUEGO.capitulosCompletados.includes(i);
            const activo = i === idx;
            return `<div class="cap-dot ${activo ? 'cap-dot-activo' : ''} ${completado ? 'cap-dot-hecho' : ''}"></div>`;
        }).join('');
    }
}
function avanzarCapitulo() {
    const cap = CAPITULOS[JUEGO.capituloActual];
    if (JUEGO.capituloActual === 0) {
        JUEGO.capitulosCompletados.push(0);
        JUEGO.capituloActual = 1;
        mostrarCapitulo(1);
        return;
    }
    if (cap.provincia) {
        cerrarModalCapitulos();
        JUEGO.modoCapitulos = true;
        if (typeof selectProv === 'function') selectProv(cap.provincia);
        setTimeout(() => {
            inicializarJuego();
            agregarLogEvento({ turno: 0, texto: `📖 <strong>${cap.titulo}</strong> — Misión iniciada.`, tipo: 'info' });
        }, 100);
    }
}
function saltarCapitulo() {
    if (JUEGO.capituloActual < CAPITULOS.length - 1) {
        JUEGO.capituloActual++;
        mostrarCapitulo(JUEGO.capituloActual);
    }
}

/* ══════════════════════════════════════════════════════════════
 TOGGLE MODO JUEGO
 ══════════════════════════════════════════════════════════════ */
function toggleModoJuego() {
    const panel = document.getElementById('juego-panel');
    const btn = document.getElementById('btn-modo-juego');
    const sim = document.getElementById('main-panel');
    const sidebar = document.querySelector('aside.sidebar');
    if (!JUEGO.activo) {
        if (!currentProv) {
            mostrarAlertaJuego('⚠️ Selecciona una provincia primero en el simulador.');
            return;
        }
        panel.style.display = 'flex';
        sim.style.display = 'none';
        if (sidebar) sidebar.style.display = 'none';
        btn.textContent = '← Volver al Simulador';
        btn.style.background = 'var(--border)';
        btn.style.color = 'var(--muted)';
        JUEGO.activo = true;
        inicializarJuego();
        if (JUEGO.capitulosCompletados.length === 0)
            setTimeout(() => abrirModalCapitulos(), 400);
    } else {
        cerrarModoJuego();
    }
}
function cerrarModoJuego() {
    const panel = document.getElementById('juego-panel');
    const btn = document.getElementById('btn-modo-juego');
    const sim = document.getElementById('main-panel');
    const sidebar = document.querySelector('aside.sidebar');
    panel.style.display = 'none';
    sim.style.display = 'flex';
    if (sidebar) sidebar.style.display = '';
    btn.textContent = '🎮 Modo Amenaza';
    btn.style.background = '';
    btn.style.color = '';
    JUEGO.activo = false;
    detenerAnimacion();
    detenerRuleta();
    if (JUEGO.miniChart) {
        JUEGO.miniChart.destroy();
        JUEGO.miniChart = null;
    }
    const gc = document.getElementById('juego-global-canvas');
    if (gc) gc.remove();
    JUEGO.globalCanvas = null;
    JUEGO.globalCtx = null;
}
function detenerAnimacion() {
    if (JUEGO.animFrameId) {
        cancelAnimationFrame(JUEGO.animFrameId);
        JUEGO.animFrameId = null;
    }
}

/* ══════════════════════════════════════════════════════════════
 INICIALIZAR JUEGO
 ══════════════════════════════════════════════════════════════ */
function inicializarJuego() {
    const toggleEuler = document.getElementById('toggle-euler');
    if (toggleEuler) toggleEuler.checked = false;

    const r = REGIONS[currentProv];
    const pProv = PARAMS_PROVINCIA[currentProv] || {};
    const z0 = pProv.z0Override || r.z0;

    JUEGO.xInicial = r.x0;
    JUEGO.yInicial = r.y0;
    JUEGO.zInicial = z0;
    JUEGO.xActual = r.x0;
    JUEGO.yActual = r.y0;
    JUEGO.zActual = z0;
    JUEGO.turno = 0;
    JUEGO.historial = [];
    JUEGO.historialEuler = [];
    JUEGO.logEventos = [];
    JUEGO.amenazaId = null;
    JUEGO.claseIdx = null;
    JUEGO.nombre = '';
    JUEGO.personas = [];
    JUEGO.particulas = [];
    JUEGO.paramsBase = capturarParamsBase(pProv);
    JUEGO.sessionId = null;
    JUEGO.presupuesto = DIFICULTADES[JUEGO.dificultad].presupuesto;
    JUEGO.esperandoDecision = false;
    JUEGO.ruletaGirando = false;
    JUEGO.comboActivo = false;
    JUEGO.comboAmenazaId = null;

    // Calcular amenazas disponibles para esta provincia
    const mapaProv = AMENAZAS_PROVINCIA[currentProv] || { disponibles: Object.keys(AMENAZAS), nodisponibles: {} };
    JUEGO.ruletaDisponibles = mapaProv.disponibles.filter(id => AMENAZAS[id]);
    JUEGO.ruletaAmenazaIds = Object.keys(AMENAZAS); // todos para mostrar en ruleta (grises los no disponibles)

    actualizarPresupuestoUI();
    document.getElementById('juego-decision-section').style.display = 'none';

    if (JUEGO.miniChart) {
        JUEGO.miniChart.destroy();
        JUEGO.miniChart = null;
    }

    renderPanelJuego();
    renderPanelDificultad();
    actualizarKPIsJuego();
    document.getElementById('juego-chart-section').style.display = 'none';
    renderLogEventos([{ turno: 0, texto: `🌎 Simulación iniciada en <strong>${r.name}</strong>. Dificultad: ${DIFICULTADES[JUEGO.dificultad].emoji} <strong>${DIFICULTADES[JUEGO.dificultad].nombre}</strong>`, tipo: 'info' }]);

    const historiaEl = document.getElementById('juego-historia-texto');
    if (historiaEl)
        historiaEl.innerHTML = HISTORIAS_INICIO[currentProv] || `Provincia: <strong>${r.name}</strong>. Gira la ruleta para comenzar.`;

    // Mostrar badge de amenazas disponibles
    renderBadgeAmenazas();

    requestAnimationFrame(() => { montarCanvasGlobal(); });
    setTimeout(() => montarRuleta(), 100);
    crearSesionBackend(r.name);
}

/* ══════════════════════════════════════════════════════════════
 BADGE DE AMENAZAS DISPONIBLES POR PROVINCIA
 ══════════════════════════════════════════════════════════════ */
function renderBadgeAmenazas() {
    const mapaProv = AMENAZAS_PROVINCIA[currentProv];
    if (!mapaProv) return;

    // Buscar o crear el contenedor del badge
    let badgeEl = document.getElementById('amenazas-badge-prov');
    if (!badgeEl) {
        badgeEl = document.createElement('div');
        badgeEl.id = 'amenazas-badge-prov';
        badgeEl.style.cssText = `
            padding:.5rem .8rem; background:var(--surface2);
            border:1px solid var(--border); border-radius:10px;
            font-size:.72rem; color:var(--muted); margin-bottom:.5rem;
            line-height:1.6;`;
        const wrap = document.getElementById('amenazas-grid');
        if (wrap) wrap.parentNode.insertBefore(badgeEl, wrap);
    }

    const nodisp = mapaProv.nodisponibles || {};
    const noDispHtml = Object.entries(nodisp).map(([id, info]) => {
        const a = AMENAZAS[id];
        if (!a) return '';
        return `<span style="opacity:.55;" title="${info.razon}">${a.emoji} <s>${a.nombre}</s></span>`;
    }).join(' · ');

    const dispHtml = mapaProv.disponibles.map(id => {
        const a = AMENAZAS[id];
        return a ? `<span title="Amenaza activa">${a.emoji} ${a.nombre}</span>` : '';
    }).join(' · ');

    badgeEl.innerHTML = `
        <div style="margin-bottom:.25rem;">
            <strong style="color:var(--text);">✅ Amenazas reales aquí:</strong> ${dispHtml}
        </div>
        ${noDispHtml ? `<div>⛔ <strong>No aplica:</strong> ${noDispHtml}</div>` : ''}`;
}

function actualizarPresupuestoUI() {
    const el = document.getElementById('juego-presupuesto');
    if (!el) return;
    el.textContent = `💰 $${JUEGO.presupuesto}M`;
    el.classList.toggle('presupuesto-bajo', JUEGO.presupuesto < 60);
}

/* ══════════════════════════════════════════════════════════════
 capturarParamsBase
 ══════════════════════════════════════════════════════════════ */
function capturarParamsBase(pProv = {}) {
    const dif = DIFICULTADES[JUEGO.dificultad];
    return {
        birthX: (pProv.birthX ?? 0.018) * (dif.birthXMod ?? 1.00),
        deathX: (pProv.deathX ?? 0.016) * dif.deathXMod,
        birthY: (pProv.birthY ?? 0.022) * (dif.birthYMod ?? 1.00),
        deathY: (pProv.deathY ?? 0.019) * dif.deathYMod,
        muBase: pProv.muBase   ?? 0.008,
        muStress: (pProv.muStress ?? 0.12) * dif.muStressMod,
        nuBase: pProv.nuBase   ?? 0.004,
        tasaConsumo: (pProv.tasaConsumo ?? 0.000018) * dif.tasaConsumoMod,
        r: (pProv.r ?? 0.055) * dif.rMod,
        K: pProv.K ?? 1_100_000,
        h: pProv.h ?? 0.5,
        pasos: pProv.pasos ?? 60,
    };
}

/* ══════════════════════════════════════════════════════════════
 RULETA — con sectores grises para amenazas no disponibles
 ══════════════════════════════════════════════════════════════ */
function montarRuleta() {
    const wrap = document.getElementById('amenazas-grid');
    if (!wrap) return;

    wrap.innerHTML = `
        <div id="ruleta-wrap" style="
            display:flex; flex-direction:column; align-items:center;
            gap:.8rem; padding:.5rem 0; width:100%; box-sizing:border-box;">

            <div style="position:relative; display:block; margin:0 auto;">
                <div id="ruleta-flecha" style="
                    position:absolute; top:-14px; left:50%; transform:translateX(-50%);
                    font-size:22px; z-index:10;
                    filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));">▼</div>
                <canvas id="ruleta-canvas" width="220" height="220"
                    style="border-radius:50%; cursor:pointer; display:block;
                           box-shadow:0 0 0 3px var(--border), 0 4px 20px rgba(0,0,0,.3);">
                </canvas>
                <div id="ruleta-centro" style="
                    position:absolute; top:50%; left:50%;
                    transform:translate(-50%,-50%); width:36px; height:36px;
                    background:var(--surface); border:3px solid var(--border);
                    border-radius:50%; display:flex; align-items:center;
                    justify-content:center; font-size:16px;
                    pointer-events:none; z-index:5;">🎲</div>
            </div>

            <button id="btn-girar-ruleta" onclick="girarRuleta()" style="
                width:88%; padding:.65rem 1rem; background:var(--accent1);
                color:#050b14; border:none; border-radius:10px;
                font-weight:800; font-size:.9rem; cursor:pointer;
                transition:opacity .2s; display:flex; align-items:center;
                justify-content:center; gap:.4rem;">
                🎰 ¡Girar ruleta!
            </button>

            <div id="ruleta-resultado" style="
                display:none; width:88%; padding:.7rem 1rem;
                background:var(--surface2); border:1px solid var(--border);
                border-radius:10px; font-size:.82rem;
                text-align:center; color:var(--text);">
            </div>

            <button id="btn-regirar" onclick="regirarConCosto()" style="
                display:none; width:88%; padding:.45rem .9rem;
                background:none; border:1px dashed rgba(248,113,113,.6);
                color:#f87171; border-radius:10px; font-size:.76rem;
                cursor:pointer; text-align:center; transition:opacity .2s;">
                🔄 No me convence — volver a girar
                <span style="font-size:.68rem; opacity:.75;"> (-$50M)</span>
            </button>
        </div>`;

    JUEGO.ruletaAmenazaIds = Object.keys(AMENAZAS);
    const canvas = document.getElementById('ruleta-canvas');
    JUEGO.ruletaCanvas = canvas;
    JUEGO.ruletaCtx = canvas.getContext('2d');
    JUEGO.ruletaAngle = Math.random() * Math.PI * 2;
    dibujarRuleta(JUEGO.ruletaAngle);
}

function dibujarRuleta(angle) {
    const canvas = JUEGO.ruletaCanvas;
    const ctx = JUEGO.ruletaCtx;
    if (!canvas || !ctx) return;

    const mapaProv = AMENAZAS_PROVINCIA[currentProv] || { disponibles: Object.keys(AMENAZAS), nodisponibles: {} };
    const ids = JUEGO.ruletaAmenazaIds;
    const n = ids.length;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 4;
    const paso = (Math.PI * 2) / n;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fill();

    ids.forEach((id, i) => {
        const a = AMENAZAS[id];
        const disponible = mapaProv.disponibles.includes(id);
        const startAngle = angle + i * paso;
        const endAngle = startAngle + paso;
        const midAngle = startAngle + paso / 2;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.closePath();

        // Si no disponible → gris apagado
        if (disponible) {
            const alpha = JUEGO.amenazaId === id ? 'ff' : 'cc';
            ctx.fillStyle = a.color + alpha;
        } else {
            ctx.fillStyle = 'rgba(80,80,100,0.45)';
        }
        ctx.fill();
        ctx.strokeStyle = disponible ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.20)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Emoji en el sector
        const emojiR = r * 0.65;
        const ex = cx + Math.cos(midAngle) * emojiR;
        const ey = cy + Math.sin(midAngle) * emojiR;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.globalAlpha = disponible ? 1.0 : 0.30;
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(a.emoji, 0, 0);
        ctx.restore();

        // Nombre del sector
        const txtR = r * 0.88;
        const tx = cx + Math.cos(midAngle) * txtR;
        const ty = cy + Math.sin(midAngle) * txtR;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.globalAlpha = disponible ? 1.0 : 0.25;
        ctx.font = 'bold 6.5px Inter, sans-serif';
        ctx.fillStyle = disponible ? '#fff' : '#aaa';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,.8)';
        ctx.shadowBlur = 3;
        ctx.fillText(a.nombre.toUpperCase(), 0, 0);
        ctx.restore();

        // Tachado/X para no disponibles
        if (!disponible) {
            const ex2 = cx + Math.cos(midAngle) * emojiR;
            const ey2 = cy + Math.sin(midAngle) * emojiR;
            ctx.save();
            ctx.translate(ex2, ey2);
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-8, -8); ctx.lineTo(8, 8);
            ctx.moveTo(8, -8);  ctx.lineTo(-8, 8);
            ctx.stroke();
            ctx.restore();
        }
    });

    // Círculo central
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--surface, #0d1b2a)';
    ctx.fill();
    ctx.strokeStyle = 'var(--border, #1e3a5f)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function girarRuleta() {
    if (JUEGO.ruletaGirando || JUEGO.esperandoDecision) return;
    if (JUEGO.turno >= JUEGO.maxTurnos) return;

    const resEl = document.getElementById('ruleta-resultado');
    if (resEl) resEl.style.display = 'none';

    const btnGirar = document.getElementById('btn-girar-ruleta');
    if (btnGirar) {
        btnGirar.disabled = true;
        btnGirar.textContent = '⏳ Girando...';
    }

    const claseSection = document.getElementById('juego-clase-section');
    if (claseSection) claseSection.style.display = 'none';
    document.getElementById('btn-activar-amenaza').disabled = true;
    JUEGO.amenazaId = null;
    JUEGO.claseIdx = null;
    JUEGO.ruletaGirando = true;

    JUEGO.ruletaVelocidad = 0.28 + Math.random() * 0.18;
    const totalVueltas = 5 + Math.random() * 4;
    const targetDelta = totalVueltas * Math.PI * 2;
    let acumulado = 0;
    const decel = 0.988;

    const loop = () => {
        JUEGO.ruletaAngle += JUEGO.ruletaVelocidad;
        acumulado += JUEGO.ruletaVelocidad;
        JUEGO.ruletaVelocidad *= decel;
        dibujarRuleta(JUEGO.ruletaAngle);

        if (JUEGO.ruletaVelocidad > 0.003 && acumulado < targetDelta) {
            JUEGO.ruletaAnimId = requestAnimationFrame(loop);
        } else {
            finalizarRuleta();
        }
    };
    JUEGO.ruletaAnimId = requestAnimationFrame(loop);
}

function detenerRuleta() {
    if (JUEGO.ruletaAnimId) {
        cancelAnimationFrame(JUEGO.ruletaAnimId);
        JUEGO.ruletaAnimId = null;
    }
    JUEGO.ruletaGirando = false;
}

/* ══════════════════════════════════════════════════════════════
 finalizarRuleta — si cae en sector no disponible, re-gira
 automáticamente hasta caer en uno disponible.
 ══════════════════════════════════════════════════════════════ */
function finalizarRuleta() {
    JUEGO.ruletaGirando = false;

    const ids = JUEGO.ruletaAmenazaIds;
    const n = ids.length;
    const paso = (Math.PI * 2) / n;

    const flechaAngle = (-Math.PI / 2 - JUEGO.ruletaAngle % (Math.PI * 2) + Math.PI * 2 * 10) % (Math.PI * 2);
    const sectorIdx = Math.floor(flechaAngle / paso) % n;
    const amenazaIdCaido = ids[sectorIdx];

    // Si cayó en una amenaza no disponible → elegir aleatoriamente entre disponibles
    let amenazaId = amenazaIdCaido;
    if (!JUEGO.ruletaDisponibles.includes(amenazaIdCaido)) {
        const dispIds = JUEGO.ruletaDisponibles;
        amenazaId = dispIds[Math.floor(Math.random() * dispIds.length)];
        // Mensaje informativo
        const noDispInfo = (AMENAZAS_PROVINCIA[currentProv]?.nodisponibles || {})[amenazaIdCaido];
        agregarLogEvento({
            turno: JUEGO.turno,
            texto: `⛔ La ruleta cayó en ${AMENAZAS[amenazaIdCaido]?.emoji} <strong>${AMENAZAS[amenazaIdCaido]?.nombre}</strong>, pero <em>${noDispInfo?.razon || 'no aplica aquí'}</em>. Se redirige a <strong>${AMENAZAS[amenazaId]?.nombre}</strong>.`,
            tipo: 'info'
        });
    }

    JUEGO.amenazaId = amenazaId;
    const amenaza = AMENAZAS[amenazaId];

    // Selección de clase según dificultad
    const numClases = amenaza.clases.length;
    let claseIdx;
    if (JUEGO.dificultad === 'facil') {
        claseIdx = 0;
    } else if (JUEGO.dificultad === 'normal') {
        claseIdx = Math.floor(Math.random() * Math.max(numClases - 1, 1));
    } else {
        claseIdx = Math.random() < 0.6
            ? numClases - 1
            : Math.floor(Math.random() * numClases);
    }
    JUEGO.claseIdx = Math.min(claseIdx, numClases - 1);
    const clase = amenaza.clases[JUEGO.claseIdx];

    // ── COMBO DE AMENAZAS (dificultad difícil, 15% de probabilidad) ──
    JUEGO.comboActivo = false;
    JUEGO.comboAmenazaId = null;
    if (JUEGO.dificultad === 'dificil' && Math.random() < 0.15) {
        const otrasDisp = JUEGO.ruletaDisponibles.filter(id => id !== amenazaId);
        if (otrasDisp.length > 0) {
            JUEGO.comboActivo = true;
            JUEGO.comboAmenazaId = otrasDisp[Math.floor(Math.random() * otrasDisp.length)];
            const amenazaCombo = AMENAZAS[JUEGO.comboAmenazaId];
            agregarLogEvento({
                turno: JUEGO.turno,
                texto: `⚠️ <strong>¡DOBLE AMENAZA!</strong> ${amenaza.emoji} ${amenaza.nombre} + ${amenazaCombo.emoji} ${amenazaCombo.nombre} simultáneamente.`,
                tipo: 'peligro'
            });
        }
    }

    // Mostrar resultado
    const resEl = document.getElementById('ruleta-resultado');
    if (resEl) {
        resEl.style.display = 'block';
        const comboHtml = JUEGO.comboActivo ? `<br><span style="color:#f87171;font-weight:700;">⚠️ + ${AMENAZAS[JUEGO.comboAmenazaId].emoji} ${AMENAZAS[JUEGO.comboAmenazaId].nombre} (combo)</span>` : '';
        resEl.innerHTML = `
            <div style="font-size:1.4rem; margin-bottom:.3rem;">${amenaza.emoji}</div>
            <strong style="color:${amenaza.color}">${amenaza.nombre}</strong>
            <span style="color:var(--muted); font-size:.75rem;"> — ${clase.nombre}</span><br>
            <span style="font-size:.72rem; color:var(--muted);">${clase.bonus}</span>
            ${comboHtml}`;
    }

    const historiaEl = document.getElementById('juego-historia-texto');
    if (historiaEl)
        historiaEl.innerHTML = `<em>${amenaza.emoji} ¡${amenaza.nombre}!</em> — ${amenaza.desc}
            <br><span style="font-size:.8rem; color:var(--muted);">Intensidad: ${clase.emoji} ${clase.nombre} · ${clase.bonus}</span>`;

    document.getElementById('btn-activar-amenaza').disabled = false;

    const btnGirar = document.getElementById('btn-girar-ruleta');
    if (btnGirar) {
        btnGirar.disabled = false;
        btnGirar.innerHTML = '🎰 ¡Girar ruleta!';
    }

    const btnRegirar = document.getElementById('btn-regirar');
    if (btnRegirar) {
        const tieneFondos = JUEGO.presupuesto >= 50;
        btnRegirar.style.display = 'block';
        btnRegirar.style.opacity = tieneFondos ? '1' : '0.35';
        btnRegirar.style.cursor = tieneFondos ? 'pointer' : 'not-allowed';
        btnRegirar.title = tieneFondos ? '' : 'Sin fondos suficientes ($50M)';
    }

    agregarLogEvento({
        turno: JUEGO.turno,
        texto: `🎰 Ruleta → ${amenaza.emoji} <strong>${amenaza.nombre}</strong> (${clase.nombre})`,
        tipo: 'info'
    });
}

/* ══════════════════════════════════════════════════════════════
 BACKEND INTEGRATION
 ══════════════════════════════════════════════════════════════ */
async function crearSesionBackend(nombreProvincia) {
    try {
        const res = await fetch('/api/juego/sesiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provincia: nombreProvincia,
                xInicial: JUEGO.xInicial, yInicial: JUEGO.yInicial,
                zInicial: JUEGO.zInicial, maxTurnos: JUEGO.maxTurnos,
            })
        });
        if (res.ok) {
            const data = await res.json();
            JUEGO.sessionId = data.id;
        }
    } catch (e) {
        console.warn('[EcuaSim] Backend no disponible:', e.message);
    }
}
async function guardarTurnoBackend(amenaza, clase, params) {
    if (!JUEGO.sessionId) return;
    try {
        await fetch(`/api/juego/sesiones/${JUEGO.sessionId}/turnos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                turno: JUEGO.turno, amenazaId: amenaza.id, amenazaNombre: amenaza.nombre,
                claseNombre: clase.nombre, nombrePersonalizado: JUEGO.nombre,
                parametros: params, xFinal: JUEGO.xActual, yFinal: JUEGO.yActual, zFinal: JUEGO.zActual,
            })
        });
    } catch (e) {
        console.warn('[EcuaSim] No se pudo guardar turno:', e.message);
    }
}
async function finalizarSesionBackend(veredicto) {
    if (!JUEGO.sessionId) return;
    try {
        await fetch(`/api/juego/sesiones/${JUEGO.sessionId}/finalizar`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ veredicto, xFinal: JUEGO.xActual, yFinal: JUEGO.yActual, zFinal: JUEGO.zActual, turnosJugados: JUEGO.turno })
        });
    } catch (e) {
        console.warn('[EcuaSim] No se pudo finalizar sesión:', e.message);
    }
}
async function guardarDecisionBackend(decision) {
    if (!JUEGO.sessionId) return;
    try {
        await fetch(`/api/juego/sesiones/${JUEGO.sessionId}/decisiones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                turno: JUEGO.turno, decisionId: decision.id,
                decisionNombre: decision.nombre, costo: decision.costo,
                presupuestoRestante: JUEGO.presupuesto,
            })
        });
    } catch (e) {
        console.warn('[EcuaSim] No se pudo guardar decisión:', e.message);
    }
}

/* ══════════════════════════════════════════════════════════════
 RENDER PANEL JUEGO
 ══════════════════════════════════════════════════════════════ */
function renderPanelJuego() {
    const prov = REGIONS[currentProv];
    document.getElementById('juego-prov-nombre').textContent = prov.name;
    document.getElementById('juego-prov-icon').textContent = prov.icon;
    document.getElementById('juego-turno').textContent = `Turno ${JUEGO.turno} / ${JUEGO.maxTurnos}`;
    const pct = (JUEGO.turno / JUEGO.maxTurnos * 100).toFixed(0);
    document.getElementById('juego-progreso-bar').style.width = pct + '%';
}
function renderTarjetasAmenaza() { /* reemplazado por ruleta */ }

/* ══════════════════════════════════════════════════════════════
 SISTEMA DE DECISIONES
 ══════════════════════════════════════════════════════════════ */
const DECISIONES = [
    {
        id: 'hospitales', emoji: '🏥', nombre: 'Desplegar hospitales',
        efecto: 'Reduce mortalidad urbana y periférica 35%',
        explicacion: 'Modifica δX y δY × 0.65 — menos muertes por turno',
        costo: 80,
        aplicar: (pb) => {
            pb.deathX *= 0.65;
            pb.deathY *= 0.65;
        }
    },
    {
        id: 'evacuar', emoji: '🚁', nombre: 'Evacuar zona periférica',
        efecto: 'Reduce la migración de estrés (μ) 45%',
        explicacion: 'Modifica μBase y μStress × 0.55 — menos gente huye de X a Y',
        costo: 60,
        aplicar: (pb) => {
            pb.muBase *= 0.55;
            pb.muStress *= 0.55;
        }
    },
    {
        id: 'recursos', emoji: '💊', nombre: 'Inyectar recursos de emergencia',
        efecto: 'Aumenta la tasa de renovación (r) 60%',
        explicacion: 'Modifica r × 1.60 — Z se regenera más rápido',
        costo: 100,
        aplicar: (pb) => {
            pb.r *= 1.60;
        }
    },
];

/* ══════════════════════════════════════════════════════════════
 ACTIVAR AMENAZA — con soporte para COMBO de amenazas
 ══════════════════════════════════════════════════════════════ */
async function activarAmenaza() {
    if (!JUEGO.amenazaId || JUEGO.claseIdx === null) return;
    if (JUEGO.esperandoDecision) return;

    JUEGO.nombre = AMENAZAS[JUEGO.amenazaId].nombre;
    JUEGO.turno++;
    document.getElementById('juego-turno').textContent = `Turno ${JUEGO.turno} / ${JUEGO.maxTurnos}`;
    document.getElementById('juego-progreso-bar').style.width = (JUEGO.turno / JUEGO.maxTurnos * 100).toFixed(0) + '%';

    const amenaza = AMENAZAS[JUEGO.amenazaId];
    const clase = amenaza.clases[JUEGO.claseIdx];
    const pb = JUEGO.paramsBase;

    // Parámetros para esta amenaza
    const p = construirParams(pb, clase);

    // Si hay combo, fusionar los multiplicadores (promedio ponderado)
    if (JUEGO.comboActivo && JUEGO.comboAmenazaId) {
        const amenazaCombo = AMENAZAS[JUEGO.comboAmenazaId];
        // Clase del combo siempre nivel 0 o 1 (no el peor)
        const claseComboIdx = Math.min(1, amenazaCombo.clases.length - 1);
        const claseCombo = amenazaCombo.clases[claseComboIdx];
        const pCombo = construirParams(pb, claseCombo);

        // Fusión: tomar el peor de cada multiplicador (más restrictivo)
        p.birthX  = Math.min(p.birthX, pCombo.birthX);
        p.deathX  = Math.max(p.deathX, pCombo.deathX);
        p.birthY  = Math.min(p.birthY, pCombo.birthY);
        p.deathY  = Math.max(p.deathY, pCombo.deathY);
        p.muBase  = Math.max(p.muBase, pCombo.muBase);
        p.muStress = Math.max(p.muStress, pCombo.muStress);
        p.tasaConsumo = Math.max(p.tasaConsumo, pCombo.tasaConsumo);
        p.r = Math.min(p.r, pCombo.r);
    }

    // ── RK4 ──
    let x = JUEGO.xActual, y = JUEGO.yActual, z = JUEGO.zActual;
    const h = pb.h, pasos = pb.pasos;
    for (let i = 0; i < pasos; i++) {
        [x, y, z] = rk4Step(x, y, z, h, p);
        x = Math.max(0, x);
        y = Math.max(0, y);
        z = Math.max(0, z);
    }

    // ── EULER ──
    let xE = JUEGO.xActual, yE = JUEGO.yActual, zE = JUEGO.zActual;
    for (let i = 0; i < pasos; i++) {
        [xE, yE, zE] = eulerStep(xE, yE, zE, h, p);
        xE = Math.max(0, xE);
        yE = Math.max(0, yE);
        zE = Math.max(0, zE);
    }
    JUEGO.historialEuler.push({ turno: JUEGO.turno, x: xE, y: yE, z: zE });

    const diffX = Math.abs(x - xE);
    if (diffX > (JUEGO.xInicial * 0.003)) {
        const masOmenos = x > xE ? 'más' : 'menos';
        agregarLogEvento({
            turno: JUEGO.turno,
            texto: `📊 <strong>RK4 vs Euler:</strong> Euler calcularía ${fmtCompacto(diffX)} personas ${masOmenos} en zona urbana.`,
            tipo: 'info'
        });
    }

    const xPrev = JUEGO.xActual, yPrev = JUEGO.yActual, zPrev = JUEGO.zActual;
    JUEGO.xActual = x;
    JUEGO.yActual = y;
    JUEGO.zActual = z;
    JUEGO.historial.push({ turno: JUEGO.turno, x, y, z });

    guardarTurnoBackend(amenaza, clase, p);

    const dX = x - xPrev, dY = y - yPrev, dZ = z - zPrev;
    const pctX = ((dX / (xPrev || 1)) * 100).toFixed(1);
    const pctY = ((dY / (yPrev || 1)) * 100).toFixed(1);
    const pctZ = ((dZ / (zPrev || 1)) * 100).toFixed(1);

    actualizarKPIsJuego(dX, dY, dZ, pctX, pctY, pctZ);

    // Narración
    const narraciones = amenaza.narrativas;
    const narrIdx = Math.min(JUEGO.turno - 1, narraciones.length - 1);
    const historiaEl = document.getElementById('juego-historia-texto');
    if (historiaEl) {
        historiaEl.style.opacity = '0';
        let notaAdicional = '';
        if (amenaza.id === 'pandemia' && (clase.muBaseMul ?? 1) < 1)
            notaAdicional = `<br><span style="font-size:.8rem;color:var(--muted);">🔒 Cuarentena activa — migración restringida.</span>`;
        else if (amenaza.id === 'terremoto' && (clase.rMul ?? 1) < 0.5)
            notaAdicional = `<br><span style="font-size:.8rem;color:var(--muted);">🏗️ Infraestructura destruida — renovación (r) colapsó.</span>`;
        else if (amenaza.id === 'sequia' && (clase.rMul ?? 1) < 0.35)
            notaAdicional = `<br><span style="font-size:.8rem;color:var(--muted);">💧 Sin agua, producción paralizada — r casi en cero.</span>`;
        else if (amenaza.id === 'inundacion')
            notaAdicional = `<br><span style="font-size:.8rem;color:var(--muted);">🌧️ El Niño agrava la situación — enfermedades secundarias posibles.</span>`;
        else if (amenaza.id === 'deslizamiento')
            notaAdicional = `<br><span style="font-size:.8rem;color:var(--muted);">⛰️ Vías cortadas — el aislamiento agrava la crisis.</span>`;

        const comboNota = JUEGO.comboActivo
            ? `<br><span style="color:#f87171; font-size:.8rem;">⚠️ COMBO activo con ${AMENAZAS[JUEGO.comboAmenazaId]?.emoji} ${AMENAZAS[JUEGO.comboAmenazaId]?.nombre}</span>`
            : '';
        setTimeout(() => {
            historiaEl.innerHTML = `<em>${amenaza.emoji} Turno ${JUEGO.turno}</em> — ${narraciones[narrIdx]}${notaAdicional}${comboNota}`;
            historiaEl.style.opacity = '1';
        }, 200);
    }

    agregarLogEvento({
        turno: JUEGO.turno,
        texto: `${amenaza.emoji} <strong>${JUEGO.nombre}</strong> (${clase.nombre}) · X ${dX >= 0 ? '▲' : '▼'}${Math.abs(pctX)}% · Y ${dY >= 0 ? '▲' : '▼'}${Math.abs(pctY)}% · Z ${dZ >= 0 ? '▲' : '▼'}${Math.abs(pctZ)}%`,
        tipo: dZ < -(zPrev * 0.08) ? 'peligro' : 'ok'
    });

    dispararEfectoPersonas(amenaza, dZ, zPrev);
    renderMiniChart();

    document.getElementById('btn-activar-amenaza').disabled = true;
    const btnGirar = document.getElementById('btn-girar-ruleta');
    if (btnGirar) btnGirar.disabled = true;

    // ── CHECK EXTINCIÓN POBLACIONAL (umbral 20%) ──
    const poblacionTotal = JUEGO.xActual + JUEGO.yActual;
    const poblacionInicial = JUEGO.xInicial + JUEGO.yInicial;
    const fraccionPob = poblacionTotal / (poblacionInicial || 1);

    if (fraccionPob < 0.20) {
        setTimeout(() => mostrarVeredictoExtincion(), 900);
        return;
    }

    // Advertencia de crisis demográfica (20–35%)
    if (fraccionPob < 0.35) {
        agregarLogEvento({
            turno: JUEGO.turno,
            texto: `☠️ <strong>CRISIS DEMOGRÁFICA</strong> — Solo queda el ${(fraccionPob * 100).toFixed(1)}% de la población. El 20% es el umbral de colapso.`,
            tipo: 'peligro'
        });
        if (historiaEl) {
            setTimeout(() => {
                historiaEl.innerHTML += `<br><span style="color:#f87171; font-weight:700; font-size:.85rem;">
                    ⚠️ Crisis demográfica — ${(fraccionPob * 100).toFixed(1)}% de población restante (colapso al 20%).</span>`;
            }, 600);
        }
    }

    if (JUEGO.turno >= JUEGO.maxTurnos) {
        setTimeout(() => {
            if (fraccionPob < 0.20) {
                mostrarVeredictoExtincion();
            } else {
                mostrarVeredictoFinal();
            }
        }, 1000);
    } else {
        const K = pb.K;
        const zFrac = z / K;
        if (zFrac < 0.2 && dZ < 0)
            setTimeout(() => mostrarEventoDramatico(amenaza, zFrac), 800);
        setTimeout(() => mostrarDecisiones(amenaza, clase, p, dX, dY, dZ), 1200);
    }
}

/* ══════════════════════════════════════════════════════════════
 Construir parámetros para una clase de amenaza
 ══════════════════════════════════════════════════════════════ */
function construirParams(pb, clase) {
    return {
        birthX: pb.birthX * (clase.birthXMul ?? 1),
        deathX: pb.deathX * (clase.deathXMul ?? 1),
        birthY: pb.birthY * (clase.birthYMul ?? 1),
        deathY: pb.deathY * (clase.deathYMul ?? 1),
        muBase: pb.muBase * (clase.muBaseMul ?? 1),
        muStress: pb.muStress * (clase.muStressMul ?? 1),
        nuBase: pb.nuBase,
        tasaConsumo: pb.tasaConsumo * (clase.consumoMul ?? 1),
        r: pb.r * Math.max(0.10, clase.rMul ?? 1),
        K: pb.K,
    };
}

/* ══════════════════════════════════════════════════════════════
 DECISIONES POST-TURNO
 ══════════════════════════════════════════════════════════════ */
function mostrarDecisiones(amenaza, clase, params, dX, dY, dZ) {
    JUEGO.esperandoDecision = true;
    const sec = document.getElementById('juego-decision-section');
    sec.style.display = 'block';

    const K = JUEGO.paramsBase?.K || 1000;
    const zFrac = JUEGO.zActual / K;
    const zColor = zFrac > 0.5 ? '#4ade80' : zFrac > 0.25 ? '#fbbf24' : '#f87171';

    document.getElementById('decision-intro').innerHTML = `
        <div style="margin-bottom:.8rem; padding:.7rem .9rem; background:var(--surface); border-radius:10px; border-left:3px solid ${zColor};">
            <strong>${amenaza.emoji} La ${JUEGO.nombre} acaba de golpear.</strong><br>
            Z (recursos) ahora está en <strong style="color:${zColor}">${(zFrac * 100).toFixed(0)}%</strong> de capacidad.
            ${dZ < 0 ? `Cayó ${fmtCompacto(Math.abs(dZ))} unidades este turno.` : `Subió ${fmtCompacto(dZ)} unidades.`}
        </div>
        <div style="font-size:.78rem; color:var(--muted);">
            💰 Presupuesto: <strong style="color:#4ade80">$${JUEGO.presupuesto}M</strong> ·
            Elige una acción para el próximo turno:
        </div>`;

    const cont = document.getElementById('decision-cards');
    cont.innerHTML = '';
    DECISIONES.forEach(d => {
        const sinFondos = JUEGO.presupuesto < d.costo;
        const card = document.createElement('div');
        card.className = 'decision-card' + (sinFondos ? ' decision-disabled' : '');
        card.innerHTML = `
            <div class="decision-emoji">${d.emoji}</div>
            <div class="decision-info">
                <div class="decision-nombre">${d.nombre}</div>
                <div class="decision-efecto">${d.efecto}</div>
                <div class="decision-math">${d.explicacion}</div>
            </div>
            <div class="decision-costo" style="${sinFondos ? 'color:#f87171' : ''}">
                -$${d.costo}M${sinFondos ? '<br><span style="font-size:.6rem">Sin fondos</span>' : ''}
            </div>`;
        if (!sinFondos) card.onclick = () => aplicarDecision(d);
        cont.appendChild(card);
    });
}

function aplicarDecision(decision) {
    decision.aplicar(JUEGO.paramsBase);
    JUEGO.presupuesto -= decision.costo;
    actualizarPresupuestoUI();
    guardarDecisionBackend(decision);
    const efectoParam = {
        hospitales: `δX: ${JUEGO.paramsBase.deathX.toFixed(5)} | δY: ${JUEGO.paramsBase.deathY.toFixed(5)}`,
        evacuar: `μBase: ${JUEGO.paramsBase.muBase.toFixed(5)} | μStress: ${JUEGO.paramsBase.muStress.toFixed(5)}`,
        recursos: `r: ${JUEGO.paramsBase.r.toFixed(5)}`,
    }[decision.id] || '';
    agregarLogEvento({
        turno: JUEGO.turno,
        texto: `${decision.emoji} <strong>${decision.nombre}</strong> aplicada (-$${decision.costo}M)<br>
                <span style="font-size:.72rem; color:var(--muted);">→ ${efectoParam}</span>`,
        tipo: 'ok'
    });
    cerrarPanelDecision();
}

function saltarDecision() {
    agregarLogEvento({ turno: JUEGO.turno, texto: `⏭️ Sin acción este turno. Las EDOs siguen su curso natural.`, tipo: 'info' });
    cerrarPanelDecision();
}

function cerrarPanelDecision() {
    document.getElementById('juego-decision-section').style.display = 'none';
    JUEGO.esperandoDecision = false;
    JUEGO.amenazaId = null;
    JUEGO.claseIdx = null;
    JUEGO.comboActivo = false;
    JUEGO.comboAmenazaId = null;

    const resEl = document.getElementById('ruleta-resultado');
    if (resEl) resEl.style.display = 'none';

    const btnRegirar = document.getElementById('btn-regirar');
    if (btnRegirar) btnRegirar.style.display = 'none';

    document.getElementById('btn-activar-amenaza').disabled = true;

    const btnGirar = document.getElementById('btn-girar-ruleta');
    if (btnGirar) {
        btnGirar.disabled = false;
        btnGirar.innerHTML = '🎰 ¡Girar ruleta!';
    }
    dibujarRuleta(JUEGO.ruletaAngle);
}

/* ══════════════════════════════════════════════════════════════
 KPIs DEL JUEGO
 ══════════════════════════════════════════════════════════════ */
function actualizarKPIsJuego(dX, dY, dZ, pctX, pctY, pctZ) {
    const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n).toString();
    ['x', 'y', 'z'].forEach(k => {
        const el = document.getElementById(`j-kpi-${k}`);
        const card = el?.parentElement;
        if (el) el.textContent = fmt(JUEGO[`${k}Actual`]);
        if (card) {
            card.classList.remove('pulsing');
            void card.offsetWidth;
            card.classList.add('pulsing');
            setTimeout(() => card.classList.remove('pulsing'), 700);
        }
    });
    if (dX !== undefined) {
        setDelta('j-delta-x', pctX);
        setDelta('j-delta-y', pctY);
        setDelta('j-delta-z', pctZ);
    }
    const K = JUEGO.paramsBase?.K || 1000;
    const zFrac = JUEGO.zActual / K;
    const barColor = zFrac > 0.6 ? '#4ade80' : zFrac > 0.3 ? '#fbbf24' : '#f87171';
    const bar = document.getElementById('j-z-bar');
    if (bar) {
        bar.style.width = Math.min(100, zFrac * 100).toFixed(1) + '%';
        bar.style.background = barColor;
    }
    const estadoEl = document.getElementById('j-estado');
    if (estadoEl) {
        if (zFrac > 0.6) {
            estadoEl.textContent = '🟢 Sistema estable';
            estadoEl.style.color = '#4ade80';
        } else if (zFrac > 0.3) {
            estadoEl.textContent = '🟡 Estrés de recursos';
            estadoEl.style.color = '#fbbf24';
        } else {
            estadoEl.textContent = '🔴 Crisis crítica';
            estadoEl.style.color = '#f87171';
        }
    }

    // Indicador de población
    const pobFrac = (JUEGO.xActual + JUEGO.yActual) / (JUEGO.xInicial + JUEGO.yInicial || 1);
    const pobEl = document.getElementById('j-pob-indicador');
    if (pobEl) {
        const color = pobFrac > 0.6 ? '#4ade80' : pobFrac > 0.35 ? '#fbbf24' : '#f87171';
        pobEl.innerHTML = `👥 Población: <strong style="color:${color}">${(pobFrac * 100).toFixed(1)}%</strong>
            <span style="font-size:.7rem; color:var(--muted);">(colapso al 20%)</span>`;
    }
}

function setDelta(id, pct) {
    const el = document.getElementById(id);
    if (!el) return;
    const num = parseFloat(pct);
    el.textContent = (num >= 0 ? '▲ +' : '▼ ') + Math.abs(pct) + '%';
    el.className = 'j-kpi-delta ' + (num >= 0 ? 'up' : 'down');
}

/* ══════════════════════════════════════════════════════════════
 LOG DE EVENTOS
 ══════════════════════════════════════════════════════════════ */
function agregarLogEvento(ev) {
    JUEGO.logEventos.unshift(ev);
    renderLogEventos(JUEGO.logEventos);
}
function renderLogEventos(eventos) {
    const el = document.getElementById('juego-log');
    if (!el) return;
    el.innerHTML = eventos.map(ev => `
        <div class="log-item log-${ev.tipo || 'info'}">
            <span class="log-turno">T${ev.turno}</span>
            <span>${ev.texto}</span>
        </div>`).join('');
}

/* ══════════════════════════════════════════════════════════════
 MINI CHART
 ══════════════════════════════════════════════════════════════ */
function renderMiniChart() {
    const canvas = document.getElementById('juego-mini-chart');
    if (!canvas || JUEGO.historial.length < 1) return;
    document.getElementById('juego-chart-section').style.display = 'block';
    const placeholder = document.getElementById('juego-chart-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    const labels = ['Inicio', ...JUEGO.historial.map(h => `T${h.turno}`)];
    const base = { x: JUEGO.xInicial, y: JUEGO.yInicial, z: JUEGO.zInicial };
    const dsX = [base.x, ...JUEGO.historial.map(h => h.x)];
    const dsY = [base.y, ...JUEGO.historial.map(h => h.y)];
    const dsZ = [base.z, ...JUEGO.historial.map(h => h.z)];
    const mostrarEuler = document.getElementById('toggle-euler')?.checked;
    const dsXe = mostrarEuler ? [base.x, ...JUEGO.historialEuler.map(h => h.x)] : null;
    const dsYe = mostrarEuler ? [base.y, ...JUEGO.historialEuler.map(h => h.y)] : null;
    const dsZe = mostrarEuler ? [base.z, ...JUEGO.historialEuler.map(h => h.z)] : null;

    if (JUEGO.miniChart) JUEGO.miniChart.destroy();
    const isDark = !document.documentElement.classList.contains('light');
    const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
    const tickColor = isDark ? '#6b8098' : '#94a3b8';
    const baseFont = { family: "'Space Grotesk', monospace", size: 9 };
    const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : Math.round(v);

    const datasets = [
        { label: 'X Urbana (RK4)', data: dsX, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,.08)', borderWidth: 2, pointRadius: 4, tension: .35, fill: true },
        { label: 'Y Periférica (RK4)', data: dsY, borderColor: '#fb923c', backgroundColor: 'rgba(251,146,60,.08)', borderWidth: 2, pointRadius: 4, tension: .35, fill: true },
        { label: 'Z Recursos (RK4)', data: dsZ, borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,.08)', borderWidth: 2, pointRadius: 4, tension: .35, fill: true },
    ];
    if (mostrarEuler) {
        datasets.push(
            { label: 'X Urbana (Euler)', data: dsXe, borderColor: 'rgba(0,212,255,.5)', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 2, tension: .35, fill: false },
            { label: 'Y Periférica (Euler)', data: dsYe, borderColor: 'rgba(251,146,60,.5)', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 2, tension: .35, fill: false },
            { label: 'Z Recursos (Euler)', data: dsZe, borderColor: 'rgba(74,222,128,.5)', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 2, tension: .35, fill: false },
        );
    }
    JUEGO.miniChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            animation: { duration: 600, easing: 'easeInOutQuart' },
            plugins: {
                legend: { labels: { color: tickColor, font: baseFont, boxWidth: 8, padding: 10 } },
                tooltip: {
                    backgroundColor: isDark ? '#1a2d45' : '#fff',
                    titleColor: isDark ? '#e2e8f0' : '#1a202c',
                    bodyColor: tickColor, borderColor: isDark ? '#2d4a6e' : '#e2e8f0', borderWidth: 1,
                    callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` }
                }
            },
            scales: {
                x: { ticks: { color: tickColor, font: baseFont }, grid: { color: gridColor } },
                y: { ticks: { color: tickColor, font: baseFont, callback: fmt }, grid: { color: gridColor } }
            }
        }
    });
}

/* ══════════════════════════════════════════════════════════════
 EVENTO DRAMÁTICO
 ══════════════════════════════════════════════════════════════ */
function mostrarEventoDramatico(amenaza, zFrac) {
    const modal = document.getElementById('juego-evento-dramatico');
    if (!modal) return;
    const msgs = [
        { emoji: '⚠️', titulo: '¡Crisis de recursos!', texto: `Los recursos han caído por debajo del 20%. Las EDOs muestran una espiral de consumo acelerada.`, color: '#f87171' },
        { emoji: '🚨', titulo: '¡Alerta máxima!', texto: `El sistema está al borde del colapso. El consumo supera la renovación.`, color: '#f97316' },
    ];
    const m = msgs[Math.floor(Math.random() * msgs.length)];
    modal.querySelector('.drama-emoji').textContent = m.emoji;
    modal.querySelector('.drama-titulo').textContent = m.titulo;
    modal.querySelector('.drama-titulo').style.color = m.color;
    modal.querySelector('.drama-texto').textContent = m.texto;
    modal.querySelector('.drama-btn').style.background = m.color;
    modal.querySelector('.drama-box').style.borderColor = m.color;
    modal.style.display = 'flex';
}
function cerrarEventoDramatico() {
    const modal = document.getElementById('juego-evento-dramatico');
    if (modal) modal.style.display = 'none';
}

/* ══════════════════════════════════════════════════════════════
 CANVAS GLOBAL — personitas
 ══════════════════════════════════════════════════════════════ */
const PROV_ZONAS_VB = {
    GY: { cx: 548, cy: 190, radio: 38, color: '#00d4ff', n: 18 },
    PI: { cx: 610, cy: 82, radio: 28, color: '#fb923c', n: 14 },
    PA: { cx: 720, cy: 185, radio: 42, color: '#4ade80', n: 10 },
};
const VB = { x: 450, y: 60, w: 340, h: 210 };

function montarCanvasGlobal() {
    const wrap = document.getElementById('juego-mapa-wrap');
    if (!wrap) return;
    const prev = document.getElementById('juego-global-canvas');
    if (prev) prev.remove();
    const canvas = document.createElement('canvas');
    canvas.id = 'juego-global-canvas';
    canvas.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;`;
    wrap.style.position = 'relative';
    wrap.appendChild(canvas);
    JUEGO.globalCanvas = canvas;
    JUEGO.globalCtx = canvas.getContext('2d');
    redimensionarCanvasGlobal();
    window.addEventListener('resize', redimensionarCanvasGlobal);
    crearPersonitas();
    detenerAnimacion();
    animarPersonitas();
}
function redimensionarCanvasGlobal() {
    const canvas = JUEGO.globalCanvas;
    const wrap = document.getElementById('juego-mapa-wrap');
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    actualizarReferenciaSVG();
}
function actualizarReferenciaSVG() {
    const svg = document.getElementById('juego-mapa-svg');
    const wrap = document.getElementById('juego-mapa-wrap');
    if (!svg || !wrap) return;
    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    JUEGO.svgRect = { left: svgRect.left - wrapRect.left, top: svgRect.top - wrapRect.top, width: svgRect.width, height: svgRect.height };
}
function vbToCanvas(vbX, vbY) {
    if (!JUEGO.svgRect) return { x: 0, y: 0 };
    const sr = JUEGO.svgRect;
    const scX = sr.width / VB.w, scY = sr.height / VB.h;
    return { x: sr.left + (vbX - VB.x) * scX, y: sr.top + (vbY - VB.y) * scY };
}
function crearPersonitas() {
    JUEGO.personas = [];
    JUEGO.particulas = [];
    actualizarReferenciaSVG();
    const zona = PROV_ZONAS_VB[currentProv];
    if (!zona) return;
    const centro = vbToCanvas(zona.cx, zona.cy);
    const sr = JUEGO.svgRect || { width: 200, height: 150 };
    const radio = zona.radio * (sr.width / VB.w);
    for (let i = 0; i < zona.n; i++)
        JUEGO.personas.push(crearPersona(centro.x, centro.y, radio, zona.color, i, zona.n));
}
function crearPersona(cx, cy, radio, colorBase, idx, total) {
    const angle = (idx / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = (0.2 + Math.random() * 0.6) * radio;
    const colores = [colorBase, '#fbbf24', '#c084fc', '#f87171', '#60a5fa'];
    const color = colores[idx % colores.length];
    return {
        x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
        homeX: cx + Math.cos(angle) * dist, homeY: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        radio, cx, cy, color,
        size: 5 + Math.random() * 3, fase: Math.random() * Math.PI * 2,
        velocidad: 0.5 + Math.random() * 0.5,
        estado: 'normal', targetX: 0, targetY: 0,
        opacidad: 0.85 + Math.random() * 0.15,
        sombrerito: Math.random() > 0.6,
    };
}
function animarPersonitas() {
    const canvas = JUEGO.globalCanvas, ctx = JUEGO.globalCtx;
    if (!canvas || !ctx) return;
    const t = performance.now() / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const panelW = canvas.width, panelH = canvas.height;
    JUEGO.personas.forEach(p => {
        if (p.estado === 'huyendo') {
            const dx = p.targetX - p.x, dy = p.targetY - p.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 2) { p.vx += (dx / d) * 0.35; p.vy += (dy / d) * 0.35; }
            p.vx *= 0.92; p.vy *= 0.92;
            p.x += p.vx; p.y += p.vy;
            p.x = Math.max(6, Math.min(panelW - 6, p.x));
            p.y = Math.max(6, Math.min(panelH - 6, p.y));
        } else if (p.estado === 'panico') {
            p.x += (Math.random() - 0.5) * 3;
            p.y += (Math.random() - 0.5) * 3;
            p.x = Math.max(6, Math.min(panelW - 6, p.x));
            p.y = Math.max(6, Math.min(panelH - 6, p.y));
        } else {
            p.x += p.vx; p.y += p.vy;
            const dx = p.x - p.homeX, dy = p.y - p.homeY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > p.radio * 0.7) { p.vx -= dx * 0.004; p.vy -= dy * 0.004; }
            p.vx *= 0.97; p.vy *= 0.97;
        }
        dibujarPersonita(ctx, p, t);
    });
    JUEGO.particulas = JUEGO.particulas.filter(p => p.vida > 0);
    JUEGO.particulas.forEach(p => {
        ctx.save();
        ctx.globalAlpha = (p.vida / p.vidaMax) * 0.9;
        ctx.font = `${p.size}px serif`;
        ctx.fillText(p.emoji, p.x, p.y);
        p.y -= p.vy; p.x += p.vx; p.vy *= 0.97; p.vida--;
        ctx.restore();
    });
    JUEGO.animFrameId = requestAnimationFrame(animarPersonitas);
}
function dibujarPersonita(ctx, p, t) {
    const s = p.size, x = p.x;
    const bouncY = (p.estado === 'normal') ? Math.sin(t * 2 * p.velocidad + p.fase) * 0.8 : 0;
    const y = p.y + bouncY;
    ctx.save();
    ctx.globalAlpha = p.opacidad;
    ctx.shadowColor = p.color + '44';
    ctx.shadowBlur = 4;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(x, y + s * 1.1, s * 0.6, s * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - s * 0.1, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    const eyeColor = p.estado === 'panico' ? '#f87171' : '#fff';
    const eyeSize = p.estado === 'panico' ? s * 0.18 : s * 0.13;
    ctx.fillStyle = eyeColor;
    ctx.beginPath(); ctx.arc(x - s * 0.18, y - s * 0.15, eyeSize, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.18, y - s * 0.15, eyeSize, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(x - s * 0.18, y - s * 0.15, eyeSize * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.18, y - s * 0.15, eyeSize * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.estado === 'panico' ? '#f87171' : '#fff';
    ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
    ctx.beginPath();
    if (p.estado === 'panico' || p.estado === 'huyendo')
        ctx.arc(x, y + s * 0.05, s * 0.2, 0, Math.PI, false);
    else
        ctx.arc(x, y - s * 0.05, s * 0.2, 0, Math.PI);
    ctx.stroke();
    if (p.sombrerito) {
        ctx.fillStyle = ajustarColor(p.color, -30);
        ctx.beginPath();
        ctx.ellipse(x, y - s * 0.6, s * 0.6, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - s * 0.35, y - s * 1.1, s * 0.7, s * 0.5);
    }
    const armSwing = p.estado === 'normal' ? Math.sin(t * 2 * p.velocidad + p.fase + Math.PI / 2) * 0.4 : (p.estado === 'panico' ? Math.sin(t * 8) * 0.8 : 0.6);
    ctx.strokeStyle = p.color; ctx.lineWidth = s * 0.18; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - s * 0.55, y + s * 0.5); ctx.lineTo(x - s * 0.9, y + s * 0.5 - armSwing * s * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.55, y + s * 0.5); ctx.lineTo(x + s * 0.9, y + s * 0.5 + armSwing * s * 0.4); ctx.stroke();
    const legAngle = p.estado === 'huyendo' ? Math.sin(t * 8 + p.fase) * 0.6 : Math.sin(t * 2 * p.velocidad + p.fase) * 0.25;
    ctx.lineWidth = s * 0.18;
    ctx.beginPath(); ctx.moveTo(x - s * 0.25, y + s * 1.7); ctx.lineTo(x - s * 0.25 - legAngle * s, y + s * 2.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.25, y + s * 1.7); ctx.lineTo(x + s * 0.25 + legAngle * s, y + s * 2.4); ctx.stroke();
    ctx.restore();
}
function ajustarColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
    return `rgb(${r},${g},${b})`;
}
function dispararEfectoPersonas(amenaza, dZ, zPrev) {
    if (!JUEGO.globalCanvas) return;
    actualizarReferenciaSVG();
    const zona = PROV_ZONAS_VB[currentProv];
    if (!zona) return;
    const centro = vbToCanvas(zona.cx, zona.cy);
    const sr = JUEGO.svgRect || { width: 200, height: 150 };
    const radio = zona.radio * (sr.width / VB.w);
    for (let i = 0; i < 14; i++) {
        const angle = Math.random() * Math.PI * 2, dist = Math.random() * radio;
        JUEGO.particulas.push({
            emoji: amenaza.emoji,
            x: centro.x + Math.cos(angle) * dist, y: centro.y + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 1.2, vy: 1.5 + Math.random() * 2,
            size: 12 + Math.random() * 8, vida: 80 + Math.floor(Math.random() * 40), vidaMax: 120,
        });
    }
    const K = JUEGO.paramsBase?.K || 1000;
    const zFrac = JUEGO.zActual / K;
    const severidad = Math.abs(dZ) / (Math.max(zPrev, 1));
    const panelW = JUEGO.globalCanvas.width, panelH = JUEGO.globalCanvas.height;
    if (severidad > 0.05 || zFrac < 0.5) {
        const fracHuir = Math.min(0.9, severidad * 2 + (1 - zFrac) * 0.5);
        const nHuir = Math.floor(JUEGO.personas.length * fracHuir);
        JUEGO.personas.forEach((p, i) => {
            if (i < nHuir) {
                p.estado = 'huyendo';
                const edge = Math.floor(Math.random() * 4);
                switch (edge) {
                    case 0: p.targetX = Math.random() * panelW; p.targetY = 10; break;
                    case 1: p.targetX = Math.random() * panelW; p.targetY = panelH - 10; break;
                    case 2: p.targetX = 10; p.targetY = Math.random() * panelH; break;
                    case 3: p.targetX = panelW - 10; p.targetY = Math.random() * panelH; break;
                }
            } else if (i < nHuir + 3) {
                p.estado = 'panico';
            }
        });
        setTimeout(() => {
            JUEGO.personas.forEach(p => {
                if (p.estado === 'huyendo' || p.estado === 'panico') {
                    p.estado = 'normal'; p.vx = 0; p.vy = 0;
                }
            });
        }, 4000 + Math.random() * 2000);
    } else {
        JUEGO.personas.slice(0, 3).forEach(p => {
            p.estado = 'panico';
            setTimeout(() => { p.estado = 'normal'; }, 2000);
        });
    }
}

/* ══════════════════════════════════════════════════════════════
 VEREDICTO FINAL
 ══════════════════════════════════════════════════════════════ */
function mostrarVeredictoFinal() {
    const K = JUEGO.paramsBase?.K || 1000;
    const zFrac = JUEGO.zActual / K;
    const _fracPob = (JUEGO.xActual + JUEGO.yActual) / (JUEGO.xInicial + JUEGO.yInicial || 1);
    const pctX = ((JUEGO.xActual - JUEGO.xInicial) / (JUEGO.xInicial || 1) * 100).toFixed(1);
    const pctY = ((JUEGO.yActual - JUEGO.yInicial) / (JUEGO.yInicial || 1) * 100).toFixed(1);
    const pctZ = ((JUEGO.zActual - JUEGO.zInicial) / (JUEGO.zInicial || 1) * 100).toFixed(1);

    if (_fracPob < 0.20) {
        mostrarVeredictoExtincion();
        return;
    }

    let titulo, emoji, color, desc, veredictoKey;
    if (zFrac > 0.6 && _fracPob > 0.70) {
        emoji = '🏆';
        titulo = 'Sistema resistente';
        color = '#4ade80';
        veredictoKey = 'RESISTENTE';
        desc = `A pesar de ${JUEGO.turno} amenazas, los recursos se mantuvieron sobre el 60% y la población sobre el 70%. Las EDOs encontraron un nuevo equilibrio.`;
    } else if (zFrac > 0.3 && _fracPob > 0.35) {
        emoji = '⚠️';
        titulo = 'Daño significativo';
        color = '#fbbf24';
        veredictoKey = 'DANIO';
        desc = `Las amenazas dejaron huella. Recursos al ${(zFrac * 100).toFixed(0)}%, población al ${(_fracPob * 100).toFixed(0)}%. El sistema sobrevivió pero requiere recuperación.`;
    } else {
        emoji = '💀';
        titulo = 'Colapso sistémico';
        color = '#f87171';
        veredictoKey = 'COLAPSO';
        desc = `Los recursos colapsaron al ${(zFrac * 100).toFixed(0)}% y/o la población cayó al ${(_fracPob * 100).toFixed(0)}% — por debajo de los umbrales de sostenibilidad.`;
    }

    finalizarSesionBackend(veredictoKey);
    if (!JUEGO.capitulosCompletados.includes(JUEGO.capituloActual))
        JUEGO.capitulosCompletados.push(JUEGO.capituloActual);

    const siguienteIdx = JUEGO.capituloActual + 1;
    const haySiguiente = siguienteIdx < CAPITULOS.length;
    const prov = REGIONS[currentProv];
    const el = document.getElementById('juego-veredicto');
    el.innerHTML = `
        <div class="veredicto-box" style="border-color:${color}">
            <div class="veredicto-emoji">${emoji}</div>
            <div class="veredicto-titulo" style="color:${color}">${titulo}</div>
            <div class="veredicto-desc">${desc}</div>
            <div style="font-size:.72rem; color:var(--muted); margin-bottom:1rem;">
                ${prov.icon} ${prov.name} · ${JUEGO.turno} turnos · Dificultad: ${DIFICULTADES[JUEGO.dificultad].emoji} ${DIFICULTADES[JUEGO.dificultad].nombre}
                ${JUEGO.sessionId ? `· <span style="color:var(--muted)">sesión #${JUEGO.sessionId}</span>` : ''}
            </div>
            <div class="veredicto-stats">
                <div class="vstat"><span>ΔX Urbana</span><strong style="color:#00d4ff">${pctX >= 0 ? '+' : ''}${pctX}%</strong></div>
                <div class="vstat"><span>ΔY Periférica</span><strong style="color:#fb923c">${pctY >= 0 ? '+' : ''}${pctY}%</strong></div>
                <div class="vstat"><span>ΔZ Recursos</span><strong style="color:#4ade80">${pctZ >= 0 ? '+' : ''}${pctZ}%</strong></div>
                <div class="vstat"><span>Población final</span><strong style="color:${_fracPob > 0.5 ? '#4ade80' : '#fbbf24'}">${(_fracPob * 100).toFixed(0)}%</strong></div>
            </div>
            ${haySiguiente ? `<button onclick="irSiguienteCapitulo()" class="btn-reiniciar-juego" style="background:${color}; color:#050b14; margin-bottom:.5rem;">
                📖 Siguiente capítulo: ${CAPITULOS[siguienteIdx].titulo.split(' — ')[1] || CAPITULOS[siguienteIdx].titulo} →
            </button>` : ''}
            <button onclick="reiniciarJuego()" class="btn-reiniciar-juego" style="${haySiguiente ? 'background:none; border:1px solid var(--border); color:var(--muted);' : ''}">↺ Jugar de nuevo</button>
        </div>`;
    el.style.display = 'block';
    document.getElementById('btn-activar-amenaza').disabled = true;
    JUEGO.personas.forEach(p => {
        p.estado = zFrac < 0.3 ? 'panico' : 'normal';
    });
}

function irSiguienteCapitulo() {
    document.getElementById('juego-veredicto').style.display = 'none';
    JUEGO.capituloActual = Math.min(JUEGO.capituloActual + 1, CAPITULOS.length - 1);
    abrirModalCapitulos();
}
function reiniciarJuego() {
    document.getElementById('juego-veredicto').style.display = 'none';
    const claseSection = document.getElementById('juego-clase-section');
    if (claseSection) claseSection.style.display = 'none';
    const nombreSection = document.getElementById('juego-nombre-section');
    if (nombreSection) nombreSection.style.display = 'none';
    document.getElementById('juego-chart-section').style.display = 'none';
    if (JUEGO.miniChart) {
        JUEGO.miniChart.destroy();
        JUEGO.miniChart = null;
    }
    detenerAnimacion();
    detenerRuleta();
    const gc = document.getElementById('juego-global-canvas');
    if (gc) gc.remove();
    window.removeEventListener('resize', redimensionarCanvasGlobal);
    inicializarJuego();
}

/* ══════════════════════════════════════════════════════════════
 UTILS
 ══════════════════════════════════════════════════════════════ */
function mostrarAlertaJuego(msg) {
    const el = document.getElementById('juego-alerta');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}
function eulerStep(x, y, z, h, p) {
    const [dx, dy, dz] = derivatives(x, y, z, p);
    return [x + h * dx, y + h * dy, z + h * dz];
}
function fmtCompacto(n) {
    return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n).toString();
}

/* ══════════════════════════════════════════════════════════════
 regirarConCosto
 ══════════════════════════════════════════════════════════════ */
function regirarConCosto() {
    const COSTO = 50;
    if (JUEGO.presupuesto < COSTO) {
        mostrarAlertaJuego(`❌ Sin fondos para volver a girar (necesitas $${COSTO}M)`);
        return;
    }
    if (JUEGO.ruletaGirando || JUEGO.esperandoDecision) return;

    JUEGO.presupuesto -= COSTO;
    actualizarPresupuestoUI();

    agregarLogEvento({
        turno: JUEGO.turno,
        texto: `🔄 Volvió a girar la ruleta (-$${COSTO}M). Presupuesto: $${JUEGO.presupuesto}M`,
        tipo: 'info'
    });

    const resEl = document.getElementById('ruleta-resultado');
    if (resEl) resEl.style.display = 'none';
    const btnRegirar = document.getElementById('btn-regirar');
    if (btnRegirar) btnRegirar.style.display = 'none';

    document.getElementById('btn-activar-amenaza').disabled = true;
    JUEGO.amenazaId = null;
    JUEGO.claseIdx = null;

    girarRuleta();
}

/* ══════════════════════════════════════════════════════════════
 EXTINCIÓN DEMOGRÁFICA (umbral 20%)
 ══════════════════════════════════════════════════════════════ */
function verificarColapsoPoblacional() {
    const total = JUEGO.xActual + JUEGO.yActual;
    const inicial = JUEGO.xInicial + JUEGO.yInicial;
    return total / (inicial || 1) < 0.20;
}

function mostrarVeredictoExtincion() {
    const K = JUEGO.paramsBase?.K || 1000;
    const pctX = ((JUEGO.xActual - JUEGO.xInicial) / (JUEGO.xInicial || 1) * 100).toFixed(1);
    const pctY = ((JUEGO.yActual - JUEGO.yInicial) / (JUEGO.yInicial || 1) * 100).toFixed(1);
    const pctZ = ((JUEGO.zActual / K) * 100).toFixed(0);
    const prov = REGIONS[currentProv];
    const fracPob = (JUEGO.xActual + JUEGO.yActual) / (JUEGO.xInicial + JUEGO.yInicial || 1);

    finalizarSesionBackend('COLAPSO_DEMOGRAFICO');
    if (!JUEGO.capitulosCompletados.includes(JUEGO.capituloActual))
        JUEGO.capitulosCompletados.push(JUEGO.capituloActual);

    const siguienteIdx = JUEGO.capituloActual + 1;
    const haySiguiente = siguienteIdx < CAPITULOS.length;

    const el = document.getElementById('juego-veredicto');
    el.innerHTML = `
        <div class="veredicto-box" style="
            border-color:#dc2626;
            background:linear-gradient(135deg, rgba(220,38,38,.08), rgba(220,38,38,.02));">

            <div style="font-size:3rem; margin-bottom:.3rem; animation: pulse-red 1.5s infinite alternate;">💀</div>

            <div class="veredicto-titulo" style="color:#dc2626; font-size:1.5rem; margin-bottom:.5rem;">
                Colapso Demográfico
            </div>

            <div class="veredicto-desc" style="color:#fca5a5; margin-bottom:.8rem; line-height:1.65;">
                La población cayó al <strong style="color:#fff;">${(fracPob * 100).toFixed(1)}%</strong> del valor inicial —
                por debajo del umbral crítico del 20%.
                No hay suficientes habitantes para sostener la infraestructura ni los servicios básicos.
            </div>

            <div style="
                background:rgba(220,38,38,.12); border:1px solid rgba(220,38,38,.3);
                border-radius:10px; padding:.8rem 1rem; margin-bottom:.9rem;
                font-size:.78rem; line-height:1.7; text-align:left; color:#fca5a5;">
                <div style="font-weight:700; color:#f87171; margin-bottom:.4rem;">
                    📐 ¿Por qué el 20% como umbral?
                </div>
                Con X+Y &lt; 20% del inicial, la EDO de recursos queda:
                <br><code style="background:rgba(0,0,0,.3); padding:2px 6px; border-radius:4px; display:inline-block; margin:.3rem 0;">
                    dZ/dt = r·Z·(1 − Z/K) − c·(X+Y)
                </code><br>
                El consumo <code>c·(X+Y)</code> colapsa, pero la sociedad ya no puede funcionar.
                En sistemas reales (PNUD, CEPAL), una pérdida del 80% de la población
                es un <strong>colapso sistémico irreversible</strong>.
            </div>

            <div style="font-size:.72rem; color:#f87171; margin-bottom:.9rem;">
                ${prov.icon} ${prov.name} · Turno ${JUEGO.turno} ·
                Dificultad: ${DIFICULTADES[JUEGO.dificultad].emoji} ${DIFICULTADES[JUEGO.dificultad].nombre}
                ${JUEGO.sessionId ? `· sesión #${JUEGO.sessionId}` : ''}
            </div>

            <div class="veredicto-stats">
                <div class="vstat"><span>ΔX Urbana</span><strong style="color:#f87171">${pctX}%</strong></div>
                <div class="vstat"><span>ΔY Periférica</span><strong style="color:#f87171">${pctY}%</strong></div>
                <div class="vstat"><span>Z / K (recursos)</span><strong style="color:#fbbf24">${pctZ}%</strong></div>
                <div class="vstat"><span>Población restante</span><strong style="color:#dc2626">${(fracPob*100).toFixed(1)}%</strong></div>
            </div>

            ${haySiguiente ? `
            <button onclick="irSiguienteCapitulo()" class="btn-reiniciar-juego"
                    style="background:#dc2626; color:#fff; margin-bottom:.5rem;">
                📖 Siguiente capítulo →
            </button>` : ''}
            <button onclick="reiniciarJuego()" class="btn-reiniciar-juego"
                    style="${haySiguiente
                        ? 'background:none; border:1px solid var(--border); color:var(--muted);'
                        : 'background:#dc2626; color:#fff;'}">
                ↺ Intentar de nuevo
            </button>
        </div>

        <style>
            @keyframes pulse-red {
                from { text-shadow: 0 0 0px #dc2626; }
                to   { text-shadow: 0 0 18px #dc2626; }
            }
        </style>`;

    el.style.display = 'block';
    document.getElementById('btn-activar-amenaza').disabled = true;
    JUEGO.personas.forEach(p => { p.estado = 'panico'; });

    setTimeout(() => {
        JUEGO.personas.forEach((p, i) => {
            setTimeout(() => { p.opacidad = 0; p.estado = 'normal'; }, i * 120);
        });
    }, 2000);
}