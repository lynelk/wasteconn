import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Trash2, Edit, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function BulkActionsToolbar({ entityName, selectedIds, onClearSelection, allowedOperations = ['delete', 'export', 'update'] }) {
  const queryClient = useQueryClient();
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const bulkMutation = useMutation({
    mutationFn: async ({ action, data }) => {
      const response = await base44.functions.invoke('bulkActionHandler', {
        entity_name: entityName,
        ids: selectedIds,
        action,
        ...(data && { data })
      });
      return response.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [entityName.toLowerCase()] });
      toast.success(`Bulk action completed: ${result.processed || selectedIds.length} records processed`);
      onClearSelection();
    },
    onError: (error) => {
      toast.error(`Bulk action failed: ${error.message}`);
    }
  });

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.length} records? This cannot be undone.`)) {
      bulkMutation.mutate({ action: 'delete' });
    }
  };

  const handleExport = () => {
    bulkMutation.mutate({ action: 'export' });
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-full shadow-lg px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3">
        <CheckSquare className="w-5 h-5" />
        <span className="font-medium">{selectedIds.length} selected</span>
      </div>
      
      <div className="h-6 w-px bg-primary-foreground/30" />
      
      <div className="flex items-center gap-2">
        {allowedOperations.includes('export') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <Download className="w-4 h-4" />
          </Button>
        )}
        
        {allowedOperations.includes('update') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUpdateModal(true)}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <Edit className="w-4 h-4" />
          </Button>
        )}
        
        {allowedOperations.includes('delete') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-primary-foreground hover:bg-destructive/80"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      <div className="h-6 w-px bg-primary-foreground/30" />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="text-primary-foreground hover:bg-primary-foreground/20"
      >
        Clear
      </Button>
    </div>
  );
}