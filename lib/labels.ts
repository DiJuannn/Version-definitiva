import {
  BreakdownCategory,
  DayPart,
  IntExt,
  InventoryItemCategory,
  LocationCharacteristic,
  ProjectStatus,
} from "@/lib/generated/prisma";

export const INT_EXT_LABELS: Record<IntExt, string> = {
  INT: "INT",
  EXT: "EXT",
  INT_EXT: "INT/EXT",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  DEVELOPMENT: "Desarrollo",
  PRE_PRODUCTION: "Preproducción",
  PRODUCTION: "Producción",
  POST_PRODUCTION: "Postproducción",
  FINISHED: "Finalizado",
};

// Progresión visual (0 a 1) para el punto de estado — cuanto más avanzado el
// proyecto, más intenso el color.
export const PROJECT_STATUS_INTENSITY: Record<ProjectStatus, number> = {
  DEVELOPMENT: 0.3,
  PRE_PRODUCTION: 0.55,
  PRODUCTION: 1,
  POST_PRODUCTION: 0.75,
  FINISHED: 0.4,
};

export const DAY_PART_LABELS: Record<DayPart, string> = {
  DAY: "Día",
  NIGHT: "Noche",
  DUSK: "Atardecer",
  DAWN: "Amanecer",
};

export const BREAKDOWN_CATEGORY_LABELS: Record<BreakdownCategory, string> = {
  PROP: "Atrezzo",
  WARDROBE: "Vestuario",
  MAKEUP_HAIR: "Maquillaje y peluquería",
  VEHICLE: "Vehículos",
  SOUND: "Sonido",
  VFX: "Efectos especiales",
  LIGHTING: "Iluminación",
  EQUIPMENT: "Equipo técnico",
};

export const INVENTORY_CATEGORY_LABELS: Record<InventoryItemCategory, string> = {
  CAMERA: "Cámara",
  LIGHTING: "Iluminación",
  SOUND: "Sonido",
  GRIP: "Grip",
  COSTUME: "Vestuario",
  PROPS: "Atrezzo",
  OFFICE: "Oficina",
  OTHER: "Otros",
};

export const LOCATION_CHARACTERISTIC_LABELS: Record<LocationCharacteristic, string> = {
  ELECTRICITY: "Electricidad",
  PARKING: "Parking",
  VEHICLE_ACCESS: "Acceso para vehículos",
  BATHROOM: "Baños",
  DRESSING_ROOM: "Camerino",
  CREW_SPACE: "Espacio para equipo",
  NOISE_CONTROL: "Control de ruido",
  EXTERIOR: "Exterior",
  INTERIOR: "Interior",
};
