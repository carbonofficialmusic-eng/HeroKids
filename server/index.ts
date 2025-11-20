// Set timezone to German time (Europe/Berlin) for daily task resets
process.env.TZ = 'Europe/Berlin';

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startPointsResetScheduler } from "./scheduler";
import { db } from "./db";
import { skins } from "../shared/schema";
import Stripe from "stripe";

const app = express();

// CRITICAL: Stripe webhook with custom raw body parser
app.post("/api/stripe-webhook",
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const rawBody = (req as any).rawBody;
    
    console.log("🔔 Webhook received:", { 
      hasSignature: !!sig, 
      hasSecret: !!webhookSecret,
      hasRawBody: !!rawBody,
      rawBodyLength: rawBody ? rawBody.length : 0,
      secretPrefix: webhookSecret ? webhookSecret.substring(0, 8) : 'none',
      signaturePreview: sig ? String(sig).substring(0, 50) + '...' : 'none'
    });
    
    if (!webhookSecret) {
      console.warn("STRIPE_WEBHOOK_SECRET not configured");
      return res.status(400).send("Webhook secret not configured");
    }
    
    if (!rawBody) {
      console.error("No raw body for webhook");
      return res.status(400).send("No raw body");
    }
    
    let event: Stripe.Event;
    
    try {
      console.log("🔍 Verifying webhook signature...");
      event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
      console.log("✅ Webhook event verified:", event.type);
    } catch (err: any) {
      console.error("❌ Webhook signature verification failed:", err.message);
      console.error("Debug details:", {
        errorType: err.constructor.name,
        webhookSecretLength: webhookSecret.length,
        rawBodyPreview: rawBody ? rawBody.substring(0, 100) : 'none'
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the event
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          
          console.log("🎯 Checkout Session Completed:", {
            sessionId: session.id,
            customer: session.customer,
            subscription: session.subscription,
            paymentStatus: session.payment_status,
            metadata: session.metadata,
          });
          
          const familyName = session.metadata?.familyName;
          const tier = session.metadata?.tier as "free" | "family" | "family_plus" | "family_hero";
          
          if (!familyName || !tier) {
            console.error("❌ Missing metadata in checkout session!", {
              familyName,
              tier,
              sessionId: session.id,
            });
            break;
          }
          
          console.log(`📝 Updating database for family: ${familyName}, tier: ${tier}`);
          
          const { eq } = await import("drizzle-orm");
          const { families } = await import("../shared/schema");
          
          await db.update(families)
            .set({
              subscriptionTier: tier,
              subscriptionStatus: "active",
              billingSubscriptionId: session.subscription as string,
            })
            .where(eq(families.familyName, familyName));
          
          console.log(`✅ Subscription activated for ${familyName}: ${tier}`);
          break;
        }
        
        default:
          console.log(`ℹ️ Unhandled webhook event type: ${event.type}`);
      }
      
      res.json({ received: true });
    } catch (error: any) {
      console.error("❌ Error processing webhook:", {
        error: error.message,
        stack: error.stack,
        eventType: event?.type,
      });
      res.status(500).send("Internal server error");
    }
  }
);

// Now load normal JSON middleware for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Auto-seed character skins on first startup (if table is empty)
async function autoSeedSkinsIfNeeded() {
  try {
    const existingSkins = await db.select().from(skins);
    
    if (existingSkins.length > 0) {
      log(`✅ Skins already seeded (${existingSkins.length} found)`);
      return;
    }

    log("🌱 Skins table is empty, auto-seeding 72 character skins...");

    const SKIN_DATA = [
      // Tier 1 - Starter Heroes (0-500 points)
      { id: "junior-champion", name: "Junior Champion", description: "The classic HeroKids hero with a teal cape - start your journey here!", imageUrl: "🏆", pointsRequired: 0, bonusPoints: 0 },
      { id: "brave-explorer", name: "Brave Explorer", description: "A fearless adventurer with a compass and backpack, ready to explore!", imageUrl: "🧭", pointsRequired: 60, bonusPoints: 10 },
      { id: "star-cadet", name: "Star Cadet", description: "A space-themed hero with a jetpack and stars in their eyes!", imageUrl: "⭐", pointsRequired: 120, bonusPoints: 0 },
      { id: "nature-scout", name: "Nature Scout", description: "A green-thumbed hero who loves plants and the outdoors!", imageUrl: "🌿", pointsRequired: 180, bonusPoints: 0 },
      { id: "speed-runner", name: "Speed Runner", description: "Lightning-fast hero with super speed and energy!", imageUrl: "⚡", pointsRequired: 240, bonusPoints: 0 },
      { id: "book-wizard", name: "Book Wizard", description: "A magical hero powered by knowledge and reading!", imageUrl: "📚", pointsRequired: 300, bonusPoints: 10 },
      { id: "kitchen-hero", name: "Kitchen Hero", description: "Master chef hero who conquers cooking challenges!", imageUrl: "👨‍🍳", pointsRequired: 360, bonusPoints: 0 },
      { id: "art-master", name: "Art Master", description: "Creative hero with paintbrush and endless imagination!", imageUrl: "🎨", pointsRequired: 500, bonusPoints: 0 },
      
      // Tier 2 - Elite Heroes (501-1000 points)
      { id: "tech-ninja", name: "Tech Ninja", description: "Cyber warrior with advanced gadgets and tech skills!", imageUrl: "🥷", pointsRequired: 560, bonusPoints: 10 },
      { id: "ocean-guardian", name: "Ocean Guardian", description: "Protector of the seas with water powers!", imageUrl: "🌊", pointsRequired: 620, bonusPoints: 0 },
      { id: "sky-knight", name: "Sky Knight", description: "Aerial warrior soaring through the clouds!", imageUrl: "☁️", pointsRequired: 680, bonusPoints: 0 },
      { id: "fire-phoenix", name: "Fire Phoenix", description: "Legendary bird rising from flames with fire powers!", imageUrl: "🔥", pointsRequired: 740, bonusPoints: 10 },
      { id: "crystal-mage", name: "Crystal Mage", description: "Mystical hero channeling crystal energy!", imageUrl: "💎", pointsRequired: 800, bonusPoints: 0 },
      { id: "neon-rebel", name: "Neon Rebel", description: "Futuristic hero glowing with neon energy!", imageUrl: "✨", pointsRequired: 860, bonusPoints: 0 },
      { id: "cosmic-drifter", name: "Cosmic Drifter", description: "Space traveler exploring distant galaxies!", imageUrl: "🌌", pointsRequired: 920, bonusPoints: 0 },
      { id: "thunder-champion", name: "Thunder Champion", description: "Ultimate hero commanding lightning and storms!", imageUrl: "⚡", pointsRequired: 1000, bonusPoints: 20 },
      
      // Tier 3 - Dinosaur Heroes (1001+ points)
      { id: "t-rex", name: "Tyrannosaurus Rex", description: "The mighty king of dinosaurs with fearsome power!", imageUrl: "🦖", pointsRequired: 1060, bonusPoints: 0 },
      { id: "triceratops", name: "Triceratops", description: "Triple-horned defender with incredible strength!", imageUrl: "🦕", pointsRequired: 1120, bonusPoints: 0 },
      { id: "stegosaurus", name: "Stegosaurus", description: "Plated warrior with spiked tail defense!", imageUrl: "🦴", pointsRequired: 1180, bonusPoints: 0 },
      { id: "velociraptor", name: "Velociraptor", description: "Swift and clever predator with razor-sharp claws!", imageUrl: "🦎", pointsRequired: 1240, bonusPoints: 10 },
      { id: "brachiosaurus", name: "Brachiosaurus", description: "Gentle giant reaching for the sky!", imageUrl: "🦕", pointsRequired: 1300, bonusPoints: 10 },
      { id: "spinosaurus", name: "Spinosaurus", description: "Sail-backed hunter of land and water!", imageUrl: "🦖", pointsRequired: 1360, bonusPoints: 0 },
      { id: "ankylosaurus", name: "Ankylosaurus", description: "Armored tank with a devastating club tail!", imageUrl: "🦴", pointsRequired: 1420, bonusPoints: 0 },
      { id: "allosaurus", name: "Allosaurus", description: "Apex predator of the Jurassic period!", imageUrl: "🦖", pointsRequired: 1500, bonusPoints: 0 },
      
      // Tier 4 - Magical Princess World (Girls collection, 1560-2300 points)
      { id: "princess-tiara", name: "Princess with Tiara", description: "Classic princess with magical tiara and sparkling gown!", imageUrl: "👑", pointsRequired: 1560, bonusPoints: 10 },
      { id: "purple-princess", name: "Purple Princess", description: "Royal princess in glittering purple ballgown with mystical powers!", imageUrl: "💜", pointsRequired: 1620, bonusPoints: 0 },
      { id: "ice-princess", name: "Ice Princess", description: "Frozen beauty with snowflake powers and icy elegance!", imageUrl: "❄️", pointsRequired: 1680, bonusPoints: 0 },
      { id: "rainbow-princess", name: "Rainbow Princess", description: "Magical princess surrounded by colorful stars and rainbows!", imageUrl: "🌈", pointsRequired: 1740, bonusPoints: 10 },
      { id: "nature-princess", name: "Nature Princess", description: "Green guardian princess who speaks to flowers and animals!", imageUrl: "🌸", pointsRequired: 1800, bonusPoints: 0 },
      { id: "sun-princess", name: "Sun Princess", description: "Golden princess radiating warmth and sunshine energy!", imageUrl: "☀️", pointsRequired: 1860, bonusPoints: 10 },
      { id: "ocean-princess", name: "Ocean Princess", description: "Coral princess ruling the underwater kingdoms!", imageUrl: "🐚", pointsRequired: 1920, bonusPoints: 0 },
      { id: "fairy-princess", name: "Fairy Princess", description: "Mystical fairy princess with butterfly wings and magic dust!", imageUrl: "🧚", pointsRequired: 2000, bonusPoints: 20 },
      
      // Tier 5 - Space Explorers (Boys collection, 2060-2800 points)
      { id: "astronaut-kid", name: "Astronaut Kid", description: "Young space explorer in white spacesuit ready for adventure!", imageUrl: "🚀", pointsRequired: 2060, bonusPoints: 0 },
      { id: "space-cadet-blue", name: "Space Cadet", description: "Blue-suited cadet training for space missions!", imageUrl: "👨‍🚀", pointsRequired: 2120, bonusPoints: 10 },
      { id: "green-alien", name: "Friendly Alien", description: "Green alien explorer from a distant galaxy!", imageUrl: "👽", pointsRequired: 2180, bonusPoints: 0 },
      { id: "rocket-pilot", name: "Rocket Pilot", description: "Red and yellow suited pilot commanding starships!", imageUrl: "🛸", pointsRequired: 2240, bonusPoints: 10 },
      { id: "moon-walker", name: "Moon Walker", description: "Lunar explorer walking on the moon's surface!", imageUrl: "🌙", pointsRequired: 2300, bonusPoints: 0 },
      { id: "galaxy-scout", name: "Galaxy Scout", description: "Purple-suited scout exploring cosmic mysteries!", imageUrl: "🌌", pointsRequired: 2360, bonusPoints: 0 },
      { id: "robot-astronaut", name: "Robot Astronaut", description: "Friendly robot exploring space with metal determination!", imageUrl: "🤖", pointsRequired: 2420, bonusPoints: 10 },
      { id: "star-captain", name: "Star Captain", description: "Gold-suited captain commanding the space fleet!", imageUrl: "⭐", pointsRequired: 2500, bonusPoints: 20 },
      
      // Tier 6 - Cute Animals (Girls collection, 2560-3300 points)
      { id: "cat-girl", name: "Cat Girl", description: "Adorable kitty character in pink hoodie with cat ears!", imageUrl: "🐱", pointsRequired: 2560, bonusPoints: 0 },
      { id: "bunny-girl", name: "Bunny Girl", description: "Sweet bunny character in lavender dress with floppy ears!", imageUrl: "🐰", pointsRequired: 2620, bonusPoints: 10 },
      { id: "fox-girl", name: "Fox Girl", description: "Clever fox character in orange outfit with fluffy tail!", imageUrl: "🦊", pointsRequired: 2680, bonusPoints: 0 },
      { id: "puppy-girl", name: "Puppy Girl", description: "Playful puppy character in brown hoodie, always wagging!", imageUrl: "🐶", pointsRequired: 2740, bonusPoints: 10 },
      { id: "panda-girl", name: "Panda Girl", description: "Cuddly panda character in black and white with bamboo!", imageUrl: "🐼", pointsRequired: 2800, bonusPoints: 0 },
      { id: "deer-girl", name: "Deer Girl", description: "Gentle deer character with adorable antlers and spots!", imageUrl: "🦌", pointsRequired: 2860, bonusPoints: 10 },
      { id: "raccoon-girl", name: "Raccoon Girl", description: "Mischievous raccoon character in gray hoodie with mask!", imageUrl: "🦝", pointsRequired: 2920, bonusPoints: 0 },
      { id: "squirrel-girl", name: "Squirrel Girl", description: "Energetic squirrel character collecting acorns and treasures!", imageUrl: "🐿️", pointsRequired: 3000, bonusPoints: 20 },
      
      // Tier 7 - Dino Adventure (Boys collection, 3060-3800 points)
      { id: "t-rex-kid", name: "T-Rex Explorer", description: "Young dino adventurer dressed as a mighty T-Rex!", imageUrl: "🦖", pointsRequired: 3060, bonusPoints: 0 },
      { id: "triceratops-kid", name: "Triceratops Scout", description: "Brave explorer with triceratops safety helmet!", imageUrl: "🦕", pointsRequired: 3120, bonusPoints: 10 },
      { id: "stegosaurus-kid", name: "Stegosaurus Hero", description: "Dino fan with colorful stegosaurus plates costume!", imageUrl: "🦴", pointsRequired: 3180, bonusPoints: 0 },
      { id: "velociraptor-kid", name: "Velociraptor Racer", description: "Speedy adventurer with velociraptor racing goggles!", imageUrl: "🦎", pointsRequired: 3240, bonusPoints: 10 },
      { id: "brachiosaurus-kid", name: "Brachiosaurus Climber", description: "Tall explorer reaching new heights like a brachiosaur!", imageUrl: "🦕", pointsRequired: 3300, bonusPoints: 0 },
      { id: "pteranodon-kid", name: "Pteranodon Pilot", description: "Flying adventurer with pteranodon aviator gear!", imageUrl: "🦅", pointsRequired: 3360, bonusPoints: 10 },
      { id: "ankylosaurus-kid", name: "Ankylosaurus Defender", description: "Protected explorer in armored ankylosaurus shell!", imageUrl: "🦴", pointsRequired: 3420, bonusPoints: 0 },
      { id: "spinosaurus-kid", name: "Spinosaurus Swimmer", description: "Water adventurer with spinosaurus swimming gear!", imageUrl: "🦖", pointsRequired: 3500, bonusPoints: 20 },
      
      // Tier 8 - Ballerina Dreams (Girls collection, 3560-4300 points)
      { id: "ballerina-pink", name: "Pink Ballerina", description: "Classic ballerina in pink tutu with sparkling grace!", imageUrl: "🩰", pointsRequired: 3560, bonusPoints: 0 },
      { id: "swan-ballerina", name: "Swan Ballerina", description: "Elegant swan lake ballerina in white feather tutu!", imageUrl: "🦢", pointsRequired: 3620, bonusPoints: 10 },
      { id: "purple-ballerina", name: "Purple Ballerina", description: "Royal ballerina in lavender tutu with flower crown!", imageUrl: "💜", pointsRequired: 3680, bonusPoints: 0 },
      { id: "blue-ballerina", name: "Ocean Ballerina", description: "Aqua ballerina dancing with ocean wave patterns!", imageUrl: "💙", pointsRequired: 3740, bonusPoints: 10 },
      { id: "golden-ballerina", name: "Golden Ballerina", description: "Radiant ballerina in golden tutu with star sequins!", imageUrl: "⭐", pointsRequired: 3800, bonusPoints: 0 },
      { id: "peach-ballerina", name: "Rose Ballerina", description: "Romantic ballerina in peach tutu with rose details!", imageUrl: "🌹", pointsRequired: 3860, bonusPoints: 10 },
      { id: "mint-ballerina", name: "Garden Ballerina", description: "Nature ballerina in mint green tutu with leaf patterns!", imageUrl: "🌿", pointsRequired: 3920, bonusPoints: 0 },
      { id: "rainbow-ballerina", name: "Rainbow Ballerina", description: "Magical ballerina in rainbow tutu spreading joy!", imageUrl: "🌈", pointsRequired: 4000, bonusPoints: 20 },
      
      // Tier 9 - Superhero Squad (Boys collection, 4060-4800 points)
      { id: "classic-superhero", name: "Classic Hero", description: "Iconic superhero in red and blue suit with star emblem!", imageUrl: "🦸", pointsRequired: 4060, bonusPoints: 0 },
      { id: "lightning-speedster", name: "Lightning Speedster", description: "Super-fast hero in yellow suit with electric powers!", imageUrl: "⚡", pointsRequired: 4120, bonusPoints: 10 },
      { id: "tech-hero", name: "Tech Hero", description: "High-tech hero in purple armor with advanced gadgets!", imageUrl: "🤖", pointsRequired: 4180, bonusPoints: 0 },
      { id: "nature-guardian", name: "Nature Guardian", description: "Eco-hero in green suit protecting the environment!", imageUrl: "🌿", pointsRequired: 4240, bonusPoints: 10 },
      { id: "ice-hero", name: "Ice Hero", description: "Cool hero in blue frost suit with ice powers!", imageUrl: "❄️", pointsRequired: 4300, bonusPoints: 0 },
      { id: "fire-hero", name: "Fire Hero", description: "Blazing hero in orange flame suit with heat powers!", imageUrl: "🔥", pointsRequired: 4360, bonusPoints: 10 },
      { id: "shadow-ninja", name: "Shadow Ninja", description: "Stealthy ninja hero in black and purple suit!", imageUrl: "🥷", pointsRequired: 4420, bonusPoints: 0 },
      { id: "shield-hero", name: "Shield Hero", description: "Defensive hero in gold armor with energy shields!", imageUrl: "🛡️", pointsRequired: 4500, bonusPoints: 20 },
    ];

    await db.insert(skins).values(SKIN_DATA);

    log(`✅ Successfully auto-seeded ${SKIN_DATA.length} character skins! (9 collections × 8 skins)`);
  } catch (error) {
    console.error("❌ Error auto-seeding skins:", error);
  }
}

(async () => {
  const server = await registerRoutes(app);

  // Auto-seed character skins on first startup
  await autoSeedSkinsIfNeeded();

  // Start points reset scheduler
  startPointsResetScheduler();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
