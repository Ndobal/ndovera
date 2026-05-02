import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * FarmingModeAds Component
 * Displays ads based on Farming Mode context
 * 
 * According to NDOVERA.txt:
 * - Appears in: Lesson notes, Library, Dashboard, AI practice, CBT
 * - Does NOT appear during: Assignments, Exams, Assessments
 * - Slightly shrinks content area
 * 
 * Usage:
 * <FarmingModeAds 
 *   context="lesson_notes" 
 *   farmingModeEnabled={true}
 *   onAdInteraction={handleInteraction}
 * />
 */
export default function FarmingModeAds({
  context = 'dashboard',
  farmingModeEnabled = false,
  onAdInteraction = null,
  containerWidth = 'default',
}) {
  const [showAd, setShowAd] = useState(false);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Sample ads - in production, these would come from an ads service
  const ads = [
    {
      id: 'ad-1',
      title: 'Learn Python Fast',
      description: 'Master programming in 30 days',
      image: '🐍',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'ad-2',
      title: 'English Grammar Pro',
      description: 'Perfect your English skills',
      image: '📚',
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'ad-3',
      title: 'Math Mastery Course',
      description: 'Excel in mathematics',
      image: '🧮',
      color: 'from-green-500 to-emerald-500',
    },
    {
      id: 'ad-4',
      title: 'Science Explorer',
      description: 'Discover the wonders of science',
      image: '🔬',
      color: 'from-orange-500 to-red-500',
    },
  ];

  // Contexts where ads should NOT appear
  const restrictedContexts = ['exam', 'assessment', 'assignment_submission'];
  const shouldShowAds = farmingModeEnabled && !restrictedContexts.includes(context);

  useEffect(() => {
    if (shouldShowAds && !showAd) {
      const timer = setTimeout(() => {
        setShowAd(true);
      }, 2000); // Show ad after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [shouldShowAds, showAd]);

  useEffect(() => {
    if (showAd && !hasInteracted) {
      const interval = setInterval(() => {
        setCurrentAdIndex((prev) => (prev + 1) % ads.length);
      }, 5000); // Rotate ads every 5 seconds
      return () => clearInterval(interval);
    }
  }, [showAd, hasInteracted, ads.length]);

  const handleAdClick = async () => {
    setHasInteracted(true);
    if (onAdInteraction) {
      try {
        await onAdInteraction({
          adId: ads[currentAdIndex].id,
          context,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error logging ad interaction:', error);
      }
    }
    // Close ad after interaction
    setTimeout(() => {
      setShowAd(false);
      setHasInteracted(false);
    }, 1500);
  };

  const handleClose = () => {
    setShowAd(false);
    setHasInteracted(false);
  };

  if (!shouldShowAds || !showAd) {
    return null;
  }

  const currentAd = ads[currentAdIndex];

  // Return ad display with content area shrinking
  return (
    <>
      {/* Overlay to shrink content */}
      <AnimatePresence>
        {showAd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 bottom-nav bottom-nav--neon"
            style={{ height: '140px' }} // Content shrinks by this much
          />
        )}
      </AnimatePresence>

      {/* Ad Banner */}
      <AnimatePresence>
        {showAd && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 bottom-nav bottom-nav--neon"
          >
            <div
              className={`mx-auto max-w-2xl p-4 rounded-t-xl bg-gradient-to-r ${currentAd.color} shadow-2xl cursor-pointer hover:shadow-3xl transition-shadow`}
              onClick={handleAdClick}
            >
              <div className="flex items-center justify-between gap-4">
                {/* Ad Content */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-5xl flex-shrink-0">{currentAd.image}</div>
                  <div className="flex-1">
                    <motion.p
                      key={currentAd.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="font-bold text-white text-lg mb-1"
                    >
                      {currentAd.title}
                    </motion.p>
                    <p className="text-white/90 text-sm">{currentAd.description}</p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                  aria-label="Close ad"
                >
                  ✕
                </button>
              </div>

              {/* Ad Indicator */}
              <div className="mt-3 flex gap-1 justify-center">
                {ads.map((_, idx) => (
                  <motion.div
                    key={idx}
                    className={`h-1 rounded-full transition-all ${
                      idx === currentAdIndex ? 'w-2 bg-white' : 'w-1 bg-white/50'
                    }`}
                  />
                ))}
              </div>

              {/* Farming Mode Badge */}
              <div className="mt-2 text-center text-xs text-white/80">
                🌱 Supporting Learning Economy
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
