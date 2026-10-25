import React from 'react';

// Minimal inline SVG icon set (no dependency, inherits the theme foreground).
// All icons use `currentColor` so they follow the VS Code theme.

export interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false
});

export const SendIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M2 8h9" />
    <path d="M8 4l4 4-4 4" />
  </svg>
);

export const StopIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...base(size)} className={className}>
    <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const QueueIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M3 4h7" />
    <path d="M3 8h7" />
    <path d="M3 12h4" />
    <path d="M12 9v5" />
    <path d="M9.6 11.6L12 14l2.4-2.4" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M8 3v10" />
    <path d="M3 8h10" />
  </svg>
);

export const HistoryIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
    <path d="M2 2v3h3" />
    <path d="M8 5v3.2l2.2 1.3" />
  </svg>
);

export const MoreIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...base(size)} className={className}>
    <circle cx="3.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const FileIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M9 1.8H4.5a1 1 0 0 0-1 1v10.4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.3z" />
    <path d="M9 1.8v3.5h3.5" />
  </svg>
);

export const ImageIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg {...base(size)} className={className}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <circle cx="5.8" cy="6.4" r="1.1" />
    <path d="M2.6 12l3.3-3.6 2.4 2.4 1.9-1.6 3.2 3.2" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M4 4l8 8" />
    <path d="M12 4l-8 8" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3.5L10.5 8 6 12.5" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 6L8 10.5 12.5 6" />
  </svg>
);

export const ArrowDownIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M8 3v10" />
    <path d="M3.5 8.5L8 13l4.5-4.5" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg {...base(size)} className={className}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
    <path d="M10.5 5.5V3.7a1.2 1.2 0 0 0-1.2-1.2H3.7a1.2 1.2 0 0 0-1.2 1.2v5.6a1.2 1.2 0 0 0 1.2 1.2h1.8" />
  </svg>
);

export const RetryIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M2.5 8a5.5 5.5 0 1 1 1.7 4" />
    <path d="M2 12.5v-3h3" />
  </svg>
);

export const WrenchIcon: React.FC<IconProps> = ({ size = 12, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M10.4 2.2a3.2 3.2 0 0 0-3.9 4.1L2.4 10.4a1.3 1.3 0 0 0 0 1.9l1.3 1.3a1.3 1.3 0 0 0 1.9 0l4.1-4.1a3.2 3.2 0 0 0 4.1-3.9l-2 2-1.8-.4-.4-1.8z" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M2.8 4.3h10.4" />
    <path d="M6.2 4.3V2.9a.9.9 0 0 1 .9-.9h1.8a.9.9 0 0 1 .9.9v1.4" />
    <path d="M4.2 4.3l.6 8.4a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8.4" />
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ size = 14, className }) => (
  <svg {...base(size)} className={className}>
    <path d="M8 1.9l5 1.9v4.1c0 3-2.1 5.2-5 6.2-2.9-1-5-3.2-5-6.2V3.8z" />
    <path d="M5.9 8.1l1.5 1.5 2.9-2.9" />
  </svg>
);
