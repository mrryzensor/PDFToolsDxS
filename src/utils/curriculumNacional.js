// Official Curriculum Nacional de la Educación Básica (CNEB - Perú)
// Curated reference database for Areas, Competencies, Capacities, Transversal Competencies and Standards

export const CNEB_AREAS = [
  {
    id: 'matematica',
    name: 'Matemática',
    competencias: [
      {
        id: 'mat_c1',
        name: 'Resuelve problemas de cantidad',
        capacidades: [
          'Traduce cantidades a expresiones numéricas',
          'Comunica su comprensión sobre los números y las operaciones',
          'Usa estrategias y procedimientos de estimación y cálculo',
          'Argumenta afirmaciones sobre las relaciones numéricas y las operaciones',
        ],
      },
      {
        id: 'mat_c2',
        name: 'Resuelve problemas de regularidad, equivalencia y cambio',
        capacidades: [
          'Traduce datos y condiciones a expresiones algebraicas y gráficas',
          'Comunica su comprensión sobre las relaciones algebraicas',
          'Usa estrategias y procedimientos para encontrar equivalencias y reglas generales',
          'Argumenta afirmaciones sobre relaciones de cambio y equivalencia',
        ],
      },
      {
        id: 'mat_c3',
        name: 'Resuelve problemas de forma, movimiento y localización',
        capacidades: [
          'Modela objetos con formas geométricas y sus transformaciones',
          'Comunica su comprensión sobre las formas y relaciones geométricas',
          'Usa estrategias y procedimientos para orientarse en el espacio',
          'Argumenta afirmaciones sobre relaciones geométricas',
        ],
      },
      {
        id: 'mat_c4',
        name: 'Resuelve problemas de gestión de datos e incertidumbre',
        capacidades: [
          'Representa datos con gráficos y medidas estadísticas o probabilísticas',
          'Comunica su comprensión de los conceptos estadísticos y probabilísticos',
          'Usa estrategias y procedimientos para recopilar y procesar datos',
          'Sustenta conclusiones o decisiones con base en la información obtenida',
        ],
      },
    ],
  },
  {
    id: 'comunicacion',
    name: 'Comunicación',
    competencias: [
      {
        id: 'com_c1',
        name: 'Se comunica oralmente en su lengua materna',
        capacidades: [
          'Obtiene información del texto oral',
          'Infiere e interpreta información del texto oral',
          'Adecúa, organiza y desarrolla las ideas de forma coherente y cohesionada',
          'Utiliza recursos no verbales y paraverbales de forma estratégica',
          'Interactúa estratégicamente con distintos interlocutores',
          'Reflexiona y evalúa la forma, el contenido y contexto del texto oral',
        ],
      },
      {
        id: 'com_c2',
        name: 'Lee diversos tipos de textos escritos en su lengua materna',
        capacidades: [
          'Obtiene información del texto escrito',
          'Infiere e interpreta información del texto',
          'Reflexiona y evalúa la forma, el contenido y contexto del texto',
        ],
      },
      {
        id: 'com_c3',
        name: 'Escribe diversos tipos de textos en su lengua materna',
        capacidades: [
          'Adecúa el texto a la situación comunicativa',
          'Organiza y desarrolla las ideas de forma coherente y cohesionada',
          'Utiliza convenciones del lenguaje escrito de forma pertinente',
          'Reflexiona y evalúa la forma, el contenido y contexto del texto escrito',
        ],
      },
    ],
  },
  {
    id: 'ciencia_tecnologia',
    name: 'Ciencia y Tecnología',
    competencias: [
      {
        id: 'cyt_c1',
        name: 'Indaga mediante métodos científicos para construir sus conocimientos',
        capacidades: [
          'Problematiza situaciones para hacer indagación',
          'Diseña estrategias para hacer indagación',
          'Genera y registra datos e información',
          'Analiza datos e información',
          'Evalúa y comunica el proceso y resultados de su indagación',
        ],
      },
      {
        id: 'cyt_c2',
        name: 'Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo',
        capacidades: [
          'Comprende y usa conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo',
          'Evalúa las implicancias del saber y del quehacer científico y tecnológico',
        ],
      },
      {
        id: 'cyt_c3',
        name: 'Diseña y construye soluciones tecnológicas para resolver problemas de su entorno',
        capacidades: [
          'Determina una alternativa de solución tecnológica',
          'Diseña la alternativa de solución tecnológica',
          'Implementa y valida la alternativa de solución tecnológica',
          'Evalúa y comunica el funcionamiento y los impactos de su alternativa de solución tecnológica',
        ],
      },
    ],
  },
  {
    id: 'ciencias_sociales',
    name: 'Ciencias Sociales',
    competencias: [
      {
        id: 'cs_c1',
        name: 'Construye interpretaciones históricas',
        capacidades: [
          'Interpreta críticamente fuentes diversas',
          'Comprende el tiempo histórico',
          'Elabora explicaciones sobre procesos históricos',
        ],
      },
      {
        id: 'cs_c2',
        name: 'Gestiona responsablemente el espacio y el ambiente',
        capacidades: [
          'Comprende las relaciones entre los elementos naturales y sociales',
          'Maneja fuentes de información para comprender el espacio geográfico y el ambiente',
          'Genera acciones para conservar el ambiente local y global',
        ],
      },
      {
        id: 'cs_c3',
        name: 'Gestiona responsablemente los recursos económicos',
        capacidades: [
          'Comprende las relaciones entre los elementos del sistema económico y financiero',
          'Toma decisiones económicas y financieras',
        ],
      },
    ],
  },
  {
    id: 'dpcc',
    name: 'Desarrollo Personal, Ciudadanía y Cívica',
    competencias: [
      {
        id: 'dpcc_c1',
        name: 'Construye su identidad',
        capacidades: [
          'Se valora a sí mismo',
          'Autorregula sus emociones',
          'Reflexiona y argumenta éticamente',
          'Vive su sexualidad de manera integral y responsable de acuerdo a su etapa de desarrollo y madurez',
        ],
      },
      {
        id: 'dpcc_c2',
        name: 'Convive y participa democráticamente en la búsqueda del bien común',
        capacidades: [
          'Interactúa con todas las personas',
          'Construye normas y asume acuerdos y leyes',
          'Maneja conflictos de manera constructiva',
          'Delibera sobre asuntos públicos',
          'Participa en acciones que promueven el bienestar común',
        ],
      },
    ],
  },
  {
    id: 'ingles',
    name: 'Inglés como lengua extranjera',
    competencias: [
      {
        id: 'ing_c1',
        name: 'Se comunica oralmente en inglés como lengua extranjera',
        capacidades: [
          'Obtiene información de textos orales',
          'Infiere e interpreta información de textos orales',
          'Adecúa, organiza y desarrolla las ideas de forma coherente y cohesionada',
          'Utiliza recursos no verbales y paraverbales de forma estratégica',
          'Interactúa estratégicamente con distintos interlocutores',
          'Reflexiona y evalúa la forma, el contenido y el contexto del texto oral en inglés',
        ],
      },
      {
        id: 'ing_c2',
        name: 'Lee diversos tipos de textos en inglés como lengua extranjera',
        capacidades: [
          'Obtiene información del texto escrito en inglés',
          'Infiere e interpreta información del texto en inglés',
          'Reflexiona y evalúa la forma, el contenido y el contexto del texto en inglés',
        ],
      },
      {
        id: 'ing_c3',
        name: 'Escribe diversos tipos de textos en inglés como lengua extranjera',
        capacidades: [
          'Adecúa el texto en inglés a la situación comunicativa',
          'Organiza y desarrolla las ideas en inglés de forma coherente y cohesionada',
          'Utiliza convenciones del lenguaje escrito en inglés de forma pertinente',
          'Reflexiona y evalúa la forma, el contenido y el contexto del texto escrito en inglés',
        ],
      },
    ],
  },
  {
    id: 'educacion_trabajo',
    name: 'Educación para el Trabajo (EPT)',
    competencias: [
      {
        id: 'ept_c1',
        name: 'Gestiona proyectos de emprendimiento económico o social',
        capacidades: [
          'Crea propuestas de valor',
          'Aplica habilidades técnicas',
          'Trabaja cooperativamente para lograr objetivos y metas',
          'Evalúa los resultados del proyecto de emprendimiento',
        ],
      },
    ],
  },
  {
    id: 'arte_cultura',
    name: 'Arte y Cultura',
    competencias: [
      {
        id: 'arte_c1',
        name: 'Aprecia de manera crítica manifestaciones artístico-culturales',
        capacidades: [
          'Percibe manifestaciones artístico-culturales',
          'Contextualiza manifestaciones artístico-culturales',
          'Reflexiona creativa y críticamente sobre manifestaciones artístico-culturales',
        ],
      },
      {
        id: 'arte_c2',
        name: 'Crea proyectos desde los lenguajes artísticos',
        capacidades: [
          'Explora y experimenta los lenguajes del arte',
          'Aplica procesos creativos',
          'Evalúa y comunica sus procesos y proyectos',
        ],
      },
    ],
  },
];

// Transversal Competencies (Standard in every session)
export const COMPETENCIAS_TRANSVERSALES = [
  {
    id: 'trans_1',
    name: 'Se desenvuelve en entornos virtuales generados por las TIC',
    capacidades: [
      'Personaliza entornos virtuales',
      'Gestiona información del entorno virtual',
      'Interactúa en entornos virtuales',
      'Crea objetos virtuales en diversos formatos',
    ],
  },
  {
    id: 'trans_2',
    name: 'Gestiona su aprendizaje de manera autónoma',
    capacidades: [
      'Define metas de aprendizaje',
      'Organiza acciones estratégicas para alcanzar sus metas de aprendizaje',
      'Monitorea y ajusta su desempeño durante el proceso de aprendizaje',
    ],
  },
];

// Enfoques Transversales
export const ENFOQUES_TRANSVERSALES = [
  { id: 'derechos', name: 'Enfoque de Derechos' },
  { id: 'inclusion', name: 'Enfoque Inclusivo o de Atención a la diversidad' },
  { id: 'intercultural', name: 'Enfoque Intercultural' },
  { id: 'genero', name: 'Enfoque Igualdad de Género' },
  { id: 'ambiental', name: 'Enfoque Ambiental' },
  { id: 'orientacion_bien_comun', name: 'Enfoque Orientación al bien común' },
  { id: 'busqueda_excelencia', name: 'Enfoque Búsqueda de la Excelencia' },
];

export const GRADOS_EDUCACION = [
  '1° Grado de Secundaria',
  '2° Grado de Secundaria',
  '3° Grado de Secundaria',
  '4° Grado de Secundaria',
  '5° Grado de Secundaria',
  '1° Grado de Primaria',
  '2° Grado de Primaria',
  '3° Grado de Primaria',
  '4° Grado de Primaria',
  '5° Grado de Primaria',
  '6° Grado de Primaria',
];
