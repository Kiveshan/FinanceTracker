/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
      },
      colors: {
        // Our fintech dark theme colour palette
        // LEARNING NOTE: Defining colours here means you use
        // names like bg-surface instead of bg-[#1e2028] everywhere.
        // Change the hex value once here, updates everywhere.
        background: '#0f1117',
        surface:    '#1a1d27',
        border:     '#2a2d3a',
        primary:    '#6366f1',  // indigo — main action colour
        success:    '#22c55e',  // green — positive values
        danger:     '#ef4444',  // red — negative values, alerts
        warning:    '#f59e0b',  // amber — approaching budget limits
        muted:      '#6b7280',  // grey — secondary text
      }
    },
  },
  plugins: [],
}
