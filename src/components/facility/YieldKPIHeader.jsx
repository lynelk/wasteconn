import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Recycle, AlertTriangle, Package } from 'lucide-react';

function KPI({ label, value, sub, icon: IconComp, color }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <IconComp className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function YieldKPIHeader({ facilityId }) {
  const { data: records = [] } = useQuery({
    queryKey: ['facility-yield', facilityId],
    queryFn: () => base44.entities.FacilityYieldRecord.filter({ facility_id: facilityId }, '-period', 30),
    enabled: !!facilityId,
  });

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const monthRecords = records.filter(r => r.period?.startsWith(currentMonth));

  const latestRecord = records[0];
  const totalInbound = monthRecords.reduce((s, r) => s + (r.inbound_t || 0), 0);
  const totalDiverted = monthRecords.reduce((s, r) => s + ((r.inbound_t || 0) - (r.sorted_residue_t || 0)), 0);
  const avgDiversion = monthRecords.length > 0
    ? monthRecords.reduce((s, r) => s + (r.diversion_rate_pct || 0), 0) / monthRecords.length
    : 0;
  const avgContamination = monthRecords.length > 0
    ? monthRecords.reduce((s, r) => s + (r.contamination_rate_pct || 0), 0) / monthRecords.length
    : 0;

  const diversionColor = avgDiversion >= 70 ? 'bg-green-100 text-green-700' : avgDiversion >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPI
        label="Monthly Inbound"
        value={`${totalInbound.toFixed(1)}t`}
        sub={`${monthRecords.length} records this month`}
        icon={Package}
        color="bg-blue-100 text-blue-700"
      />
      <KPI
        label="Avg Diversion Rate"
        value={`${avgDiversion.toFixed(1)}%`}
        sub={avgDiversion >= 70 ? 'Target met' : avgDiversion >= 50 ? 'Below target' : 'Needs attention'}
        icon={TrendingUp}
        color={diversionColor}
      />
      <KPI
        label="Total Diverted"
        value={`${totalDiverted.toFixed(1)}t`}
        sub="From landfill this month"
        icon={Recycle}
        color="bg-green-100 text-green-700"
      />
      <KPI
        label="Avg Contamination"
        value={`${avgContamination.toFixed(1)}%`}
        sub={latestRecord ? `Last: ${latestRecord.period}` : 'No data yet'}
        icon={AlertTriangle}
        color={avgContamination > 20 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}
      />
    </div>
  );
}