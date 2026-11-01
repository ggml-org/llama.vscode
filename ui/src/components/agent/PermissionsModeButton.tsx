import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CheckIcon, ShieldIcon } from '../common/Icons';
import {
  DEFAULT_PERMISSIONS_MODES,
  getPermissionsModeInfo,
  PermissionsMode,
  PermissionsModeInfo,
  permissionsModeButtonAriaLabel,
  permissionsModeButtonTitle,
  permissionsModeMenuOffset
} from '../../utils/permissionsMode';

interface PermissionsModeButtonProps {
  // Raw value of the `tools_permissions_mode` setting as reported by the
  // extension. An unknown value renders as the most restrictive mode.
  mode: string;
  // List posted by the extension. Falls back to the built-in copy so the button
  // still works against an extension that does not send the list.
  modes?: PermissionsModeInfo[];
  onSelect: (mode: PermissionsMode) => void;
}

/**
 * Compact footer button showing the current `tools_permissions_mode` with a
 * dropdown that explains every mode. The menu opens upwards (the composer sits
 * at the bottom of the panel) and marks the active mode.
 */
const PermissionsModeButton: React.FC<PermissionsModeButtonProps> = ({
  mode,
  modes = DEFAULT_PERMISSIONS_MODES,
  onSelect
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Horizontal correction applied to the (right-anchored) menu so it stays
  // inside the panel. Measured on open, because the button's position depends on
  // the length of the agent / model names next to it.
  const [menuOffset, setMenuOffset] = useState(0);
  const info = getPermissionsModeInfo(mode, modes);

  // The footer is right aligned and the button is its first item, so a long
  // model name pushes the button left: an unadjusted menu would render off the
  // left edge of a narrow sidebar. Measuring after mount (layout effect) keeps
  // the correction invisible.
  useLayoutEffect(() => {
    if (!open) {
      setMenuOffset(0);
      return;
    }
    const update = () => {
      const button = buttonRef.current;
      if (!button) return;
      const offset = permissionsModeMenuOffset({
        buttonRight: button.getBoundingClientRect().right,
        viewportWidth: window.innerWidth
      });
      setMenuOffset(previous => (previous === offset ? previous : offset));
    };
    update();
    // A panel resize or the footer wrapping onto another row moves the button.
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open, info.value, modes]);

  // Escape and a click anywhere else close the menu. Both listeners are only
  // registered while it is open, so the footer costs nothing when idle.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Do not let Escape reach the composer (it would be read as "stop the
        // running session"): the menu is the innermost thing being dismissed.
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open]);

  const select = (value: PermissionsMode) => {
    setOpen(false);
    // Re-selecting the current mode must not write the setting again (it would
    // fire a configuration change event and a needless refresh).
    if (value === info.value) return;
    onSelect(value);
  };

  return (
    <div className="permissions-mode" ref={containerRef}>
      <button
        type="button"
        ref={buttonRef}
        className={`context-link permissions-mode-link${open ? ' open' : ''}`}
        onClick={() => setOpen(previous => !previous)}
        title={permissionsModeButtonTitle(info)}
        aria-label={permissionsModeButtonAriaLabel(info)}
        aria-haspopup="menu"
        aria-expanded={open}
        // The value is short and always fully visible: unlike the agent / model
        // names it must not be truncated, because it is a safety indicator.
        data-permissions-mode={info.value}
      >
        <ShieldIcon size={10} />
        <span className="permissions-mode-link-label">{info.shortLabel}</span>
      </button>

      {open && (
        <>
          {/* Transparent click catcher, same pattern as the @ / picker: the menu
              closes even when the click lands on a non-focusable area. */}
          <div className="picker-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="permissions-mode-menu"
            role="menu"
            aria-label="Tools permissions mode"
            style={menuOffset ? { transform: `translateX(${menuOffset}px)` } : undefined}
          >
            <div className="permissions-mode-menu-header">
              <span className="permissions-mode-menu-title">Tools permissions</span>
              <span className="permissions-mode-menu-current">{info.value}</span>
            </div>
            {modes.map((candidate: PermissionsModeInfo) => {
              const selected = candidate.value === info.value;
              return (
                <button
                  key={candidate.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={`permissions-mode-item${selected ? ' selected' : ''}${
                    candidate.value === 'AllowAll' ? ' danger' : ''
                  }`}
                  onClick={() => select(candidate.value)}
                  // The long explanation is the tooltip; the short one is always
                  // visible so the trade-off can be read without hovering.
                  title={candidate.details}
                >
                  <span className="permissions-mode-check" aria-hidden="true">
                    {selected ? <CheckIcon size={12} /> : null}
                  </span>
                  <span className="permissions-mode-item-text">
                    <span className="permissions-mode-item-label">{candidate.label}</span>
                    <span className="permissions-mode-item-desc">{candidate.description}</span>
                  </span>
                </button>
              );
            })}
            <div className="permissions-mode-menu-footer">
              Stored in the <code>llama-vscode.tools_permissions_mode</code> setting.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PermissionsModeButton;
