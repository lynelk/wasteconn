import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Clock, Gauge, Fuel, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function DriverShiftReportPanel() {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportMonth, setReportMonth] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return format(d, 'yyyy-MM');
  });

  const generate = async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split('-').map(Number);
    const res = await base44.functions.invoke('generateDriverShiftReport', { year, month });
    setReports(res.data?.reports || []);
    setReportMonth(res.data?.month || selectedMonth);
    setLoading(false);
  };

  const exportCSV = () => {
    if (!reports.length) return;
    const headers = ['Driver', 'Month', 'Shifts', 'Hours', 'Distance (km)', 'Min Start Odometer', 'Fuel (L)', 'Avg Efficiency (km/L)'];
    const rows = reports.map(r => [
      r.driver_name, r.month, r.total_shifts, r.total_hours, r.total_distance_km,
      r.min_start_odometer || '', r.total_fuel_litres, r.avg_fuel_efficiency_km_per_litre || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver_shift_report_${reportMonth.replace(' ', '_')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Report Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-input bg-background rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <Button onClick={generate} disabled={loading} size="sm">
          <FileText className="w-4 h-4" />
          {loading ? 'Generating...' : 'Generate Report'}
        </Button>
        {reports.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        )}
      </div>

      {loading && (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      )}

      {!loading && reports.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Shift Summary — {reportMonth} ({reports.length} drivers)</p>
          {reports.map((r, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{r.driver_name}</p>
                    <p className="text-xs text-muted-foreground">{r.total_shifts} shift{r.total_shifts !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-4 text-xs text-right">
                    <div className="flex flex-col items-center">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground mb-0.5" />
                      <span className="font-semibold">{r.total_hours}h</span>
                      <span className="text-muted-foreground">Hours</span>
                    </div>
                    {r.total_distance_km > 0 && (
                      <div className="flex flex-col items-center">
                        <Gauge className="w-3.5 h-3.5 text-muted-foreground mb-0.5" />
                        <span className="font-semibold">{r.total_distance_km} km</span>
                        <span className="text-muted-foreground">Distance</span>
                      </div>
                    )}
                    {r.min_start_odometer && (
                      <div className="flex flex-col items-center">
                        <span className="text-muted-foreground text-xs mb-0.5">Start ODO</span>
                        <span className="font-semibold">{r.min_start_odometer.toLocaleString()}</span>
                        <span className="text-muted-foreground">km</span>
                      </div>
                    )}
                    {r.avg_fuel_efficiency_km_per_litre && (
                      <div className="flex flex-col items-center">
                        <Fuel className="w-3.5 h-3.5 text-muted-foreground mb-0.5" />
                        <span className="font-semibold">{r.avg_fuel_efficiency_km_per_litre}</span>
                        <span className="text-muted-foreground">km/L</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && reports.length === 0 && reportMonth && (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">
          No completed shifts found for {reportMonth}.
        </div>
      )}
    </div>
  );
}