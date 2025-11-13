import { db } from "./db";
import { skins } from "../shared/schema";

const SKIN_DATA = [
  // Tier 1 - Starter Heroes (0-500 points)
  {
    id: "junior-champion",
    name: "Junior Champion",
    description: "The classic HeroKids hero with a teal cape - start your journey here!",
    imageUrl: "🏆",
    pointsRequired: 0,
    bonusPoints: 0,
  },
  {
    id: "brave-explorer",
    name: "Brave Explorer",
    description: "A fearless adventurer with a compass and backpack, ready to explore!",
    imageUrl: "🧭",
    pointsRequired: 60,
    bonusPoints: 10,
  },
  {
    id: "star-cadet",
    name: "Star Cadet",
    description: "A space-themed hero with a jetpack and stars in their eyes!",
    imageUrl: "⭐",
    pointsRequired: 120,
    bonusPoints: 0,
  },
  {
    id: "nature-scout",
    name: "Nature Scout",
    description: "A green-thumbed hero who loves plants and the outdoors!",
    imageUrl: "🌿",
    pointsRequired: 180,
    bonusPoints: 0,
  },
  {
    id: "speed-runner",
    name: "Speed Runner",
    description: "Lightning-fast hero with super speed and energy!",
    imageUrl: "⚡",
    pointsRequired: 240,
    bonusPoints: 0,
  },
  {
    id: "book-wizard",
    name: "Book Wizard",
    description: "A magical hero powered by knowledge and reading!",
    imageUrl: "📚",
    pointsRequired: 300,
    bonusPoints: 10,
  },
  {
    id: "kitchen-hero",
    name: "Kitchen Hero",
    description: "Master chef hero who conquers cooking challenges!",
    imageUrl: "👨‍🍳",
    pointsRequired: 360,
    bonusPoints: 0,
  },
  {
    id: "art-master",
    name: "Art Master",
    description: "Creative hero with paintbrush and endless imagination!",
    imageUrl: "🎨",
    pointsRequired: 500,
    bonusPoints: 0,
  },
  
  // Tier 2 - Elite Heroes (501-1000 points)
  {
    id: "tech-ninja",
    name: "Tech Ninja",
    description: "Cyber warrior with advanced gadgets and tech skills!",
    imageUrl: "🥷",
    pointsRequired: 560,
    bonusPoints: 10,
  },
  {
    id: "ocean-guardian",
    name: "Ocean Guardian",
    description: "Protector of the seas with water powers!",
    imageUrl: "🌊",
    pointsRequired: 620,
    bonusPoints: 0,
  },
  {
    id: "sky-knight",
    name: "Sky Knight",
    description: "Aerial warrior soaring through the clouds!",
    imageUrl: "☁️",
    pointsRequired: 680,
    bonusPoints: 0,
  },
  {
    id: "fire-phoenix",
    name: "Fire Phoenix",
    description: "Legendary bird rising from flames with fire powers!",
    imageUrl: "🔥",
    pointsRequired: 740,
    bonusPoints: 10,
  },
  {
    id: "crystal-mage",
    name: "Crystal Mage",
    description: "Mystical hero channeling crystal energy!",
    imageUrl: "💎",
    pointsRequired: 800,
    bonusPoints: 0,
  },
  {
    id: "neon-rebel",
    name: "Neon Rebel",
    description: "Futuristic hero glowing with neon energy!",
    imageUrl: "✨",
    pointsRequired: 860,
    bonusPoints: 0,
  },
  {
    id: "cosmic-drifter",
    name: "Cosmic Drifter",
    description: "Space traveler exploring distant galaxies!",
    imageUrl: "🌌",
    pointsRequired: 920,
    bonusPoints: 0,
  },
  {
    id: "thunder-champion",
    name: "Thunder Champion",
    description: "Ultimate hero commanding lightning and storms!",
    imageUrl: "⚡",
    pointsRequired: 1000,
    bonusPoints: 20,
  },
  
  // Tier 3 - Dinosaur Heroes (1001+ points)
  {
    id: "t-rex",
    name: "Tyrannosaurus Rex",
    description: "The mighty king of dinosaurs with fearsome power!",
    imageUrl: "🦖",
    pointsRequired: 1060,
    bonusPoints: 0,
  },
  {
    id: "triceratops",
    name: "Triceratops",
    description: "Triple-horned defender with incredible strength!",
    imageUrl: "🦕",
    pointsRequired: 1120,
    bonusPoints: 0,
  },
  {
    id: "stegosaurus",
    name: "Stegosaurus",
    description: "Plated warrior with spiked tail defense!",
    imageUrl: "🦴",
    pointsRequired: 1180,
    bonusPoints: 0,
  },
  {
    id: "velociraptor",
    name: "Velociraptor",
    description: "Swift and clever predator with razor-sharp claws!",
    imageUrl: "🦎",
    pointsRequired: 1240,
    bonusPoints: 30,
  },
  {
    id: "brachiosaurus",
    name: "Brachiosaurus",
    description: "Gentle giant reaching for the sky!",
    imageUrl: "🦕",
    pointsRequired: 1300,
    bonusPoints: 10,
  },
  {
    id: "spinosaurus",
    name: "Spinosaurus",
    description: "Sail-backed hunter of land and water!",
    imageUrl: "🦖",
    pointsRequired: 1360,
    bonusPoints: 0,
  },
  {
    id: "ankylosaurus",
    name: "Ankylosaurus",
    description: "Armored tank with a devastating club tail!",
    imageUrl: "🦴",
    pointsRequired: 1420,
    bonusPoints: 0,
  },
  {
    id: "allosaurus",
    name: "Allosaurus",
    description: "Apex predator of the Jurassic period!",
    imageUrl: "🦖",
    pointsRequired: 1500,
    bonusPoints: 40,
  },
];

async function seedSkins() {
  console.log("🌱 Starting skin seeding...");
  
  try {
    // Check if skins already exist
    const existingSkins = await db.select().from(skins);
    
    if (existingSkins.length > 0) {
      console.log(`⚠️  Found ${existingSkins.length} existing skins. Skipping seed.`);
      console.log("To re-seed, first delete all skins from the database.");
      return;
    }
    
    // Insert all skins
    console.log(`📦 Inserting ${SKIN_DATA.length} skins...`);
    await db.insert(skins).values(SKIN_DATA);
    
    console.log("✅ Successfully seeded all skins!");
    console.log(`   - Tier 1 (Starter Heroes): 8 skins`);
    console.log(`   - Tier 2 (Elite Heroes): 8 skins`);
    console.log(`   - Tier 3 (Dinosaur Heroes): 8 skins`);
  } catch (error) {
    console.error("❌ Error seeding skins:", error);
    throw error;
  }
}

// Run the seed function
seedSkins()
  .then(() => {
    console.log("🎉 Seed script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Seed script failed:", error);
    process.exit(1);
  });
