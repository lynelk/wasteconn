import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StatCard({ title, value, subtitle }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}
