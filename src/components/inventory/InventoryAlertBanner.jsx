import { CheckCircle, X, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InventoryAlertBanner({ result, onDismiss }) {
  if (!result) return null;

  const { alerts_triggered, purchase_orders, items_checked } = result;

  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${alerts_triggered > 0 ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300' : 'bg-green-50 dark:bg-green-950/30 border-green-300'}`}>
      {alerts_triggered > 0 ? (
        <ShoppingCart className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
      ) : (
        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1">
        <p className={`font-semibold text-sm ${alerts_triggered > 0 ? 'text-blue-700' : 'text-green-700'}`}>
          {alerts_triggered > 0
            ? `${alerts_triggered} purchase order${alerts_triggered > 1 ? 's' : ''} triggered (${items_checked} items checked)`
            : `All stock levels OK — ${items_checked} items checked`}
        </p>
        {purchase_orders?.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {purchase_orders.map((po, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                • {po.item_name}: stock {po.current_stock} ≤ threshold {po.safety_threshold} → PO {po.po_status}
                {po.merx365_po_id && ` (Merx365 #${po.merx365_po_id})`}
              </p>
            ))}
          </div>
        )}
      </div>
      <Button size="sm" variant="ghost" onClick={onDismiss} className="h-6 w-6 p-0">
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}