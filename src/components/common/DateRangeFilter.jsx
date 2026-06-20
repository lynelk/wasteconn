import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, subMonths } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDateRange } from '@/hooks/useDateRange';

const PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last Quarter', value: 'quarter' },
];

export default function DateRangeFilter() {
  const { startDate, endDate, setDateRange, clearDateRange } = useDateRange();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState({ from: new Date(startDate), to: new Date(endDate) });

  const applyPreset = (preset) => {
    const today = new Date();
    let from, to;

    switch (preset) {
      case 'today':
        from = format(today, 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      case '7d':
        from = format(subDays(today, 6), 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      case '30d':
        from = format(subDays(today, 29), 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      case 'month':
        from = format(startOfMonth(today), 'yyyy-MM-dd');
        to = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case 'last_month':
        from = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
        to = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
        break;
      case 'quarter':
        from = format(subMonths(today, 2), 'yyyy-MM-dd');
        to = format(today, 'yyyy-MM-dd');
        break;
      default:
        from = format(startOfMonth(today), 'yyyy-MM-dd');
        to = format(endOfMonth(today), 'yyyy-MM-dd');
    }

    setDateRange(from, to);
    setDate({ from: new Date(from), to: new Date(to) });
    setOpen(false);
  };

  const handleCalendarSelect = (selected) => {
    if (selected?.from && selected?.to) {
      const from = format(selected.from, 'yyyy-MM-dd');
      const to = format(selected.to, 'yyyy-MM-dd');
      setDateRange(from, to);
      setDate(selected);
      setOpen(false);
    } else if (selected?.from) {
      setDate({ from: selected.from, to: selected.from });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 font-medium">
          <CalendarIcon className="w-4 h-4" />
          <span className="hidden sm:inline">
            {startDate && endDate 
              ? `${format(new Date(startDate), 'MMM d')} - ${format(new Date(endDate), 'MMM d, yyyy')}`
              : 'Select date range'
            }
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="end">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(preset.value)}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          
          <div className="border-t pt-3">
            <Calendar
              mode="range"
              selected={date}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              className="rounded-md border"
            />
          </div>
          
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearDateRange}
              className="text-xs text-muted-foreground"
            >
              Clear filter
            </Button>
            <Button
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}