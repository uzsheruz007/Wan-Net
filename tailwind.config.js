// CSS qayta yig'ish: tailwindcss -c tailwind.config.js -i static/ctf/tw.src.css -o static/ctf/tw.css --minify
module.exports = {
  content: ['./ctf/templates/**/*.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Chakra Petch', 'JetBrains Mono', 'sans-serif'],
      },
      colors: { acc: '#00ff9c', acc2: '#00d1ff' },
    },
  },
};
