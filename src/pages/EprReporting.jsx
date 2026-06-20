import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Recycle, Plus, FileText, Loader2, Download, CheckCircle, Clock, X } from 'lucide-react';
import { toast } from 'sonner';

const MATERIAL_OPTIONS = ['plastic', 'paper', 'glass', 'metal', 'organic', 'e_waste', 'textile', 'mixed'];

const STATUS_BADGE = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700'
};

function ProducerForm({ producer, onClose, onSaved }) {
  const [form, setForm] = useState(producer || {
    company_name: '', registration_no: '', epr_scheme: '', contract_ref: '',
    contact_email: '', materials: [], active: true, tenant_id: 'default'
  });
  const [saving, setSaving] = useState(false);

  const toggleMaterial = (m) => {
    setForm(f => ({
      ...f,
      materials: f.materials.includes(m) ? f.materials.filter(x => x !== m) : [...f.materials, m]
    }));
  };

  const handleSave = async () => {
    if (!form.company_name) return toast.error('Company name required');
    setSaving(true);
    try {
      if (form.id) {
        await base44.entities.Producer.update(form.id, form);
      } else {
        await base44.entities.Producer.create(form);
      }
      toast.success('Producer saved');
      onSaved();
      onClose();
    } catch (e) {
      toast.error('Failed to save producer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Company Name *</Label>
          <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
        </div>
        <div>
          <Label>Registration No.</Label>
          <Input value={form.registration_no || ''} onChange={e => setForm(f => ({ ...f, registration_no: e.target.value }))} />
        </div>
        <div>
          <Label>EPR Scheme</Label>
          <Input value={form.epr_scheme || ''} onChange={e => setForm(f => ({ ...f, epr_scheme: e.target.value }))} placeholder="e.g. NEMA EPR 2024" />
        </div>
        <div>
          <Label>Contract Ref</Label>
          <Input value={form.contract_ref || ''} onChange={e => setForm(f => ({ ...f, contract_ref: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <Label>Contact Email</Label>
          <Input type="email" value={form.contact_email || ''} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
        </div>
      </div>
      <div>
        <Label className="mb-2 block">Materials Covered</Label>
        <div className="flex flex-wrap gap-2">
          {MATERIAL_OPTIONS.map(m => (
            <button
              key={m}
              onClick={() => toggleMaterial(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                form.materials.includes(m) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          Save Producer
        </Button>
      </div>
    </div>
  );
}

function GenerateReportDialog({ producers, onClose, onGenerated }) {
  const [producerId, setProducerId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!producerId || !periodFrom || !periodTo) return toast.error('All fields required');
    setGenerating(true);
    try {
      await base44.functions.invoke('generateEprReport', { producer_id: producerId, period_from: periodFrom, period_to: periodTo });
      toast.success('EPR report generated');
      onGenerated();
      onClose();
    } catch (e) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Producer</Label>
        <Select value={producerId} onValueChange={setProducerId}>
          <SelectTrigger><SelectValue placeholder="Select producer..." /></SelectTrigger>
          <SelectContent>
            {producers.map(p => <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Period From</Label>
          <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} />
        </div>
        <div>
          <Label>Period To</Label>
          <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />}
          Generate Report
        </Button>
      </div>
    </div>
  );
}

export default function EprReporting() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [producerDialog, setProducerDialog] = useState(null); // null | 'new' | producer_obj
  const [reportDialog, setReportDialog] = useState(false);

  const { data: producers = [], refetch: refetchProducers } = useQuery({
    queryKey: ['producers'],
    queryFn: () => base44.entities.Producer.list('-created_date', 100)
  });

  const { data: reports = [], refetch: refetchReports } = useQuery({
    queryKey: ['epr-reports'],
    queryFn: () => base44.entities.EprReport.list('-created_date', 100)
  });

  const deleteProducer = async (id) => {
    await base44.entities.Producer.delete(id);
    refetchProducers();
    toast.success('Producer removed');
  };

  const updateReportStatus = async (report, status) => {
    await base44.entities.EprReport.update(report.id, { status });
    refetchReports();
    toast.success(`Report marked as ${status}`);
  };

  const producerMap = Object.fromEntries(producers.map(p => [p.id, p]));

  if (!['admin', 'super_admin'].includes(user?.role)) {
    return <div className="p-8 text-center text-muted-foreground">Access restricted to administrators.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">EPR Reporting</h1>
          <p className="text-muted-foreground text-sm mt-1">Extended Producer Responsibility compliance & material recovery</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReportDialog(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
          <Button onClick={() => setProducerDialog('new')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Producer
          </Button>
        </div>
      </div>

      <Tabs defaultValue="producers">
        <TabsList>
          <TabsTrigger value="producers">Producers ({producers.length})</TabsTrigger>
          <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="producers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {producers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Recycle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No producers registered. Add brand owners participating in your EPR scheme.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Company</th>
                        <th className="text-left px-4 py-3 font-medium">Reg. No.</th>
                        <th className="text-left px-4 py-3 font-medium">Materials</th>
                        <th className="text-left px-4 py-3 font-medium">EPR Scheme</th>
                        <th className="text-left px-4 py-3 font-medium">Contact</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-right px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {producers.map(p => (
                        <tr key={p.id} className="border-t hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{p.company_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.registration_no || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(p.materials || []).map(m => (
                                <span key={m} className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">{m}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.epr_scheme || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.contact_email || '—'}</td>
                          <td className="px-4 py-3">
                            <Badge className={p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                              {p.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setProducerDialog(p)}>Edit</Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteProducer(p.id)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {reports.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No reports generated yet. Use "Generate Report" to create your first EPR compliance document.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Producer</th>
                        <th className="text-left px-4 py-3 font-medium">Period</th>
                        <th className="text-right px-4 py-3 font-medium">Total Recovered (kg)</th>
                        <th className="text-right px-4 py-3 font-medium">Diversion Rate</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-right px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map(r => {
                        const producer = producerMap[r.producer_id];
                        return (
                          <tr key={r.id} className="border-t hover:bg-muted/20">
                            <td className="px-4 py-3 font-medium">{producer?.company_name || r.producer_id}</td>
                            <td className="px-4 py-3 text-muted-foreground">{r.period_from} → {r.period_to}</td>
                            <td className="px-4 py-3 text-right font-semibold">{(r.total_recovered_kg || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">{r.diversion_rate || 0}%</td>
                            <td className="px-4 py-3">
                              <Badge className={STATUS_BADGE[r.status] || STATUS_BADGE.draft}>{r.status}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                              {r.document_url && (
                                <a href={r.document_url} download={`EPR_${producer?.company_name}_${r.period_from}.txt`}>
                                  <Button variant="ghost" size="sm">
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </a>
                              )}
                              {r.status === 'draft' && (
                                <Button variant="ghost" size="sm" onClick={() => updateReportStatus(r, 'submitted')}>
                                  Submit
                                </Button>
                              )}
                              {r.status === 'submitted' && (
                                <Button variant="ghost" size="sm" onClick={() => updateReportStatus(r, 'accepted')}>
                                  <CheckCircle className="w-4 h-4 mr-1 text-green-600" /> Accept
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Producer Form Dialog */}
      <Dialog open={!!producerDialog} onOpenChange={() => setProducerDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{producerDialog === 'new' ? 'Register Producer' : 'Edit Producer'}</DialogTitle>
          </DialogHeader>
          <ProducerForm
            producer={producerDialog === 'new' ? null : producerDialog}
            onClose={() => setProducerDialog(null)}
            onSaved={refetchProducers}
          />
        </DialogContent>
      </Dialog>

      {/* Generate Report Dialog */}
      <Dialog open={reportDialog} onOpenChange={setReportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate EPR Report</DialogTitle>
          </DialogHeader>
          <GenerateReportDialog
            producers={producers.filter(p => p.active)}
            onClose={() => setReportDialog(false)}
            onGenerated={refetchReports}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}