import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

const ScrollToTop = ({ hasBottomBar = false }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`
        fixed ${hasBottomBar ? 'bottom-[165px] sm:bottom-8' : 'bottom-8'} right-8 z-[9999]
        h-12 w-12 rounded-2xl
        flex items-center justify-center
        bg-indigo-600/90 backdrop-blur-md
        border border-indigo-500/40
        text-white
        shadow-xl shadow-indigo-600/30
        cursor-pointer
        transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        hover:scale-110 hover:shadow-2xl hover:shadow-indigo-500/40
        hover:bg-indigo-500 hover:border-indigo-400/60
        active:scale-95
        ${visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
        }
      `}
      style={{
        /* Subtle glow ring */
        boxShadow: visible
          ? '0 0 20px -4px rgba(99,102,241,0.5), 0 10px 25px -5px rgba(99,102,241,0.3)'
          : 'none',
      }}
    >
      <ArrowUp className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
    </button>
  );
};

export default ScrollToTop;
