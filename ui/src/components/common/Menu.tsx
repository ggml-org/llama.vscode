import React, { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}

interface MenuProps {
  items: MenuItem[];
  open: boolean;
  onClose: () => void;
  // Align the dropdown to the right edge of its container (default) or left.
  align?: 'left' | 'right';
  ariaLabel?: string;
}

// Anchored dropdown menu. Reuses the `.more-actions-menu` styles that are
// already proven in App.tsx (the "..." more actions button).
const Menu: React.FC<MenuProps> = ({ items, open, onClose, align = 'right', ariaLabel }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      // Ignore clicks on the toggle button itself - it handles its own toggling.
      const target = event.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if ((target as HTMLElement)?.closest?.('[data-menu-toggle]')) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`more-actions-menu${align === 'left' ? ' align-left' : ''}`}
      role="menu"
      aria-label={ariaLabel}
      ref={menuRef}
    >
      {items.map(item => (
        <button
          key={item.label}
          role="menuitem"
          className={`more-actions-item${item.danger ? ' danger' : ''}`}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          disabled={item.disabled}
          title={item.title || item.label}
        >
          {item.icon && <span className="menu-item-icon">{item.icon}</span>}
          <span className="menu-item-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default Menu;
