// CSS qayta yig'ish (frontend papkasida): npx tailwindcss@3 -c tailwind.config.js -i tw.src.css -o public/ctf/tw.css --minify
module.exports = {
  content: ['./app/**/*.tsx', './components/**/*.tsx'],
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
