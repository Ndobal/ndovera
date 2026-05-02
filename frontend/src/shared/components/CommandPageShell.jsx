import React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: 'easeOut',
      when: 'beforeChildren',
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
};

export default function CommandPageShell({
  section,
  title,
  description,
  chips = [],
  live = false,
}) {
  return (
    <motion.div
      className="p-8 max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div className="glass-surface rounded-3xl p-8" variants={itemVariants}>
        <motion.p className="micro-label neon-subtle mb-2 flex items-center gap-2" variants={itemVariants}>
          {live && <span className="live-dot" />}
          {section}
        </motion.p>
        <motion.h1 className="text-3xl command-title neon-title mb-3" variants={itemVariants}>
          {title}
        </motion.h1>
        <motion.p className="text-slate-600 neon-subtle mb-6" variants={itemVariants}>
          {description}
        </motion.p>
        <motion.div className="flex flex-wrap gap-3" variants={itemVariants}>
          {chips.map(chip => (
            <span key={chip.label} className={`glass-chip px-3 py-1 rounded-full micro-label ${chip.accent}`}>
              {chip.label}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
