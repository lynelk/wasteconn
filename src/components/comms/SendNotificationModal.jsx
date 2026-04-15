import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

const templates = {
  pickup_reminder: (name) => `Dear ${name}, this is a reminder that your waste collection is scheduled for tomorrow. Please ensure your bins are accessible. - NLS Waste Services`,
  pickup_completed: (name) => `Dear ${name}, your waste collection has been completed successfully. Thank you for keeping your area clean! - NLS Waste Services`,
  pickup_missed: (name) => `Dear ${name}, we were unable to complete your scheduled collection today. Our team will reschedule within 24 hours. We apologize for the inconvenience. - NLS Waste Services`,
  invoice_issued: (name) => `Dear ${name}, a new invoice has been issued to your account. Please log in to your customer portal to view and pay your invoice. - NLS Waste Services`,
  invoice_overdue: (name) => `Dear ${name}, your invoice is now overdue. Please make payment at your earliest convenience to avoid service suspension. - NLS Waste Services`,
  payment_received: (name) => `Dear ${name}, we have received your payment. Thank you! Your account has been updated. - NLS Waste Services`,
  welcome: (name) => `Welcome to NLS Waste Services, ${name}! We are delighted to have you as our customer. Your waste collection service will begin shortly. - NLS Waste Services`,
  custom: () => '',
};

export default function SendNotificationModal({ customers, onClose, onSaved }) {
  const [form, setForm] = useState({
    customer_id: '', channel: 'email', template_type: 'pickup_reminder', subject: '', body: '',
  });

  const selectedCustomer = customers.find(c => c.id === form.customer_id);

  const handleTemplateChange = (type) => {
    const name = selectedCustomer?.full_name || 'Customer';
    setForm(f => ({ ...f, template_type: type, body: templates[type]?.(name) || '' }));
  };

  const handleCustomerChange = (id) => {
    const cust = customers.find(c => c.id === id);
    const name = cust?.full_name || 'Customer';
    setForm(f => ({ ...f, customer_id: id, recipient_email: cust?.email, recipient_phone: cust?.phone, body: templates[f.template_type]?.(name) || f.body }));
  };

  const sendMutation = useMutation({
    mutationFn: async (data) => {
      const notification = await base44.entities.Notification.create({
        ...data,
        tenant_id: selectedCustomer?.tenant_id || '',
        recipient_email: selectedCustomer?.email,
        recipient_phone: selectedCustomer?.phone,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      // Actually send email if channel is email
      if (data.channel === 'email' && selectedCustomer?.email) {
        await base44.integrations.Core.SendEmail({
          to: selectedCustomer.email,
          subject: data.subject || data.template_type?.replace(/_/g, ' '),
          body: data.body,
        });
      }
      return notification;
    },
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold font-jakarta">Send Notification</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Customer</label>
            <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
              value={form.customer_id} onChange={e => handleCustomerChange(e.target.value)}>
              <option value="">Select customer...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} — {c.email || c.phone}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Channel</label>
            <div className="flex gap-2">
              {['email','sms','in_app'].map(ch => (
                <button key={ch} onClick={() => setForm(f => ({ ...f, channel: ch }))}
                  className={`flex-1 py-2 text-xs rounded-lg border font-medium capitalize transition-all ${form.channel === ch ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
                  {ch.replace('_',' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Template</label>
            <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
              value={form.template_type} onChange={e => handleTemplateChange(e.target.value)}>
              {Object.keys(templates).map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          {form.channel === 'email' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject</label>
              <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject..." />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message</label>
            <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none" rows={5}
              value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => sendMutation.mutate(form)} disabled={sendMutation.isPending || !form.customer_id || !form.body}>
              {sendMutation.isPending ? 'Sending...' : <><Send className="w-4 h-4" /> Send</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}