import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { logger } from '@/lib/logger';
import { Package, AlertTriangle, Plus, CheckCircle, RefreshCw, ShoppingCart } from 'lucide-react';
import ExportButton from '@/components/export/ExportButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import InventoryForm from '@/components/inventory/InventoryForm';
import InventoryAlertBanner from '@/components/inventory/InventoryAlertBanner';

const categoryColors = {
  bags: 'bg-blue-100 text-blue-700',
  safety_gear: 'bg-orange-100 text-orange-700',
  fuel_cans: 'bg-red-100 text-red-700',
  tools: 'bg-gray-100 text-gray-700',
  ppe: 'bg-yellow-100 text-yellow-700',
  other: 'bg-purple-100 text-purple-700',
};

const poStatusColors = {
  none: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-100 text-yellow-700',
  submitted: 'bg-blue-100 text-blue-700',
  fulfilled: 'bg-green-100 text-green-700',
};

export default function Inventory() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  const [alertResult, setAlertResult] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => base44.entities.Inventory.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Inventory.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const belowThreshold = items.filter(i => i.current_stock <= i.safety_threshold);
  const okItems = items.filter(i => i.current_stock > i.safety_threshold);

  const handleCheckAlerts = async () => {
    setCheckingAlerts(true);
    setAlertResult(null);
    try {
      const res = await base44.functions.invoke('checkInventoryAlerts', {});
      setAlertResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (err) {
      logger.error('inventory.alertCheck.error', { message: err?.message });
    }
    setCheckingAlerts(false);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditItem(null);
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  };

  const stats = {
    total: items.length,
    low: belowThreshold.length,
    pending_po: items.filter(i => i.po_status === 'pending' || i.po_status === 'submitted').length,
    ok: okItems.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">Inventory</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track waste collection supplies and automate purchase orders</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            title="Inventory"
            columns={[
              { label: 'Item Name', key: 'item_name' },
              { label: 'Category', key: 'category' },
              { label: 'SKU', key: 'sku' },
              { label: 'Stock', key: 'current_stock' },
              { label: 'Unit', key: 'unit_of_measure' },
              { label: 'Threshold', key: 'safety_threshold' },
              { label: 'Supplier', key: 'supplier_name' },
              { label: 'PO Status', key: 'po_status' },
              { label: 'Unit Cost (UGX)', key: 'unit_cost_ugx' },
            ]}
            rows={items}
          />
          <Button variant="outline" onClick={handleCheckAlerts} disabled={checkingAlerts} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${checkingAlerts ? 'animate-spin' : ''}`} />
            {checkingAlerts ? 'Checking...' : 'Run Alert Check'}
          </Button>
          <Button onClick={() => { setEditItem(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Item
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Items', count: stats.total, icon: Package, color: 'text-blue-600' },
          { label: 'Low Stock', count: stats.low, icon: AlertTriangle, color: 'text-red-600' },
          { label: 'Pending POs', count: stats.pending_po, icon: ShoppingCart, color: 'text-yellow-600' },
          { label: 'Adequate', count: stats.ok, icon: CheckCircle, color: 'text-green-600' },
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

      {/* Alert result banner */}
      {alertResult && (
        <InventoryAlertBanner result={alertResult} onDismiss={() => setAlertResult(null)} />
      )}

      {/* Low Stock Alert */}
      {belowThreshold.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-400 font-semibold text-sm">
            {belowThreshold.length} item{belowThreshold.length > 1 ? 's' : ''} below safety threshold
          </span>
          <span className="text-xs text-muted-foreground">Click "Run Alert Check" to trigger purchase orders via Merx365.</span>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <InventoryForm
          item={editItem}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditItem(null); }}
        />
      )}

      {/* Inventory Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stock Items</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading inventory...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No inventory items yet. Add your first item above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Item</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Category</th>
                    <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Stock</th>
                    <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Threshold</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Supplier</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">PO Status</th>
                    <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const isLow = item.current_stock <= item.safety_threshold;
                    return (
                      <tr key={item.id} className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${isLow ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                        <td className="py-2 px-2">
                          <div className="font-medium">{item.item_name}</div>
                          {item.sku && <div className="text-xs text-muted-foreground">{item.sku}</div>}
                        </td>
                        <td className="py-2 px-2">
                          <Badge className={`text-xs ${categoryColors[item.category] || 'bg-gray-100 text-gray-600'}`} variant="secondary">
                            {item.category?.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span className={`font-bold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                            {item.current_stock}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">{item.unit_of_measure}</span>
                          {isLow && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />}
                        </td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{item.safety_threshold} {item.unit_of_measure}</td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">{item.supplier_name || '—'}</td>
                        <td className="py-2 px-2">
                          <Badge className={`text-xs ${poStatusColors[item.po_status] || 'bg-gray-100 text-gray-600'}`} variant="secondary">
                            {item.po_status || 'none'}
                          </Badge>
                          {item.merx365_po_id && <div className="text-xs text-muted-foreground mt-0.5">#{item.merx365_po_id}</div>}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditItem(item); setShowForm(true); }}>Edit</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(item.id)}>Delete</Button>
                          </div>
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
    </div>
  );
}