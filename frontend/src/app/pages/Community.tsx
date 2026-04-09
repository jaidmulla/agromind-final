import { motion } from 'motion/react';
import { MapPin, TrendingUp, Users, Heart, MessageCircle, Plus, X, Loader2, BadgeCheck } from 'lucide-react';
import { useState } from 'react';
import { useCommunityPosts, useToggleLike, useCreatePost, useMapPosts } from '../../hooks';
import { useLocation } from '../../contexts/LocationContext';
import type { CommunityPost } from '../../types';

function timeAgo(date: string) {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
}

function PostCard({ post, onLike }: { post: CommunityPost; onLike: () => void }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#2E7D32] flex items-center justify-center font-bold text-white">
            {post.author_name?.charAt(0).toUpperCase() || 'F'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm">{post.author_name || 'Farmer'}</p>
              {post.is_verified && <BadgeCheck className="w-4 h-4 text-[#2E7D32]" />}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {post.location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{post.location}</span>}
              <span>{timeAgo(post.created_at)}</span>
            </div>
          </div>
        </div>
        {post.crop_name && (
          <span className="text-xs bg-[#E8F5E9] text-[#2E7D32] px-3 py-1 rounded-full font-medium">{post.crop_name}</span>
        )}
      </div>

      {post.title && <h3 className="font-bold text-lg mb-2">{post.title}</h3>}
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{post.content}</p>

      {post.action_taken && (
        <div className="bg-muted rounded-lg p-3 mb-3 text-sm">
          <span className="font-medium">Action taken: </span>{post.action_taken}
        </div>
      )}
      {post.result && (
        <div className="bg-[#E8F5E9] rounded-lg p-3 mb-3 text-sm">
          <span className="font-medium text-[#2E7D32]">Result: </span>{post.result}
        </div>
      )}
      {post.savings && post.savings > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[#2E7D32]" />
          <span className="font-bold text-[#2E7D32]">₹{post.savings.toLocaleString('en-IN')} saved</span>
        </div>
      )}

      <div className="flex items-center gap-4 pt-4 border-t border-border">
        <button onClick={onLike}
          className={`flex items-center gap-1.5 text-sm transition-all hover:scale-105 ${
            post.liked_by_me ? 'text-red-500 font-semibold' : 'text-muted-foreground hover:text-red-400'
          }`}>
          <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-current' : ''}`} />
          {post.likes_count}
        </button>
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-all">
          <MessageCircle className="w-4 h-4" />
          {post.comments_count}
        </button>
      </div>
    </div>
  );
}

export function Community() {
  const { selectedLocation } = useLocation();
  const [cropFilter, setCropFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'nearby'>('nearby'); // Toggle between all and nearby
  const [newPost, setNewPost] = useState({ title: '', content: '', crop_name: '', location: '', action_taken: '', result: '', savings: '' });

  // Fetch all posts with crop filter
  const { data: allPosts = [], isLoading: allLoading } = useCommunityPosts({ crop: cropFilter || undefined });
  
  // Fetch nearby posts based on selected location
  const { data: nearbyPosts = [], isLoading: nearbyLoading } = useMapPosts(
    selectedLocation?.lat,
    selectedLocation?.lon,
    15
  );

  const toggleLike = useToggleLike();
  const createPost = useCreatePost();

  const crops = ['Tomato','Potato','Wheat','Cotton','Rice','Onion','Sugarcane'];
  
  // Use nearby posts if location is selected and viewMode is 'nearby', otherwise use all posts
  const posts = viewMode === 'nearby' && selectedLocation ? nearbyPosts : allPosts;
  const isLoading = viewMode === 'nearby' && selectedLocation ? nearbyLoading : allLoading;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.content.trim()) return;
    
    // If location is selected, use it; otherwise use form location
    const postData = {
      ...newPost,
      location: newPost.location || selectedLocation?.name || '',
      savings: newPost.savings ? parseFloat(newPost.savings) : undefined,
    };
    
    await createPost.mutateAsync(postData);
    setNewPost({ title: '', content: '', crop_name: '', location: '', action_taken: '', result: '', savings: '' });
    setShowCreate(false);
  };

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Community</h1>
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground">Farmer insights and success stories</p>
              {selectedLocation && (
                <div className="px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> {selectedLocation.name}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#2E7D32] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#1B5E20] transition-all">
            <Plus className="w-4 h-4" /> Share Insight
          </button>
        </div>
      </motion.div>

      {/* View Mode Toggle */}
      {selectedLocation && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('nearby')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'nearby'
                ? 'bg-[#2E7D32] text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            📍 Stories Near {selectedLocation.name}
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === 'all'
                ? 'bg-[#2E7D32] text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            🌍 All Stories
          </button>
        </div>
      )}

      {/* Stats Bar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Users, label: 'Farmers sharing', value: posts.length > 0 ? `${posts.length}+` : '0' },
          { icon: TrendingUp, label: 'Total savings shared', value: `₹${(posts.reduce((s, p) => s + (Number(p.savings) || 0), 0)/1000).toFixed(0)}K` },
          { icon: BadgeCheck, label: 'Verified insights', value: String(posts.filter(p => p.is_verified).length) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center">
              <Icon className="w-5 h-5 text-[#2E7D32]" />
            </div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setCropFilter('')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!cropFilter ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
          All Crops
        </button>
        {crops.map(c => (
          <button key={c} onClick={() => setCropFilter(cropFilter === c ? '' : c)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${cropFilter === c ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">No posts yet</h3>
          <p className="text-muted-foreground mb-4">Be the first to share your farming insight!</p>
          <button onClick={() => setShowCreate(true)} className="bg-[#2E7D32] text-white px-6 py-3 rounded-xl font-semibold">
            Share Your Story
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post, i) => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <PostCard post={post} onLike={() => toggleLike.mutate(post.id)} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Post Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Share Your Insight</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <input value={newPost.title} onChange={e => setNewPost(p => ({...p, title: e.target.value}))}
                placeholder="Title (optional)" className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
              <textarea value={newPost.content} onChange={e => setNewPost(p => ({...p, content: e.target.value}))}
                placeholder="Share what you learned or how you saved your crop... *" rows={4} required
                className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32] resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <input value={newPost.crop_name} onChange={e => setNewPost(p => ({...p, crop_name: e.target.value}))}
                  placeholder="Crop name" className="px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
                <input value={newPost.location} onChange={e => setNewPost(p => ({...p, location: e.target.value}))}
                  placeholder="Location" className="px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
                <input value={newPost.action_taken} onChange={e => setNewPost(p => ({...p, action_taken: e.target.value}))}
                  placeholder="Action taken" className="px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
                <input value={newPost.savings} onChange={e => setNewPost(p => ({...p, savings: e.target.value}))}
                  placeholder="₹ Amount saved" type="number" className="px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
              </div>
              <input value={newPost.result} onChange={e => setNewPost(p => ({...p, result: e.target.value}))}
                placeholder="What was the result?" className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
              <button type="submit" disabled={createPost.isPending}
                className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white py-3 rounded-lg font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {createPost.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sharing...</> : 'Share with Community'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
