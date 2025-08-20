import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-screen bg-gradient-to-br from-purple-900 via-black to-zinc-900 px-6">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-r from-pink-400 via-purple-400 to-amber-400 bg-clip-text text-transparent drop-shadow-lg"
      >
        Generative Architecture Visualizer
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="mt-6 text-lg text-zinc-300 max-w-2xl"
      >
        Transform your ideas into stunning architectural designs powered by AI.
        Upload a photo, set your preferences, and watch the magic happen.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-10 flex gap-6"
      >
        <Link
          to="/visualizer"
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition"
        >
          Try Visualizer
        </Link>
        <Link
          to="/login"
          className="px-6 py-3 rounded-2xl bg-white/10 border border-white/20 backdrop-blur hover:bg-white/20 transition"
        >
          Login
        </Link>
      </motion.div>
    </div>
  );
}
