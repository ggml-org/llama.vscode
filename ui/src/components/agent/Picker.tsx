import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon } from '../common/Icons';
import { getCommandName, parsePickerItem, PickerItem, PickerMode } from '../../utils/pickerItems';

interface PickerProps {
  mode: PickerMode;
  items: string[];
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
  // The extension has not answered the list request yet.
  loading?: boolean;
  // Rules/commands cannot be started while a run is in progress.
  disabled?: boolean;
  disabledHint?: string;
}

const Picker: React.FC<PickerProps> = ({ mode, items, onSelect, onClose, loading, disabled, disabledHint }) => {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const parsedItems = useMemo(
    () => items.map(raw => parsePickerItem(raw, mode)),
    [items, mode]
  );

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return parsedItems;
    return parsedItems.filter(item =>
      item.name.toLowerCase().includes(needle) || item.detail.toLowerCase().includes(needle)
    );
  }, [parsedItems, filter]);

  // Reset the highlighted row whenever the filter changes.
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Focus the search box once, on mount. Focus never leaves it afterwards:
  // arrow keys only move the highlighted row.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Keep the highlighted row visible.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.children[selectedIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, filtered.length]);

  const commit = (index: number) => {
    const item = filtered[index];
    if (item) onSelect(item);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => (filtered.length === 0 ? 0 : (prev + 1) % filtered.length));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => (filtered.length === 0 ? 0 : (prev - 1 + filtered.length) % filtered.length));
        break;
      case 'Enter':
        event.preventDefault();
        if (!disabled) commit(selectedIndex);
        break;
      case 'Tab':
        event.preventDefault();
        setSelectedIndex(prev => {
          const next = event.shiftKey ? prev - 1 : prev + 1;
          if (filtered.length === 0) return 0;
          return (next + filtered.length) % filtered.length;
        });
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  };

  const title = mode === 'files' ? 'Add file to context' : 'Run agent command';
  const placeholder = mode === 'files' ? 'Filter files…' : 'Filter commands…';

  return (
    <>
      {/* Transparent click catcher: closes the picker even when nothing inside has focus */}
      <div className="picker-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="picker-popover"
        role="dialog"
        aria-modal="false"
        aria-label={title}
        onKeyDown={handleKeyDown}
      >
        <div className="picker-header">
          <span className="picker-title">{title}</span>
          <span className="picker-count">
            {disabled
              ? 'unavailable'
              : loading
                ? 'loading…'
                : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="Close picker"
            aria-label="Close picker"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="picker-search">
          <input
            ref={searchRef}
            type="text"
            className="modern-input"
            placeholder={placeholder}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            disabled={disabled}
            aria-label={placeholder}
            aria-controls="picker-list"
            aria-activedescendant={filtered[selectedIndex] ? `picker-item-${selectedIndex}` : undefined}
          />
        </div>

        {disabled ? (
          <div className="picker-empty">{disabledHint || 'Not available right now.'}</div>
        ) : (
          <div
            className="picker-list"
            id="picker-list"
            role="listbox"
            aria-label={title}
            ref={listRef}
          >
            {filtered.length > 0 ? (
              filtered.map((item, index) => (
                <button
                  type="button"
                  key={item.raw}
                  id={`picker-item-${index}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={`picker-item${index === selectedIndex ? ' selected' : ''}`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => onSelect(item)}
                  title={item.fullText}
                >
                  <span className="picker-item-main">
                    <span className="picker-item-name">{item.name}</span>
                    {mode === 'commands' && (
                      <span className={`badge ${item.kind}`}>
                        {item.kind === 'script' ? 'Script' : 'Prompt'}
                      </span>
                    )}
                    {mode === 'commands' && item.scheduled && (
                      <span className="badge scheduled" title="Runs periodically">Scheduled</span>
                    )}
                  </span>
                  {item.detail && <span className="picker-item-detail">{item.detail}</span>}
                </button>
              ))
            ) : (
              <div className="picker-empty">
                {loading
                  ? 'Loading…'
                  : filter
                    ? `No ${mode === 'files' ? 'files' : 'commands'} match “${filter}”`
                    : 'Nothing available'}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default Picker;
