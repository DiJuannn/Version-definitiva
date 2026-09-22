type IconProps = { className?: string };

const shared = {
  viewBox: "0 0 24 24",
  fill: "none",
  strokeWidth: 1.5,
} as const;

export function ProjectsIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path
        d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        d="M4 10 5 5h3l-1 5M9 10l1-5h3l-1 5M14 10l1-5h3l-1 5"
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SceneIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="1" stroke="currentColor" />
      <path d="M3 9h18M3 15h18M8 4v16M16 4v16" stroke="currentColor" />
    </svg>
  );
}

export function MoodboardIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <rect x="3" y="4" width="8" height="9" rx="1" stroke="currentColor" />
      <rect x="13" y="4" width="8" height="5" rx="1" stroke="currentColor" />
      <rect x="13" y="11" width="8" height="9" rx="1" stroke="currentColor" />
      <rect x="3" y="15" width="8" height="5" rx="1" stroke="currentColor" />
    </svg>
  );
}

export function CastIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M4 16c0-7 5.5-12.5 13.5-12.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M13 1.5 17.5 3.5 13 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path
        d="M12 3.5 13.8 9l5.2 1.8-5.2 1.8L12 18l-1.8-5.4L5 10.8 10.2 9 12 3.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path d="M19 15.5 19.7 17.5 21.5 18.2 19.7 19 19 21 18.3 19 16.5 18.2 18.3 17.5 19 15.5Z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

export function ClaquetaIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M4 10 20 6l1 4-17 4-1-4Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M4 14h16v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="m8.5 8.7 2 3.3M13.5 7.5l2 3.3" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function LocationIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path
        d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12Z"
        stroke="currentColor"
      />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" />
    </svg>
  );
}

export function BudgetIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <rect x="3" y="7" width="18" height="12" rx="1.5" stroke="currentColor" />
      <path d="M3 10.5h18" stroke="currentColor" />
      <circle cx="16" cy="14.5" r="1.5" stroke="currentColor" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="1.5" stroke="currentColor" />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EventIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="1.5" stroke="currentColor" />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeLinecap="round"
      />
      <rect x="13" y="13" width="4" height="4" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShotListIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10.5h8M8 13.5h5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path
        d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path d="M9 12h6M9 16h6" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function SummaryIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path
        d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path d="M8 10h8M8 13.5h8M8 17h5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function TaskIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <rect x="3.5" y="4" width="6" height="6" rx="1" stroke="currentColor" />
      <path d="M5 7l1 1 2-2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3.5" y="14" width="6" height="6" rx="1" stroke="currentColor" />
      <path d="M12 7h8.5M12 17h8.5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function VehicleIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path
        d="M4 16v-3.5L6 8h12l2 4.5V16"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path d="M4 16h16v2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-9v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2Z" stroke="currentColor" strokeLinejoin="round" />
      <circle cx="7.5" cy="16" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="16" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" />
    </svg>
  );
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path
        d="M2.5 12S6 5.5 12 5.5c1.6 0 3 .4 4.2 1M21.5 12S18 18.5 12 18.5c-1.6 0-3-.4-4.2-1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 9.7A3 3 0 0 0 14.4 14M6.5 7.5 4 5M17.5 16.5 20 19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Un icono propio por herramienta — antes cuatro compartían DocumentIcon y
// Calendario/Plan de rodaje eran casi idénticos.
export function ScriptIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M9.5 8h5M9.5 11h5M9.5 14h3" stroke="currentColor" strokeLinecap="round" />
      <path d="M3.5 6.5h2M3.5 12h2M3.5 17.5h2" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function StackIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M12 4 3.5 8.5 12 13l8.5-4.5L12 4Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CallSheetIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M6 3h9l3 3v7" stroke="currentColor" strokeLinejoin="round" />
      <path d="M6 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 8h5M8.5 11.5h3" stroke="currentColor" strokeLinecap="round" />
      <circle cx="16.5" cy="17" r="4" stroke="currentColor" />
      <path d="M16.5 15v2l1.4 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ScheduleIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" stroke="currentColor" />
      <path d="M7 9h6M10 13h7M7 17h5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function FolderIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M3.5 7a1 1 0 0 1 1-1h4.6l2 2.2H19.5a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V7Z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

export function ContractIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M9 9h5" stroke="currentColor" strokeLinecap="round" />
      <path d="M8.5 16c1-2 1.7-2 2.2-.6.4 1 1 1 1.6-.4.4-.9 1-1.1 1.7-.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PeopleIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <circle cx="9" cy="9" r="3" stroke="currentColor" />
      <path d="M3.5 19c.5-3 2.6-4.8 5.5-4.8s5 1.8 5.5 4.8" stroke="currentColor" strokeLinecap="round" />
      <circle cx="17" cy="9.5" r="2.3" stroke="currentColor" />
      <path d="M16.5 14.4c2.2.1 3.7 1.5 4 3.8" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export function BoxIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M12 3 20.5 7.5v9L12 21 3.5 16.5v-9L12 3Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1v-8Z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

export function OrganizationIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <path d="M12 3.5 4.5 6v5.5c0 4.3 3 7.4 7.5 9 4.5-1.6 7.5-4.7 7.5-9V6L12 3.5Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="m9 12 2.2 2.2L15.5 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


// Parte de script: tablilla con tomas marcadas como buenas.
export function TakeReportIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <rect x="5" y="4" width="14" height="17" rx="1" stroke="currentColor" />
      <path d="M9 4V3h6v1" stroke="currentColor" strokeLinejoin="round" />
      <path d="m8.5 10 1.2 1.2L12 9M8.5 15l1.2 1.2L12 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 10.2h2.5M14 15.2h2.5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

// Icono de Montaje (postproducción): una tira de fotogramas.
export function EditIcon({ className }: IconProps) {
  return (
    <svg {...shared} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="1" stroke="currentColor" />
      <path d="M8 5v14M16 5v14" stroke="currentColor" />
      <path d="M5.5 8h1M5.5 11h1M5.5 14h1M5.5 17h1M17.5 8h1M17.5 11h1M17.5 14h1M17.5 17h1" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
