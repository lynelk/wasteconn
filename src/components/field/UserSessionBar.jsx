import { User } from 'lucide-react';

export default function UserSessionBar({ sessions, activeUser, onSwitch }) {
  return (
    <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
      <span className="text-xs text-gray-500 shrink-0">Users:</span>
      {sessions.map(session => (
        <button
          key={session.id}
          onClick={onSwitch}
          title={session.full_name}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-all ${
            session.id === activeUser?.id
              ? 'bg-primary text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
        >
          <User className="w-3 h-3" />
          {session.full_name?.split(' ')[0]}
        </button>
      ))}
    </div>
  );
}