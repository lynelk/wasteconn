import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Recycle, Plus, ShoppingCart, Package, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductForm from '@/components/circular/ProductForm';
import OrderList from '@/components/circular/OrderList';

const categoryColors = {
  bin: 'bg-blue-100 text-blue-700',
  liner: 'bg-green-100 text-green-700',
  recyclable_material: 'bg-yellow-100 text-yellow-700',
  composting_kit: 'bg-emerald-100 text-emerald-700',
  cleaning_supply: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-600',
};

export default function CircularEconomy() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Product.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['customer-orders'],
    queryFn: () => base44.entities.CustomerOrder.list('-created_date', 100),
  });

  const available = products.filter(p => p.status === 'available');
  const outOfStock = products.filter(p => p.status === 'out_of_stock');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta flex items-center gap-2"><Recycle className="w-6 h-6 text-primary" /> Circular Economy</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage eco-products, customer orders & delivery tracking</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Available Products', value: available.length, color: 'text-green-600' },
          { label: 'Out of Stock', value: outOfStock.length, color: 'text-red-600' },
          { label: 'Total Orders', value: orders.length, color: 'text-blue-600' },
          { label: 'Pending Delivery', value: orders.filter(o => ['pending','scheduled','in_transit'].includes(o.delivery_status)).length, color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className={`text-2xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products" className="gap-2"><Package className="w-4 h-4" /> Products</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2"><ShoppingCart className="w-4 h-4" /> Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          {isLoading ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-48 rounded-xl bg-muted animate-pulse"/>)}</div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Recycle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No products yet. Add eco-products to start selling.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map(p => (
                <Card key={p.id} className={`border-border/60 hover:shadow-md transition-shadow ${p.status === 'discontinued' ? 'opacity-50' : ''}`}>
                  {p.image_url && (
                    <div className="h-40 overflow-hidden rounded-t-xl">
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-bold font-jakarta text-sm">{p.name}</p>
                      <Badge className={`text-xs ${categoryColors[p.category] || categoryColors.other}`} variant="secondary">
                        {p.category?.replace('_', ' ')}
                      </Badge>
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{p.description}</p>}
                    <div className="flex items-end gap-1 mb-2">
                      <span className="text-lg font-bold text-primary font-jakarta">{(p.price_ugx || 0).toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground pb-0.5">UGX / {p.unit_of_measure}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span>Stock: {p.stock_quantity} {p.unit_of_measure}</span>
                      {p.weight_capacity_kg && <span>Capacity: {p.weight_capacity_kg}kg</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
                        {p.recyclable && <Badge variant="outline" className="text-xs text-green-600 border-green-300">♻ Recyclable</Badge>}
                        {p.eco_certified && <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">🌿 Eco-cert</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditing(p); setOpen(true); }} className="text-muted-foreground hover:text-foreground p-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteMutation.mutate(p.id)} className="text-muted-foreground hover:text-destructive p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <OrderList orders={orders} />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={() => { setOpen(false); setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-jakarta">{editing ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <ProductForm product={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}