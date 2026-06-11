// Set timezone to German time (Europe/Berlin) for daily task resets
process.env.TZ = 'Europe/Berlin';

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import http from "http";
import { startPointsResetScheduler } from "./scheduler";
import { db } from "./db";
import { skins, familyMembers, starPlacements, achievementDefinitions } from "../shared/schema";
import { sql, eq, and, notInArray } from "drizzle-orm";
import Stripe from "stripe";

const app = express();

// Proxy /__mockup/ requests to the mockup sandbox dev server (port 23636)
// This allows the canvas to embed mockup iframes through the main HTTPS domain
app.use("/__mockup", (req: Request, res: Response) => {
  const options = {
    hostname: "127.0.0.1",
    port: 23636,
    path: "/__mockup" + req.url,
    method: req.method,
    headers: { ...req.headers, host: "localhost:23636" },
  };
  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxy.on("error", () => res.status(502).send("Mockup sandbox not running"));
  req.pipe(proxy, { end: true });
});

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
          
          // Auto-unpause members that now fit within the new tier's member limit
          try {
            const { getMaxMembers } = await import("../shared/tier-config");
            const allMembers = await db.select().from(familyMembers)
              .where(eq(familyMembers.familyName, familyName));
            const pausedMembers = allMembers.filter((m: any) => m.isPaused);
            if (pausedMembers.length > 0) {
              const maxMembers = getMaxMembers(tier as any);
              const activeCount = allMembers.filter((m: any) => !m.isPaused).length;
              const canUnpauseCount = maxMembers === Infinity ? pausedMembers.length : Math.max(0, maxMembers - activeCount);
              const toUnpause = pausedMembers
                .sort((a: any, b: any) => (new Date(a.createdAt ?? 0).getTime()) - (new Date(b.createdAt ?? 0).getTime()))
                .slice(0, canUnpauseCount);
              if (toUnpause.length > 0) {
                const toUnpauseIds = toUnpause.map((m: any) => m.id);
                const { inArray } = await import("drizzle-orm");
                await db.update(familyMembers)
                  .set({ isPaused: false })
                  .where(inArray(familyMembers.id, toUnpauseIds));
                console.log(`✅ Auto-unpaused ${toUnpause.length} member(s) for "${familyName}" after webhook upgrade to ${tier}`);
              }
            }
          } catch (unpauseErr: any) {
            console.error("⚠️ Auto-unpause failed (non-critical):", unpauseErr.message);
          }
          break;
        }
        
        case "customer.subscription.deleted": {
          // Subscription was cancelled
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          console.log("Subscription Cancelled:", {
            subscriptionId: subscription.id,
            customerId,
          });
          
          const { eq } = await import("drizzle-orm");
          const { families } = await import("../shared/schema");
          
          // Find family by billingCustomerId and reset to free tier
          await db.update(families)
            .set({
              subscriptionTier: "free",
              subscriptionStatus: "canceled",
              billingSubscriptionId: null,
            })
            .where(eq(families.billingCustomerId, customerId));
          
          console.log(`Subscription cancelled for customer: ${customerId}`);
          break;
        }
        
        case "customer.subscription.updated": {
          // Subscription was updated (e.g., tier change, payment failure)
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          console.log("Subscription Updated:", {
            subscriptionId: subscription.id,
            customerId,
            status: subscription.status,
          });
          
          const { eq } = await import("drizzle-orm");
          const { families } = await import("../shared/schema");
          
          // Update subscription status
          if (subscription.status === "past_due") {
            await db.update(families)
              .set({
                subscriptionStatus: "past_due",
              })
              .where(eq(families.billingCustomerId, customerId));
            console.log(`Subscription status updated to ${subscription.status} for customer: ${customerId}`);
          } else if (subscription.status === "active") {
            await db.update(families)
              .set({
                subscriptionStatus: "active",
              })
              .where(eq(families.billingCustomerId, customerId));
            console.log(`Subscription reactivated for customer: ${customerId}`);
          }
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
app.use(cookieParser());

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

    log("🌱 Skins table is empty, auto-seeding 96 character skins...");

    const SKIN_DATA = [
      // Tier 1 - Starter Heroes (0-500 points)
      { id: "junior-champion", name: "Junior Champion", description: "The classic HeroKids hero with a teal cape - start your journey here!", imageUrl: "🏆", pointsRequired: 0, bonusPoints: 0 },
      { id: "brave-explorer", name: "Brave Explorer", description: "A fearless adventurer with a compass and backpack, ready to explore!", imageUrl: "🧭", pointsRequired: 60, bonusPoints: 0 },
      { id: "star-cadet", name: "Star Cadet", description: "A space-themed hero with a jetpack and stars in their eyes!", imageUrl: "⭐", pointsRequired: 120, bonusPoints: 0 },
      { id: "nature-scout", name: "Nature Scout", description: "A green-thumbed hero who loves plants and the outdoors!", imageUrl: "🌿", pointsRequired: 180, bonusPoints: 0 },
      { id: "speed-runner", name: "Speed Runner", description: "Lightning-fast hero with super speed and energy!", imageUrl: "⚡", pointsRequired: 240, bonusPoints: 0 },
      { id: "book-wizard", name: "Book Wizard", description: "A magical hero powered by knowledge and reading!", imageUrl: "📚", pointsRequired: 300, bonusPoints: 5 },
      { id: "kitchen-hero", name: "Kitchen Hero", description: "Master chef hero who conquers cooking challenges!", imageUrl: "👨‍🍳", pointsRequired: 360, bonusPoints: 0 },
      { id: "art-master", name: "Art Master", description: "Creative hero with paintbrush and endless imagination!", imageUrl: "🎨", pointsRequired: 500, bonusPoints: 0 },
      
      // Tier 2 - Elite Heroes (501-1000 points)
      { id: "tech-ninja", name: "Tech Ninja", description: "Cyber warrior with advanced gadgets and tech skills!", imageUrl: "🥷", pointsRequired: 560, bonusPoints: 0 },
      { id: "ocean-guardian", name: "Ocean Guardian", description: "Protector of the seas with water powers!", imageUrl: "🌊", pointsRequired: 620, bonusPoints: 0 },
      { id: "sky-knight", name: "Sky Knight", description: "Aerial warrior soaring through the clouds!", imageUrl: "☁️", pointsRequired: 680, bonusPoints: 0 },
      { id: "fire-phoenix", name: "Fire Phoenix", description: "Legendary bird rising from flames with fire powers!", imageUrl: "🔥", pointsRequired: 740, bonusPoints: 5 },
      { id: "crystal-mage", name: "Crystal Mage", description: "Mystical hero channeling crystal energy!", imageUrl: "💎", pointsRequired: 800, bonusPoints: 0 },
      { id: "neon-rebel", name: "Neon Rebel", description: "Futuristic hero glowing with neon energy!", imageUrl: "✨", pointsRequired: 860, bonusPoints: 0 },
      { id: "cosmic-drifter", name: "Cosmic Drifter", description: "Space traveler exploring distant galaxies!", imageUrl: "🌌", pointsRequired: 920, bonusPoints: 0 },
      { id: "thunder-champion", name: "Thunder Champion", description: "Ultimate hero commanding lightning and storms!", imageUrl: "⚡", pointsRequired: 1000, bonusPoints: 15 },
      
      // Tier 3 - Dinosaur Heroes (1001+ points)
      { id: "t-rex", name: "Tyrannosaurus Rex", description: "The mighty king of dinosaurs with fearsome power!", imageUrl: "🦖", pointsRequired: 1060, bonusPoints: 0 },
      { id: "triceratops", name: "Triceratops", description: "Triple-horned defender with incredible strength!", imageUrl: "🦕", pointsRequired: 1120, bonusPoints: 0 },
      { id: "stegosaurus", name: "Stegosaurus", description: "Plated warrior with spiked tail defense!", imageUrl: "🦴", pointsRequired: 1180, bonusPoints: 0 },
      { id: "velociraptor", name: "Velociraptor", description: "Swift and clever predator with razor-sharp claws!", imageUrl: "🦎", pointsRequired: 1240, bonusPoints: 0 },
      { id: "brachiosaurus", name: "Brachiosaurus", description: "Gentle giant reaching for the sky!", imageUrl: "🦕", pointsRequired: 1300, bonusPoints: 0 },
      { id: "spinosaurus", name: "Spinosaurus", description: "Sail-backed hunter of land and water!", imageUrl: "🦖", pointsRequired: 1360, bonusPoints: 0 },
      { id: "ankylosaurus", name: "Ankylosaurus", description: "Armored tank with a devastating club tail!", imageUrl: "🦴", pointsRequired: 1420, bonusPoints: 0 },
      { id: "allosaurus", name: "Allosaurus", description: "Apex predator of the Jurassic period!", imageUrl: "🦖", pointsRequired: 1500, bonusPoints: 0 },
      
      // Tier 4 - Magical Princess World (Girls collection, 1560-2000 points) - Bonus Slots: 1, 4, 7
      { id: "princess-tiara", name: "Princess with Tiara", description: "Classic princess with magical tiara and sparkling gown!", imageUrl: "👑", pointsRequired: 1560, bonusPoints: 0 },
      { id: "purple-princess", name: "Purple Princess", description: "Royal princess in glittering purple ballgown with mystical powers!", imageUrl: "💜", pointsRequired: 1620, bonusPoints: 0 },
      { id: "ice-princess", name: "Ice Princess", description: "Frozen beauty with snowflake powers and icy elegance!", imageUrl: "❄️", pointsRequired: 1680, bonusPoints: 0 },
      { id: "rainbow-princess", name: "Rainbow Princess", description: "Magical princess surrounded by colorful stars and rainbows!", imageUrl: "🌈", pointsRequired: 1740, bonusPoints: 10 },
      { id: "nature-princess", name: "Nature Princess", description: "Green guardian princess who speaks to flowers and animals!", imageUrl: "🌸", pointsRequired: 1800, bonusPoints: 0 },
      { id: "sun-princess", name: "Sun Princess", description: "Golden princess radiating warmth and sunshine energy!", imageUrl: "☀️", pointsRequired: 1860, bonusPoints: 0 },
      { id: "ocean-princess", name: "Ocean Princess", description: "Coral princess ruling the underwater kingdoms!", imageUrl: "🐚", pointsRequired: 1920, bonusPoints: 15 },
      { id: "fairy-princess", name: "Fairy Princess", description: "Mystical fairy princess with butterfly wings and magic dust!", imageUrl: "🧚", pointsRequired: 2000, bonusPoints: 0 },
      
      // Tier 5 - Space Explorers (Boys collection, 2060-2500 points) - Bonus Slots: 3, 6, 8
      { id: "astronaut-kid", name: "Astronaut Kid", description: "Young space explorer in white spacesuit ready for adventure!", imageUrl: "🚀", pointsRequired: 2060, bonusPoints: 0 },
      { id: "space-cadet-blue", name: "Space Cadet", description: "Blue-suited cadet training for space missions!", imageUrl: "👨‍🚀", pointsRequired: 2120, bonusPoints: 0 },
      { id: "green-alien", name: "Friendly Alien", description: "Green alien explorer from a distant galaxy!", imageUrl: "👽", pointsRequired: 2180, bonusPoints: 0 },
      { id: "rocket-pilot", name: "Rocket Pilot", description: "Red and yellow suited pilot commanding starships!", imageUrl: "🛸", pointsRequired: 2240, bonusPoints: 0 },
      { id: "moon-walker", name: "Moon Walker", description: "Lunar explorer walking on the moon's surface!", imageUrl: "🌙", pointsRequired: 2300, bonusPoints: 0 },
      { id: "galaxy-scout", name: "Galaxy Scout", description: "Purple-suited scout exploring cosmic mysteries!", imageUrl: "🌌", pointsRequired: 2360, bonusPoints: 15 },
      { id: "robot-astronaut", name: "Robot Astronaut", description: "Friendly robot exploring space with metal determination!", imageUrl: "🤖", pointsRequired: 2420, bonusPoints: 0 },
      { id: "star-captain", name: "Star Captain", description: "Gold-suited captain commanding the space fleet!", imageUrl: "⭐", pointsRequired: 2500, bonusPoints: 20 },
      
      // Tier 6 - Cute Animals (Girls collection, 2560-3000 points) - Bonus Slots: 1, 4, 6
      { id: "cat-girl", name: "Cat Girl", description: "Adorable kitty character in pink hoodie with cat ears!", imageUrl: "🐱", pointsRequired: 2560, bonusPoints: 0 },
      { id: "bunny-girl", name: "Bunny Girl", description: "Sweet bunny character in lavender dress with floppy ears!", imageUrl: "🐰", pointsRequired: 2620, bonusPoints: 0 },
      { id: "fox-girl", name: "Fox Girl", description: "Clever fox character in orange outfit with fluffy tail!", imageUrl: "🦊", pointsRequired: 2680, bonusPoints: 0 },
      { id: "puppy-girl", name: "Puppy Girl", description: "Playful puppy character in brown hoodie, always wagging!", imageUrl: "🐶", pointsRequired: 2740, bonusPoints: 10 },
      { id: "panda-girl", name: "Panda Girl", description: "Cuddly panda character in black and white with bamboo!", imageUrl: "🐼", pointsRequired: 2800, bonusPoints: 0 },
      { id: "deer-girl", name: "Deer Girl", description: "Gentle deer character with adorable antlers and spots!", imageUrl: "🦌", pointsRequired: 2860, bonusPoints: 15 },
      { id: "raccoon-girl", name: "Raccoon Girl", description: "Mischievous raccoon character in gray hoodie with mask!", imageUrl: "🦝", pointsRequired: 2920, bonusPoints: 0 },
      { id: "squirrel-girl", name: "Squirrel Girl", description: "Energetic squirrel character collecting acorns and treasures!", imageUrl: "🐿️", pointsRequired: 3000, bonusPoints: 0 },
      
      // Tier 7 - Vampire Adventure (Boys collection, 3060-3500 points) - Bonus Slots: 2, 4, 7
      { id: "classic-vampire", name: "Classic Vampire", description: "Traditional vampire with elegant black cape and friendly fangs!", imageUrl: "🧛", pointsRequired: 3060, bonusPoints: 0 },
      { id: "bat-boy", name: "Bat Boy", description: "Vampire boy with small bat wings and purple vest!", imageUrl: "🦇", pointsRequired: 3120, bonusPoints: 0 },
      { id: "moonlight-vampire", name: "Moonlight Vampire", description: "Silver-haired vampire glowing with mystical moonlight!", imageUrl: "🌙", pointsRequired: 3180, bonusPoints: 0 },
      { id: "gothic-vampire", name: "Gothic Vampire", description: "Edgy vampire in dark purple and black with silver chains!", imageUrl: "🖤", pointsRequired: 3240, bonusPoints: 10 },
      { id: "shadow-vampire", name: "Shadow Vampire", description: "Mysterious vampire with shadow powers and glowing red eyes!", imageUrl: "👤", pointsRequired: 3300, bonusPoints: 0 },
      { id: "night-hunter", name: "Night Hunter", description: "Brave vampire hunter boy with wooden cross and courage!", imageUrl: "🗡️", pointsRequired: 3360, bonusPoints: 0 },
      { id: "blood-moon-vampire", name: "Blood Moon Vampire", description: "Dramatic vampire under blood moon influence with crimson power!", imageUrl: "🌕", pointsRequired: 3420, bonusPoints: 20 },
      { id: "vampire-prince", name: "Vampire Prince", description: "Royal vampire prince in elegant black and gold with small crown!", imageUrl: "👑", pointsRequired: 3500, bonusPoints: 0 },
      
      // Tier 8 - Ballerina Dreams (Girls collection, 3560-4000 points) - Bonus Slots: 3, 5, 8
      { id: "ballerina-pink", name: "Pink Ballerina", description: "Classic ballerina in pink tutu with sparkling grace!", imageUrl: "🩰", pointsRequired: 3560, bonusPoints: 0 },
      { id: "swan-ballerina", name: "Swan Ballerina", description: "Elegant swan lake ballerina in white feather tutu!", imageUrl: "🦢", pointsRequired: 3620, bonusPoints: 0 },
      { id: "purple-ballerina", name: "Purple Ballerina", description: "Royal ballerina in lavender tutu with flower crown!", imageUrl: "💜", pointsRequired: 3680, bonusPoints: 0 },
      { id: "blue-ballerina", name: "Ocean Ballerina", description: "Aqua ballerina dancing with ocean wave patterns!", imageUrl: "💙", pointsRequired: 3740, bonusPoints: 0 },
      { id: "golden-ballerina", name: "Golden Ballerina", description: "Radiant ballerina in golden tutu with star sequins!", imageUrl: "⭐", pointsRequired: 3800, bonusPoints: 10 },
      { id: "peach-ballerina", name: "Rose Ballerina", description: "Romantic ballerina in peach tutu with rose details!", imageUrl: "🌹", pointsRequired: 3860, bonusPoints: 0 },
      { id: "mint-ballerina", name: "Garden Ballerina", description: "Nature ballerina in mint green tutu with leaf patterns!", imageUrl: "🌿", pointsRequired: 3920, bonusPoints: 0 },
      { id: "rainbow-ballerina", name: "Rainbow Ballerina", description: "Magical ballerina in rainbow tutu spreading joy!", imageUrl: "🌈", pointsRequired: 4000, bonusPoints: 15 },
      
      // Tier 9 - Superhero Squad (Boys collection, 4060-4500 points) - Bonus Slots: 1, 3, 7
      { id: "classic-superhero", name: "Classic Hero", description: "Iconic superhero in red and blue suit with star emblem!", imageUrl: "🦸", pointsRequired: 4060, bonusPoints: 0 },
      { id: "lightning-speedster", name: "Lightning Speedster", description: "Super-fast hero in yellow suit with electric powers!", imageUrl: "⚡", pointsRequired: 4120, bonusPoints: 0 },
      { id: "tech-hero", name: "Tech Hero", description: "High-tech hero in purple armor with advanced gadgets!", imageUrl: "🤖", pointsRequired: 4180, bonusPoints: 10 },
      { id: "nature-guardian", name: "Nature Guardian", description: "Eco-hero in green suit protecting the environment!", imageUrl: "🌿", pointsRequired: 4240, bonusPoints: 0 },
      { id: "ice-hero", name: "Ice Hero", description: "Cool hero in blue frost suit with ice powers!", imageUrl: "❄️", pointsRequired: 4300, bonusPoints: 0 },
      { id: "fire-hero", name: "Fire Hero", description: "Blazing hero in orange flame suit with heat powers!", imageUrl: "🔥", pointsRequired: 4360, bonusPoints: 0 },
      { id: "shadow-ninja", name: "Shadow Ninja", description: "Stealthy ninja hero in black and purple suit!", imageUrl: "🥷", pointsRequired: 4420, bonusPoints: 20 },
      { id: "shield-hero", name: "Shield Hero", description: "Defensive hero in gold armor with energy shields!", imageUrl: "🛡️", pointsRequired: 4500, bonusPoints: 0 },
      
      // Tier 10 - Mecha Robots (Unisex collection, 4560-5000 points) - Bonus Slots: 2, 6, 8
      { id: "titan-mech", name: "Titan Mech", description: "Massive mech warrior with powerful hydraulic arms!", imageUrl: "🤖", pointsRequired: 4560, bonusPoints: 0 },
      { id: "cyber-warrior", name: "Cyber Warrior", description: "Sleek cyber robot with plasma blades and neon lights!", imageUrl: "⚔️", pointsRequired: 4620, bonusPoints: 0 },
      { id: "iron-guardian", name: "Iron Guardian", description: "Heavy armored mech designed for defense and protection!", imageUrl: "🛡️", pointsRequired: 4680, bonusPoints: 0 },
      { id: "plasma-bot", name: "Plasma Bot", description: "Energy-powered robot with glowing plasma core!", imageUrl: "💫", pointsRequired: 4740, bonusPoints: 0 },
      { id: "steel-samurai", name: "Steel Samurai", description: "Japanese-inspired mech with katana and honor code!", imageUrl: "⚔️", pointsRequired: 4800, bonusPoints: 0 },
      { id: "thunder-mech", name: "Thunder Mech", description: "Electric mech channeling lightning through its systems!", imageUrl: "⚡", pointsRequired: 4860, bonusPoints: 15 },
      { id: "neon-droid", name: "Neon Droid", description: "Colorful robot with vibrant LED displays!", imageUrl: "✨", pointsRequired: 4920, bonusPoints: 0 },
      { id: "battle-commander", name: "Battle Commander", description: "Elite mech leader coordinating robot squadrons!", imageUrl: "🎖️", pointsRequired: 5000, bonusPoints: 15 },
      
      // Tier 11 - Manga Heroes (Unisex collection, 5060-5500 points) - Bonus Slots: 4, 5, 7
      { id: "ninja-shadow", name: "Ninja Shadow", description: "Stealthy anime ninja with shadow jutsu techniques!", imageUrl: "🥷", pointsRequired: 5060, bonusPoints: 0 },
      { id: "spirit-fox", name: "Spirit Fox", description: "Mystical kitsune character with nine glowing tails!", imageUrl: "🦊", pointsRequired: 5120, bonusPoints: 0 },
      { id: "dragon-slayer", name: "Dragon Slayer", description: "Brave warrior wielding legendary dragon-forged sword!", imageUrl: "🐉", pointsRequired: 5180, bonusPoints: 0 },
      { id: "magical-girl", name: "Magical Girl", description: "Sparkling magical girl with transformation powers!", imageUrl: "✨", pointsRequired: 5240, bonusPoints: 0 },
      { id: "samurai-hero", name: "Samurai Hero", description: "Honorable samurai following the code of bushido!", imageUrl: "⚔️", pointsRequired: 5300, bonusPoints: 15 },
      { id: "elemental-master", name: "Elemental Master", description: "Anime hero controlling fire, water, earth and air!", imageUrl: "🌊", pointsRequired: 5360, bonusPoints: 0 },
      { id: "cat-fighter", name: "Cat Fighter", description: "Agile catgirl martial artist with lightning reflexes!", imageUrl: "🐱", pointsRequired: 5420, bonusPoints: 20 },
      { id: "school-hero", name: "School Hero", description: "Ordinary student with extraordinary hidden powers!", imageUrl: "📚", pointsRequired: 5500, bonusPoints: 0 },
      
      // Tier 12 - Gaming Legends (Unisex collection, 5560-6000 points) - Bonus Slots: 1, 5, 8
      { id: "pro-gamer", name: "Pro Gamer", description: "Esports champion with gaming headset and skills!", imageUrl: "🎮", pointsRequired: 5560, bonusPoints: 0 },
      { id: "pixel-warrior", name: "Pixel Warrior", description: "Retro 8-bit hero from classic gaming era!", imageUrl: "👾", pointsRequired: 5620, bonusPoints: 0 },
      { id: "controller-king", name: "Controller King", description: "Master of all gaming consoles and controllers!", imageUrl: "🕹️", pointsRequired: 5680, bonusPoints: 0 },
      { id: "vr-champion", name: "VR Champion", description: "Virtual reality hero exploring digital worlds!", imageUrl: "🥽", pointsRequired: 5740, bonusPoints: 0 },
      { id: "stream-star", name: "Stream Star", description: "Popular streamer bringing joy to millions!", imageUrl: "📺", pointsRequired: 5800, bonusPoints: 15 },
      { id: "arcade-master", name: "Arcade Master", description: "Champion of classic arcade games with high scores!", imageUrl: "🕹️", pointsRequired: 5860, bonusPoints: 0 },
      { id: "console-hero", name: "Console Hero", description: "Ultimate gaming hero with legendary achievements!", imageUrl: "🎮", pointsRequired: 5920, bonusPoints: 0 },
      { id: "level-boss", name: "Level Boss", description: "Final boss character with epic powers and style!", imageUrl: "👑", pointsRequired: 6000, bonusPoints: 20 },
      
      // Tier 13 - Pterosaur Sky (Flying Dinosaurs collection, 6060-6500 points) - Bonus Slots: 2, 5, 8
      { id: "pteranodon", name: "Pteranodon", description: "Majestic flying reptile with distinctive long head crest!", imageUrl: "🦅", pointsRequired: 6060, bonusPoints: 0 },
      { id: "quetzalcoatlus", name: "Quetzalcoatlus", description: "One of the largest flying animals ever - truly gigantic!", imageUrl: "🦅", pointsRequired: 6120, bonusPoints: 0 },
      { id: "rhamphorhynchus", name: "Rhamphorhynchus", description: "Small agile flyer with long tail and diamond tip!", imageUrl: "🦅", pointsRequired: 6180, bonusPoints: 0 },
      { id: "pterodactylus", name: "Pterodactylus", description: "The classic pterosaur from prehistoric skies!", imageUrl: "🦅", pointsRequired: 6240, bonusPoints: 0 },
      { id: "dimorphodon", name: "Dimorphodon", description: "Compact flyer with powerful jaws and strong teeth!", imageUrl: "🦅", pointsRequired: 6300, bonusPoints: 15 },
      { id: "tapejara", name: "Tapejara", description: "Stunning pterosaur with spectacular colorful head crest!", imageUrl: "🦅", pointsRequired: 6360, bonusPoints: 0 },
      { id: "anhanguera", name: "Anhanguera", description: "Expert fish hunter with long toothy snout!", imageUrl: "🦅", pointsRequired: 6420, bonusPoints: 0 },
      { id: "dsungaripterus", name: "Dsungaripterus", description: "Shell-crushing specialist with unique curved beak!", imageUrl: "🦅", pointsRequired: 6500, bonusPoints: 0 },
      
      // Tier 14 - HeroKids Legacy (Logo-style collection, 6560-7000 points) - Bonus Slots: 1, 4, 7
      { id: "shield-blaze", name: "Shield Blaze", description: "Protective hero boy with energy shield powers!", imageUrl: "🛡️", pointsRequired: 6560, bonusPoints: 0 },
      { id: "comet-dash", name: "Comet Dash", description: "Super-fast hero boy with comet trail speed!", imageUrl: "☄️", pointsRequired: 6620, bonusPoints: 0 },
      { id: "wave-glider", name: "Wave Glider", description: "Ocean hero boy surfing on water powers!", imageUrl: "🌊", pointsRequired: 6680, bonusPoints: 0 },
      { id: "forest-guard", name: "Forest Guard", description: "Nature hero boy with leaf shield protection!", imageUrl: "🌲", pointsRequired: 6740, bonusPoints: 10 },
      { id: "luna-beacon", name: "Luna Beacon", description: "Moonlight hero girl casting lunar beams!", imageUrl: "🌙", pointsRequired: 6800, bonusPoints: 0 },
      { id: "sunrise-spark", name: "Sunrise Spark", description: "Dawn hero girl radiating sun energy!", imageUrl: "🌅", pointsRequired: 6860, bonusPoints: 0 },
      { id: "bloom-guardian", name: "Bloom Guardian", description: "Flower hero girl with petal shield powers!", imageUrl: "🌸", pointsRequired: 6920, bonusPoints: 15 },
      { id: "breeze-captain", name: "Breeze Captain", description: "Wind hero girl guiding air currents!", imageUrl: "💨", pointsRequired: 7000, bonusPoints: 0 },
    ];

    await db.insert(skins).values(SKIN_DATA);

    log(`✅ Successfully auto-seeded ${SKIN_DATA.length} character skins! (14 collections × 8 skins)`);
  } catch (error) {
    console.error("❌ Error auto-seeding skins:", error);
  }
}

// Add Tier 13 Pterosaur Sky skins incrementally if they don't exist
async function addTier13PterosaursIfNeeded() {
  try {
    const tier13Skin = await db.select().from(skins).where(
      sql`${skins.id} = 'pteranodon'`
    );

    if (tier13Skin.length > 0) {
      log("✅ Tier 13 Pterosaur Sky skins already exist");
      return;
    }

    log("🌱 Adding Tier 13 Pterosaur Sky skins (8 new skins)...");
    
    const TIER_13_SKINS = [
      { id: "pteranodon", name: "Pteranodon", description: "Majestic flying reptile with distinctive long head crest!", imageUrl: "🦅", pointsRequired: 6060, bonusPoints: 0 },
      { id: "quetzalcoatlus", name: "Quetzalcoatlus", description: "One of the largest flying animals ever - truly gigantic!", imageUrl: "🦅", pointsRequired: 6120, bonusPoints: 0 },
      { id: "rhamphorhynchus", name: "Rhamphorhynchus", description: "Small agile flyer with long tail and diamond tip!", imageUrl: "🦅", pointsRequired: 6180, bonusPoints: 0 },
      { id: "pterodactylus", name: "Pterodactylus", description: "The classic pterosaur from prehistoric skies!", imageUrl: "🦅", pointsRequired: 6240, bonusPoints: 0 },
      { id: "dimorphodon", name: "Dimorphodon", description: "Compact flyer with powerful jaws and strong teeth!", imageUrl: "🦅", pointsRequired: 6300, bonusPoints: 15 },
      { id: "tapejara", name: "Tapejara", description: "Stunning pterosaur with spectacular colorful head crest!", imageUrl: "🦅", pointsRequired: 6360, bonusPoints: 0 },
      { id: "anhanguera", name: "Anhanguera", description: "Expert fish hunter with long toothy snout!", imageUrl: "🦅", pointsRequired: 6420, bonusPoints: 0 },
      { id: "dsungaripterus", name: "Dsungaripterus", description: "Shell-crushing specialist with unique curved beak!", imageUrl: "🦅", pointsRequired: 6500, bonusPoints: 0 },
    ];

    await db.insert(skins).values(TIER_13_SKINS);
    log("✅ Successfully added Tier 13 Pterosaur Sky skins!");
    
    // Also update HeroKids Legacy points to new Tier 14 range (6560-7000)
    await db.execute(sql`UPDATE skins SET points_required = 6560 WHERE id = 'shield-blaze'`);
    await db.execute(sql`UPDATE skins SET points_required = 6620 WHERE id = 'comet-dash'`);
    await db.execute(sql`UPDATE skins SET points_required = 6680 WHERE id = 'wave-glider'`);
    await db.execute(sql`UPDATE skins SET points_required = 6740 WHERE id = 'forest-guard'`);
    await db.execute(sql`UPDATE skins SET points_required = 6800 WHERE id = 'luna-beacon'`);
    await db.execute(sql`UPDATE skins SET points_required = 6860 WHERE id = 'sunrise-spark'`);
    await db.execute(sql`UPDATE skins SET points_required = 6920 WHERE id = 'bloom-guardian'`);
    await db.execute(sql`UPDATE skins SET points_required = 7000 WHERE id = 'breeze-captain'`);
    log("✅ Updated HeroKids Legacy skins to Tier 14 point range!");
  } catch (error) {
    console.error("❌ Error adding Tier 13 Pterosaur skins:", error);
  }
}

// Add Tier 15 Bonus Adventure Pack + new Legacy skins if they don't exist
async function addBonusAdventurePackIfNeeded() {
  try {
    const bonusSkin = await db.select().from(skins).where(
      sql`${skins.id} = 'pirate-captain'`
    );

    if (bonusSkin.length > 0) {
      log("✅ Bonus Adventure Pack skins already exist");
      return;
    }

    log("🌱 Adding Bonus Adventure Pack + new Legacy skins (8 new skins)...");
    
    // Tier 15 - Bonus Adventure Pack (4 regular skins)
    const BONUS_SKINS = [
      { id: "pirate-captain", name: "Pirate Captain", description: "Brave pirate captain sailing the seven seas!", imageUrl: "🏴‍☠️", pointsRequired: 7060, bonusPoints: 0 },
      { id: "wizard-kid", name: "Wizard Kid", description: "Young wizard with magical powers and a trusty wand!", imageUrl: "🧙", pointsRequired: 7120, bonusPoints: 10 },
      { id: "rock-star", name: "Rock Star", description: "Cool rock star with a guitar and awesome shades!", imageUrl: "🎸", pointsRequired: 7180, bonusPoints: 0 },
      { id: "detective-kid", name: "Detective Kid", description: "Clever detective solving mysteries everywhere!", imageUrl: "🔍", pointsRequired: 7240, bonusPoints: 0 },
    ];

    // New Legacy skins (4 more Legacy heroes)
    const NEW_LEGACY_SKINS = [
      { id: "storm-runner", name: "Storm Runner", description: "Swift hero racing through thunderstorms!", imageUrl: "⚡", pointsRequired: 7300, bonusPoints: 15 },
      { id: "star-guardian", name: "Star Guardian", description: "Celestial protector from the stars above!", imageUrl: "🌟", pointsRequired: 7360, bonusPoints: 0 },
      { id: "thunder-bolt", name: "Thunder Bolt", description: "Electric hero with lightning speed powers!", imageUrl: "⚡", pointsRequired: 7420, bonusPoints: 0 },
      { id: "heart-shield", name: "Heart Shield", description: "Brave hero protecting everyone with love!", imageUrl: "💖", pointsRequired: 7500, bonusPoints: 15 },
    ];

    await db.insert(skins).values([...BONUS_SKINS, ...NEW_LEGACY_SKINS]);
    log("✅ Successfully added Bonus Adventure Pack and new Legacy skins!");
  } catch (error) {
    console.error("❌ Error adding Bonus Adventure Pack skins:", error);
  }
}

// Add Nemicolopterus (Pterosaur) and Skater Kid (Adventure) to complete the last row
async function addNemicolopterusAndSkaterKidIfNeeded() {
  try {
    const existing = await db.select().from(skins).where(
      sql`${skins.id} = 'nemicolopterus'`
    );

    if (existing.length > 0) {
      log("✅ Nemicolopterus & Skater Kid skins already exist");
      return;
    }

    log("🌱 Adding Nemicolopterus & Skater Kid skins (2 new skins)...");

    const NEW_SKINS = [
      { id: "nemicolopterus", name: "Nemicolopterus", description: "Tiny tree-dwelling pterosaur, the smallest known pterosaur!", imageUrl: "🦅", pointsRequired: 7300, bonusPoints: 0 },
      { id: "skater-kid", name: "Skater Kid", description: "Cool skateboarder pulling off awesome tricks at the park!", imageUrl: "🛹", pointsRequired: 7360, bonusPoints: 0 },
    ];

    await db.insert(skins).values(NEW_SKINS);
    log("✅ Successfully added Nemicolopterus & Skater Kid skins!");
  } catch (error) {
    console.error("❌ Error adding new skins:", error);
  }
}

// Force reseed all skins if new skin collections don't exist
// This is a one-time migration that will run on next app start (both dev and production)
async function forceReseedSkinsIfNeeded() {
  try {
    // Check if new Tier 10-12 skins exist (Mecha Robots, Manga Heroes, Gaming Legends)
    const newSkins = await db.select().from(skins).where(
      sql`${skins.id} = 'titan-mech'`
    );

    if (newSkins.length > 0) {
      log("✅ Skins are up-to-date (Tier 10-12 detected)");
      return;
    }

    log("🔄 New skin collections not found - force reseeding all 96 skins...");
    
    // Delete ALL existing skins (this is safe because we're reseeding immediately)
    await db.delete(skins);
    
    log("🗑️  Deleted all old skins");

    // Reseed all 72 skins with correct data
    const SKIN_DATA = [
      // Tier 1 - Starter Heroes (0-500 points)
      { id: "junior-champion", name: "Junior Champion", description: "The classic HeroKids hero with a teal cape - start your journey here!", imageUrl: "🏆", pointsRequired: 0, bonusPoints: 0 },
      { id: "brave-explorer", name: "Brave Explorer", description: "A fearless adventurer with a compass and backpack, ready to explore!", imageUrl: "🧭", pointsRequired: 60, bonusPoints: 0 },
      { id: "star-cadet", name: "Star Cadet", description: "A space-themed hero with a jetpack and stars in their eyes!", imageUrl: "⭐", pointsRequired: 120, bonusPoints: 0 },
      { id: "nature-scout", name: "Nature Scout", description: "A green-thumbed hero who loves plants and the outdoors!", imageUrl: "🌿", pointsRequired: 180, bonusPoints: 0 },
      { id: "speed-runner", name: "Speed Runner", description: "Lightning-fast hero with super speed and energy!", imageUrl: "⚡", pointsRequired: 240, bonusPoints: 0 },
      { id: "book-wizard", name: "Book Wizard", description: "A magical hero powered by knowledge and reading!", imageUrl: "📚", pointsRequired: 300, bonusPoints: 5 },
      { id: "kitchen-hero", name: "Kitchen Hero", description: "Master chef hero who conquers cooking challenges!", imageUrl: "👨‍🍳", pointsRequired: 360, bonusPoints: 0 },
      { id: "art-master", name: "Art Master", description: "Creative hero with paintbrush and endless imagination!", imageUrl: "🎨", pointsRequired: 500, bonusPoints: 0 },
      
      // Tier 2 - Elite Heroes (501-1000 points)
      { id: "tech-ninja", name: "Tech Ninja", description: "Cyber warrior with advanced gadgets and tech skills!", imageUrl: "🥷", pointsRequired: 560, bonusPoints: 0 },
      { id: "ocean-guardian", name: "Ocean Guardian", description: "Protector of the seas with water powers!", imageUrl: "🌊", pointsRequired: 620, bonusPoints: 0 },
      { id: "sky-knight", name: "Sky Knight", description: "Aerial warrior soaring through the clouds!", imageUrl: "☁️", pointsRequired: 680, bonusPoints: 0 },
      { id: "fire-phoenix", name: "Fire Phoenix", description: "Legendary bird rising from flames with fire powers!", imageUrl: "🔥", pointsRequired: 740, bonusPoints: 5 },
      { id: "crystal-mage", name: "Crystal Mage", description: "Mystical hero channeling crystal energy!", imageUrl: "💎", pointsRequired: 800, bonusPoints: 0 },
      { id: "neon-rebel", name: "Neon Rebel", description: "Futuristic hero glowing with neon energy!", imageUrl: "✨", pointsRequired: 860, bonusPoints: 0 },
      { id: "cosmic-drifter", name: "Cosmic Drifter", description: "Space traveler exploring distant galaxies!", imageUrl: "🌌", pointsRequired: 920, bonusPoints: 0 },
      { id: "thunder-champion", name: "Thunder Champion", description: "Ultimate hero commanding lightning and storms!", imageUrl: "⚡", pointsRequired: 1000, bonusPoints: 15 },
      
      // Tier 3 - Dinosaur Heroes (1001+ points)
      { id: "t-rex", name: "Tyrannosaurus Rex", description: "The mighty king of dinosaurs with fearsome power!", imageUrl: "🦖", pointsRequired: 1060, bonusPoints: 0 },
      { id: "triceratops", name: "Triceratops", description: "Triple-horned defender with incredible strength!", imageUrl: "🦕", pointsRequired: 1120, bonusPoints: 0 },
      { id: "stegosaurus", name: "Stegosaurus", description: "Plated warrior with spiked tail defense!", imageUrl: "🦴", pointsRequired: 1180, bonusPoints: 0 },
      { id: "velociraptor", name: "Velociraptor", description: "Swift and clever predator with razor-sharp claws!", imageUrl: "🦎", pointsRequired: 1240, bonusPoints: 0 },
      { id: "brachiosaurus", name: "Brachiosaurus", description: "Gentle giant reaching for the sky!", imageUrl: "🦕", pointsRequired: 1300, bonusPoints: 0 },
      { id: "spinosaurus", name: "Spinosaurus", description: "Sail-backed hunter of land and water!", imageUrl: "🦖", pointsRequired: 1360, bonusPoints: 0 },
      { id: "ankylosaurus", name: "Ankylosaurus", description: "Armored tank with a devastating club tail!", imageUrl: "🦴", pointsRequired: 1420, bonusPoints: 0 },
      { id: "allosaurus", name: "Allosaurus", description: "Apex predator of the Jurassic period!", imageUrl: "🦖", pointsRequired: 1500, bonusPoints: 0 },
      
      // Tier 4 - Magical Princess World (Girls collection, 1560-2000 points) - Bonus Slots: 1, 4, 7
      { id: "princess-tiara", name: "Princess with Tiara", description: "Classic princess with magical tiara and sparkling gown!", imageUrl: "👑", pointsRequired: 1560, bonusPoints: 0 },
      { id: "purple-princess", name: "Purple Princess", description: "Royal princess in glittering purple ballgown with mystical powers!", imageUrl: "💜", pointsRequired: 1620, bonusPoints: 0 },
      { id: "ice-princess", name: "Ice Princess", description: "Frozen beauty with snowflake powers and icy elegance!", imageUrl: "❄️", pointsRequired: 1680, bonusPoints: 0 },
      { id: "rainbow-princess", name: "Rainbow Princess", description: "Magical princess surrounded by colorful stars and rainbows!", imageUrl: "🌈", pointsRequired: 1740, bonusPoints: 10 },
      { id: "nature-princess", name: "Nature Princess", description: "Green guardian princess who speaks to flowers and animals!", imageUrl: "🌸", pointsRequired: 1800, bonusPoints: 0 },
      { id: "sun-princess", name: "Sun Princess", description: "Golden princess radiating warmth and sunshine energy!", imageUrl: "☀️", pointsRequired: 1860, bonusPoints: 0 },
      { id: "ocean-princess", name: "Ocean Princess", description: "Coral princess ruling the underwater kingdoms!", imageUrl: "🐚", pointsRequired: 1920, bonusPoints: 15 },
      { id: "fairy-princess", name: "Fairy Princess", description: "Mystical fairy princess with butterfly wings and magic dust!", imageUrl: "🧚", pointsRequired: 2000, bonusPoints: 0 },
      
      // Tier 5 - Space Explorers (Boys collection, 2060-2500 points) - Bonus Slots: 3, 6, 8
      { id: "astronaut-kid", name: "Astronaut Kid", description: "Young space explorer in white spacesuit ready for adventure!", imageUrl: "🚀", pointsRequired: 2060, bonusPoints: 0 },
      { id: "space-cadet-blue", name: "Space Cadet", description: "Blue-suited cadet training for space missions!", imageUrl: "👨‍🚀", pointsRequired: 2120, bonusPoints: 0 },
      { id: "green-alien", name: "Friendly Alien", description: "Green alien explorer from a distant galaxy!", imageUrl: "👽", pointsRequired: 2180, bonusPoints: 0 },
      { id: "rocket-pilot", name: "Rocket Pilot", description: "Red and yellow suited pilot commanding starships!", imageUrl: "🛸", pointsRequired: 2240, bonusPoints: 0 },
      { id: "moon-walker", name: "Moon Walker", description: "Lunar explorer walking on the moon's surface!", imageUrl: "🌙", pointsRequired: 2300, bonusPoints: 0 },
      { id: "galaxy-scout", name: "Galaxy Scout", description: "Purple-suited scout exploring cosmic mysteries!", imageUrl: "🌌", pointsRequired: 2360, bonusPoints: 15 },
      { id: "robot-astronaut", name: "Robot Astronaut", description: "Friendly robot exploring space with metal determination!", imageUrl: "🤖", pointsRequired: 2420, bonusPoints: 0 },
      { id: "star-captain", name: "Star Captain", description: "Gold-suited captain commanding the space fleet!", imageUrl: "⭐", pointsRequired: 2500, bonusPoints: 20 },
      
      // Tier 6 - Cute Animals (Girls collection, 2560-3000 points) - Bonus Slots: 1, 4, 6
      { id: "cat-girl", name: "Cat Girl", description: "Adorable kitty character in pink hoodie with cat ears!", imageUrl: "🐱", pointsRequired: 2560, bonusPoints: 0 },
      { id: "bunny-girl", name: "Bunny Girl", description: "Sweet bunny character in lavender dress with floppy ears!", imageUrl: "🐰", pointsRequired: 2620, bonusPoints: 0 },
      { id: "fox-girl", name: "Fox Girl", description: "Clever fox character in orange outfit with fluffy tail!", imageUrl: "🦊", pointsRequired: 2680, bonusPoints: 0 },
      { id: "puppy-girl", name: "Puppy Girl", description: "Playful puppy character in brown hoodie, always wagging!", imageUrl: "🐶", pointsRequired: 2740, bonusPoints: 10 },
      { id: "panda-girl", name: "Panda Girl", description: "Cuddly panda character in black and white with bamboo!", imageUrl: "🐼", pointsRequired: 2800, bonusPoints: 0 },
      { id: "deer-girl", name: "Deer Girl", description: "Gentle deer character with adorable antlers and spots!", imageUrl: "🦌", pointsRequired: 2860, bonusPoints: 15 },
      { id: "raccoon-girl", name: "Raccoon Girl", description: "Mischievous raccoon character in gray hoodie with mask!", imageUrl: "🦝", pointsRequired: 2920, bonusPoints: 0 },
      { id: "squirrel-girl", name: "Squirrel Girl", description: "Energetic squirrel character collecting acorns and treasures!", imageUrl: "🐿️", pointsRequired: 3000, bonusPoints: 0 },
      
      // Tier 7 - Vampire Adventure (Boys collection, 3060-3500 points) - Bonus Slots: 2, 4, 7
      { id: "classic-vampire", name: "Classic Vampire", description: "Traditional vampire with elegant black cape and friendly fangs!", imageUrl: "🧛", pointsRequired: 3060, bonusPoints: 0 },
      { id: "bat-boy", name: "Bat Boy", description: "Vampire boy with small bat wings and purple vest!", imageUrl: "🦇", pointsRequired: 3120, bonusPoints: 0 },
      { id: "moonlight-vampire", name: "Moonlight Vampire", description: "Silver-haired vampire glowing with mystical moonlight!", imageUrl: "🌙", pointsRequired: 3180, bonusPoints: 0 },
      { id: "gothic-vampire", name: "Gothic Vampire", description: "Edgy vampire in dark purple and black with silver chains!", imageUrl: "🖤", pointsRequired: 3240, bonusPoints: 10 },
      { id: "shadow-vampire", name: "Shadow Vampire", description: "Mysterious vampire with shadow powers and glowing red eyes!", imageUrl: "👤", pointsRequired: 3300, bonusPoints: 0 },
      { id: "night-hunter", name: "Night Hunter", description: "Brave vampire hunter boy with wooden cross and courage!", imageUrl: "🗡️", pointsRequired: 3360, bonusPoints: 0 },
      { id: "blood-moon-vampire", name: "Blood Moon Vampire", description: "Dramatic vampire under blood moon influence with crimson power!", imageUrl: "🌕", pointsRequired: 3420, bonusPoints: 20 },
      { id: "vampire-prince", name: "Vampire Prince", description: "Royal vampire prince in elegant black and gold with small crown!", imageUrl: "👑", pointsRequired: 3500, bonusPoints: 0 },
      
      // Tier 8 - Ballerina Dreams (Girls collection, 3560-4000 points) - Bonus Slots: 3, 5, 8
      { id: "ballerina-pink", name: "Pink Ballerina", description: "Classic ballerina in pink tutu with sparkling grace!", imageUrl: "🩰", pointsRequired: 3560, bonusPoints: 0 },
      { id: "swan-ballerina", name: "Swan Ballerina", description: "Elegant swan lake ballerina in white feather tutu!", imageUrl: "🦢", pointsRequired: 3620, bonusPoints: 0 },
      { id: "purple-ballerina", name: "Purple Ballerina", description: "Royal ballerina in lavender tutu with flower crown!", imageUrl: "💜", pointsRequired: 3680, bonusPoints: 0 },
      { id: "blue-ballerina", name: "Ocean Ballerina", description: "Aqua ballerina dancing with ocean wave patterns!", imageUrl: "💙", pointsRequired: 3740, bonusPoints: 0 },
      { id: "golden-ballerina", name: "Golden Ballerina", description: "Radiant ballerina in golden tutu with star sequins!", imageUrl: "⭐", pointsRequired: 3800, bonusPoints: 10 },
      { id: "peach-ballerina", name: "Rose Ballerina", description: "Romantic ballerina in peach tutu with rose details!", imageUrl: "🌹", pointsRequired: 3860, bonusPoints: 0 },
      { id: "mint-ballerina", name: "Garden Ballerina", description: "Nature ballerina in mint green tutu with leaf patterns!", imageUrl: "🌿", pointsRequired: 3920, bonusPoints: 0 },
      { id: "rainbow-ballerina", name: "Rainbow Ballerina", description: "Magical ballerina in rainbow tutu spreading joy!", imageUrl: "🌈", pointsRequired: 4000, bonusPoints: 15 },
      
      // Tier 9 - Superhero Squad (Boys collection, 4060-4500 points) - Bonus Slots: 1, 3, 7
      { id: "classic-superhero", name: "Classic Hero", description: "Iconic superhero in red and blue suit with star emblem!", imageUrl: "🦸", pointsRequired: 4060, bonusPoints: 0 },
      { id: "lightning-speedster", name: "Lightning Speedster", description: "Super-fast hero in yellow suit with electric powers!", imageUrl: "⚡", pointsRequired: 4120, bonusPoints: 0 },
      { id: "tech-hero", name: "Tech Hero", description: "High-tech hero in purple armor with advanced gadgets!", imageUrl: "🤖", pointsRequired: 4180, bonusPoints: 10 },
      { id: "nature-guardian", name: "Nature Guardian", description: "Eco-hero in green suit protecting the environment!", imageUrl: "🌿", pointsRequired: 4240, bonusPoints: 0 },
      { id: "ice-hero", name: "Ice Hero", description: "Cool hero in blue frost suit with ice powers!", imageUrl: "❄️", pointsRequired: 4300, bonusPoints: 0 },
      { id: "fire-hero", name: "Fire Hero", description: "Blazing hero in orange flame suit with heat powers!", imageUrl: "🔥", pointsRequired: 4360, bonusPoints: 0 },
      { id: "shadow-ninja", name: "Shadow Ninja", description: "Stealthy ninja hero in black and purple suit!", imageUrl: "🥷", pointsRequired: 4420, bonusPoints: 20 },
      { id: "shield-hero", name: "Shield Hero", description: "Defensive hero in gold armor with energy shields!", imageUrl: "🛡️", pointsRequired: 4500, bonusPoints: 0 },
      
      // Tier 10 - Mecha Robots (Unisex collection, 4560-5000 points) - Bonus Slots: 2, 6, 8
      { id: "titan-mech", name: "Titan Mech", description: "Massive mech warrior with powerful hydraulic arms!", imageUrl: "🤖", pointsRequired: 4560, bonusPoints: 0 },
      { id: "cyber-warrior", name: "Cyber Warrior", description: "Sleek cyber robot with plasma blades and neon lights!", imageUrl: "⚔️", pointsRequired: 4620, bonusPoints: 0 },
      { id: "iron-guardian", name: "Iron Guardian", description: "Heavy armored mech designed for defense and protection!", imageUrl: "🛡️", pointsRequired: 4680, bonusPoints: 0 },
      { id: "plasma-bot", name: "Plasma Bot", description: "Energy-powered robot with glowing plasma core!", imageUrl: "💫", pointsRequired: 4740, bonusPoints: 0 },
      { id: "steel-samurai", name: "Steel Samurai", description: "Japanese-inspired mech with katana and honor code!", imageUrl: "⚔️", pointsRequired: 4800, bonusPoints: 0 },
      { id: "thunder-mech", name: "Thunder Mech", description: "Electric mech channeling lightning through its systems!", imageUrl: "⚡", pointsRequired: 4860, bonusPoints: 15 },
      { id: "neon-droid", name: "Neon Droid", description: "Colorful robot with vibrant LED displays!", imageUrl: "✨", pointsRequired: 4920, bonusPoints: 0 },
      { id: "battle-commander", name: "Battle Commander", description: "Elite mech leader coordinating robot squadrons!", imageUrl: "🎖️", pointsRequired: 5000, bonusPoints: 15 },
      
      // Tier 11 - Manga Heroes (Unisex collection, 5060-5500 points) - Bonus Slots: 4, 5, 7
      { id: "ninja-shadow", name: "Ninja Shadow", description: "Stealthy anime ninja with shadow jutsu techniques!", imageUrl: "🥷", pointsRequired: 5060, bonusPoints: 0 },
      { id: "spirit-fox", name: "Spirit Fox", description: "Mystical kitsune character with nine glowing tails!", imageUrl: "🦊", pointsRequired: 5120, bonusPoints: 0 },
      { id: "dragon-slayer", name: "Dragon Slayer", description: "Brave warrior wielding legendary dragon-forged sword!", imageUrl: "🐉", pointsRequired: 5180, bonusPoints: 0 },
      { id: "magical-girl", name: "Magical Girl", description: "Sparkling magical girl with transformation powers!", imageUrl: "✨", pointsRequired: 5240, bonusPoints: 0 },
      { id: "samurai-hero", name: "Samurai Hero", description: "Honorable samurai following the code of bushido!", imageUrl: "⚔️", pointsRequired: 5300, bonusPoints: 15 },
      { id: "elemental-master", name: "Elemental Master", description: "Anime hero controlling fire, water, earth and air!", imageUrl: "🌊", pointsRequired: 5360, bonusPoints: 0 },
      { id: "cat-fighter", name: "Cat Fighter", description: "Agile catgirl martial artist with lightning reflexes!", imageUrl: "🐱", pointsRequired: 5420, bonusPoints: 20 },
      { id: "school-hero", name: "School Hero", description: "Ordinary student with extraordinary hidden powers!", imageUrl: "📚", pointsRequired: 5500, bonusPoints: 0 },
      
      // Tier 12 - Gaming Legends (Unisex collection, 5560-6000 points) - Bonus Slots: 1, 5, 8
      { id: "pro-gamer", name: "Pro Gamer", description: "Esports champion with gaming headset and skills!", imageUrl: "🎮", pointsRequired: 5560, bonusPoints: 0 },
      { id: "pixel-warrior", name: "Pixel Warrior", description: "Retro 8-bit hero from classic gaming era!", imageUrl: "👾", pointsRequired: 5620, bonusPoints: 0 },
      { id: "controller-king", name: "Controller King", description: "Master of all gaming consoles and controllers!", imageUrl: "🕹️", pointsRequired: 5680, bonusPoints: 0 },
      { id: "vr-champion", name: "VR Champion", description: "Virtual reality hero exploring digital worlds!", imageUrl: "🥽", pointsRequired: 5740, bonusPoints: 0 },
      { id: "stream-star", name: "Stream Star", description: "Popular streamer bringing joy to millions!", imageUrl: "📺", pointsRequired: 5800, bonusPoints: 15 },
      { id: "arcade-master", name: "Arcade Master", description: "Champion of classic arcade games with high scores!", imageUrl: "🕹️", pointsRequired: 5860, bonusPoints: 0 },
      { id: "console-hero", name: "Console Hero", description: "Ultimate gaming hero with legendary achievements!", imageUrl: "🎮", pointsRequired: 5920, bonusPoints: 0 },
      { id: "level-boss", name: "Level Boss", description: "Final boss character with epic powers and style!", imageUrl: "👑", pointsRequired: 6000, bonusPoints: 20 },
      
      // Tier 13 - Pterosaur Sky (Flying Dinosaurs collection, 6060-6500 points) - Bonus Slots: 2, 5, 8
      { id: "pteranodon", name: "Pteranodon", description: "Majestic flying reptile with distinctive long head crest!", imageUrl: "🦅", pointsRequired: 6060, bonusPoints: 0 },
      { id: "quetzalcoatlus", name: "Quetzalcoatlus", description: "One of the largest flying animals ever - truly gigantic!", imageUrl: "🦅", pointsRequired: 6120, bonusPoints: 0 },
      { id: "rhamphorhynchus", name: "Rhamphorhynchus", description: "Small agile flyer with long tail and diamond tip!", imageUrl: "🦅", pointsRequired: 6180, bonusPoints: 0 },
      { id: "pterodactylus", name: "Pterodactylus", description: "The classic pterosaur from prehistoric skies!", imageUrl: "🦅", pointsRequired: 6240, bonusPoints: 0 },
      { id: "dimorphodon", name: "Dimorphodon", description: "Compact flyer with powerful jaws and strong teeth!", imageUrl: "🦅", pointsRequired: 6300, bonusPoints: 15 },
      { id: "tapejara", name: "Tapejara", description: "Stunning pterosaur with spectacular colorful head crest!", imageUrl: "🦅", pointsRequired: 6360, bonusPoints: 0 },
      { id: "anhanguera", name: "Anhanguera", description: "Expert fish hunter with long toothy snout!", imageUrl: "🦅", pointsRequired: 6420, bonusPoints: 0 },
      { id: "dsungaripterus", name: "Dsungaripterus", description: "Shell-crushing specialist with unique curved beak!", imageUrl: "🦅", pointsRequired: 6500, bonusPoints: 0 },
      
      // Tier 14 - HeroKids Legacy (Logo-style collection, 6560-7000 points) - Bonus Slots: 1, 4, 7
      { id: "shield-blaze", name: "Shield Blaze", description: "Protective hero boy with energy shield powers!", imageUrl: "🛡️", pointsRequired: 6560, bonusPoints: 0 },
      { id: "comet-dash", name: "Comet Dash", description: "Super-fast hero boy with comet trail speed!", imageUrl: "☄️", pointsRequired: 6620, bonusPoints: 0 },
      { id: "wave-glider", name: "Wave Glider", description: "Ocean hero boy surfing on water powers!", imageUrl: "🌊", pointsRequired: 6680, bonusPoints: 0 },
      { id: "forest-guard", name: "Forest Guard", description: "Nature hero boy with leaf shield protection!", imageUrl: "🌲", pointsRequired: 6740, bonusPoints: 10 },
      { id: "luna-beacon", name: "Luna Beacon", description: "Moonlight hero girl casting lunar beams!", imageUrl: "🌙", pointsRequired: 6800, bonusPoints: 0 },
      { id: "sunrise-spark", name: "Sunrise Spark", description: "Dawn hero girl radiating sun energy!", imageUrl: "🌅", pointsRequired: 6860, bonusPoints: 0 },
      { id: "bloom-guardian", name: "Bloom Guardian", description: "Flower hero girl with petal shield powers!", imageUrl: "🌸", pointsRequired: 6920, bonusPoints: 15 },
      { id: "breeze-captain", name: "Breeze Captain", description: "Wind hero girl guiding air currents!", imageUrl: "💨", pointsRequired: 7000, bonusPoints: 0 },
    ];

    await db.insert(skins).values(SKIN_DATA);

    log(`✅ Force reseeded all ${SKIN_DATA.length} character skins! (14 collections × 8 skins)`);
  } catch (error) {
    console.error("❌ Error force reseeding skins:", error);
  }
}

// One-time migration: Give starter skin to existing members and redistribute stars
// This migration is idempotent - it only applies changes once per member
async function migrateExistingMembersForTestPhase() {
  const STARTER_SKIN = "junior-champion";
  const LEGACY_SKIN_IDS = [
    "shield-blaze", "comet-dash", "wave-glider", "forest-guard",
    "luna-beacon", "sunrise-spark", "bloom-guardian", "breeze-captain"
  ];

  try {
    // Get all members
    const allMembers = await db.select().from(familyMembers);
    let membersUpdated = 0;
    let starsRedistributed = 0;
    let alreadyMigrated = 0;

    for (const member of allMembers) {
      let discoveredSkinIds = (member.discoveredSkinIds as string[]) || [];
      let needsSkinUpdate = false;

      // Step 1: Ensure member has the starter skin
      if (discoveredSkinIds.length === 0) {
        discoveredSkinIds = [STARTER_SKIN];
        needsSkinUpdate = true;
      } else if (!discoveredSkinIds.includes(STARTER_SKIN)) {
        discoveredSkinIds = [STARTER_SKIN, ...discoveredSkinIds];
        needsSkinUpdate = true;
      }

      if (needsSkinUpdate) {
        await db.update(familyMembers)
          .set({ discoveredSkinIds })
          .where(eq(familyMembers.id, member.id));
        membersUpdated++;
      }

      // Step 2: Check star placements
      const existingStars = await db.select().from(starPlacements)
        .where(eq(starPlacements.memberId, member.id));
      
      // Get all standard skins (excluding starter and legacy)
      const allSkins = await db.select({ id: skins.id }).from(skins);
      const standardSkinIds = allSkins
        .map(s => s.id)
        .filter(id => !LEGACY_SKIN_IDS.includes(id) && id !== STARTER_SKIN);
      
      // Get undiscovered standard skins (use updated discoveredSkinIds)
      const undiscoveredSkinIds = standardSkinIds.filter(
        id => !discoveredSkinIds.includes(id)
      );

      // Check if any unfound stars are on discovered skins or starter (they need to be moved)
      const starsOnDiscoveredSkins = existingStars.filter(
        star => !star.found && (discoveredSkinIds.includes(star.skinId) || star.skinId === STARTER_SKIN)
      );

      // Only redistribute if there are unfound stars on discovered/starter skins
      // This ensures we don't touch members who already have correct star placement
      if (starsOnDiscoveredSkins.length > 0 && undiscoveredSkinIds.length > 0) {
        // Delete all star placements and redistribute to undiscovered skins
        await db.delete(starPlacements).where(eq(starPlacements.memberId, member.id));
        
        // Reset stars found counter (since we're starting fresh)
        await db.update(familyMembers)
          .set({ starsFound: 0 })
          .where(eq(familyMembers.id, member.id));

        // Randomly select up to 32 undiscovered skins for star placement
        const shuffled = [...undiscoveredSkinIds].sort(() => Math.random() - 0.5);
        const selectedPositions = shuffled.slice(0, Math.min(32, shuffled.length));

        for (const skinId of selectedPositions) {
          await db.insert(starPlacements).values({
            memberId: member.id,
            skinId,
            found: false,
          }).onConflictDoNothing();
        }

        starsRedistributed++;
        log(`♻️ Redistributed ${selectedPositions.length} stars for ${member.displayName} to undiscovered cards`);
      } else if (existingStars.length === 0 && undiscoveredSkinIds.length > 0) {
        // No stars yet - initialize on undiscovered skins only (one-time)
        const shuffled = [...undiscoveredSkinIds].sort(() => Math.random() - 0.5);
        const selectedPositions = shuffled.slice(0, Math.min(32, shuffled.length));

        for (const skinId of selectedPositions) {
          await db.insert(starPlacements).values({
            memberId: member.id,
            skinId,
            found: false,
          }).onConflictDoNothing();
        }
        starsRedistributed++;
        log(`⭐ Initialized ${selectedPositions.length} stars for ${member.displayName}`);
      } else {
        // Member already has correct setup
        alreadyMigrated++;
      }
    }

    if (membersUpdated > 0 || starsRedistributed > 0) {
      log(`✅ Test phase migration: ${membersUpdated} members got starter skin, ${starsRedistributed} members got stars initialized/redistributed, ${alreadyMigrated} already migrated`);
    } else {
      log(`✅ Test phase migration: All ${alreadyMigrated} members already migrated (skipped)`);
    }
  } catch (error) {
    console.error("❌ Error during test phase migration:", error);
  }
}

async function ensurePinboardTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pinboard_notes (
        id SERIAL PRIMARY KEY,
        family_name VARCHAR NOT NULL REFERENCES families(family_name) ON DELETE CASCADE,
        member_id VARCHAR NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
        message VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    log("✅ Pinboard notes table ready");
  } catch (error) {
    console.error("❌ Error ensuring pinboard table:", error);
  }
}

(async () => {
  const server = await registerRoutes(app);

  // Ensure pinboard_notes table exists
  await ensurePinboardTable();

  // Auto-seed character skins on first startup
  await autoSeedSkinsIfNeeded();

  // Force reseed all skins if Vampire Adventure doesn't exist (one-time migration)
  await forceReseedSkinsIfNeeded();
  
  // Add Tier 13 Pterosaur Sky skins if they don't exist (and update HeroKids Legacy to Tier 14)
  await addTier13PterosaursIfNeeded();
  
  // Add Bonus Adventure Pack + new Legacy skins
  await addBonusAdventurePackIfNeeded();

  // Add Nemicolopterus & Skater Kid to complete the last row
  await addNemicolopterusAndSkaterKidIfNeeded();

  // Add new achievement_type enum values if they don't exist yet
  try {
    await db.execute(sql`ALTER TYPE achievement_type ADD VALUE IF NOT EXISTS 'legacy_collector'`);
  } catch (_e) { /* ignore */ }
  try {
    await db.execute(sql`ALTER TYPE achievement_type ADD VALUE IF NOT EXISTS 'monthly_leaderboard'`);
  } catch (_e) { /* ignore */ }

  // Backfill legacy-collector achievement for families that already have achievements but are missing it
  try {
    // Use raw SQL to avoid Drizzle enum validation issues with the newly added enum value
    const families = await db.execute(sql`SELECT DISTINCT family_name FROM achievement_definitions`);
    log(`🔍 Backfill: found ${families.rows.length} families with achievements`);
    for (const row of families.rows) {
      const familyName = row.family_name as string;
      const existing = await db.execute(
        sql`SELECT id FROM achievement_definitions WHERE family_name = ${familyName} AND slug = 'legacy-collector'`
      );
      if (existing.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO achievement_definitions (id, family_name, type, slug, title, description, bonus_points, reward_type, is_active, config)
          VALUES (
            gen_random_uuid(),
            ${familyName},
            'legacy_collector'::achievement_type,
            'legacy-collector',
            'Legacy Collector',
            'Unlock 10 of 12 HeroKids Legacy skins',
            500,
            'custom',
            false,
            '{"requiredLegacySkins": 10}'::jsonb
          )
        `);
        log(`✅ Added legacy-collector achievement for family: ${familyName}`);
      } else {
        log(`ℹ️ legacy-collector already exists for family: ${familyName}`);
      }

      // Backfill monthly-leaderboard-1st
      const existingMonthly = await db.execute(
        sql`SELECT id FROM achievement_definitions WHERE family_name = ${familyName} AND slug = 'monthly-leaderboard-1st'`
      );
      if (existingMonthly.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO achievement_definitions (id, family_name, type, slug, title, description, bonus_points, reward_type, is_active, config)
          VALUES (
            gen_random_uuid(),
            ${familyName},
            'monthly_leaderboard'::achievement_type,
            'monthly-leaderboard-1st',
            'Monthly Champion',
            'Finish in 1st place on the monthly leaderboard',
            200,
            'custom',
            true,
            '{"rank": 1}'::jsonb
          )
        `);
        log(`✅ Added monthly-leaderboard-1st achievement for family: ${familyName}`);
      } else {
        // Ensure existing rows have is_active = true
        await db.execute(sql`
          UPDATE achievement_definitions SET is_active = true
          WHERE family_name = ${familyName} AND slug = 'monthly-leaderboard-1st' AND is_active = false
        `);
        log(`ℹ️ monthly-leaderboard-1st already exists for family: ${familyName}`);
      }
    }
  } catch (e) {
    console.error("Failed to backfill achievements:", e);
  }

  // One-time migration for existing testers (starter skin + star redistribution)
  await migrateExistingMembersForTestPhase();

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
    // Prevent browsers from caching the HTML shell so new chunk filenames
    // are always fetched after an app update (avoids infinite loading spinner).
    app.use((req, res, next) => {
      if (req.accepts("html")) {
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");
      }
      next();
    });
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
