# Dirección visual

**Producto**: Corte, la sala de trabajo interna de una agencia de edición. Tres públicos
con ritmos distintos: coordinación (vista de conjunto), edición (qué hago ahora) y
cliente (revisar y aprobar sin formación). La pieza central es la sala de revisión.

## Idea

El mundo de una sala de montaje: grises fríos, monitores, cinta de carrocero con el número
de versión escrito a mano y el **lápiz graso amarillo** con el que se marcaban los cortes
sobre la película. De ahí sale el único acento del sistema.

## Tokens

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#ECEEF1` | Fondo de la app (gris frío de sala) |
| `--surface` | `#FFFFFF` | Paneles y listas |
| `--ink` | `#14161A` | Texto y acciones primarias |
| `--ink-2 / --ink-3` | `#454C57 / #646C78` | Texto secundario (contraste AA sobre blanco) |
| `--marker` | `#FFD23F` | Lápiz graso: playhead, anotaciones, versión aprobada, foco en la sala. **Nunca** como texto sobre fondo claro |
| `--focus` | `#2F5BEA` | Anillo de foco en la app clara |
| `--c-bg / --c-panel` | `#0A0B0D / #121418` | Sala «cine»: neutro para no teñir la imagen |
| Tonos de estado | info, progreso, atención, éxito, peligro, apagado | Chips de estado con fondo suave |

Estados de corrección en la sala (siempre con texto, nunca solo color):
pendiente `#FFD23F`, en curso `#3DC5CF`, resuelta `#6B9BFF`, verificada `#3DDC97`, descartada gris.

## Tipografía

- **Archivo** (ancho expandido, 700–800) para títulos: recuerda las rotulaciones de equipos y
  claquetas. Solo en títulos de página y cifras destacadas.
- **Instrument Sans** para el cuerpo: legible en tamaños pequeños y densidades altas.
- **JetBrains Mono** para timecodes, versiones y datos tabulares.

## Elemento propio

La **etiqueta de cinta** (`<Tape>`): V1, V2… sobre una tira con bordes rasgados, como la
cinta pegada en las bobinas. Amarilla solo cuando la versión está aprobada.

## Principios aplicados

- Sin tarjetas de estadísticas: el inicio de cada rol es una lista de acciones con datos reales.
- Listas y tablas densas antes que tarjetas; tarjetas solo donde hay una acción clara (revisar).
- Estados de carga, vacío, error y éxito escritos como indicaciones («Añade las piezas…»).
- Foco visible en todo, navegación por teclado, `prefers-reduced-motion` respetado.
- Móvil: menú lateral en cajón; en la sala, vídeo arriba, controles en una fila, lista de
  comentarios y compositor plegado que se abre al tocarlo.
