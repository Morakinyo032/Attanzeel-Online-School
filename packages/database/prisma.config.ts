import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: 'postgresql://postgres:hollyh@6@localhost:5432/lms_dev?schema=public',
  },
})