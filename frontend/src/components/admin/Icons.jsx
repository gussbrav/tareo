/**
 * Íconos monoline (Lucide/Feather style) inline SVG — sin dependencias.
 * stroke=1.5, currentColor. Uso: <Icon.General className="w-4 h-4" />
 */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
}

const wrap = (children) => (props) => (
  <svg {...base} {...props}>{children}</svg>
)

export const Icon = {
  General: wrap(<>
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="18" height="6" rx="1.5" />
    <path d="M7 7h.01M7 17h.01" />
  </>),
  Brand: wrap(<>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v18M3 12h18" />
  </>),
  Users: wrap(<>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </>),
  Key: wrap(<>
    <path d="M21 2l-9.6 9.6" />
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="M15 6l3 3M18 3l3 3" />
  </>),
  Shield: wrap(<>
    <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </>),
  Tag: wrap(<>
    <path d="M20.6 13.4l-8.2 8.2a2 2 0 0 1-2.8 0L2 14V2h12l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7" cy="7" r="1.5" />
  </>),
  Layers: wrap(<>
    <path d="M12 2l10 6-10 6L2 8l10-6z" />
    <path d="M2 16l10 6 10-6M2 12l10 6 10-6" />
  </>),
  Beaker: wrap(<>
    <path d="M9 3h6M10 3v6L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3" />
    <path d="M7 14h10" />
  </>),
  Building: wrap(<>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" />
  </>),
  Folder: wrap(<>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </>),
  Search: wrap(<>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </>),
  Plus: wrap(<>
    <path d="M12 5v14M5 12h14" />
  </>),
  Edit: wrap(<>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </>),
  Archive: wrap(<>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
  </>),
  ArrowUp: wrap(<path d="M12 19V5M5 12l7-7 7 7" />),
  ArrowDown: wrap(<path d="M12 5v14M19 12l-7 7-7-7" />),
  ChevronLeft: wrap(<path d="M15 18l-6-6 6-6" />),
  ChevronRight: wrap(<path d="M9 6l6 6-6 6" />),
  Info: wrap(<>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01M11 12h1v4h1" />
  </>),
  ArrowsUpDown: wrap(<>
    <path d="M7 4v16M4 7l3-3 3 3" />
    <path d="M17 20V4M20 17l-3 3-3-3" />
  </>),
  X: wrap(<path d="M18 6L6 18M6 6l12 12" />),
  Drag: wrap(<>
    <circle cx="9" cy="6" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="18" r="1" />
  </>),
  Inbox: wrap(<>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.5L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.5z" />
  </>),
  Check: wrap(<path d="M20 6L9 17l-5-5" />),
  Refresh: wrap(<>
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5M3 21v-5h5" />
  </>),
  Calendar: wrap(<>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>),
}
