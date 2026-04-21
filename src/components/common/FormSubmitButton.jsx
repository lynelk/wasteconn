import { Button } from '@/components/ui/button';

export default function FormSubmitButton({ isSubmitting, label = 'Submit', loadingLabel = 'Submitting...' }) {
  return (
    <Button type="submit" disabled={isSubmitting}>
      {isSubmitting ? loadingLabel : label}
    </Button>
  );
}
