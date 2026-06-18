import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Star, Trophy, User } from 'lucide-react';
import { Link } from 'react-router-dom';

const medals = ['🥇', '🥈', '🥉'];

export default function DriverLeaderboard() {
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allJobs = [] } = useQuery({
    queryKey: ['all-completed-jobs'],
    queryFn: () => base44.entities.PickupRequest.filter({ status: 'completed' }, '-completed_at', 200),
  });

  const { data: satisfaction = [] } = useQuery({
    queryKey: ['customer-satisfaction'],
    queryFn: () => base44.entities.CustomerSatisfaction.list('-created_date', 300),
  });

  const leaderboard = useMemo(() => {
    const driverIdSet = new Set(allJobs.map(j => j.assigned_driver_id).filter(Boolean));
    const driverUsers = drivers.filter(d => driverIdSet.has(d.id));

    return driverUsers.map(driver => {
      const jobs = allJobs.filter(j => j.assigned_driver_id === driver.id);
      const completionRate = Math.round(jobs.length / Math.max(jobs.length, 1) * 100);

      // Customer satisfaction for this driver
      const driverSat = satisfaction.filter(s => s.driver_id === driver.id);
      const positiveFeedback = driverSat.filter(s => s.rating >= 4).length;
      const avgRating = driverSat.length > 0
        ? (driverSat.reduce((s, x) => s + (x.rating || 0), 0) / driverSat.length).toFixed(1)
        : null;

      // Composite score: 50% completion, 30% positive feedback %, 20% avg rating
      const feedbackScore = driverSat.length > 0 ? (positiveFeedback / driverSat.length) * 100 : 50;
      const ratingScore = avgRating ? (parseFloat(avgRating) / 5) * 100 : 50;
      const score = Math.round(completionRate * 0.5 + feedbackScore * 0.3 + ratingScore * 0.2);

      return {
        driver,
        jobs: jobs.length,
        completionRate,
        avgRating,
        positiveFeedback,
        totalFeedback: driverSat.length,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  }, [drivers, allJobs, satisfaction]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold font-jakarta flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          Driver Leaderboard
        </CardTitle>
        <p className="text-xs text-muted-foreground">Ranked by completion rate &amp; customer satisfaction</p>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No driver performance data yet.
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <Link key={entry.driver.id} to={`/driver-detail?id=${entry.driver.id}`} className="block">
                <div className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${i === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800' : 'bg-muted/20'}`}>
                  {/* Rank */}
                  <div className="text-base w-7 text-center shrink-0">
                    {i < 3 ? medals[i] : <span className="text-sm text-muted-foreground font-medium">#{i + 1}</span>}
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Name & stats */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm font-jakarta truncate">
                      {entry.driver.full_name || entry.driver.email}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{entry.jobs} jobs</span>
                      {entry.avgRating && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          {entry.avgRating}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{entry.completionRate}% completion</span>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold font-jakarta ${entry.score >= 80 ? 'text-primary' : entry.score >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {entry.score}
                    </p>
                    <p className="text-[10px] text-muted-foreground">score</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}