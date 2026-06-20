import { useSearchParams } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Custom hook for managing date range filtering via URL search parameters.
 * Defaults to current month if no parameters are present.
 * Returns startDate, endDate in ISO format, and a setDateRange function.
 */
export function useDateRange() {
  const [params, setParams] = useSearchParams();
  
  const startDateParam = params.get('from');
  const endDateParam = params.get('to');
  
  // Default to current month if no parameters
  const startDate = startDateParam || format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const endDate = endDateParam || format(endOfMonth(new Date()), 'yyyy-MM-dd');
  
  const setDateRange = (from, to) => {
    const newParams = new URLSearchParams(params);
    if (from) {
      newParams.set('from', from);
    } else {
      newParams.delete('from');
    }
    if (to) {
      newParams.set('to', to);
    } else {
      newParams.delete('to');
    }
    setParams(newParams, { replace: true });
  };
  
  const clearDateRange = () => {
    const newParams = new URLSearchParams(params);
    newParams.delete('from');
    newParams.delete('to');
    setParams(newParams, { replace: true });
  };
  
  return { startDate, endDate, setDateRange, clearDateRange };
}