// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://themproject.ai',
  integrations: [mdx(), sitemap()],
  redirects: {
    // Il blog esiste solo in italiano: la rotta EN rimanda al blog IT
    '/en/blog': '/blog',
  },
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en'],
    routing: { prefixDefaultLocale: false }, // IT su /, EN su /en/
  },
});
