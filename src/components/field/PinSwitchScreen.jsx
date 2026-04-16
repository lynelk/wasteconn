import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, User, Plus, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PinSwitchScreen({ sessions, activeUser, onSwitch, onAddUser, onClose }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinDigit = (digit) => {
    if (pin.length < 4) setPin(p => p + digit);
  };

  const handleBackspace = () => setPin(p => p.slice(0, -1));

  const handleValidatePin = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('validateFieldPin', {
        user_id: selectedUser.id,
        pin,
      });
      if (res.data?.valid) {
        onSwitch(selectedUser);
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch {
      setError('Unable to verify PIN. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-validate when 4 digits entered
  useState(() => {
    if (pin.length === 4) handleValidatePin();
  });

  const handlePinChange = (newPin) => {
    setPin(newPin);
    if (newPin.length === 4) {
      setTimeout(async () => {
        setLoading(true);
        setError('');
        try {
          const res = await base44.functions.invoke('validateFieldPin', {
            user_id: selectedUser.id,
            pin: newPin,
          });
          if (res.data?.valid) {
            onSwitch(selectedUser);
          } else {
            setError('Incorrect PIN. Please try again.');
            setPin('');
          }
        } catch {
          setError('Unable to verify PIN.');
          setPin('');
        } finally {
          setLoading(false);
        }
      }, 100);
    }
  };

  const addDigit = (d) => {
    if (loading) return;
    const newPin = pin.length < 4 ? pin + d : pin;
    if (newPin !== pin) handlePinChange(newPin);
  };

  return (
    <div className="fixed inset-0 bg-gray-950/95 z-50 flex flex-col items-center justify-center p-6">
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
        <X className="w-6 h-6" />
      </button>

      {!selectedUser ? (
        <div className="w-full max-w-xs">
          <h2 className="text-white font-bold text-xl text-center mb-6 font-jakarta">Switch User</h2>
          <div className="space-y-3">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => {
                  if (session.id === activeUser?.id) { onSwitch(session); return; }
                  setSelectedUser(session);
                  setPin('');
                  setError('');
                }}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  session.id === activeUser?.id
                    ? 'border-primary bg-primary/10 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-200 hover:border-gray-500'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{session.full_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{session.field_app_role || session.role}</p>
                </div>
                {session.id === activeUser?.id && (
                  <span className="ml-auto text-xs text-primary font-medium">Active</span>
                )}
              </button>
            ))}
            <button
              onClick={onAddUser}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-sm">Add Another User</p>
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xs">
          <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1">
            ← Back
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
              <User className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-white font-bold text-lg font-jakarta">{selectedUser.full_name}</h2>
            <p className="text-gray-400 text-sm capitalize">{selectedUser.field_app_role || selectedUser.role}</p>
          </div>

          <p className="text-gray-300 text-center text-sm mb-4">Enter your 4-digit PIN</p>

          {/* PIN dots */}
          <div className="flex justify-center gap-4 mb-6">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-4 h-4 rounded-full transition-all ${
                pin.length > i ? 'bg-primary' : 'bg-gray-700'
              }`} />
            ))}
          </div>

          {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3,4,5,6,7,8,9].map(d => (
              <button
                key={d}
                onClick={() => addDigit(String(d))}
                disabled={loading}
                className="h-14 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl text-white text-xl font-semibold transition-colors disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <div />
            <button
              onClick={() => addDigit('0')}
              disabled={loading}
              className="h-14 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl text-white text-xl font-semibold transition-colors disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={() => setPin(p => p.slice(0,-1))}
              disabled={loading}
              className="h-14 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl text-white transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {loading && <p className="text-center text-gray-400 text-sm mt-4">Verifying...</p>}
        </div>
      )}
    </div>
  );
}