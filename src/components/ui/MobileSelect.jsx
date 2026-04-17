/**
 * MobileSelect — on mobile renders BottomSheetSelect; on desktop renders Radix Select.
 * Drop-in replacement: same API as <Select> but simpler — pass options as array.
 *
 * Props:
 *   value, onChange, options=[{value,label}], placeholder, className, disabled
 */
import { useIsMobile } from '@/hooks/use-mobile';
import BottomSheetSelect from '@/components/ui/BottomSheetSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MobileSelect({ value, onChange, options = [], placeholder = 'Select…', className = '', disabled = false }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BottomSheetSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}