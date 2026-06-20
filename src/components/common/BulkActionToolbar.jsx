import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, Edit2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BulkActionToolbar({ 
  selectedIds, 
  onClearSelection, 
  onBulkAction,
  entityName,
  isAdmin 
}) {
  const [showActions, setShowActions] = useState(false);

  if (selectedIds.length === 0) return null;

  const handleAction = (action) => {
    if (onBulkAction) {
      onBulkAction(action);
    }
    setShowActions(false);
  };

  return (
    <div className="sticky top-0 z-30 bg-primary/95 backdrop-blur-sm text-primary-foreground px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={true}
            onCheckedChange={onClearSelection}
            className="border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
          />
          <span className="text-sm font-medium">
            {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <Badge variant="secondary" className="text-xs">
            {entityName}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {showActions ? (
            <>
              {isAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction('delete')}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction('update')}
                    className="text-primary-foreground hover:bg-primary-foreground/20"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Update
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction('export')}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActions(false)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActions(true)}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              Actions
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}