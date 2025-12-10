import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CampusSeeder,
  UserSeeder,
  VenueSeeder,
  EventSeeder,
  SeatSeeder,
  TicketSeeder,
} from '../src/seeder';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const seeders = [
    new CampusSeeder(),
    new UserSeeder(),
    new VenueSeeder(),
    new EventSeeder(),
    new SeatSeeder(),
    new TicketSeeder(),
  ];

  for (const seeder of seeders) {
    console.log(`Running seeder: ${seeder.constructor.name}`);
    await seeder.seed(prisma);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
