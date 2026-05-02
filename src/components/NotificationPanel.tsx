import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Heart, MessageCircle, Swords, Zap, CheckCircle2, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { AppNotification } from '../hooks/useNotifications';

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  like:              { icon: Heart,         color: 'text-red-400',    bg: 'bg-red-400/10'    },
  comment:           { icon: MessageCircle, color: 'text-primary',    bg: 'bg-primary/10'    },
  duel_created:      { icon: Swords,        color: 'text-secondary',  bg: 'bg-secondary/10'  },
  duel_accepted:     { icon: Swords,        color: 'text-primary',    bg: 'bg-primary/10'    },
  challenge_done:    { icon: Zap,           color: 'text-secondary',  bg: 'bg-secondary/10'  },
};

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return 'agora';
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

interface Props {
  open:         boolean;
  onClose:      () => void;
  notifications: AppNotification[];
  unreadCount:  number;
  onMarkRead:   (id: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationPanel({
  open, onClose, notifications, unreadCount, onMarkRead, onMarkAllRead,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel — slides in from top-right */}
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={{    opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed top-16 right-3 z-[70] w-[min(360px,calc(100vw-1.5rem))] bg-surface-container-low border border-outline-variant/15 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="font-headline font-black text-sm text-on-surface uppercase italic">
                  Notificações
                </span>
                {unreadCount > 0 && (
                  <span className="bg-primary text-background text-[9px] font-black px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="text-[10px] text-primary font-bold uppercase tracking-widest hover:underline"
                  >
                    Marcar todas
                  </button>
                )}
                <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[min(480px,60vh)]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Bell className="w-10 h-10 text-on-surface-variant opacity-20" />
                  <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
                    Nenhuma notificação
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const cfg  = TYPE_CONFIG[n.type] || TYPE_CONFIG.like;
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0  }}
                      className={cn(
                        'flex items-start gap-3 px-5 py-4 border-b border-outline-variant/10 cursor-pointer transition-colors hover:bg-surface-container-highest/30',
                        !n.read && 'bg-primary/5'
                      )}
                      onClick={() => !n.read && onMarkRead(n.id)}
                    >
                      {/* Icon */}
                      <div className={cn('w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0', cfg.bg)}>
                        <Icon className={cn('w-4 h-4', cfg.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface leading-snug">{n.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">{n.body}</p>
                        <p className="text-[10px] text-on-surface-variant/60 font-bold mt-1 uppercase tracking-widest">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>

                      {/* Unread dot / read check */}
                      <div className="flex-shrink-0 mt-1">
                        {n.read
                          ? <Check className="w-3 h-3 text-on-surface-variant/30" />
                          : <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_rgba(202,253,0,0.6)]" />
                        }
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
