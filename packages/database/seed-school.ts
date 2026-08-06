import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create Junior Secondary Program
  const jss = await prisma.schoolProgram.create({
    data: {
      title: 'Junior Secondary School',
      description: 'JSS1 - JSS3 Curriculum',
      published: true,
      classes: {
        create: ['JSS1', 'JSS2', 'JSS3'].map(name => ({
          name,
          level: 'Junior',
          subjects: {
            create: [
              { name: 'Mathematics', code: 'MATH' },
              { name: 'English Language', code: 'ENG' },
              { name: 'Basic Science', code: 'BSC' },
              { name: 'Social Studies', code: 'SOS' },
            ].map(s => ({
              ...s,
              topics: {
                create: [
                  {
                    title: 'Introduction',
                    order: 1,
                    lessons: {
                      create: [
                        { title: 'Getting Started', content: 'Welcome to this subject!', order: 1 },
                        { title: 'Key Concepts', content: 'Learn the fundamentals.', order: 2 },
                      ],
                    },
                  },
                ],
              },
            })),
          },
        })),
      },
    },
  });

  // Create Senior Secondary Program
  const sss = await prisma.schoolProgram.create({
    data: {
      title: 'Senior Secondary School',
      description: 'SSS1 - SSS3 Curriculum',
      published: true,
      classes: {
        create: ['SSS1', 'SSS2', 'SSS3'].map(name => ({
          name,
          level: 'Senior',
          subjects: {
            create: [
              { name: 'Mathematics', code: 'MATH' },
              { name: 'English Language', code: 'ENG' },
              { name: 'Physics', code: 'PHY' },
              { name: 'Chemistry', code: 'CHM' },
              { name: 'Biology', code: 'BIO' },
            ].map(s => ({
              ...s,
              topics: {
                create: [
                  {
                    title: 'Introduction',
                    order: 1,
                    lessons: {
                      create: [
                        { title: 'Getting Started', content: 'Welcome to this subject!', order: 1 },
                      ],
                    },
                  },
                ],
              },
            })),
          },
        })),
      },
    },
  });

  console.log('✅ School programs seeded!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());