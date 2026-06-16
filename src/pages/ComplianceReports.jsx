import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';
import { FileText, Download, Plus, Shield, CheckCircle, Archive, Target, Sheet } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MobileSelect from '@/components/ui/MobileSelect';
import RegionalTargetTracker from '@/components/compliance/RegionalTargetTracker';

const statusColors = {
  generating: 'bg-yellow-100 text-yellow-700',
  generated:  'bg-blue-100 text-blue-700',
  submitted:  'bg-purple-100 text-purple-700',
  archived:   'bg-green-100 text-green-700',
};

export default function ComplianceReports() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reportType, setReportType] = useState('route_completion');
  const [periodFrom, setPeriodFrom] = useState(format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd'));
  const [periodTo, setPeriodTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['compliance-reports'],
    queryFn: () => base44.entities.ComplianceReport.list('-created_date', 50),
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await base44.functions.invoke('generateComplianceReport', {
        report_type: reportType,
        period_from: periodFrom,
        period_to: periodTo,
      });
      queryClient.invalidateQueries({ queryKey: ['compliance-reports'] });
      toast({ title: 'Report generated', description: `${reportType.replace(/_/g,' ')} report archived successfully.` });
    } catch (err) {
      logger.error('compliance.generateReport.error', { message: err?.message });
      toast({ title: 'Generation failed', description: err?.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleExportToSheets = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportComplianceToSheets', {});
      const url = res?.data?.spreadsheet_url;
      toast({
        title: 'Exported to Google Sheets',
        description: `${res?.data?.rows_exported || 0} reports exported.${url ? ' Opening sheet...' : ''}`,
      });
      if (url) window.open(url, '_blank');
    } catch (err) {
      toast({ title: 'Export failed', description: err?.message, variant: 'destructive' });
    }
    setExporting(false);
  };

  const handleDownload = (report) => {
    if (report.pdf_url) window.open(report.pdf_url, '_blank');
  };

  const stats = {
    total:     reports.length,
    generated: reports.filter(r => r.status === 'generated').length,
    submitted: reports.filter(r => r.status === 'submitted').length,
    archived:  reports.filter(r => r.status === 'archived').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Compliance Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Regional targets, audit archives & Google Sheets export</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportToSheets} disabled={exporting} className="gap-2">
            <Sheet className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'Export to Sheets'}
          </Button>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            <Plus className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="targets">
        <TabsList>
          <TabsTrigger value="targets"><Target className="w-3.5 h-3.5 mr-1.5" />Regional Targets</TabsTrigger>
          <TabsTrigger value="archive"><Archive className="w-3.5 h-3.5 mr-1.5" />Report Archive</TabsTrigger>
        </TabsList>

        {/* ── Regional Targets Tab ── */}
        <TabsContent value="targets" className="mt-4">
          <RegionalTargetTracker />
        </TabsContent>

        {/* ── Archive Tab ── */}
        <TabsContent value="archive" className="mt-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Reports', count: stats.total,     icon: FileText,    color: 'text-blue-600'   },
              { label: 'Generated',     count: stats.generated, icon: CheckCircle, color: 'text-green-600'  },
              { label: 'Submitted',     count: stats.submitted, icon: Shield,      color: 'text-purple-600' },
              { label: 'Archived',      count: stats.archived,  icon: Archive,     color: 'text-gray-600'   },
            ].map(s => (
              <Card key={s.label} className="border-border/60">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                    <div>
                      <div className="text-xl font-bold font-jakarta">{s.count}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Generate Panel */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generate New Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Report Type</label>
                  <MobileSelect
                    value={reportType}
                    onChange={setReportType}
                    options={[
                      { value: 'route_completion',  label: 'Route Completion' },
                      { value: 'monthly_summary',   label: 'Monthly Summary' },
                      { value: 'payment_audit',     label: 'Payment Audit' },
                      { value: 'evidence_bundle',   label: 'Evidence Bundle' },
                    ]}
                    className="w-44"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Period From</label>
                  <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
                    className="border border-input bg-background rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Period To</label>
                  <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
                    className="border border-input bg-background rounded-lg px-3 py-2 text-sm" />
                </div>
                <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                  <FileText className="w-4 h-4" />
                  {generating ? 'Generating PDF...' : 'Generate & Archive'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Reports are automatically generated when a route is marked as completed. You can also generate period summaries manually above.
              </p>
            </CardContent>
          </Card>

          {/* Reports List */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Archived Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading reports...</div>
              ) : reports.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No compliance reports yet. Generate your first report above.
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map(report => (
                    <div key={report.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{report.report_number || report.id.slice(0, 12)}</p>
                          <p className="text-xs text-muted-foreground">
                            {report.report_type?.replace(/_/g, ' ')} · {report.period_from} → {report.period_to}
                            {report.jobs_count != null && ` · ${report.jobs_count} jobs`}
                            {report.evidence_photos_count != null && ` · ${report.evidence_photos_count} photos`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${statusColors[report.status] || 'bg-gray-100 text-gray-600'}`} variant="secondary">
                          {report.status}
                        </Badge>
                        {report.pdf_url && (
                          <Button size="sm" variant="outline" onClick={() => handleDownload(report)} className="gap-1 h-7 text-xs">
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}