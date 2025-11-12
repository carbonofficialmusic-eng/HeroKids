import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startPointsResetScheduler } from "./scheduler";
import { db } from "./db";
import { skins } from "../shared/schema";
import Stripe from "stripe";

const app = express();

// CRITICAL: Stripe webhook MUST use express.raw() BEFORE express.json()
app.post("/api/stripe-webhook", 
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    console.log("🔔 Webhook received:", { 
      hasSignature: !!sig, 
      hasSecret: !!webhookSecret,
      hasRawBody: !!req.body,
      rawBodyType: req.body ? typeof req.body : 'undefined',
      rawBodyLength: req.body ? Buffer.byteLength(req.body) : 0,
      secretPrefix: webhookSecret ? webhookSecret.substring(0, 8) : 'none'
    });
    
    if (!webhookSecret) {
      console.warn("STRIPE_WEBHOOK_SECRET not configured");
      return res.status(400).send("Webhook secret not configured");
    }
    
    if (!req.body) {
      console.error("No request body for webhook");
      return res.status(400).send("No request body");
    }
    
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
      console.log("✅ Webhook event verified:", event.type);
    } catch (err: any) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the event
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const familyName = session.metadata?.familyName;
          const tier = session.metadata?.tier;
          
          if (familyName && tier) {
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
          }
          break;
        }
      }
      
      res.json({ received: true });
    } catch (error: any) {
      console.error("Error processing webhook:", error);
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

    log("🌱 Skins table is empty, auto-seeding 24 character skins...");

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
    ];

    await db.insert(skins).values(SKIN_DATA);

    log(`✅ Successfully auto-seeded ${SKIN_DATA.length} character skins! (Tier 1: 8, Tier 2: 8, Tier 3: 8)`);
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
