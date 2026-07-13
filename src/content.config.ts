import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: ({ image }) => z.object({
    deity: z.string(),                       // es. "Kali"
    title_it: z.string(),                    // es. "L'Essenza del Tempo"
    title_en: z.string(),
    series: z.enum(['Essence', 'The Codes of Beauty', 'Algorithm Monks', 'Archetipi', 'Gods of the Digital Age']),
    year: z.number(),
    medium_it: z.string().default('Mosaico tipografico, lightbox'),
    medium_en: z.string().default('Typographic mosaic, lightbox'),
    cover: image().optional(),               // il lightbox vero, quando c'è
    focus: z.enum(['top', 'center', 'bottom']).default('top'), // punto di ritaglio dell'immagine
    feat: z.string().optional(),             // collaborazione, es. "feat. Gebelia"
    featured: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

const writing = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/writing' }),
  schema: z.object({
    lang: z.enum(['it', 'en']).default('it'),
    category: z.enum(['rassegna', 'riflessioni', 'articoli', 'pubblicazioni']).default('riflessioni'),
    title: z.string(),
    excerpt: z.string(),
    date: z.date(),
    publication: z.string().optional(),     // testata esterna, es. "Artuu"
    external: z.string().url().optional(),  // se presente, la scheda linka fuori
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
  }),
});

export const collections = { works, writing };
