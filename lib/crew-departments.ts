// Departamento de cada persona del equipo técnico, deducido del puesto que
// se escribió a mano («Directora de fotografía», «Gaffer», «Microfonista»…).
// Un solo sitio con las palabras clave: el primer departamento que encaja
// gana, así que el orden importa (p. ej. «dirección de fotografía» tiene que
// caer en Fotografía antes de que «dirección» lo mande a Dirección).

export type CrewDepartment = {
  id: string;
  title: string;
  // ¿Lo echa en falta un rodaje si está vacío?
  essential: boolean;
  keywords: string[];
};

export const CREW_DEPARTMENTS: CrewDepartment[] = [
  {
    id: "fotografia",
    title: "Fotografía y cámara",
    essential: true,
    keywords: ["fotograf", "camara", "camar", "foquista", "operador", "operadora", "steadicam", "dop", "video assist", "auxiliar de camara", "cinematograf"],
  },
  {
    id: "electricos",
    title: "Eléctricos y maquinistas",
    essential: false,
    keywords: ["gaffer", "electric", "iluminac", "maquinist", "grip", "best boy", "luminotec"],
  },
  {
    id: "sonido",
    title: "Sonido",
    essential: true,
    keywords: ["sonido", "microfon", "pertiga", "boom", "sonidist", "mezcla"],
  },
  {
    id: "arte",
    title: "Arte",
    essential: false,
    keywords: ["arte", "atrezz", "attrezz", "escenograf", "decorad", "ambientac", "utiler", "construcc"],
  },
  {
    id: "vestuario",
    title: "Vestuario, maquillaje y peluquería",
    essential: false,
    keywords: ["vestuario", "sastr", "figurin", "maquill", "peluquer", "caracteriz", "efectos de maquillaje"],
  },
  {
    id: "postproduccion",
    title: "Postproducción",
    essential: false,
    keywords: ["montaj", "editor", "edicion", "postpro", "colorista", "etalonaj", "vfx", "efectos visuales", "grafismo", "motion"],
  },
  {
    id: "produccion",
    title: "Producción",
    essential: true,
    keywords: ["produc", "localizac", "location", "runner", "meritori", "catering", "transporte", "conductor", "chofer", "contabl"],
  },
  {
    id: "direccion",
    title: "Dirección",
    essential: true,
    keywords: ["direc", "director", "ayudante de direc", "script", "continuidad", "casting", "guion", "guionist", "1st ad", "2nd ad"],
  },
];

export const OTHER_DEPARTMENT: CrewDepartment = { id: "otros", title: "Otros", essential: false, keywords: [] };

// Orden en el que se presentan, como en unos créditos.
export const DEPARTMENT_ORDER = [
  "direccion",
  "produccion",
  "fotografia",
  "sonido",
  "arte",
  "vestuario",
  "electricos",
  "postproduccion",
  "otros",
];

const normalize = (s: string) =>
  s
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export function departmentFor(role: string | null | undefined): CrewDepartment {
  if (!role) return OTHER_DEPARTMENT;
  const r = normalize(role);
  return CREW_DEPARTMENTS.find((d) => d.keywords.some((k) => r.includes(k))) ?? OTHER_DEPARTMENT;
}
