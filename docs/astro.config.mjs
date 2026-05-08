// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: '@beautifulbits/lib',
      description:
        'Shared-code manager for personal libraries: publish, install, and wire each library into host projects with one command.',
      sidebar: [
        { label: 'Overview', slug: 'index' },
        { label: 'Getting started', slug: 'getting-started' },
        { label: 'lib.cfg reference', slug: 'lib-cfg-reference' },
        {
          label: 'Commands',
          autogenerate: { directory: 'commands' },
        },
        {
          label: 'Cookbook',
          autogenerate: { directory: 'cookbook' },
        },
      ],
    }),
  ],
});
