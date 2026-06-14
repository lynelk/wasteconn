import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useEntitySearch } from '@/hooks/useEntitySearch';

// Scalable async typeahead picker for a Base44 entity — the drop-in replacement
// for `entity.list()` <Select> dropdowns that load every row.
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
  const { query, setQuery, options, isLoading } = useEntitySearch({ entity, searchFields, enabled: open });

  const label = (row) => (getLabel ? getLabel(row) : row?.[searchFields[0]] ?? row?.id ?? '');
  const selected = options.find((o) => o.id === value);

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
          <CommandList>
            <CommandEmpty>{isLoading ? 'Searching…' : 'No results'}</CommandEmpty>
            <CommandGroup>
              {options.map((row) => (
                <CommandItem
                  key={row.id}
                  value={row.id}
                  onSelect={() => { onChange?.(row.id, row); setOpen(false); }}
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
