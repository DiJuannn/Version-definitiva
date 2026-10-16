// «Cómo se usa» de cada herramienta: tres pasos, en el orden en que se hacen.
// Lo enseña la cabecera de la herramienta, plegado.

export const TOOL_GUIDES: Record<string, string[]> = {
  guion: [
    "Sube el guion en PDF y la IA saca escenas, personajes, sitios y objetos. Revisas la propuesta antes de importarla.",
    "O escríbelo en Guiones: se vincula al proyecto y sus escenas pasan aquí con «Sincronizar escenas».",
    "Abre cada escena para completar dónde se rueda y quién sale. Todo lo demás (desglose, planos, plan) sale de aquí.",
  ],
  personajes: [
    "Los personajes salen solos del guion, con las escenas en las que aparecen.",
    "Rellena su ficha (edad, aspecto, vestuario) y añade a los actores del casting.",
    "Asigna un actor a cada personaje: así la hoja de llamada sabe a quién citar cada día.",
  ],
  moodboard: [
    "Arrastra fotos, crea paletas y notas, o pide referencias a la IA a partir del guion.",
    "Toca un número de escena para traerla al tablero y agrupa a su lado lo que le corresponde.",
    "Las referencias que añades en Guiones llegan solas, por escena y por personaje.",
  ],
  desglose: [
    "Elige una escena de la lista y lee su texto.",
    "Selecciona una palabra (una botella, un coche, un chándal) y di qué es: atrezzo, vestuario, vehículo…",
    "En «Lo que hay que conseguir» tienes la lista completa, por categorías, para producción.",
  ],
  planos: [
    "Abre una escena con «Planificar» y empieza por una cobertura (máster, plano/contraplano…) o crea un plano a medida.",
    "Para cada plano elige tamaño, ángulo y movimiento; el dibujo te enseña qué entra en el encuadre.",
    "Apunta qué se oye y cuánto dura: con eso se arma el guion técnico y el plan de rodaje.",
  ],
  tecnico: [
    "Se arma solo con los planos de cada escena, en el orden del guion.",
    "Rellena en cada plano qué se ve, qué se oye y cuánto dura; el tiempo acumulado se suma solo.",
    "Imprímelo para dirección, cámara y script: es el documento que va al rodaje.",
  ],
  storyboard: [
    "Cada plano de la lista tiene su hueco de viñeta.",
    "Sube un dibujo, una foto de referencia o un fotograma, y escribe qué pasa.",
    "Expórtalo en PDF para enseñárselo al equipo o llevarlo al rodaje.",
  ],
  equipo: [
    "Añade a cada persona con su puesto y departamento (o tráela del equipo de la productora).",
    "Guarda su teléfono y correo: aparecen en la hoja de llamada.",
    "Lo verás todo por departamentos, y cada persona aparece en las hojas de llamada.",
  ],
  localizaciones: [
    "Las localizaciones salen de las escenas del guion.",
    "Ponles dirección, contacto y fotos; el mapa te ayuda a ver cuáles quedan cerca.",
    "Sube el permiso de cada sitio y comprueba en qué jornadas del plan se usa.",
  ],
  presupuesto: [
    "Empieza con las categorías típicas o crea las tuyas.",
    "Añade partidas con lo previsto y, cuando pagues, lo gastado.",
    "Vigila el total y expórtalo en PDF o a una hoja de cálculo.",
  ],
  "plan-de-rodaje": [
    "Crea las jornadas con su fecha.",
    "Reparte en cada día los planos que se ruedan (por bloques y en orden): las horas se calculan solas.",
    "Revisa los avisos (cambios de sitio, noches seguidas…) y genera la hoja de llamada del día.",
  ],
  "call-sheets": [
    "Hay una hoja por cada jornada del plan de rodaje; se rellena sola con escenas, reparto y equipo.",
    "Completa la citación general, el sitio y las notas del día.",
    "Compártela con el equipo la víspera.",
  ],
  claqueta: [
    "En el rodaje, abre la claqueta en el móvil o la tableta.",
    "Elige escena y plano: el número de toma sube solo.",
    "Marca la buena y añade una nota; todo va al parte de script y al montaje.",
  ],
  script: [
    "Se rellena solo con lo que se apunta en la claqueta.",
    "Revisa cada toma, su hora y su nota, y marca la buena si no se hizo en rodaje.",
    "Pásaselo a montaje: así sabe qué tomas usar.",
  ],
  vehiculos: [
    "Da de alta los coches y furgonetas de la productora en Recursos › Vehículos.",
    "Resérvalos para cada día en el plan de rodaje.",
    "Aquí ves qué vehículo va cada día y cuáles faltan por reservar.",
  ],
  montaje: [
    "Las tomas buenas de la claqueta aparecen aquí, por escenas, para quien monta.",
    "Lleva el control de las versiones del montaje.",
    "Repasa lo que falta para entregar y copia los créditos finales, ya ordenados.",
  ],
  documentos: [
    "Sube los papeles del proyecto (seguros, permisos, contratos firmados…).",
    "La lista de arriba te dice cuáles faltan antes de rodar.",
    "Aquí también aparece lo que generan las herramientas: guion, hojas de llamada, presupuesto…",
  ],
  "documentos-legales": [
    "Elige la plantilla según el momento: antes de rodar, con cada persona, antes de compartir.",
    "Rellena los huecos; los datos del proyecto ya están puestos.",
    "Descarga el PDF para firmar y súbelo firmado a Archivos.",
  ],
};
