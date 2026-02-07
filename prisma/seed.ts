import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const plans = [
  {
    name: "50 / 30 / 20",
    isDefault: true,
    categories: [
      { name: "Needs", percentage: 50 },
      { name: "Wants", percentage: 30 },
      { name: "Savings", percentage: 20 },
    ],
  },
  {
    name: "70 / 20 / 10",
    isDefault: false,
    categories: [
      { name: "Essentials", percentage: 70 },
      { name: "Leisure", percentage: 20 },
      { name: "Savings", percentage: 10 },
    ],
  },
  {
    name: "80 / 20",
    isDefault: false,
    categories: [
      { name: "Spending", percentage: 80 },
      { name: "Savings", percentage: 20 },
    ],
  },
];

async function main() {
  for (const plan of plans) {
    const existing = await prisma.budgetPlan.findFirst({
      where: { name: plan.name },
    });

    if (existing) {
      console.log(`Plan "${plan.name}" already exists, skipping.`);
      continue;
    }

    await prisma.budgetPlan.create({
      data: {
        name: plan.name,
        isDefault: plan.isDefault,
        categories: {
          create: plan.categories,
        },
      },
    });

    console.log(`Created plan: ${plan.name}`);
  }

  // Create a default UserConfig if none exists
  const configCount = await prisma.userConfig.count();
  if (configCount === 0) {
    const defaultPlan = await prisma.budgetPlan.findFirst({
      where: { isDefault: true },
    });

    if (defaultPlan) {
      await prisma.userConfig.create({
        data: { activePlanId: defaultPlan.id },
      });
      console.log("Created default user config with 50/30/20 plan.");
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
