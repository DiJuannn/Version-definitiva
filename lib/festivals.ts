// Guía de festivales para la etapa «Entregar». Lista curada a mano: solo nombre, sitio, época habitual y
// web oficial (enlaces comprobados en septiembre de 2026). NO trae plazos ni precios de inscripción,
// porque cambian cada año: cada ficha remite a la convocatoria oficial y a los buscadores de convocatorias.
// Sin dependencias de servidor: la usa un componente de cliente.

export type FestivalKind = "cortos" | "largos" | "doc";

export type Festival = {
  name: string;
  city: string;
  // Zona que elige la persona (comunidad autónoma o país). «Online» = no depende de un sitio.
  zone: string;
  country: string;
  // Época en la que suele celebrarse (orientativa); null si no se sabe con seguridad.
  when: string | null;
  kinds: FestivalKind[];
  note: string;
  url: string;
};

export const ZONES: { zone: string; country: string }[] = [
  { zone: "Madrid", country: "España" },
  { zone: "Cataluña", country: "España" },
  { zone: "Comunidad Valenciana", country: "España" },
  { zone: "Andalucía", country: "España" },
  { zone: "País Vasco", country: "España" },
  { zone: "Castilla y León", country: "España" },
  { zone: "Castilla-La Mancha", country: "España" },
  { zone: "Aragón", country: "España" },
  { zone: "Asturias", country: "España" },
  { zone: "México", country: "México" },
  { zone: "Colombia", country: "Colombia" },
  { zone: "Perú", country: "Perú" },
  { zone: "Chile", country: "Chile" },
];

export const FESTIVALS: Festival[] = [
  // — España —
  { name: "Cortogenia", city: "Madrid", zone: "Madrid", country: "España", when: "Todo el año (una gala al mes)", kinds: ["cortos"], note: "Festival de cortos con galas mensuales en Madrid.", url: "https://cortogenia.es/" },
  { name: "Alcine", city: "Alcalá de Henares", zone: "Madrid", country: "España", when: "Finales de año", kinds: ["cortos"], note: "Festival de Cine de Alcalá de Henares, con muchísima tradición en cortometraje.", url: "https://alcine.org/" },
  { name: "Sitges Film Festival", city: "Sitges", zone: "Cataluña", country: "España", when: "Octubre", kinds: ["largos", "cortos"], note: "Cine fantástico, terror y ciencia ficción.", url: "https://sitgesfilmfestival.com/" },
  { name: "Filmets Badalona", city: "Badalona", zone: "Cataluña", country: "España", when: "Octubre", kinds: ["cortos"], note: "Uno de los festivales de cortometrajes más veteranos de Europa.", url: "https://www.festivalfilmets.cat/" },
  { name: "Mecal", city: "Barcelona", zone: "Cataluña", country: "España", when: null, kinds: ["cortos"], note: "Cortometrajes y animación.", url: "https://www.mecalbcn.org/" },
  { name: "Centelles en Curt", city: "Centelles (Barcelona)", zone: "Cataluña", country: "España", when: null, kinds: ["cortos"], note: "Festival internacional de cortometrajes.", url: "https://www.centellesencurt.org/" },
  { name: "DocsBarcelona", city: "Barcelona", zone: "Cataluña", country: "España", when: "Primavera", kinds: ["doc"], note: "Cine documental.", url: "https://www.docsbarcelona.com/" },
  { name: "Cinema Jove", city: "Valencia", zone: "Comunidad Valenciana", country: "España", when: "Verano (junio)", kinds: ["cortos", "largos"], note: "Festival de cine joven, con secciones para primeras obras.", url: "https://www.cinemajove.com/" },
  { name: "Mostra de València", city: "Valencia", zone: "Comunidad Valenciana", country: "España", when: "Otoño", kinds: ["largos", "cortos"], note: "Cine del Mediterráneo.", url: "https://lamostradevalencia.com/" },
  { name: "Festival de Málaga", city: "Málaga", zone: "Andalucía", country: "España", when: "Primavera (marzo)", kinds: ["largos", "cortos", "doc"], note: "Cine en español.", url: "https://festivaldemalaga.com/" },
  { name: "Festival de Sevilla", city: "Sevilla", zone: "Andalucía", country: "España", when: "Noviembre", kinds: ["largos", "cortos", "doc"], note: "Festival de Cine Europeo.", url: "https://www.festivalcinesevilla.eu/" },
  { name: "Festival de San Sebastián", city: "San Sebastián", zone: "País Vasco", country: "España", when: "Septiembre", kinds: ["largos", "doc"], note: "El festival más importante de España.", url: "https://www.sansebastianfestival.com/" },
  { name: "ZINEBI", city: "Bilbao", zone: "País Vasco", country: "España", when: "Otoño", kinds: ["cortos", "doc"], note: "Festival internacional de cine documental y cortometraje.", url: "https://zinebi.eus/" },
  { name: "SEMINCI", city: "Valladolid", zone: "Castilla y León", country: "España", when: "Octubre", kinds: ["largos", "cortos", "doc"], note: "Semana Internacional de Cine de Valladolid.", url: "https://www.seminci.com/" },
  { name: "Aguilar Film Festival", city: "Aguilar de Campoo (Palencia)", zone: "Castilla y León", country: "España", when: "Verano", kinds: ["cortos"], note: "Festival internacional de cortometrajes.", url: "https://aguilarfilmfestival.com/" },
  { name: "Abycine", city: "Albacete", zone: "Castilla-La Mancha", country: "España", when: "Otoño", kinds: ["cortos", "largos"], note: "Cine independiente.", url: "https://www.abycine.com/" },
  { name: "Huesca Film Festival", city: "Huesca", zone: "Aragón", country: "España", when: "Junio", kinds: ["cortos"], note: "Festival internacional de cine, muy centrado en el cortometraje.", url: "https://www.huesca-filmfestival.com/" },
  { name: "FICX Gijón", city: "Gijón", zone: "Asturias", country: "España", when: "Noviembre", kinds: ["largos", "cortos"], note: "Cine de autor y primeras obras.", url: "https://www.gijonfilmfestival.com/" },
  // — Latinoamérica —
  { name: "Festival Internacional de Cine en Guadalajara", city: "Guadalajara", zone: "México", country: "México", when: "Junio", kinds: ["largos", "cortos", "doc"], note: "El gran festival de cine iberoamericano de México.", url: "https://ficg.mx/" },
  { name: "Morelia Film Festival", city: "Morelia", zone: "México", country: "México", when: "Octubre", kinds: ["cortos", "largos", "doc"], note: "Festival internacional de cine de Morelia.", url: "https://moreliafilmfest.com/" },
  { name: "FICCI", city: "Cartagena de Indias", zone: "Colombia", country: "Colombia", when: "Primavera (marzo)", kinds: ["largos", "cortos", "doc"], note: "Festival Internacional de Cine de Cartagena.", url: "https://www.ficcifestival.com/" },
  { name: "Festival de Cine de Lima", city: "Lima", zone: "Perú", country: "Perú", when: "Agosto", kinds: ["largos", "cortos"], note: "Con su propia sección de cortometrajes (Filmocorto).", url: "https://www.festivaldelima.com/" },
  { name: "SANFIC", city: "Santiago", zone: "Chile", country: "Chile", when: "Agosto", kinds: ["largos", "doc"], note: "Santiago Festival Internacional de Cine.", url: "https://sanfic.com/" },
];

// No dependen del sitio.
export const ONLINE_FESTIVALS: Festival[] = [
  { name: "Notodofilmfest", city: "Online", zone: "Online", country: "Online", when: null, kinds: ["cortos"], note: "Festival de cortos por internet, creado por Javier Fesser.", url: "https://www.notodofilmfest.com/" },
];

// Donde se inscriben la mayoría de los cortos: enseñan las convocatorias abiertas con su plazo.
export const SUBMISSION_PLATFORMS = [
  { name: "Festhome", note: "Plataforma española: busca festivales con la convocatoria abierta y envía tu corto.", url: "https://festhome.com/" },
  { name: "FilmFreeway", note: "La plataforma más usada en todo el mundo, sobre todo para festivales internacionales.", url: "https://filmfreeway.com/" },
];

// Tipo de proyecto (el de «Datos del proyecto») → qué festivales encajan. Sin tipo claro, todos.
export function kindsForProjectType(type: string | null): FestivalKind[] | null {
  switch (type) {
    case "Cortometraje":
      return ["cortos"];
    case "Largometraje":
      return ["largos"];
    case "Documental":
      return ["doc", "cortos"];
    default:
      return null;
  }
}

export function festivalsFor(zone: string | null, kinds: FestivalKind[] | null) {
  const fits = (f: Festival) => !kinds || f.kinds.some((k) => kinds.includes(k));
  const country = ZONES.find((z) => z.zone === zone)?.country ?? null;
  const all = FESTIVALS.filter(fits);
  return {
    inZone: zone ? all.filter((f) => f.zone === zone) : [],
    inCountry: country ? all.filter((f) => f.country === country && f.zone !== zone) : [],
    elsewhere: all.filter((f) => f.country !== country),
    online: ONLINE_FESTIVALS.filter(fits),
  };
}
