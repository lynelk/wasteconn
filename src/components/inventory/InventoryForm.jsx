import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function InventoryForm({ item, onSaved, onCancel }) {
  const [form, setForm] = useState({
    tenant_id: 'default',
    item_name: item?.item_name || '',
    category: item?.category || 'other',
    sku: item?.sku || '',
    current_stock: item?.current_stock ?? 0,
    unit_of_measure: item?.unit_of_measure || 'units',
    safety_threshold: item?.safety_threshold ?? 10,
    reorder_quantity: item?.reorder_quantity ?? 50,
    unit_cost_ugx: item?.unit_cost_ugx || '',
    supplier_name: item?.supplier_name || '',
    supplier_contact: item?.supplier_contact || '',
    location: item?.location || '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form, current_stock: Number(form.current_stock), safety_threshold: Number(form.safety_threshold), reorder_quantity: Number(form.reorder_quantity), unit_cost_ugx: form.unit_cost_ugx ? Number(form.unit_cost_ugx) : undefined };
    if (item?.id) {
      await base44.entities.Inventory.update(item.id, data);
    } else {
      await base44.entities.Inventory.create(data);
    }
    setSaving(false);
    onSaved();
  };

  const field = (label, key, type = 'text', opts = null) => (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {opts ? (
        <select
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm"
        >
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full border border-input bg-background rounded-lg px-3 py-2 text-sm"
        />
      )}
    </div>
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{item ? 'Edit Item' : 'Add Inventory Item'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {field('Item Name *', 'item_name')}
          {field('Category', 'category', 'text', [
            { value: 'bags', label: 'Bags' },
            { value: 'safety_gear', label: 'Safety Gear' },
            { value: 'fuel_cans', label: 'Fuel Cans' },
            { value: 'tools', label: 'Tools' },
            { value: 'ppe', label: 'PPE' },
            { value: 'other', label: 'Other' },
          ])}
          {field('SKU', 'sku')}
          {field('Current Stock *', 'current_stock', 'number')}
          {field('Unit of Measure', 'unit_of_measure', 'text', [
            { value: 'units', label: 'Units' },
            { value: 'litres', label: 'Litres' },
            { value: 'kg', label: 'Kg' },
            { value: 'boxes', label: 'Boxes' },
            { value: 'rolls', label: 'Rolls' },
          ])}
          {field('Safety Threshold *', 'safety_threshold', 'number')}
          {field('Reorder Quantity', 'reorder_quantity', 'number')}
          {field('Unit Cost (UGX)', 'unit_cost_ugx', 'number')}
          {field('Supplier Name', 'supplier_name')}
          {field('Supplier Contact', 'supplier_contact')}
          {field('Storage Location', 'location')}
          {field('Notes', 'notes')}
          <div className="sm:col-span-2 lg:col-span-3 flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : item ? 'Update' : 'Add Item'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}