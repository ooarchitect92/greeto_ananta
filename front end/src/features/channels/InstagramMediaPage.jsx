import React, { useState, useEffect } from 'react';
import { getInstagramMedia, getInstagramStatus } from './api.js';
import { Button } from '../../components/ui/Button.jsx';
import { ArrowLeft, ExternalLink, MessageCircle, Calendar, RefreshCw, Instagram, Heart, Play, Zap } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import InstagramAutoDMBuilder from './InstagramAutoDMBuilder.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

const InstagramMediaPage = ({ activeChannelId, onBack, embedded = false, hideHeader = false }) => {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [channel, setChannel] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeChannelId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setNextCursor(null);
    try {
      // 1. Get channel info to show header
      const statusRes = await getInstagramStatus();
      if (statusRes.connected) {
        const currentChannel = statusRes.channels.find(c => c.id === activeChannelId);
        setChannel(currentChannel);
      }

      // 2. Get media list
      const res = await getInstagramMedia(activeChannelId);
      if (res.success) {
        setMedia(res.media);
        setNextCursor(res.paging?.cursors?.after || null);
      } else {
        throw new Error(res.error || 'Failed to fetch media');
      }
    } catch (err) {
      console.error('[InstagramMediaPage] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getInstagramMedia(activeChannelId, nextCursor);
      if (res.success) {
        setMedia(prev => [...prev, ...res.media]);
        setNextCursor(res.paging?.cursors?.after || null);
      }
    } catch (err) {
      console.error('[InstagramMediaPage] Load more failed:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header */}
      {!hideHeader && (
        <div className={cn("bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between", !embedded && "sticky top-0 z-10")}>
          <div className="flex items-center gap-4">
            {!embedded && (
              <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full text-slate-500 hover:bg-slate-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                Instagram Posts
                {channel && <span className="text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full text-xs font-bold border border-pink-100">@{channel.username?.replace('@','')}</span>}
              </h2>
              <p className="text-xs text-slate-400">View your latest posts and set up comment automations</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2 rounded-full border-slate-200 text-slate-600 font-bold">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-1 pt-1 pb-10">
        {loading && media.length === 0 ? (
          <div className="px-6 py-16">
            <GreetoLoader label="Loading Instagram media..." sublabel="Fetching latest posts and reels" />
          </div>
        ) : error ? (
          <div className="px-6 py-20">
            <div className="bg-red-50 border border-red-200 p-8 rounded-2xl text-center max-w-md mx-auto">
              <p className="text-red-600 font-bold mb-2">Error loading posts</p>
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <Button onClick={fetchData} variant="outline" className="text-red-600 border-red-200 hover:bg-red-100">Try Again</Button>
            </div>
          </div>
        ) : media.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 text-center">No posts found</h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mx-auto">Make sure you have shared content on your Instagram Business profile.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 w-full p-4">
              {media.map((item) => (
                <div key={item.id} className="relative group cursor-pointer rounded-2xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
                  {/* Image */}
                  <img
                    src={item.media_type === 'VIDEO' ? (item.thumbnail_url || item.media_url) : item.media_url}
                    alt={item.caption}
                    className="w-full h-full object-cover"
                  />

                  {/* Persistent gradient overlay, greeto-style */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(236,72,153,0.30) 0%, rgba(168,85,247,0.18) 35%, rgba(0,0,0,0.72) 100%)',
                    }}
                  />

                  {/* Media Type Indicator */}
                  {item.media_type === 'CAROUSEL_ALBUM' && (
                    <div className="absolute top-3 right-3 z-10">
                      <div className="w-4 h-4 bg-transparent border-2 border-white rounded-[2px] border-r-4 border-b-4 drop-shadow-md" />
                    </div>
                  )}

                  {/* Play button for video */}
                  {item.media_type === 'VIDEO' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-black/30 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play size={22} fill="white" className="text-white ml-1" />
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="absolute bottom-14 left-0 right-0 flex items-center justify-center gap-5">
                    <span className="flex items-center gap-1.5 text-white text-xs font-semibold drop-shadow">
                      <Heart size={13} className={item.like_count > 0 ? 'fill-white' : ''} />
                      {item.like_count || 0}
                    </span>
                    <span className="flex items-center gap-1.5 text-white text-xs font-semibold drop-shadow">
                      <MessageCircle size={13} />
                      {item.comments_count || 0}
                    </span>
                  </div>

                  {/* Setup Auto-DM button */}
                  <div className="absolute bottom-3.5 left-0 right-0 flex justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPost(item);
                        setModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-900 text-xs font-semibold px-5 py-2 rounded-full shadow transition-colors"
                    >
                      <Zap size={12} className="text-purple-600" />
                      Setup Auto-DM
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {nextCursor && (
              <div className="flex justify-center p-12">
                <Button 
                  onClick={handleLoadMore} 
                  disabled={loadingMore}
                  variant="outline"
                  className="rounded-full px-10 h-14 font-black uppercase tracking-widest text-xs border-slate-300 hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 bg-white shadow-xl hover:shadow-2xl flex items-center gap-3"
                >
                  {loadingMore ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Instagram className="w-5 h-5 text-pink-500" />
                      Load More Posts
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        <InstagramAutoDMBuilder
           isOpen={modalOpen}
           onClose={() => setModalOpen(false)}
           post={selectedPost}
           channelId={activeChannelId}
        />
      </div>
    </div>
  );
};

export default InstagramMediaPage;
