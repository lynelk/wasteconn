import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ModalWorkflow({ open, onOpenChange, title, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
