import React from 'react';

interface IconButtonProps {
  // Required: icon-only buttons need an accessible name.
  label: string;
  icon: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  className?: string;
  disabled?: boolean;
  active?: boolean;
  // Any extra data attribute (e.g. data-menu-toggle) forwarded to the button.
  dataMenuToggle?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({
  label,
  icon,
  onClick,
  title,
  className = '',
  disabled = false,
  active = false,
  dataMenuToggle = false
}) => (
  <button
    type="button"
    className={`icon-btn${active ? ' active' : ''}${className ? ' ' + className : ''}`}
    onClick={onClick}
    title={title || label}
    aria-label={label}
    disabled={disabled}
    {...(dataMenuToggle ? { 'data-menu-toggle': 'true' } : {})}
  >
    {icon}
  </button>
);

export default IconButton;
