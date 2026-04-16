import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ShoppingCart, Plus, Minus, Trash2, Recycle, CreditCard, Package, Calendar, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const DELIVERY_SLOTS = ['07:00-09:00', '09:00-11:00', '11:00-13:00', '14:00-16:00', '16:00-18:00'];

export default function CustomerShop() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [cart, setCart] = useState([]);
  const [view, setView] = useState('shop'); // 'shop' | 'cart' | 'checkout' | 'success'
  const [checkoutForm, setCheckoutForm] = useState({
    delivery_address: '',
    requested_delivery_date: '',
    requested_delivery_slot: '',
    payment_method: 'yo_payments',
    customer_notes: '',
  });
  const [processing, setProcessing] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  const { data: customer } = useQuery({
    queryKey: ['my-customer', user?.email],
    queryFn: () => base44.entities.Customer.filter({ email: user?.email }),
    select: data => data?.[0],
    enabled: !!user?.email,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['shop-products'],
    queryFn: () => base44.entities.Product.filter({ status: 'available' }),
  });

  const { data: myOrders = [] } = useQuery({
    queryKey: ['my-orders', customer?.id],
    queryFn: () => base44.entities.CustomerOrder.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const addToCart = (product) => {
    setCart(c => {
      const ex = c.find(i => i.product_id === product.id);
      if (ex) return c.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { product_id: product.id, product_name: product.name, quantity: 1, unit_price_ugx: product.price_ugx, total_ugx: product.price_ugx, image_url: product.image_url, unit: product.unit_of_measure }];
    });
  };

  const updateQty = (product_id, qty) => {
    if (qty <= 0) setCart(c => c.filter(i => i.product_id !== product_id));
    else setCart(c => c.map(i => i.product_id === product_id ? { ...i, quantity: qty, total_ugx: qty * i.unit_price_ugx } : i));
  };

  const cartTotal = cart.reduce((s, i) => s + i.total_ugx, 0);

  const handleCheckout = async () => {
    if (!customer) return;
    setProcessing(true);
    try {
      // Check delivery slot availability
      const existing = await base44.entities.CustomerOrder.filter({
        requested_delivery_date: checkoutForm.requested_delivery_date,
        requested_delivery_slot: checkoutForm.requested_delivery_slot,
        tenant_id: customer.tenant_id,
      });

      let confirmedDate = checkoutForm.requested_delivery_date;
      let confirmedSlot = checkoutForm.requested_delivery_slot;
      let alternative = false;

      // If slot is taken (>3 orders in same slot), suggest next available
      if (existing.length >= 3) {
        const takenSlots = new Set(existing.map(o => o.requested_delivery_slot));
        const freeSlot = DELIVERY_SLOTS.find(s => !takenSlots.has(s));
        if (freeSlot) {
          confirmedSlot = freeSlot;
          alternative = true;
        }
      }

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const order = await base44.entities.CustomerOrder.create({
        tenant_id: customer.tenant_id,
        customer_id: customer.id,
        order_number: orderNumber,
        items: cart.map(i => ({ product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price_ugx: i.unit_price_ugx, total_ugx: i.total_ugx })),
        total_amount_ugx: cartTotal,
        payment_status: 'pending',
        payment_method: checkoutForm.payment_method,
        delivery_address: checkoutForm.delivery_address,
        requested_delivery_date: checkoutForm.requested_delivery_date,
        requested_delivery_slot: checkoutForm.requested_delivery_slot,
        confirmed_delivery_date: confirmedDate,
        confirmed_delivery_slot: confirmedSlot,
        delivery_status: 'pending',
        customer_notes: checkoutForm.customer_notes,
      });

      // Initiate Yo! Payments
      if (checkoutForm.payment_method === 'yo_payments') {
        const payRes = await base44.functions.invoke('initiateYoPayment', {
          order_id: order.id,
          amount: cartTotal,
          customer_phone: customer.phone || '',
          reference: orderNumber,
        });
        if (payRes.data?.payment_url) {
          window.open(payRes.data.payment_url, '_blank');
        }
      }

      setLastOrder({ ...order, alternative, confirmedSlot });
      setCart([]);
      setView('success');
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      toast({ title: 'Order placed!', description: `Order ${orderNumber} submitted.` });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const setForm = (k, v) => setCheckoutForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-primary text-white px-4 pt-6 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Recycle className="w-5 h-5" />
            <h1 className="font-bold font-jakarta">Eco Store</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('orders')} className="text-white/80 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-white/10">My Orders</button>
            <button onClick={() => setView('cart')} className="relative text-white/80 hover:text-white">
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{cart.reduce((s,i)=>s+i.quantity,0)}</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Shop View */}
        {view === 'shop' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{products.length} eco-products available</p>
            <div className="grid grid-cols-2 gap-3">
              {products.map(p => {
                const inCart = cart.find(i => i.product_id === p.id);
                return (
                  <Card key={p.id} className="border-border/60">
                    {p.image_url && <div className="h-32 overflow-hidden rounded-t-xl"><img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /></div>}
                    <CardContent className="pt-3 pb-3">
                      <p className="font-semibold text-xs font-jakarta line-clamp-1">{p.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{p.material_type || p.category?.replace('_',' ')}</p>
                      <p className="text-sm font-bold text-primary mt-1">{(p.price_ugx||0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">UGX / {p.unit_of_measure}</p>
                      {inCart ? (
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateQty(p.id, inCart.quantity - 1)} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                          <span className="text-sm font-medium">{inCart.quantity}</span>
                          <button onClick={() => updateQty(p.id, inCart.quantity + 1)} className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => addToCart(p)} className="w-full mt-2 h-7 text-xs gap-1" disabled={p.stock_quantity === 0}>
                          <Plus className="w-3 h-3" /> {p.stock_quantity === 0 ? 'Out of Stock' : 'Add'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Cart View */}
        {view === 'cart' && (
          <div className="space-y-4">
            <h2 className="font-bold font-jakarta">Your Cart</h2>
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Cart is empty</p>
                <Button variant="outline" onClick={() => setView('shop')} className="mt-3">Browse Products</Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.product_id} className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
                      {item.image_url && <img src={item.image_url} alt={item.product_name} className="w-12 h-12 object-cover rounded-lg" />}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">{(item.unit_price_ugx||0).toLocaleString()} UGX each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="w-7 h-7 rounded-full bg-background border flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                        <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => setCart(c => c.filter(i => i.product_id !== item.product_id))} className="text-muted-foreground hover:text-destructive ml-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <div className="bg-muted/50 rounded-xl p-4">
                  <div className="flex justify-between font-bold"><span>Total</span><span className="text-primary">{cartTotal.toLocaleString()} UGX</span></div>
                </div>
                <Button className="w-full" onClick={() => setView('checkout')}>Proceed to Checkout</Button>
                <Button variant="outline" className="w-full" onClick={() => setView('shop')}>Continue Shopping</Button>
              </>
            )}
          </div>
        )}

        {/* Checkout View */}
        {view === 'checkout' && (
          <div className="space-y-4">
            <h2 className="font-bold font-jakarta">Checkout</h2>
            <div className="space-y-3">
              <div>
                <Label>Delivery Address *</Label>
                <Input value={checkoutForm.delivery_address} onChange={e => setForm('delivery_address', e.target.value)} className="mt-1" required />
              </div>
              <div>
                <Label>Preferred Delivery Date *</Label>
                <Input type="date" value={checkoutForm.requested_delivery_date} onChange={e => setForm('requested_delivery_date', e.target.value)} min={new Date().toISOString().slice(0,10)} className="mt-1" required />
              </div>
              <div>
                <Label>Preferred Time Slot *</Label>
                <Select value={checkoutForm.requested_delivery_slot} onValueChange={v => setForm('requested_delivery_slot', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select a slot" /></SelectTrigger>
                  <SelectContent>
                    {DELIVERY_SLOTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={checkoutForm.payment_method} onValueChange={v => setForm('payment_method', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yo_payments">Yo! Payments</SelectItem>
                    <SelectItem value="mtn_momo">MTN Mobile Money</SelectItem>
                    <SelectItem value="airtel_money">Airtel Money</SelectItem>
                    <SelectItem value="pesa_pal">Pesa Pal</SelectItem>
                    <SelectItem value="cash">Cash on Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input value={checkoutForm.customer_notes} onChange={e => setForm('customer_notes', e.target.value)} className="mt-1" placeholder="Any delivery instructions?" />
              </div>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 flex justify-between font-bold">
              <span>Order Total</span><span className="text-primary">{cartTotal.toLocaleString()} UGX</span>
            </div>
            <Button className="w-full gap-2" onClick={handleCheckout} disabled={processing || !checkoutForm.delivery_address || !checkoutForm.requested_delivery_date || !checkoutForm.requested_delivery_slot}>
              {processing ? 'Processing...' : <><CreditCard className="w-4 h-4" /> Place Order & Pay</>}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setView('cart')}>Back to Cart</Button>
          </div>
        )}

        {/* Success View */}
        {view === 'success' && lastOrder && (
          <div className="text-center py-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold font-jakarta text-green-700">Order Placed!</h2>
            <p className="text-muted-foreground text-sm">{lastOrder.order_number}</p>
            {lastOrder.alternative && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                ⚠ Your requested slot was unavailable. We've scheduled your delivery for <strong>{lastOrder.confirmedSlot}</strong> on the same day.
              </div>
            )}
            {!lastOrder.alternative && (
              <p className="text-sm">Delivery confirmed for <strong>{lastOrder.confirmed_delivery_slot || checkoutForm.requested_delivery_slot}</strong></p>
            )}
            <Button className="w-full" onClick={() => setView('orders')}>View My Orders</Button>
            <Button variant="outline" className="w-full" onClick={() => setView('shop')}>Continue Shopping</Button>
          </div>
        )}

        {/* My Orders View */}
        {view === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold font-jakarta">My Orders</h2>
              <Button variant="ghost" size="sm" onClick={() => setView('shop')}>← Shop</Button>
            </div>
            {myOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(order => (
                  <Card key={order.id} className="border-border/60">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm font-jakarta">{order.order_number || `ORD-${order.id.slice(0,6)}`}</p>
                          <p className="text-xs text-muted-foreground">{order.delivery_address}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {order.confirmed_delivery_date || order.requested_delivery_date} · {order.confirmed_delivery_slot || order.requested_delivery_slot}
                          </p>
                          <p className="text-sm font-bold text-primary mt-1">{(order.total_amount_ugx||0).toLocaleString()} UGX</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge className={`text-xs ${order.delivery_status === 'delivered' ? 'bg-green-100 text-green-700' : order.delivery_status === 'in_transit' ? 'bg-purple-100 text-purple-700' : 'bg-yellow-100 text-yellow-700'}`} variant="secondary">
                            {order.delivery_status?.replace('_',' ')}
                          </Badge>
                          <Badge className={`text-xs ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`} variant="secondary">
                            {order.payment_status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}