import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password.util.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with demo users, network connections, and cards...");

  const defaultPassword = hashPassword("password123");

  const demoUsers = [
    { id: "usr_teja", email: "teja@cardcrew.local", display_name: "Teja" },
    { id: "usr_sarah", email: "sarah@cardcrew.local", display_name: "Sarah M." },
    { id: "usr_arjun", email: "arjun@cardcrew.local", display_name: "Arjun K." },
    { id: "usr_elena", email: "elena@cardcrew.local", display_name: "Elena R." },
    { id: "usr_david", email: "david@cardcrew.local", display_name: "David L." },
    { id: "usr_maya", email: "maya@cardcrew.local", display_name: "Maya S." },
    { id: "usr_vikram", email: "vikram@cardcrew.local", display_name: "Vikram P." },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { display_name: u.display_name, password_hash: defaultPassword, status: "active" },
      create: {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        password_hash: defaultPassword,
        status: "active",
      },
    });
  }

  console.log("Users seeded successfully.");

  // Connections
  // Teja <-> Sarah (accepted)
  await upsertConnection("usr_teja", "usr_sarah", "accepted");
  // Teja <-> Arjun (accepted)
  await upsertConnection("usr_teja", "usr_arjun", "accepted");
  // Sarah <-> Elena (accepted) => Elena is FoF to Teja via Sarah!
  await upsertConnection("usr_sarah", "usr_elena", "accepted");
  // Arjun <-> David (accepted) => David is FoF to Teja via Arjun!
  await upsertConnection("usr_arjun", "usr_david", "accepted");
  // Maya -> Teja (pending incoming request for Teja)
  await upsertConnection("usr_maya", "usr_teja", "pending");

  console.log("Connections seeded successfully.");

  // Seed sample wallet cards if catalog items exist
  const catalogCards = await prisma.cardCatalog.findMany({ take: 10 });
  if (catalogCards.length > 0) {
    const card1 = catalogCards[0];
    const card2 = catalogCards[1] || catalogCards[0];
    const card3 = catalogCards[2] || catalogCards[0];

    await prisma.resource.deleteMany({
      where: {
        owner_id: { in: demoUsers.map((u) => u.id) },
      },
    });

    if (card1) {
      await prisma.resource.create({
        data: {
          owner_id: "usr_teja",
          card_catalog_id: card1.id,
          visibility: "friends",
          request_enabled: true,
          notes: "My primary dining & travel card",
        },
      });
      await prisma.resource.create({
        data: {
          owner_id: "usr_sarah",
          card_catalog_id: card1.id,
          visibility: "friends",
          request_enabled: true,
          notes: "Great rewards on shopping",
        },
      });
    }

    if (card2) {
      await prisma.resource.create({
        data: {
          owner_id: "usr_arjun",
          card_catalog_id: card2.id,
          visibility: "friends",
          request_enabled: true,
          notes: "Airport lounge and flight discounts",
        },
      });
      await prisma.resource.create({
        data: {
          owner_id: "usr_elena",
          card_catalog_id: card2.id,
          visibility: "network",
          request_enabled: true,
          notes: "Cashback card",
        },
      });
    }

    if (card3) {
      await prisma.resource.create({
        data: {
          owner_id: "usr_david",
          card_catalog_id: card3.id,
          visibility: "network",
          request_enabled: true,
          notes: "Movie & entertainment card",
        },
      });
    }

    console.log("Wallet cards seeded successfully.");
  }

  console.log("Seeding complete! Ready to rock.");
}

async function upsertConnection(requesterId: string, addresseeId: string, status: "pending" | "accepted") {
  const [first, second] = [requesterId, addresseeId].sort();
  const pairKey = `${first}:${second}`;

  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { requester_id: requesterId, addressee_id: addresseeId },
        { requester_id: addresseeId, addressee_id: requesterId },
      ],
    },
  });

  if (existing) {
    await prisma.connection.update({
      where: { id: existing.id },
      data: { status, active_pair_key: pairKey },
    });
  } else {
    await prisma.connection.create({
      data: {
        requester_id: requesterId,
        addressee_id: addresseeId,
        status,
        active_pair_key: pairKey,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
