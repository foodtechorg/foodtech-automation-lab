import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { search1cContractors } from '@/services/rawMaterial1cApi';
import type { Supplier1cCache } from '@/types/rawMaterial';
import { Loader2 } from 'lucide-react';

interface SupplierAutocompleteProps {
  value: Supplier1cCache | null;
  onChange: (supplier: Supplier1cCache | null) => void;
  disabled?: boolean;
}

export function SupplierAutocomplete({ value, onChange, disabled }: SupplierAutocompleteProps) {
  const [query, setQuery] = useState(value?.name || '');
  const [results, setResults] = useState<Supplier1cCache[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setQuery(value.name);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = (q: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchSuppliers(q, 15);
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (value) onChange(null);
    doSearch(val);
  };

  const handleSelect = (supplier: Supplier1cCache) => {
    setQuery(supplier.name);
    onChange(supplier);
    setOpen(false);
  };

  const handleFocus = () => {
    if (!value) doSearch(query);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          placeholder="Пошук постачальника..."
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          disabled={disabled}
          className={value ? 'pr-8 border-green-500/50' : ''}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
          {results.map((s) => (
            <button
              key={s.supplier_1c_id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={() => handleSelect(s)}
            >
              <span className="truncate">{s.name}</span>
              {s.tax_id && (
                <span className="ml-2 text-xs text-muted-foreground shrink-0">
                  ЄДРПОУ: {s.tax_id}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg p-3 text-sm text-muted-foreground">
          Постачальників не знайдено
        </div>
      )}
    </div>
  );
}
