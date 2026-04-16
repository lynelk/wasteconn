import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function SurveyModal({ survey, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSaving(true);
    await base44.entities.CustomerSatisfaction.update(survey.id, {
      rating,
      comment,
      responded_at: new Date().toISOString(),
      ai_sentiment: rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral',
    });
    setDone(true);
    setSaving(false);
    setTimeout(() => { onSubmitted?.(); onClose(); }, 1500);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-card w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-xl border border-border"
          onClick={e => e.stopPropagation()}
        >
          {done ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">🙏</div>
              <p className="font-semibold font-jakarta">Thank you for your feedback!</p>
              <p className="text-sm text-muted-foreground mt-1">Your response helps us improve service.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="font-semibold font-jakarta text-sm">Rate your pickup experience</p>
                <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>

              {/* Star Rating */}
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform active:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        star <= (hovered || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {rating > 0 && (
                <p className="text-center text-xs text-muted-foreground mb-3">
                  {rating === 5 ? 'Excellent!' : rating === 4 ? 'Good' : rating === 3 ? 'Okay' : rating === 2 ? 'Poor' : 'Very Poor'}
                </p>
              )}

              <textarea
                className="w-full border border-input bg-background rounded-xl px-3 py-2.5 text-sm resize-none mb-4"
                rows={3}
                placeholder="Any comments? (optional)"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />

              <Button className="w-full" onClick={handleSubmit} disabled={rating === 0 || saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Submit Rating'}
              </Button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}