import { useState } from 'react';
import { Check, ChevronsUpDown, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useEntitySearch } from '@/hooks/useEntitySearch';

// Scalable async typeahead picker for a Base44 entity — the drop-in replacement
// for `entity.list()` <Select> dropdowns that load every row.
//
// Offline: falls back to locally-cached rows (see useEntitySearch), so a
// required id (e.g. customer_id) can still be selected without a connection.
//
// Props:
//   entity        - entity name, e.g. 'Customer'
//   value         - selected id
//   onChange      - (id, row) => void
//   searchFields  - fields to search/display-match, e.g. ['full_name', 'phone']
//   getLabel      - row => string (defaults to first searchField, then id)
//   placeholder   - trigger text when nothing selected
export default function EntitySelect({
  entity,
  value,
  onChange,
  searchFields = ['full_name'],
  getLabel,
  placeholder = 'Select…',
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  // Remember the chosen row so the trigger label stays stable even when it
  // drops out of the current (online or cached) option set.
  const [selectedRow, setSelectedRow] = useState(null);
  const { query, setQuery, options, isLoading, isOffline } = useEntitySearch({ entity, searchFields, enabled: open });

  const label = (row) => (getLabel ? getLabel(row) : row?.[searchFields[0]] ?? row?.id ?? '');
  const selected = (selectedRow && selectedRow.id === value) ? selectedRow : options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected ? label(selected) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search…" value={query} onValueChange={setQuery} />
          {isOffline && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-amber-600 border-b border-border">
              <WifiOff className="w-3 h-3" /> Offline — showing saved records
            </div>
          )}
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Searching…' : isOffline ? 'No saved records — connect once to enable offline selection' : 'No results'}
            </CommandEmpty>
            <CommandGroup>
              {options.map((row) => (
                <CommandItem
                  key={row.id}
                  value={row.id}
                  onSelect={() => { setSelectedRow(row); onChange?.(row.id, row); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === row.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{label(row)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
