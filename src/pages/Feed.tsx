import { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, MessageCircle, Trophy, Zap, CheckCircle2, Swords, Send, X, Users, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { createNotification } from '../hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedPost {
  id: string;
  user_id: string;
  type: string;
  challenge_id: string | null;
  photo_url: string | null;
  caption: string | null;
  xp_earned: number;
  coins_earned: number;
  created_at: string;
  // Supabase retorna joins com nomes gerados — lemos via alias seguro
  profiles: { name: string; avatar_equipped: any } | null;
  feed_likes: { user_id: string }[];
  feed_comments: {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles: { name: string } | null;
  }[];
  challenges: { title: string } | null;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  challenge: { icon: Zap,          label: 'Desafio concluído', color: 'text-secondary' },
  checkin:   { icon: CheckCircle2, label: 'Check-in no box',  color: 'text-primary'   },
  wod:       { icon: Trophy,       label: 'WOD registrado',   color: 'text-primary'   },
  duel_win:  { icon: Swords,       label: 'Vitória no duelo', color: 'text-secondary' },
};

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return 'agora';
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function AvatarCircle({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full bg-primary/20 text-primary flex items-center justify-center font-black flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function CommentSection({
  post, currentUserId, onAdd,
}: {
  post: FeedPost;
  currentUserId: string;
  onAdd: (postId: string, text: string) => Promise<void>;
}) {
  const [text, setText]       = useState('');
  const [sending, setSending] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await onAdd(post.id, text.trim());
    setText('');
    setSending(false);
  };

  const comments = post.feed_comments || [];

  return (
    <div className="mt-3 pt-3 border-t border-outline-variant/10 flex flex-col gap-2">
      {comments.slice(0, 3).map(c => (
        <div key={c.id} className="flex items-start gap-2">
          <AvatarCircle name={c.profiles?.name || '?'} size={24} />
          <div className="flex-1 bg-surface-container-highest/50 rounded-2xl px-3 py-1.5">
            <span className="text-[10px] font-black text-on-surface uppercase tracking-wide">
              {(c.profiles?.name || '?').split(' ')[0]}{' '}
            </span>
            <span className="text-[11px] text-on-surface-variant">{c.content}</span>
          </div>
        </div>
      ))}
      {comments.length > 3 && (
        <p className="text-[10px] text-on-surface-variant text-center">
          +{comments.length - 3} comentários
        </p>
      )}
      <div className="flex items-center gap-2 mt-1">
        <AvatarCircle name={currentUserId} size={24} />
        <div className="flex-1 flex items-center gap-2 bg-surface-container-highest/50 rounded-2xl px-3 py-1.5">
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Comentar..."
            className="flex-1 bg-transparent text-[12px] text-on-surface outline-none placeholder:text-on-surface-variant/50"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="text-primary disabled:opacity-30"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PostCard({
  post, currentUserId, onLike, onAdd,
}: {
  post: FeedPost;
  currentUserId: string;
  onLike: (postId: string, liked: boolean) => Promise<void>;
  onAdd: (postId: string, text: string) => Promise<void>;
}) {
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking]             = useState(false);
  const [imgError, setImgError]         = useState(false);

  const likes    = post.feed_likes    || [];
  const comments = post.feed_comments || [];
  const liked    = likes.some(l => l.user_id === currentUserId);
  const cfg      = TYPE_CONFIG[post.type] || TYPE_CONFIG.checkin;
  const Icon     = cfg.icon;
  const name     = post.profiles?.name || 'Atleta';
  const title    = post.challenges?.title || cfg.label;

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    await onLike(post.id, liked);
    setLiking(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <AvatarCircle name={name} size={38} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-on-surface uppercase italic leading-none truncate">
            {name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Icon className={cn('w-3 h-3', cfg.color)} />
            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest truncate">
              {title}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-on-surface-variant flex-shrink-0">
          {timeAgo(post.created_at)}
        </span>
      </div>

      {/* Foto — só renderiza se photo_url existir e não der erro de load */}
      {post.photo_url && !imgError && (
        <div className="aspect-[4/3] bg-surface-container-highest overflow-hidden">
          <img
            src={post.photo_url}
            alt="Foto do desafio"
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      {/* Caption + recompensas */}
      <div className="px-4 pt-3 pb-1 flex items-start justify-between gap-2">
        <div className="flex-1">
          {post.caption && (
            <p className="text-sm text-on-surface leading-snug mb-2">{post.caption}</p>
          )}
        </div>
        {(post.xp_earned > 0 || post.coins_earned > 0) && (
          <div className="flex gap-1.5 flex-shrink-0">
            {post.xp_earned   > 0 && (
              <span className="bg-primary/20 text-primary text-[9px] font-black px-2 py-0.5 rounded-full border border-primary/30">
                +{post.xp_earned} XP
              </span>
            )}
            {post.coins_earned > 0 && (
              <span className="bg-secondary/20 text-secondary text-[9px] font-black px-2 py-0.5 rounded-full border border-secondary/30">
                +{post.coins_earned} BC
              </span>
            )}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="px-4 pb-3 flex items-center gap-4 border-t border-outline-variant/10 mt-2 pt-2">
        <button
          onClick={handleLike}
          className={cn(
            'flex items-center gap-1.5 transition-all',
            liked ? 'text-red-500' : 'text-on-surface-variant hover:text-red-400'
          )}
        >
          <Heart className={cn('w-4 h-4 transition-all', liked && 'fill-current scale-110')} />
          <span className="text-[11px] font-bold">{likes.length || ''}</span>
        </button>

        <button
          onClick={() => setShowComments(v => !v)}
          className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-all"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-[11px] font-bold">{comments.length || ''}</span>
        </button>
      </div>

      {/* Comentários expansíveis */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4 overflow-hidden"
          >
            <CommentSection
              post={post}
              currentUserId={currentUserId}
              onAdd={onAdd}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Feed() {
  const { user }                      = useAuth();
  const [posts, setPosts]             = useState<FeedPost[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [refreshing, setRefreshing]   = useState(false);

  const fetchPosts = useCallback(async () => {
    setError(null);
    // Query única com joins diretos via FK explícita (migration_fk_fix.sql)
    const { data, error: err } = await supabase
      .from('feed_posts')
      .select(`
        *,
        profiles!feed_posts_profiles_fkey ( name, avatar_equipped ),
        feed_likes ( user_id ),
        feed_comments (
          id, user_id, content, created_at,
          profiles!feed_comments_profiles_fkey ( name )
        ),
        challenges ( title )
      `)
      .order('created_at', { ascending: false })
      .limit(40);

    if (err) {
      console.error('Feed fetch error:', err);
      setError(err.message);
      setLoading(false);
      return;
    }

    setPosts((data as unknown as FeedPost[]) || []);
    setLoading(false);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchPosts();

    // Realtime — novos posts, likes e comentários aparecem automaticamente
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_posts' },    () => fetchPosts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_likes' },    () => fetchPosts())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'feed_likes' },    () => fetchPosts())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_comments' }, () => fetchPosts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const handleLike = async (postId: string, alreadyLiked: boolean) => {
    if (!user) return;
    if (alreadyLiked) {
      await supabase.from('feed_likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } else {
      await supabase.from('feed_likes').insert({ post_id: postId, user_id: user.id });
      // Notifica o dono do post (não notifica a si mesmo)
      const post = posts.find(p => p.id === postId);
      if (post && post.user_id !== user.id) {
        await createNotification(
          post.user_id, 'like',
          '❤️ Curtida no seu post',
          `${user.name} curtiu sua foto de desafio.`,
          { post_id: postId }
        );
      }
    }
    // Atualização otimista local — sem refetch
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        feed_likes: alreadyLiked
          ? p.feed_likes.filter(l => l.user_id !== user.id)
          : [...p.feed_likes, { user_id: user.id }],
      };
    }));
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('feed_comments')
      .insert({ post_id: postId, user_id: user.id, content })
      .select('id, user_id, content, created_at')
      .single();
    if (data) {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return {
          ...p,
          feed_comments: [
            ...p.feed_comments,
            { ...data, profiles: { name: user.name } },
          ],
        };
      }));
      // Notifica o dono do post (não notifica a si mesmo)
      const post = posts.find(p => p.id === postId);
      if (post && post.user_id !== user.id) {
        await createNotification(
          post.user_id, 'comment',
          '💬 Comentário no seu post',
          `${user.name}: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
          { post_id: postId }
        );
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          FEED
        </h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-primary disabled:opacity-40 transition-all"
        >
          <RefreshCw className={cn('w-5 h-5', refreshing && 'animate-spin')} />
        </button>
      </header>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-surface-container-highest rounded w-1/2" />
                  <div className="h-2 bg-surface-container-highest rounded w-1/3" />
                </div>
              </div>
              <div className="h-40 bg-surface-container-highest rounded-2xl" />
            </div>
          ))}
        </div>
      )}

      {/* Erro com botão de retry */}
      {!loading && error && (
        <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10 text-center flex flex-col gap-4">
          <X className="w-10 h-10 text-on-surface-variant opacity-30 mx-auto" />
          <p className="text-on-surface-variant text-sm">Erro ao carregar feed</p>
          <p className="text-on-surface-variant text-xs font-mono opacity-60">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-primary text-background px-6 py-2 rounded-xl text-sm font-black mx-auto"
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      )}

      {/* Feed vazio */}
      {!loading && !error && posts.length === 0 && (
        <div className="bg-surface-container-low p-12 rounded-3xl border border-outline-variant/10 text-center flex flex-col items-center gap-4 mt-8">
          <Users className="w-12 h-12 text-on-surface-variant opacity-20" />
          <p className="text-on-surface-variant font-headline font-bold uppercase italic tracking-widest text-sm">
            Ainda sem posts
          </p>
          <p className="text-on-surface-variant text-xs">
            Conclua um desafio com foto para aparecer aqui!
          </p>
        </div>
      )}

      {/* Posts */}
      {!loading && !error && posts.map(post => (
        <div key={post.id}>
          <PostCard
            post={post}
            currentUserId={user?.id || ''}
            onLike={handleLike}
            onAdd={handleAddComment}
          />
        </div>
      ))}
    </div>
  );
}
