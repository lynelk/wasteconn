import { CheckCircle2, Clock, Truck } from 'lucide-react';

export default function DriverStats({ jobs, completedToday }) {
  const inProgress = jobs.filter(j => j.status === 'in_progress').length;
  const remaining = jobs.filter(j => ['assigned', 'pending'].includes(j.status)).length;

  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-4 bg-gray-900 border-b border-gray-800">
      <div className="bg-gray-800 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-white font-jakarta">{completedToday}</div>
        <div className="text-xs text-green-400 flex items-center justify-center gap-1 mt-0.5">
          <CheckCircle2 className="w-3 h-3" /> Done
        </div>
      </div>
      <div className="bg-gray-800 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-white font-jakarta">{inProgress}</div>
        <div className="text-xs text-yellow-400 flex items-center justify-center gap-1 mt-0.5">
          <Truck className="w-3 h-3" /> Active
        </div>
      </div>
      <div className="bg-gray-800 rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-white font-jakarta">{remaining}</div>
        <div className="text-xs text-blue-400 flex items-center justify-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" /> Left
        </div>
      </div>
    </div>
  );
}