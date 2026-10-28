import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon } from '../common/Icons';
import { filterPickerItems, parsePickerItem, PickerItem, PickerMode } from '../../utils/pickerItems';

const MAX_RENDERED_ITEMS = 100;

interface PickerProps {
  mode: PickerMode;
  items: string[];
  filter: string;
  onFilterChange: (filter: string) => void;
  fileDetails?: Record<string, string>;
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
  // The extension has not answered the current list/search request yet.
  loading?: boolean;
  truncated?: boolean;
  workspaceEmpty?: boolean;
  error?: string;
  onRetry?: () => void;
  onChooseFile?: () => void;
  // Rules/commands cannot be started while a run is in progress.
  disabled?: boolean;
  disabledHint?: string;
}

const Picker: React.FC<PickerProps> = ({
  mode,
  items,
  filter,
  onFilterChange,
  fileDetails = {},
  onSelect,
  onClose,
  loading,
  truncated,
  workspaceEmpty,
  error,
  onRetry,
  onChooseFile,
  disabled,
  disabledHint
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const parsedItems = useMemo(
    () => items.map(raw => parsePickerItem(raw, mode, fileDetails[raw])),
    [items, mode, fileDetails]
  );

  const filtered = useMemo(() => filterPickerItems(parsedItems, filter), [parsedItems, filter]);
  const visibleItems = useMemo(() => filtered.slice(0, MAX_RENDERED_ITEMS), [filtered]);

  // A response can replace the whole list without changing the filter.
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter, items]);

  // Focus the search box once, on mount. Focus never leaves it afterwards:
  // arrow keys only move the highlighted row.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Keep the highlighted row visible. querySelector skips the optional result
  // limit footer, which is also a child of the list container.
  useEffect(() => {
    const row = listRef.current?.querySelector(`#picker-item-${selectedIndex}`) as HTMLElement | null;
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, visibleItems.length]);

  const commit = (index: number) => {
    const item = visibleItems[index];
    if (item && !loading && !error && !workspaceEmpty) onSelect(item);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => (visibleItems.length === 0 ? 0 : (prev + 1) % visibleItems.length));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => (visibleItems.length === 0 ? 0 : (prev - 1 + visibleItems.length) % visibleItems.length));
        break;
      case 'Enter':
        event.preventDefault();
        if (!disabled) commit(selectedIndex);
        break;
      case 'Tab':
        event.preventDefault();
        setSelectedIndex(prev => {
          const next = event.shiftKey ? prev - 1 : prev + 1;
          if (visibleItems.length === 0) return 0;
          return (next + visibleItems.length) % visibleItems.length;
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
  const placeholder = mode === 'files' ? 'Search files by name or path…' : 'Filter commands…';
  const resultCount = `${filtered.length}${truncated ? '+' : ''} result${filtered.length === 1 && !truncated ? '' : 's'}`;

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
                ? 'searching…'
                : resultCount}
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
            onChange={(event) => onFilterChange(event.target.value)}
            disabled={disabled}
            aria-label={placeholder}
            aria-controls="picker-list"
            aria-activedescendant={visibleItems[selectedIndex] ? `picker-item-${selectedIndex}` : undefined}
          />
        </div>

        {disabled ? (
          <div className="picker-empty">{disabledHint || 'Not available right now.'}</div>
        ) : error ? (
          <div className="picker-empty picker-message" role="alert">
            <span>{error}</span>
            {onRetry && <button type="button" className="modern-btn secondary" onClick={onRetry}>Retry</button>}
          </div>
        ) : workspaceEmpty ? (
          <div className="picker-empty picker-message">
            <span>Open a folder to search workspace files, or choose a file from your computer.</span>
            {onChooseFile && <button type="button" className="modern-btn secondary" onClick={onChooseFile}>Choose file…</button>}
          </div>
        ) : (
          <div
            className="picker-list"
            id="picker-list"
            role="listbox"
            aria-label={title}
            ref={listRef}
            aria-busy={loading}
          >
            {visibleItems.length > 0 ? (
              <>
                {visibleItems.map((item: PickerItem, index: number) => (
                  <button
                    type="button"
                    key={item.raw}
                    id={`picker-item-${index}`}
                    role="option"
                    aria-selected={index === selectedIndex}
                    className={`picker-item${index === selectedIndex ? ' selected' : ''}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => commit(index)}
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
                ))}
                {(visibleItems.length < filtered.length || truncated) && (
                  <div className="picker-result-limit">
                    {visibleItems.length < filtered.length
                      ? `Showing ${visibleItems.length} of ${filtered.length} matches. `
                      : ''}
                    {truncated ? 'More files match. Refine your search.' : 'Type to narrow the results.'}
                  </div>
                )}
              </>
            ) : (
              <div className="picker-empty">
                {loading
                  ? mode === 'files' ? 'Finding workspace files…' : 'Loading…'
                  : filter
                    ? `No ${mode === 'files' ? 'files' : 'commands'} match “${filter}”`
                    : mode === 'files' ? 'No workspace files found' : 'Nothing available'}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default Picker;
