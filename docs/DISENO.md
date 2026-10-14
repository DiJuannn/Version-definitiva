# Diseño de Taller

Guía corta para que todas las herramientas se vean como una sola. Si algo de
aquí choca con lo que pide una pantalla concreta, gana la claridad para quien
la usa, pero la excepción se razona en un comentario.

## Mesa y papel

- **Marco en negro** (`.taller-ink`): la barra de arriba, los menús y la
  cabecera del proyecto (migas, nombre y pestañas de herramientas).
- **Mesa** (`.taller-desk`, en el `<main>` del panel): oscura pero más suave
  que el marco. Encima va lo que sirve para orientarse: títulos, cifras,
  atajos, navegación, vacíos.
- **Papel** (`.sheet`): lo que se lee o se rellena va en hojas claras (no blanco
  puro, para no deslumbrar): formularios, fichas, tablas y listas de trabajo.
  Es la misma idea que el editor de guiones: la página clara sobre la mesa.
  Dentro de una hoja los tokens pasan solos a la versión clara.
- **Losa** (`.tile`): superficie oscura de la mesa para atajos y resúmenes
  (tarjeta de herramienta, de proyecto). Nunca lleva formularios dentro.

Los colores salen siempre de los tokens (`bg-bg`, `bg-bg-raised`, `text-fg`,
`text-muted`, `border-line`, `text-accent`, `text-success/warn/danger`), que
cambian solos entre mesa y papel. Nada de `bg-black`, `text-white`, `bg-white`
ni colores fijos: se rompen en una de las dos.

Equilibrio: en cada pantalla, la mesa manda y el papel aparece donde está el
trabajo. Una pantalla toda de papel deslumbra; una sin papel no se lee.

## Una sola capa: nada de cuadros sobre cuadros

La regla que más importa.

1. **Nunca una superficie dentro de otra**: ni hoja dentro de hoja, ni losa
   dentro de hoja, ni una caja con borde dentro de cualquiera de ellas.
2. **Dentro de una hoja** se separa con líneas finas (`divide-y divide-line`,
   `border-t border-line`) y con espacio, no con más cajas.
3. **Sobre la mesa**, una sección es: título de sección + contenido. Se separa
   de la siguiente con espacio (`mt-12`/`mt-16`) y, si hace falta, una línea.
4. **Listas = filas**, no tarjetas: `divide-y` dentro de una hoja. Las
   tarjetas sueltas solo para contenido visual (imágenes, viñetas, moodboard,
   portadas) o para atajos (losas).
5. **Estadísticas**: número grande + etiqueta, en fila sobre la mesa, sin caja
   por número.
6. **Avisos** (pendiente, error, consejo): una línea con un punto o una barra
   de color a la izquierda (`border-l-2 border-warn pl-3`), no un recuadro.
7. **Vacíos** (`<EmptyState>`): sobre la mesa, texto centrado + una acción.

Prohibido: `border border-line p-*` como contenedor, `border-dashed` como caja
de vacío, `bg-bg-raised/40` con borde, y cualquier caja-dentro-de-caja.

## Formularios

- **No dejar un formulario grande siempre abierto encima de la lista.** La
  acción de crear es un botón (`btn btn-primary`, arriba a la derecha, en las
  `actions` de `PageHeader`) que abre el formulario: en un `<Modal>`, o
  desplegado en línea dentro de un `<details>` (sin JS) como una hoja. Los
  modales ya son papel.
  Excepción: si la herramienta está vacía, el formulario puede verse directo
  como primer paso.
- **Campos**: clase `.field` (claro en el papel, oscuro en la mesa; borde fino, redondeado, anillo de foco).
  `<FormField label=…>` para la etiqueta. En filas de edición en línea, la
  variante subrayada `.field-line`.
- **Botones**: `btn btn-primary` (morado, la acción principal: una por zona),
  `btn btn-secondary` (negro, acción fuerte secundaria), `btn btn-outline`
  (discreta), `link-action` (texto: Editar, Cancelar). Borrar: `btn-danger` o
  `<DeleteButton>`, siempre con confirmación.
- **Chips** de opción: `<ChipOption>` (pastillas redondeadas). Conmutadores de
  vista: `<ScopeToggle>` (control segmentado).

## Tipografía

- Títulos: `font-display` (Archivo), negrita, mayúsculas solo en el título de
  página (`PageHeader`) y en nombres muy cortos.
- Texto: `font-sans`, 14–15px, `leading-relaxed` en párrafos.
- Etiquetas y datos: `font-mono` 10–11px, `tracking-widest uppercase`
  (`.eyebrow`). Con moderación: no todo es una etiqueta.

## Cabecera de página

`<PageHeader eyebrow title description actions />`. Sin «← Volver» en las
herramientas (la cabecera negra del proyecto ya dice dónde estás); solo en
fichas de detalle, para volver a la lista (`backHref`).

## Menús

Los desplegables del marco usan `.menu-panel` y `.menu-item` (icono, nombre y
una línea de descripción). Las pestañas son texto con una raya de acento bajo
la activa; nunca pastillas con borde.

## Movimiento

Poco y con sentido: un hover que levanta 2px una tarjeta, la aparición de los
menús. Respetar `prefers-reduced-motion`.
