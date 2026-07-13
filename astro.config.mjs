// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://themproject.tech',
  integrations: [mdx(), sitemap()],
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en'],
    routing: { prefixDefaultLocale: false }, // IT su /, EN su /en/
  },
});
