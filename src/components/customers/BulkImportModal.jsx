import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// ── Required columns and optional aliases ────────────────────────────────────
const REQUIRED_COLS = ['full_name', 'phone'];
const OPTIONAL_COLS = [
  'email', 'customer_type', 'customer_segment', 'address', 'district',
  'bin_count', 'estimated_waste_kg_month', 'num_branches',
  'institution_name', 'contact_person', 'mobile_money_provider',
  'mobile_money_number', 'preferred_language', 'notes',
];
const ALL_COLS = [...REQUIRED_COLS, ...OPTIONAL_COLS];

const ALIASES = {
  name: 'full_name', 'customer name': 'full_name', 'full name': 'full_name',
  'phone number': 'phone', mobile: 'phone', telephone: 'phone',
  'e-mail': 'email', 'email address': 'email',
  type: 'customer_type', segment: 'customer_segment',
  area: 'address', location: 'address',
  parish: 'district', region: 'district',
  bins: 'bin_count', 'no of bins': 'bin_count',
  'waste kg': 'estimated_waste_kg_month',
  org: 'institution_name', organization: 'institution_name', organisation: 'institution_name',
  contact: 'contact_person',
  momo: 'mobile_money_provider', provider: 'mobile_money_provider',
  'momo number': 'mobile_money_number',
  language: 'preferred_language',
  remarks: 'notes', comment: 'notes', comments: 'notes',
};

function normaliseHeader(h) {
  const lower = h.trim().toLowerCase().replace(/[^a-z0-9 _]/g, '');
  return ALIASES[lower] || lower.replace(/\s+/g, '_');
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const raw = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const headers = raw.map(normaliseHeader);
  const rows = lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g)
      || line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''); });
    return obj;
  });
  return { headers, rows };
}

function validateRows(rows) {
  return rows.map((row, i) => {
    const errs = [];
    if (!row.full_name) errs.push('full_name is required');
    if (!row.phone) errs.push('phone is required');
    if (row.customer_type && !['residential', 'commercial', 'industrial'].includes(row.customer_type)) {
      errs.push(`invalid customer_type "${row.customer_type}"`);
    }
    if (row.customer_segment && !['individual', 'sme', 'institution'].includes(row.customer_segment)) {
      errs.push(`invalid customer_segment "${row.customer_segment}"`);
    }
    return { row: i + 2, ...row, valid: errs.length === 0, errors: errs };
  });
}

export default function BulkImportModal({ open, onClose, tenantId, onComplete }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [detectedHeaders, setDetectedHeaders] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [skipDups, setSkipDups] = useState(true);

  const handleFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResults(null);

    const isExcel = f.name.endsWith('.xlsx') || f.name.endsWith('.xls');

    if (isExcel) {
      // Use ExtractDataFromUploadedFile for Excel files
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      const schema = {
        type: 'object',
        properties: Object.fromEntries(ALL_COLS.map(c => [c, { type: 'string' }])),
      };
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: schema,
      });
      if (result.status === 'success') {
        const raw = Array.isArray(result.output) ? result.output : [result.output];
        // Normalise headers
        const normalised = raw.map(obj => {
          const normalObj = {};
          for (const [k, v] of Object.entries(obj)) {
            normalObj[normaliseHeader(k)] = v;
          }
          return normalObj;
        });
        const headers = normalised.length > 0 ? Object.keys(normalised[0]) : [];
        setDetectedHeaders(headers);
        setParsedRows(normalised);
        setValidationResults(validateRows(normalised));
      } else {
        toast({ title: 'Failed to parse Excel file', description: result.details, variant: 'destructive' });
      }
    } else {
      const text = await f.text();
      const { headers, rows } = parseCSV(text);
      setDetectedHeaders(headers);
      setParsedRows(rows);
      setValidationResults(validateRows(rows));
    }
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((_, i) => validationResults[i]?.valid);
    setImporting(true);
    try {
      const res = await base44.functions.invoke('bulkImportCustomers', {
        rows: validRows,
        tenant_id: tenantId,
        skip_duplicates: skipDups,
      });
      setResults(res.data);
      toast({ title: `Imported ${res.data?.summary?.created ?? 0} customers` });
      onComplete?.();
    } catch (err) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ALL_COLS.join(',');
    const sample = '"John Doe","+256700123456","john@example.com","residential","individual","Makerere Hill Rd","Kampala","1","50","1","","","mtn","+256700123456","english","New customer"';
    const blob = new Blob([headers + '\n' + sample], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'customer_import_template.csv';
    a.click();
  };

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setDetectedHeaders([]);
    setValidationResults([]);
    setResults(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const validCount = validationResults.filter(r => r.valid).length;
  const invalidCount = validationResults.filter(r => !r.valid).length;

  const missingRequired = REQUIRED_COLS.filter(c => detectedHeaders.length > 0 && !detectedHeaders.includes(c));

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-jakarta flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Bulk Customer Import
          </DialogTitle>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            {/* Template download */}
            <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-3">
              <p className="text-sm text-muted-foreground">
                Download the CSV template with all supported columns.
              </p>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1 shrink-0">
                <Download className="w-3.5 h-3.5" /> Template
              </Button>
            </div>

            {/* Column reference */}
            <details className="text-xs border border-border rounded-lg overflow-hidden">
              <summary className="px-3 py-2 cursor-pointer text-muted-foreground hover:text-foreground bg-muted/40 select-none">
                Supported columns & aliases
              </summary>
              <div className="p-3 grid grid-cols-2 gap-x-6 gap-y-0.5">
                {REQUIRED_COLS.map(c => (
                  <span key={c} className="text-primary font-medium">{c} <span className="text-destructive">*</span></span>
                ))}
                {OPTIONAL_COLS.map(c => (
                  <span key={c} className="text-muted-foreground">{c}</span>
                ))}
              </div>
              <p className="px-3 pb-2 text-muted-foreground">
                Column headers are matched automatically — common variations like "Name", "Mobile", "Organization" are recognised.
              </p>
            </details>

            {/* File upload */}
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { fileRef.current.files = e.dataTransfer.files; handleFile({ target: { files: [f] } }); } }}
              onDragOver={e => e.preventDefault()}
            >
              <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={handleFile} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 text-primary" />
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{parsedRows.length} rows detected</p>
                  <button onClick={e => { e.stopPropagation(); reset(); }} className="text-xs text-muted-foreground hover:text-destructive underline">
                    Remove & re-upload
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click or drag & drop a CSV or Excel file</p>
                  <p className="text-xs text-muted-foreground">.csv, .xlsx, .xls supported</p>
                </div>
              )}
            </div>

            {/* Column mapping feedback */}
            {detectedHeaders.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Detected columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {detectedHeaders.map(h => {
                    const isKnown = ALL_COLS.includes(h);
                    const isRequired = REQUIRED_COLS.includes(h);
                    return (
                      <Badge
                        key={h}
                        variant="secondary"
                        className={`text-xs ${isRequired ? 'bg-green-100 text-green-700' : isKnown ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}
                      >
                        {h}
                      </Badge>
                    );
                  })}
                </div>
                {missingRequired.length > 0 && (
                  <p className="text-xs text-destructive">
                    ⚠ Missing required columns: {missingRequired.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Validation summary */}
            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                    ✓ {validCount} valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-200">
                      ✗ {invalidCount} with errors (will be skipped)
                    </span>
                  )}
                </div>

                {/* Preview table */}
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
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className={`border-t ${!validationResults[i]?.valid ? 'bg-red-50/50' : ''}`}>
                          <td className="p-2 text-muted-foreground">{i + 2}</td>
                          <td className="p-2">{r.full_name}</td>
                          <td className="p-2">{r.phone}</td>
                          <td className="p-2">{r.email}</td>
                          <td className="p-2">{r.customer_type}</td>
                          <td className="p-2">
                            {validationResults[i]?.valid ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-600" title={validationResults[i]?.errors?.join('; ')}>
                                ✗ {validationResults[i]?.errors?.[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Error rows (if any) */}
                {invalidCount > 0 && (
                  <details className="text-xs border border-red-200 rounded-lg overflow-hidden">
                    <summary className="px-3 py-2 cursor-pointer bg-red-50 text-red-700 hover:bg-red-100 select-none">
                      {invalidCount} rows with errors (click to review)
                    </summary>
                    <div className="divide-y">
                      {validationResults.filter(r => !r.valid).map(r => (
                        <div key={r.row} className="px-3 py-1.5 flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0">Row {r.row}</span>
                          <span className="font-medium shrink-0">{r.full_name || '(no name)'}</span>
                          <span className="text-red-600">{r.errors?.join('; ')}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="flex items-center gap-3">
                  <Switch id="skipDups" checked={skipDups} onCheckedChange={setSkipDups} />
                  <Label htmlFor="skipDups" className="text-sm">Skip duplicate records (AI detection)</Label>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { reset(); onClose(); }} className="flex-1">Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || importing || missingRequired.length > 0}
                className="flex-1 gap-2"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                {importing
                  ? `Importing ${validCount} rows...`
                  : `Import ${validCount} Customer${validCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-3 pb-3 text-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                  <div className="text-xl font-bold text-green-700 mt-1">{results.summary?.created ?? 0}</div>
                  <div className="text-xs text-green-600">Created</div>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-3 pb-3 text-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mx-auto" />
                  <div className="text-xl font-bold text-orange-700 mt-1">{results.summary?.skipped ?? 0}</div>
                  <div className="text-xs text-orange-600">Skipped</div>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-3 pb-3 text-center">
                  <XCircle className="w-5 h-5 text-red-600 mx-auto" />
                  <div className="text-xl font-bold text-red-700 mt-1">{results.summary?.errors ?? 0}</div>
                  <div className="text-xs text-red-600">Errors</div>
                </CardContent>
              </Card>
            </div>

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
                  {(results.results || []).map(r => (
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