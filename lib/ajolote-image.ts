export const AJOLOTE_IMAGE_SRC = "/ajolote.png";
export const AJOLOTE_IMAGE_WIDTH = 1085;
export const AJOLOTE_IMAGE_HEIGHT = 992;

// Coordenadas medidas por análisis de píxeles sobre la imagen real
// (ver commit que las añadió), como fracción del ancho/alto de la imagen.
export const AJOLOTE_EYES = {
  left: { xFrac: 470.75 / AJOLOTE_IMAGE_WIDTH, yFrac: 236.25 / AJOLOTE_IMAGE_HEIGHT },
  right: { xFrac: 616.48 / AJOLOTE_IMAGE_WIDTH, yFrac: 236.3 / AJOLOTE_IMAGE_HEIGHT },
};

export const AJOLOTE_PUPIL_RADIUS_FRAC = 16 / AJOLOTE_IMAGE_WIDTH;
export const AJOLOTE_PUPIL_COVER_RADIUS_FRAC = 17.5 / AJOLOTE_IMAGE_WIDTH;
// Radio exterior del ojo (~27.7px) menos el radio de la pupila (~16px):
// máximo desplazamiento posible sin que la pupila se salga del blanco.
export const AJOLOTE_MAX_PUPIL_OFFSET_FRAC = 12.5 / AJOLOTE_IMAGE_WIDTH;
