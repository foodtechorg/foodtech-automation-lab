import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { search1cRawMaterials } from '@/services/rawMaterial1cApi';
import type { RawMaterial1cCache } from '@/types/rawMaterial';
import { Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';

interface RawMaterialAutocompleteProps {
  value: string;
  onChange: (material: RawMaterial1cCache | null, customName?: string) => void;
  disabled?: boolean;
}

export function RawMaterialAutocomplete({ value, onChange, disabled }: RawMaterialAutocompleteProps) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<RawMaterial1cCache[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const clickedInContainer = containerRef.current?.contains(e.target as Node);
      const clickedInDropdown = dropdownRef.current?.contains(e.target as Node);
      if (!clickedInContainer && !clickedInDropdown) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = (q: string) => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await search1cRawMaterials(q, 15);
        setResults(data);
        setOpen(true);
      } catch (err: any) {
        setResults([]);
        setErrorMsg(err?.message || 'Помилка пошуку');
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(null, val);
    doSearch(val);
  };

  const handleSelect = (material: RawMaterial1cCache) => {
    setQuery(material.name);
    onChange(material);
    setOpen(false);
  };

  const handleFocus = () => {
    if (query.trim().length >= 2) doSearch(query);
  };

  const dropdownContent = open && (
    <>
      {results.length > 0 && (
        <div style={dropdownStyle} className="rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
          {results.map((m) => (
            <button
              key={m.raw_material_1c_id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={() => handleSelect(m)}
            >
              <span className="truncate">{m.name}</span>
              <span className="ml-2 text-xs text-muted-foreground shrink-0">{m.default_uom}</span>
            </button>
          ))}
        </div>
      )}
      {!loading && results.length === 0 && query.trim().length >= 2 && (
        <div style={dropdownStyle} className="rounded-md border bg-popover shadow-lg p-3 text-sm text-muted-foreground">
          {errorMsg ? (
            <span className="text-destructive">{errorMsg}</span>
          ) : (
            'Сировину не знайдено'
          )}
        </div>
      )}
    </>
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="Пошук сировини..."
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          disabled={disabled}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {dropdownContent && createPortal(<div ref={dropdownRef}>{dropdownContent}</div>, document.body)}
    </div>
  );
}
