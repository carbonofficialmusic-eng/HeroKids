-- Insert all 24 character skins into production database
-- Run this in Replit's Production Database SQL pane

INSERT INTO skins (id, name, description, image_url, points_required, bonus_points) VALUES
-- Tier 1 - Starter Heroes (0-500 points)
('junior-champion', 'Junior Champion', 'The classic HeroKids hero with a teal cape - start your journey here!', '🏆', 0, 0),
('brave-explorer', 'Brave Explorer', 'A fearless adventurer with a compass and backpack, ready to explore!', '🧭', 60, 10),
('star-cadet', 'Star Cadet', 'A space-themed hero with a jetpack and stars in their eyes!', '⭐', 120, 0),
('nature-scout', 'Nature Scout', 'A green-thumbed hero who loves plants and the outdoors!', '🌿', 180, 0),
('speed-runner', 'Speed Runner', 'Lightning-fast hero with super speed and energy!', '⚡', 240, 0),
('book-wizard', 'Book Wizard', 'A magical hero powered by knowledge and reading!', '📚', 300, 10),
('kitchen-hero', 'Kitchen Hero', 'Master chef hero who conquers cooking challenges!', '👨‍🍳', 360, 0),
('art-master', 'Art Master', 'Creative hero with paintbrush and endless imagination!', '🎨', 500, 0),

-- Tier 2 - Elite Heroes (501-1000 points)
('tech-ninja', 'Tech Ninja', 'Cyber warrior with advanced gadgets and tech skills!', '🥷', 560, 10),
('ocean-guardian', 'Ocean Guardian', 'Ocean warrior princess commanding the power of the seas!', '🧜‍♀️', 620, 0),
('sky-knight', 'Sky Knight', 'Aerial warrior soaring through the clouds!', '☁️', 680, 0),
('fire-phoenix', 'Fire Phoenix', 'Legendary bird rising from flames with fire powers!', '🔥', 740, 10),
('crystal-mage', 'Crystal Mage', 'Mystical hero channeling crystal energy!', '💎', 800, 0),
('neon-rebel', 'Neon Rebel', 'Futuristic hero glowing with neon energy!', '✨', 860, 0),
('cosmic-drifter', 'Cosmic Drifter', 'Space traveler exploring distant galaxies!', '🌌', 920, 0),
('thunder-champion', 'Thunder Champion', 'Ultimate hero commanding lightning and storms!', '⚡', 1000, 20),

-- Tier 3 - Dinosaur Heroes (1001+ points)
('t-rex', 'Tyrannosaurus Rex', 'The mighty king of dinosaurs with fearsome power!', '🦖', 1060, 0),
('triceratops', 'Triceratops', 'Triple-horned defender with incredible strength!', '🦕', 1120, 0),
('stegosaurus', 'Stegosaurus', 'Plated warrior with spiked tail defense!', '🦴', 1180, 0),
('velociraptor', 'Velociraptor', 'Swift and clever predator with razor-sharp claws!', '🦎', 1240, 10),
('brachiosaurus', 'Brachiosaurus', 'Gentle giant reaching for the sky!', '🦕', 1300, 10),
('spinosaurus', 'Spinosaurus', 'Sail-backed hunter of land and water!', '🦖', 1360, 0),
('ankylosaurus', 'Ankylosaurus', 'Armored tank with a devastating club tail!', '🦴', 1420, 0),
('allosaurus', 'Allosaurus', 'Apex predator of the Jurassic period!', '🦖', 1500, 0)
ON CONFLICT (id) DO NOTHING;
