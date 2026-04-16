import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

export default function BulkImportModal({ open, onClose, tenantId, onComplete }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [skipDups, setSkipDups] = useState(true);

  const handleFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResults(null);
    const text = await f.text();
    const rows = parseCSV(text);
    setParsedRows(rows);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await base44.functions.invoke('bulkImportCustomers', {
        rows: parsedRows,
        tenant_id: tenantId,
        skip_duplicates: skipDups,
      });
      setResults(res.data);
      toast({ title: `Imported ${res.data.summary.created} of ${res.data.summary.total} customers` });
      onComplete?.();
    } catch (err) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = 'full_name,phone,email,customer_type,customer_segment,address,district,bin_count,estimated_waste_kg_month,num_branches,institution_name,contact_person,mobile_money_provider,mobile_money_number,preferred_language,notes';
    const sample = '"John Doe","+256700123456","john@example.com","residential","individual","Makerere Hill Rd","Kampala","1","50","1","","","mtn","+256700123456","english","New customer"';
    const blob = new Blob([headers + '\n' + sample], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'customer_import_template.csv';
    a.click();
  };

  const reset = () => { setFile(null); setParsedRows([]); setResults(null); };

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-jakarta flex items-center gap-2">
            <Upload className="w-5 h-5" /> Bulk Customer Import
          </DialogTitle>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            {/* Template download */}
            <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-3">
              <div className="text-sm text-muted-foreground">
                Download the CSV template to ensure correct column format.
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1 shrink-0">
                <Download className="w-3.5 h-3.5" /> Template
              </Button>
            </div>

            {/* File upload */}
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 text-primary" />
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{parsedRows.length} rows detected</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to select CSV file</p>
                </div>
              )}
            </div>

            {/* Preview */}
            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Preview (first 5 rows)</div>
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Phone</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Segment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2">{r.full_name}</td>
                          <td className="p-2">{r.phone}</td>
                          <td className="p-2">{r.email}</td>
                          <td className="p-2">{r.customer_type}</td>
                          <td className="p-2">{r.customer_segment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-3">
                  <Switch id="skipDups" checked={skipDups} onCheckedChange={setSkipDups} />
                  <Label htmlFor="skipDups" className="text-sm">Skip duplicate records (AI detection)</Label>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { reset(); onClose(); }} className="flex-1">Cancel</Button>
              <Button onClick={handleImport} disabled={parsedRows.length === 0 || importing} className="flex-1 gap-2">
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                {importing ? `Importing ${parsedRows.length} rows...` : `Import ${parsedRows.length} Customers`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Results summary */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-3 pb-3 text-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                  <div className="text-xl font-bold text-green-700 mt-1">{results.summary.created}</div>
                  <div className="text-xs text-green-600">Created</div>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-3 pb-3 text-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mx-auto" />
                  <div className="text-xl font-bold text-orange-700 mt-1">{results.summary.skipped}</div>
                  <div className="text-xs text-orange-600">Skipped</div>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-3 pb-3 text-center">
                  <XCircle className="w-5 h-5 text-red-600 mx-auto" />
                  <div className="text-xl font-bold text-red-700 mt-1">{results.summary.errors}</div>
                  <div className="text-xs text-red-600">Errors</div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed report */}
            <div className="rounded-lg border overflow-y-auto max-h-60">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left p-2">Row</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map(r => (
                    <tr key={r.row} className="border-t">
                      <td className="p-2">{r.row}</td>
                      <td className="p-2">{r.full_name}</td>
                      <td className="p-2">
                        <Badge variant="secondary" className={`text-xs ${r.status === 'created' ? 'bg-green-100 text-green-700' : r.status === 'skipped' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {r.errors?.join('; ')}
                        {r.reason}
                        {r.duplicate && <span> — matches {r.duplicate.full_name} ({r.duplicate.score}%)</span>}
                        {r.tier_assigned && <span className="text-primary"> tier: {r.tier_assigned}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={() => { reset(); onClose(); }} className="w-full">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}