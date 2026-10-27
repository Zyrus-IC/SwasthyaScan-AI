import React from 'react'
import { useScroll, motion } from 'framer-motion'

export const ScrollProgressBar: React.FC = () => {
  const { scrollYProgress } = useScroll()

  return (
    <motion.div
      className="scroll-progress"
      style={{ scaleX: scrollYProgress }}
    />
  )
}
