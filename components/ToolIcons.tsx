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
      <rect x="3" y="4" width="8" height="6" rx="1" stroke="currentColor" />
      <rect x="13" y="4" width="8" height="6" rx="1" stroke="currentColor" />
      <rect x="3" y="14" width="8" height="6" rx="1" stroke="currentColor" />
      <rect x="13" y="14" width="8" height="6" rx="1" stroke="currentColor" />
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
