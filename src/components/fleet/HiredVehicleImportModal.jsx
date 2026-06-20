import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import DownloadTemplateButton from '@/components/common/DownloadTemplateButton';

const CSV_TEMPLATE = `provider_code,client_name,contact_person,phone,email,vehicle_type,capacity,rate_per_trip_ugx,rate_per_day_ugx,availability,mou_status
HV-001,ABC Transport Ltd,John Doe,+256700000001,abc@example.com,truck,5 tonnes,150000,600000,on_call,MOU Signed
HV-002,XYZ Logistics,Jane Smith,+256700000002,xyz@example.com,tipper,8 tonnes,200000,800000,weekdays,No MOU`;

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

export default function HiredVehicleImportModal({ onClose }) {
  const qc = useQueryClient();
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);
  const [status, setStatus] = useState(null); // null | 'importing' | 'success' | 'error'
  const [importCount, setImportCount] = useState(0);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setCsvText(text);
      setPreview(parseCSV(text).slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const rows = parseCSV(csvText);
    if (!rows.length) return;
    setStatus('importing');
    const tenants = await base44.entities.Tenant.list();
    const tenantId = tenants[0]?.id || '';
    const records = rows.map(r => ({
      tenant_id: tenantId,
      provider_code: r.provider_code || '',
      client_name: r.client_name || '',
      contact_person: r.contact_person || '',
      phone: r.phone || '',
      email: r.email || '',
      vehicle_type: r.vehicle_type || 'truck',
      capacity: r.capacity || '',
      rate_per_trip_ugx: parseFloat(r.rate_per_trip_ugx) || 0,
      rate_per_day_ugx: parseFloat(r.rate_per_day_ugx) || 0,
      availability: r.availability || 'on_call',
      mou_status: r.mou_status || 'No MOU',
      status: 'active',
    }));
    await base44.entities.HiredVehicleProvider.bulkCreate(records);
    setImportCount(records.length);
    setStatus('success');
    qc.invalidateQueries({ queryKey: ['hired-providers'] });
  };

  const TEMPLATE_COLUMNS = [
    { key: 'provider_code', sample: 'HV-001', notes: 'Unique provider code' },
    { key: 'client_name', sample: 'ABC Transport Ltd', notes: 'Company / provider name' },
    { key: 'contact_person', sample: 'John Doe', notes: 'Primary contact name' },
    { key: 'phone', sample: '+256700000001', notes: 'Phone number' },
    { key: 'email', sample: 'abc@example.com', notes: 'Email address' },
    { key: 'vehicle_type', sample: 'truck', notes: 'truck | tipper | pickup | van' },
    { key: 'capacity', sample: '5 tonnes', notes: 'Vehicle capacity description' },
    { key: 'rate_per_trip_ugx', sample: '150000', notes: 'Rate per trip in UGX' },
    { key: 'rate_per_day_ugx', sample: '600000', notes: 'Rate per day in UGX' },
    { key: 'availability', sample: 'on_call', notes: 'on_call | weekdays | weekends | fulltime' },
    { key: 'mou_status', sample: 'MOU Signed', notes: 'MOU Signed | No MOU | Pending' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold font-jakarta text-lg">Import Providers from CSV</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {status === 'success' ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="font-semibold">{importCount} providers imported successfully!</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-secondary/30 rounded-xl p-3">
              <p className="text-sm text-muted-foreground">Download the import template</p>
              <DownloadTemplateButton
                filename="hired_vehicle_providers_template"
                columns={TEMPLATE_COLUMNS}
                required={['provider_code', 'client_name', 'phone']}
              />
            </div>

            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">Upload your CSV file</p>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload">
                <Button variant="outline" size="sm" asChild>
                  <span className="cursor-pointer">Choose File</span>
                </Button>
              </label>
            </div>

            {preview.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview (first 5 rows):</p>
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        {['code', 'name', 'type', 'rate/trip', 'mou'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-t border-border/40">
                          <td className="px-3 py-1.5">{r.provider_code}</td>
                          <td className="px-3 py-1.5 font-medium">{r.client_name}</td>
                          <td className="px-3 py-1.5 capitalize">{r.vehicle_type}</td>
                          <td className="px-3 py-1.5">{Number(r.rate_per_trip_ugx).toLocaleString()}</td>
                          <td className="px-3 py-1.5">{r.mou_status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={handleImport}
                disabled={!csvText || status === 'importing'}
              >
                {status === 'importing' ? 'Importing...' : `Import ${parseCSV(csvText).length || 0} Records`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}