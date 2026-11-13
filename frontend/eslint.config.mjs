import next from 'eslint-config-next';

const config = [
  { ignores: ['.next/**', 'public/**', 'next-env.d.ts'] },
  ...next,
  {
    rules: {
      // O'zbekcha matnlarda apostrof ko'p
      'react/no-unescaped-entities': 'off',
      // «// kurslar» kabi yorliqlar dizaynning bir qismi, izoh emas
      'react/jsx-no-comment-textnodes': 'off',
      // Fayllar Django orqali beriladi, next/image optimizatsiyasi shart emas
      '@next/next/no-img-element': 'off',
      // Shablonlardagi kabi: shriftlar va CSS tartibi <link> bilan boshqariladi
      '@next/next/no-css-tags': 'off',
      '@next/next/no-page-custom-font': 'off',
      // Fayl yuklash, chiqish kabi havolalar sahifa emas
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];

export default config;
