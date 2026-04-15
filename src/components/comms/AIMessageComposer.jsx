import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Zap, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AIMessageComposer({ customers, onClose, onSaved }) {
  const [context, setContext] = useState('');
  const [channel, setChannel] = useState('email');
  const [generated, setGenerated] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState([]);

  const generateMutation = useMutation({
    mutationFn: () => base44.integrations.Core.InvokeLLM({
      prompt: `You are a communications AI for NLS Waste Services, a Ugandan waste management company.
Write a professional, friendly customer notification message.
Context: ${context}
Channel: ${channel} (${channel === 'sms' ? 'keep under 160 characters' : 'can be longer, use clear paragraphs'})
Tone: Professional but warm, Uganda-appropriate.
Return a subject line and message body.`,
      response_json_schema: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
          suggested_template_type: { type: 'string' },
        }
      }
    }),
    onSuccess: (data) => setGenerated(data),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const targets = selectedCustomers.length > 0
        ? customers.filter(c => selectedCustomers.includes(c.id))
        : customers.slice(0, 1);

      for (const customer of targets) {
        await base44.entities.Notification.create({
          customer_id: customer.id,
          tenant_id: customer.tenant_id || '',
          channel,
          template_type: generated.suggested_template_type || 'custom',
          subject: generated.subject,
          body: generated.body,
          recipient_email: customer.email,
          recipient_phone: customer.phone,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
        if (channel === 'email' && customer.email) {
          await base44.integrations.Core.SendEmail({
            to: customer.email,
            subject: generated.subject,
            body: generated.body,
          });
        }
      }
    },
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="font-semibold font-jakarta">AI Message Composer</h3>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">What do you want to communicate?</label>
            <textarea
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none"
              rows={3}
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="e.g. Remind customers in Zone A that collection is delayed by 2 hours tomorrow due to road works..."
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Channel</label>
            <div className="flex gap-2">
              {['email','sms','in_app'].map(ch => (
                <button key={ch} onClick={() => setChannel(ch)}
                  className={`flex-1 py-2 text-xs rounded-lg border font-medium capitalize transition-all ${channel === ch ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
                  {ch.replace('_',' ')}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || !context}>
            {generateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Zap className="w-4 h-4" /> Generate Message</>}
          </Button>

          {generated && (
            <div className="space-y-3 border border-primary/30 rounded-xl p-4 bg-primary/5">
              <p className="text-xs font-semibold text-primary">AI Generated Message</p>
              {generated.subject && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
                  <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                    value={generated.subject} onChange={e => setGenerated(g => ({ ...g, subject: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Body</label>
                <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none" rows={5}
                  value={generated.body} onChange={e => setGenerated(g => ({ ...g, body: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Send to ({selectedCustomers.length === 0 ? 'first customer' : selectedCustomers.length + ' selected'})</label>
                <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                  {customers.slice(0, 20).map(c => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer text-xs py-0.5">
                      <input type="checkbox" checked={selectedCustomers.includes(c.id)}
                        onChange={e => setSelectedCustomers(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} />
                      {c.full_name} — {c.email || c.phone}
                    </label>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
                {sendMutation.isPending ? 'Sending...' : <><Send className="w-4 h-4" /> Send Message</>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}