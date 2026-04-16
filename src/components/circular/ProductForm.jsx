import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export default function ProductForm({ product, onClose }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || 'other',
    price_ugx: product?.price_ugx || '',
    stock_quantity: product?.stock_quantity ?? 0,
    unit_of_measure: product?.unit_of_measure || 'unit',
    weight_capacity_kg: product?.weight_capacity_kg || '',
    volume_capacity_litres: product?.volume_capacity_litres || '',
    material_type: product?.material_type || '',
    colour: product?.colour || '',
    dimensions: product?.dimensions || '',
    recyclable: product?.recyclable ?? false,
    eco_certified: product?.eco_certified ?? false,
    sku: product?.sku || '',
    status: product?.status || 'available',
    image_url: product?.image_url || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data) => product
      ? base44.entities.Product.update(product.id, data)
      : base44.entities.Product.create({ ...data, tenant_id: user?.tenant_id || 'default' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast({ title: product ? 'Product updated' : 'Product created' });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      price_ugx: Number(form.price_ugx),
      stock_quantity: Number(form.stock_quantity),
      weight_capacity_kg: form.weight_capacity_kg ? Number(form.weight_capacity_kg) : undefined,
      volume_capacity_litres: form.volume_capacity_litres ? Number(form.volume_capacity_litres) : undefined,
    };
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Product Name *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bin">Bin</SelectItem>
              <SelectItem value="liner">Liner</SelectItem>
              <SelectItem value="recyclable_material">Recyclable Material</SelectItem>
              <SelectItem value="composting_kit">Composting Kit</SelectItem>
              <SelectItem value="cleaning_supply">Cleaning Supply</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Price (UGX) *</Label>
          <Input type="number" min={0} value={form.price_ugx} onChange={e => set('price_ugx', e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label>Stock Quantity</Label>
          <Input type="number" min={0} value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Unit of Measure</Label>
          <Select value={form.unit_of_measure} onValueChange={v => set('unit_of_measure', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['unit','pack','roll','kg','litre'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>SKU</Label>
          <Input value={form.sku} onChange={e => set('sku', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Weight Capacity (kg)</Label>
          <Input type="number" min={0} value={form.weight_capacity_kg} onChange={e => set('weight_capacity_kg', e.target.value)} className="mt-1" placeholder="For bins" />
        </div>
        <div>
          <Label>Volume Capacity (litres)</Label>
          <Input type="number" min={0} value={form.volume_capacity_litres} onChange={e => set('volume_capacity_litres', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Material Type</Label>
          <Input value={form.material_type} onChange={e => set('material_type', e.target.value)} className="mt-1" placeholder="e.g. HDPE plastic" />
        </div>
        <div>
          <Label>Colour</Label>
          <Input value={form.colour} onChange={e => set('colour', e.target.value)} className="mt-1" />
        </div>
        <div className="col-span-2">
          <Label>Dimensions</Label>
          <Input value={form.dimensions} onChange={e => set('dimensions', e.target.value)} className="mt-1" placeholder="e.g. 60cm × 40cm × 80cm" />
        </div>
        <div className="col-span-2">
          <Label>Image URL</Label>
          <Input value={form.image_url} onChange={e => set('image_url', e.target.value)} className="mt-1" placeholder="https://..." />
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={e => set('description', e.target.value)} className="mt-1" rows={2} />
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.recyclable} onCheckedChange={v => set('recyclable', v)} />
          <Label>Recyclable</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.eco_certified} onCheckedChange={v => set('eco_certified', v)} />
          <Label>Eco-certified</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save Product'}</Button>
      </div>
    </form>
  );
}