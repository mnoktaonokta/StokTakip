import { defineConfig } from '@prisma/client/runtime/library';

import '../src/config/env';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? '',
    directUrl: process.env.DIRECT_URL,
  },
});
