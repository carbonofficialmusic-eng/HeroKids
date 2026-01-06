// Import default avatar resolver
import { resolveAvatarUrl } from "@/lib/avatarAssets";

// Import skin images using @assets alias
// Tier 1 - Starter Heroes (Modern fresh designs)
import juniorChampionImg from "@assets/generated_images/Modern_Junior_Champion_avatar_2bc47f6b.png";
import braveExplorerImg from "@assets/generated_images/Modern_Brave_Explorer_avatar_5d8a0f47.png";
import starCadetImg from "@assets/generated_images/Modern_Star_Cadet_avatar_03106676.png";
import natureScoutImg from "@assets/generated_images/Modern_Nature_Scout_avatar_9a7998e2.png";
import speedRunnerImg from "@assets/generated_images/Modern_Speed_Runner_avatar_6438bf70.png";
import bookWizardImg from "@assets/generated_images/Modern_Book_Wizard_avatar_a7765dd5.png";
import kitchenHeroImg from "@assets/generated_images/Modern_Kitchen_Hero_avatar_4062600a.png";
import artMasterImg from "@assets/generated_images/Modern_Art_Master_avatar_9e59088f.png";

// Tier 2 - Elite Heroes (Friendly heroic designs with white backgrounds)
import techNinjaImg from "@assets/generated_images/Friendly_Tech_Ninja_white_bg_ab574699.png";
import oceanGuardianImg from "@assets/generated_images/Friendly_Ocean_Guardian_white_bg_d61b9379.png";
import skyKnightImg from "@assets/generated_images/Sky_Knight_avatar_11e5e952.png";
import firePhoenixImg from "@assets/generated_images/Fire_Phoenix_avatar_0eb558b2.png";
import crystalMageImg from "@assets/generated_images/Crystal_Mage_avatar_3822ee79.png";
import neonRebelImg from "@assets/generated_images/Neon_Rebel_avatar_fe8fea5f.png";
import cosmicDrifterImg from "@assets/generated_images/Cosmic_Drifter_avatar_1d7d3759.png";
import thunderChampionImg from "@assets/generated_images/Thunder_Champion_avatar_cf3f783f.png";

// Tier 3 - Dinosaur Heroes (Realistic scientific designs for teenagers)
import tRexImg from "@assets/generated_images/T-Rex_realistic_portrait_82feaa74.png";
import triceratopsImg from "@assets/generated_images/Triceratops_realistic_portrait_028d6c17.png";
import stegosaurusImg from "@assets/generated_images/Stegosaurus_realistic_portrait_539445d4.png";
import velociraptorImg from "@assets/generated_images/Velociraptor_realistic_feathered_portrait_d3f3b6ad.png";
import brachiosaurusImg from "@assets/generated_images/Brachiosaurus_realistic_portrait_d0eb144d.png";
import spinosaurusImg from "@assets/generated_images/Spinosaurus_realistic_portrait_2e2df3d4.png";
import ankylosaurusImg from "@assets/generated_images/Ankylosaurus_realistic_portrait_34a4b4bf.png";
import allosaurusImg from "@assets/generated_images/Allosaurus_realistic_portrait_c0d02199.png";

// Tier 4 - Magical Princess World (Girls collection)
import princessTiaraImg from "@assets/generated_images/princess_with_tiara_magical.png";
import purplePrincessImg from "@assets/generated_images/purple_princess_glitter_gown.png";
import icePrincessImg from "@assets/generated_images/ice_princess_blue_snowflake.png";
import rainbowPrincessImg from "@assets/generated_images/rainbow_princess_colorful_stars.png";
import naturePrincessImg from "@assets/generated_images/nature_princess_green_flowers.png";
import sunPrincessImg from "@assets/generated_images/sun_princess_golden_bright.png";
import oceanPrincessImg from "@assets/generated_images/ocean_princess_coral_seashells.png";
import fairyPrincessImg from "@assets/generated_images/fairy_princess_lavender_butterflies.png";

// Tier 5 - Space Explorers (Boys collection)
import astronautKidImg from "@assets/generated_images/astronaut_kid_white_spacesuit.png";
import spaceCadetBlueImg from "@assets/generated_images/blue_space_cadet_uniform.png";
import greenAlienImg from "@assets/generated_images/green_alien_orange_spacesuit.png";
import rocketPilotImg from "@assets/generated_images/rocket_pilot_red_yellow.png";
import moonWalkerImg from "@assets/generated_images/moon_walker_gray_lunar.png";
import galaxyScoutImg from "@assets/generated_images/galaxy_scout_purple_cosmic.png";
import robotAstronautImg from "@assets/generated_images/robot_astronaut_metallic_friendly.png";
import starCaptainImg from "@assets/generated_images/star_captain_gold_uniform.png";

// Tier 6 - Cute Animals (Girls collection)
import catGirlImg from "@assets/generated_images/cat_girl_pink_hoodie.png";
import bunnyGirlImg from "@assets/generated_images/bunny_girl_lavender_dress.png";
import foxGirlImg from "@assets/generated_images/fox_girl_orange_outfit.png";
import puppyGirlImg from "@assets/generated_images/puppy_girl_brown_hoodie.png";
import pandaGirlImg from "@assets/generated_images/panda_girl_black_white.png";
import deerGirlImg from "@assets/generated_images/deer_girl_brown_antlers.png";
import raccoonGirlImg from "@assets/generated_images/raccoon_girl_gray_hoodie.png";
import squirrelGirlImg from "@assets/generated_images/squirrel_girl_orange_acorn.png";

// Tier 7 - Vampire Adventure (Boys collection - 3D style with white backgrounds)
import classicVampireImg from "@assets/generated_images/classic_vampire_boy_white_bg.png";
import batBoyImg from "@assets/generated_images/bat_boy_vampire_white_bg.png";
import moonlightVampireImg from "@assets/generated_images/moonlight_vampire_white_bg.png";
import gothicVampireImg from "@assets/generated_images/gothic_vampire_white_bg.png";
import shadowVampireImg from "@assets/generated_images/shadow_vampire_white_bg.png";
import nightHunterImg from "@assets/generated_images/night_hunter_vampire_white_bg.png";
import bloodMoonVampireImg from "@assets/generated_images/blood_moon_vampire_white_bg.png";
import vampirePrinceImg from "@assets/generated_images/vampire_prince_white_bg.png";

// Tier 8 - Ballerina Dreams (Girls collection)
import ballerinaPinkImg from "@assets/generated_images/ballerina_pink_tutu_classic.png";
import swanBallerinaImg from "@assets/generated_images/swan_ballerina_white_feathers.png";
import purpleBallerinaImg from "@assets/generated_images/purple_ballerina_flower_crown.png";
import blueBallerinaImg from "@assets/generated_images/blue_ballerina_ocean_waves.png";
import goldenBallerinaImg from "@assets/generated_images/golden_ballerina_star_sequins.png";
import peachBallerinaImg from "@assets/generated_images/peach_ballerina_rose_details.png";
import mintBallerinaImg from "@assets/generated_images/mint_ballerina_leaf_patterns.png";
import rainbowBallerinaImg from "@assets/generated_images/rainbow_ballerina_colorful_layers.png";

// Tier 9 - Superhero Squad (Boys collection)
import classicSuperheroImg from "@assets/generated_images/classic_superhero_red_blue.png";
import lightningSpeedsterImg from "@assets/generated_images/lightning_speedster_yellow_suit.png";
import techHeroImg from "@assets/generated_images/tech_hero_purple_armor.png";
import natureGuardianImg from "@assets/generated_images/nature_guardian_green_eco.png";
import iceHeroImg from "@assets/generated_images/ice_hero_blue_frost.png";
import fireHeroImg from "@assets/generated_images/fire_hero_orange_flames.png";
import shadowNinjaImg from "@assets/generated_images/shadow_ninja_black_purple.png";
import shieldHeroImg from "@assets/generated_images/shield_hero_gold_energy.png";

// Tier 10 - Mecha Robots (Modern tech collection for older kids)
import titanMechImg from "@assets/generated_images/titan_mech_robot_avatar.png";
import cyberWarriorImg from "@assets/generated_images/cyber_warrior_robot_avatar.png";
import ironGuardianImg from "@assets/generated_images/iron_guardian_robot_avatar.png";
import plasmaBotImg from "@assets/generated_images/plasma_bot_robot_avatar.png";
import steelSamuraiImg from "@assets/generated_images/steel_samurai_robot_avatar.png";
import thunderMechImg from "@assets/generated_images/thunder_mech_robot_avatar.png";
import neonDroidImg from "@assets/generated_images/neon_droid_robot_avatar.png";
import battleCommanderImg from "@assets/generated_images/battle_commander_robot_avatar.png";

// Tier 11 - Manga Heroes (Anime/Manga style for older kids)
import ninjaShadowImg from "@assets/generated_images/ninja_shadow_manga_avatar.png";
import spiritFoxImg from "@assets/generated_images/spirit_fox_manga_avatar.png";
import dragonSlayerImg from "@assets/generated_images/dragon_slayer_manga_avatar.png";
import magicalGirlImg from "@assets/generated_images/magical_girl_manga_avatar.png";
import samuraiHeroImg from "@assets/generated_images/samurai_hero_manga_avatar.png";
import elementalMasterImg from "@assets/generated_images/elemental_master_manga_avatar.png";
import catFighterImg from "@assets/generated_images/cat_fighter_manga_avatar.png";
import schoolHeroImg from "@assets/generated_images/school_hero_manga_avatar.png";

// Tier 12 - Gaming Legends (E-Sports/Gamer style for older kids)
import proGamerImg from "@assets/generated_images/pro_gamer_esports_avatar.png";
import pixelWarriorImg from "@assets/generated_images/pixel_warrior_retro_avatar.png";
import controllerKingImg from "@assets/generated_images/controller_king_gamer_avatar.png";
import vrChampionImg from "@assets/generated_images/vr_champion_gaming_avatar.png";
import streamStarImg from "@assets/generated_images/stream_star_creator_avatar.png";
import arcadeMasterImg from "@assets/generated_images/arcade_master_retro_avatar.png";
import consoleHeroImg from "@assets/generated_images/console_hero_gamer_avatar.png";
import levelBossImg from "@assets/generated_images/level_boss_gaming_avatar.png";

// Tier 13 - Pterosaur Sky (Flying Dinosaurs collection - realistic style with white backgrounds)
import pteranodonImg from "@assets/generated_images/pteranodon_white_bg.png";
import quetzalcoatlusImg from "@assets/generated_images/quetzalcoatlus_white_bg.png";
import rhamphorhynchusImg from "@assets/generated_images/rhamphorhynchus_white_bg.png";
import pterodactylusImg from "@assets/generated_images/pterodactylus_white_bg.png";
import dimorphodonImg from "@assets/generated_images/dimorphodon_white_bg.png";
import tapejaraImg from "@assets/generated_images/tapejara_white_bg.png";
import anhangueraImg from "@assets/generated_images/anhanguera_white_bg.png";
import dsungaripterusImg from "@assets/generated_images/dsungaripterus_white_bg.png";

// Tier 14 - HeroKids Legacy (Logo-style superhero collection - 4 boys, 4 girls)
import shieldBlazeImg from "@assets/generated_images/shield_blaze_boy_hero_avatar.png";
import cometDashImg from "@assets/generated_images/comet_dash_boy_hero_avatar.png";
import waveGliderImg from "@assets/generated_images/wave_glider_boy_hero_avatar.png";
import forestGuardImg from "@assets/generated_images/forest_guard_boy_hero_avatar.png";
import lunaBeaconImg from "@assets/generated_images/luna_beacon_girl_hero_avatar.png";
import sunriseSparkImg from "@assets/generated_images/sunrise_spark_girl_hero_avatar.png";
import bloomGuardianImg from "@assets/generated_images/bloom_guardian_girl_hero_avatar.png";
import breezeCaptainImg from "@assets/generated_images/breeze_captain_girl_hero_avatar.png";
import stormRunnerImg from "@assets/generated_images/legacy_hero_boy_logo_style.png";
import starGuardianImg from "@assets/generated_images/legacy_hero_girl_logo_style.png";
import thunderBoltImg from "@assets/generated_images/legacy_thunder_boy_logo.png";
import heartShieldImg from "@assets/generated_images/legacy_heart_girl_logo.png";

// Tier 15 - Bonus Adventure Pack (Mixed collection)
import pirateCaptainImg from "@assets/generated_images/pirate_captain_kid_avatar.png";
import wizardKidImg from "@assets/generated_images/wizard_kid_avatar.png";
import rockStarImg from "@assets/generated_images/rock_star_kid_avatar.png";
import detectiveKidImg from "@assets/generated_images/detective_kid_avatar.png";

// Bonus Adventure Pack backgrounds
import rockConcertStageBg from "@assets/generated_images/rock_concert_stage_background.png";
import pirateShipDeckBg from "@assets/generated_images/pirate_ship_deck_background.png";
import wizardTowerBg from "@assets/generated_images/wizard_tower_magical_background.png";
import detectiveOfficeBg from "@assets/generated_images/detective_mystery_office_background.png";

// New Legacy skin backgrounds (cel-shaded vector style like Comet Dash)
import legacyStormRunnerBg from "@assets/generated_images/storm_runner_cel-shaded_coastal_highway.png";
import legacyStarGuardianBg from "@assets/generated_images/star_guardian_cel-shaded_observatory.png";
import legacyThunderBoltBg from "@assets/generated_images/thunder_bolt_cel-shaded_storm_city.png";
import legacyHeartShieldBg from "@assets/generated_images/heart_shield_cel-shaded_plaza.png";

// Import themed background images
// Modern fresh backgrounds for Tier 1
import modernCitySkylineBg from "@assets/generated_images/Modern_city_skyline_background_a5f841c6.png";
import modernJungleParkBg from "@assets/generated_images/Modern_jungle_park_background_ec08fd63.png";
import modernSpaceStationBg from "@assets/generated_images/Modern_space_station_background_1605b9f8.png";
import modernEcoGardenBg from "@assets/generated_images/Modern_eco_garden_background_86a539ca.png";
import modernRacingTrackBg from "@assets/generated_images/Modern_racing_track_background_850e8bdc.png";
import modernMagicalLibraryBg from "@assets/generated_images/Modern_magical_library_background_514c4635.png";
import modernProfessionalKitchenBg from "@assets/generated_images/Modern_professional_kitchen_background_30a471ed.png";
import modernArtStudioBg from "@assets/generated_images/Modern_art_studio_background_56a4110e.png";

// Tier 2 backgrounds (Epic dramatic scenes)
import eliteTechCityBg from "@assets/generated_images/Elite_tech_city_background_21f1690c.png";
import eliteOceanDepthsBg from "@assets/generated_images/Elite_ocean_depths_background_112ffacd.png";
import skylineBg from "@assets/generated_images/City_skyline_background_cf75a668.png";
import nightSkyBg from "@assets/generated_images/Night_sky_knight_background_b50bd51d.png";
import volcanicBg from "@assets/generated_images/Fire_Phoenix_volcanic_background_f3ebef18.png";
import crystalCaveBg from "@assets/generated_images/Crystal_Mage_cave_background_64b9c911.png";
import neonCityBg from "@assets/generated_images/Neon_Rebel_city_background_29209636.png";
import nebulaBg from "@assets/generated_images/Cosmic_Drifter_nebula_background_cea3dec7.png";
import stormBg from "@assets/generated_images/Thunder_Champion_storm_background_4272fb58.png";

// Tier 3 backgrounds (Prehistoric epic landscapes)
import cretaceousVolcanicBg from "@assets/generated_images/Cretaceous_volcanic_landscape_80691058.png";
import cretaceousPlainsBg from "@assets/generated_images/Cretaceous_plains_background_f84649c6.png";
import jurassicForestBg from "@assets/generated_images/Jurassic_forest_background_dca2add4.png";
import cretaceousScrublandBg from "@assets/generated_images/Cretaceous_scrubland_background_779cd327.png";
import jurassicSwampBg from "@assets/generated_images/Jurassic_swamp_background_e9a9dd22.png";
import cretaceousRiverDeltaBg from "@assets/generated_images/Cretaceous_river_delta_background_23c38a31.png";
import cretaceousCoastalBg from "@assets/generated_images/Cretaceous_coastal_plains_background_cb7d4a93.png";
import jurassicCanyonBg from "@assets/generated_images/Jurassic_canyon_background_c736e0a5.png";

// Tier 4 backgrounds - Magical Princess World
import pinkCastleBg from "@assets/generated_images/pink_castle_magical_rainbow.png";
import purpleCrystalPalaceBg from "@assets/generated_images/purple_crystal_palace_night.png";
import iceCastleBg from "@assets/generated_images/ice_castle_winter_wonderland.png";
import rainbowCastleBg from "@assets/generated_images/rainbow_castle_colorful_clouds.png";
import enchantedForestBg from "@assets/generated_images/enchanted_green_forest_magical.png";
import goldenPalaceBg from "@assets/generated_images/golden_palace_sunny_bright.png";
import underwaterPalaceBg from "@assets/generated_images/underwater_coral_palace_ocean.png";
import fairyGardenBg from "@assets/generated_images/fairy_garden_lavender_magical.png";

// Tier 5 backgrounds - Space Explorers
import spaceStationBg from "@assets/generated_images/space_station_command_center.png";
import alienPlanetBg from "@assets/generated_images/alien_planet_colorful_landscape.png";
import rocketLaunchBg from "@assets/generated_images/rocket_launch_pad_countdown.png";
import moonBaseBg from "@assets/generated_images/moon_base_lunar_station.png";
import galaxyNebulaBg from "@assets/generated_images/purple_pink_nebula_cosmic.png";
import spaceAcademyBg from "@assets/generated_images/space_academy_blue_training.png";
import asteroidFieldBg from "@assets/generated_images/asteroid_field_mining_station.png";
import starshipBridgeBg from "@assets/generated_images/starship_bridge_gold_command.png";

// Tier 6 backgrounds - Cute Animals
import sunnyMeadowBg from "@assets/generated_images/sunny_meadow_wildflowers_butterflies.png";
import enchantedForestPurpleBg from "@assets/generated_images/enchanted_forest_magical_purple.png";
import autumnWoodlandBg from "@assets/generated_images/autumn_woodland_orange_leaves.png";
import flowerGardenBg from "@assets/generated_images/flower_garden_colorful_blooms.png";
import bambooForestBg from "@assets/generated_images/bamboo_forest_peaceful_panda.png";
import woodlandClearingBg from "@assets/generated_images/woodland_clearing_deer_sunbeams.png";
import hollowTreeHouseBg from "@assets/generated_images/hollow_tree_house_cozy.png";
import oakTreeParkBg from "@assets/generated_images/oak_tree_park_squirrel.png";

// Tier 7 backgrounds - Vampire Adventure (new 3D style - 8 unique backgrounds)
import vampireCastle3dBg from "@assets/generated_images/3d_vampire_castle_background.png";
import vampireMansion3dBg from "@assets/generated_images/3d_vampire_mansion_interior.png";
import moonlitForest3dBg from "@assets/generated_images/3d_moonlit_enchanted_forest.png";
import gothicCathedral3dBg from "@assets/generated_images/3d_gothic_cathedral_interior.png";
import shadowyCrypt3dBg from "@assets/generated_images/3d_shadowy_crystal_crypt.png";
import bloodMoonSky3dBg from "@assets/generated_images/3d_blood_moon_night_sky.png";
import vampireThrone3dBg from "@assets/generated_images/3d_vampire_throne_room.png";
import gothicGraveyard3dBg from "@assets/generated_images/3d_whimsical_gothic_graveyard.png";

// Tier 8 backgrounds - Ballerina Dreams
import balletStageBg from "@assets/generated_images/ballet_stage_red_curtains.png";
import swanLakeBg from "@assets/generated_images/swan_lake_sunset_castle.png";
import balletStudioBg from "@assets/generated_images/ballet_studio_mirrors_barre.png";
import underwaterBalletBg from "@assets/generated_images/underwater_ballet_coral_ocean.png";
import sunflowerFieldBg from "@assets/generated_images/sunflower_field_golden_bright.png";
import roseGardenBg from "@assets/generated_images/rose_garden_romantic_trellis.png";
import springMeadowBg from "@assets/generated_images/spring_meadow_green_fresh.png";
import rainbowSkyBg from "@assets/generated_images/rainbow_sky_magical_clouds.png";

// Tier 9 backgrounds - Superhero Squad
import citySkylineBg from "@assets/generated_images/city_skyline_hero_signal.png";
import lightningStormBg from "@assets/generated_images/lightning_storm_electric_sky.png";
import techLabBg from "@assets/generated_images/tech_lab_purple_holograms.png";
import forestClearingMagicBg from "@assets/generated_images/forest_clearing_nature_magic.png";
import arcticIceBg from "@assets/generated_images/arctic_ice_northern_lights.png";
import volcanicCraterBg from "@assets/generated_images/volcanic_crater_lava_glowing.png";
import shadowDojoBg from "@assets/generated_images/shadow_dojo_ninja_training.png";
import heroFortressBg from "@assets/generated_images/hero_fortress_gold_shields.png";

// Tier 10 backgrounds - Mecha Robots (individual backgrounds)
import titanMechBg from "@assets/generated_images/titan_mech_hangar_background.png";
import cyberWarriorBg from "@assets/generated_images/cyber_warrior_city_background.png";
import ironGuardianBg from "@assets/generated_images/iron_guardian_fortress_background.png";
import plasmaBotBg from "@assets/generated_images/plasma_bot_lab_background.png";
import steelSamuraiBg from "@assets/generated_images/steel_samurai_castle_background.png";
import thunderMechBg from "@assets/generated_images/thunder_mech_storm_background.png";
import neonDroidBg from "@assets/generated_images/neon_droid_digital_background.png";
import battleCommanderBg from "@assets/generated_images/battle_commander_center_background.png";

// Tier 11 backgrounds - Manga Heroes (individual backgrounds)
import ninjaShadowBg from "@assets/generated_images/ninja_shadow_village_background.png";
import spiritFoxBg from "@assets/generated_images/spirit_fox_shrine_background.png";
import dragonSlayerBg from "@assets/generated_images/dragon_slayer_lair_background.png";
import magicalGirlBg from "@assets/generated_images/magical_girl_sky_background.png";
import samuraiHeroBg from "@assets/generated_images/samurai_hero_battlefield_background.png";
import elementalMasterBg from "@assets/generated_images/elemental_master_chamber_background.png";
import catFighterBg from "@assets/generated_images/cat_fighter_rooftop_scene.png";
import schoolHeroBg from "@assets/generated_images/anime_school_rooftop_sunset.png";

// Tier 12 backgrounds - Gaming Legends (individual backgrounds)
import proGamerBg from "@assets/generated_images/pro_gamer_arena_background.png";
import pixelWarriorBg from "@assets/generated_images/pixel_art_fantasy_landscape_background.png";
import controllerKingBg from "@assets/generated_images/controller_king_throne_background.png";
import vrChampionBg from "@assets/generated_images/vr_champion_cyberspace_background.png";
import streamStarBg from "@assets/generated_images/stream_star_studio_background.png";
import arcadeMasterBg from "@assets/generated_images/arcade_master_retro_background.png";
import consoleHeroBg from "@assets/generated_images/console_hero_setup_background.png";
import levelBossBg from "@assets/generated_images/level_boss_throne_background.png";

// Tier 13 backgrounds - Pterosaur Sky (individual prehistoric scenes)
import pteranodonBg from "@assets/generated_images/pteranodon_ocean_sunset_scene.png";
import quetzalcoatlusBg from "@assets/generated_images/quetzalcoatlus_canyon_landscape.png";
import rhamphorhynchusBg from "@assets/generated_images/rhamphorhynchus_lagoon_twilight.png";
import pterodactylusBg from "@assets/generated_images/pterodactylus_forest_canopy.png";
import dimorphodonBg from "@assets/generated_images/dimorphodon_jungle_cliff.png";
import tapejaraBg from "@assets/generated_images/tapejara_tropical_coast.png";
import anhangueraBg from "@assets/generated_images/anhanguera_ocean_hunting.png";
import dsungaripterusBg from "@assets/generated_images/dsungaripterus_rocky_shore.png";

// Tier 14 backgrounds - HeroKids Legacy
import shieldBlazeBg from "@assets/generated_images/shield_blaze_city_protection_background.png";
import cometDashBg from "@assets/generated_images/comet_dash_sky_bridge_background.png";
import waveGliderBg from "@assets/generated_images/wave_glider_ocean_bay_background.png";
import forestGuardBg from "@assets/generated_images/forest_guard_nature_clearing_background.png";
import lunaBeaconBg from "@assets/generated_images/luna_beacon_moonlit_rooftop_background.png";
import sunriseSparkBg from "@assets/generated_images/sunrise_spark_hilltop_dawn_background.png";
import bloomGuardianBg from "@assets/generated_images/bloom_guardian_flower_garden_background.png";
import breezeCaptainBg from "@assets/generated_images/breeze_captain_cloud_deck_background.png";

// Skin image mappings for new HeroKids themed skins
export const SKIN_IMAGES: Record<string, string> = {
  // Tier 1 - Starter Heroes
  "junior-champion": juniorChampionImg,
  "brave-explorer": braveExplorerImg,
  "star-cadet": starCadetImg,
  "nature-scout": natureScoutImg,
  "speed-runner": speedRunnerImg,
  "book-wizard": bookWizardImg,
  "kitchen-hero": kitchenHeroImg,
  "art-master": artMasterImg,
  
  // Tier 2 - Elite Heroes
  "tech-ninja": techNinjaImg,
  "ocean-guardian": oceanGuardianImg,
  "sky-knight": skyKnightImg,
  "fire-phoenix": firePhoenixImg,
  "crystal-mage": crystalMageImg,
  "neon-rebel": neonRebelImg,
  "cosmic-drifter": cosmicDrifterImg,
  "thunder-champion": thunderChampionImg,
  
  // Tier 3 - Dinosaur Heroes
  "t-rex": tRexImg,
  "triceratops": triceratopsImg,
  "stegosaurus": stegosaurusImg,
  "velociraptor": velociraptorImg,
  "brachiosaurus": brachiosaurusImg,
  "spinosaurus": spinosaurusImg,
  "ankylosaurus": ankylosaurusImg,
  "allosaurus": allosaurusImg,
  
  // Tier 4 - Magical Princess World
  "princess-tiara": princessTiaraImg,
  "purple-princess": purplePrincessImg,
  "ice-princess": icePrincessImg,
  "rainbow-princess": rainbowPrincessImg,
  "nature-princess": naturePrincessImg,
  "sun-princess": sunPrincessImg,
  "ocean-princess": oceanPrincessImg,
  "fairy-princess": fairyPrincessImg,
  
  // Tier 5 - Space Explorers
  "astronaut-kid": astronautKidImg,
  "space-cadet-blue": spaceCadetBlueImg,
  "green-alien": greenAlienImg,
  "rocket-pilot": rocketPilotImg,
  "moon-walker": moonWalkerImg,
  "galaxy-scout": galaxyScoutImg,
  "robot-astronaut": robotAstronautImg,
  "star-captain": starCaptainImg,
  
  // Tier 6 - Cute Animals
  "cat-girl": catGirlImg,
  "bunny-girl": bunnyGirlImg,
  "fox-girl": foxGirlImg,
  "puppy-girl": puppyGirlImg,
  "panda-girl": pandaGirlImg,
  "deer-girl": deerGirlImg,
  "raccoon-girl": raccoonGirlImg,
  "squirrel-girl": squirrelGirlImg,
  
  // Tier 7 - Vampire Adventure
  "classic-vampire": classicVampireImg,
  "bat-boy": batBoyImg,
  "moonlight-vampire": moonlightVampireImg,
  "gothic-vampire": gothicVampireImg,
  "shadow-vampire": shadowVampireImg,
  "night-hunter": nightHunterImg,
  "blood-moon-vampire": bloodMoonVampireImg,
  "vampire-prince": vampirePrinceImg,
  
  // Tier 8 - Ballerina Dreams
  "ballerina-pink": ballerinaPinkImg,
  "swan-ballerina": swanBallerinaImg,
  "purple-ballerina": purpleBallerinaImg,
  "blue-ballerina": blueBallerinaImg,
  "golden-ballerina": goldenBallerinaImg,
  "peach-ballerina": peachBallerinaImg,
  "mint-ballerina": mintBallerinaImg,
  "rainbow-ballerina": rainbowBallerinaImg,
  
  // Tier 9 - Superhero Squad
  "classic-superhero": classicSuperheroImg,
  "lightning-speedster": lightningSpeedsterImg,
  "tech-hero": techHeroImg,
  "nature-guardian": natureGuardianImg,
  "ice-hero": iceHeroImg,
  "fire-hero": fireHeroImg,
  "shadow-ninja": shadowNinjaImg,
  "shield-hero": shieldHeroImg,
  
  // Tier 10 - Mecha Robots
  "titan-mech": titanMechImg,
  "cyber-warrior": cyberWarriorImg,
  "iron-guardian": ironGuardianImg,
  "plasma-bot": plasmaBotImg,
  "steel-samurai": steelSamuraiImg,
  "thunder-mech": thunderMechImg,
  "neon-droid": neonDroidImg,
  "battle-commander": battleCommanderImg,
  
  // Tier 11 - Manga Heroes
  "ninja-shadow": ninjaShadowImg,
  "spirit-fox": spiritFoxImg,
  "dragon-slayer": dragonSlayerImg,
  "magical-girl": magicalGirlImg,
  "samurai-hero": samuraiHeroImg,
  "elemental-master": elementalMasterImg,
  "cat-fighter": catFighterImg,
  "school-hero": schoolHeroImg,
  
  // Tier 12 - Gaming Legends
  "pro-gamer": proGamerImg,
  "pixel-warrior": pixelWarriorImg,
  "controller-king": controllerKingImg,
  "vr-champion": vrChampionImg,
  "stream-star": streamStarImg,
  "arcade-master": arcadeMasterImg,
  "console-hero": consoleHeroImg,
  "level-boss": levelBossImg,
  
  // Tier 13 - Pterosaur Sky (Flying Dinosaurs)
  "pteranodon": pteranodonImg,
  "quetzalcoatlus": quetzalcoatlusImg,
  "rhamphorhynchus": rhamphorhynchusImg,
  "pterodactylus": pterodactylusImg,
  "dimorphodon": dimorphodonImg,
  "tapejara": tapejaraImg,
  "anhanguera": anhangueraImg,
  "dsungaripterus": dsungaripterusImg,
  
  // Tier 14 - HeroKids Legacy (Logo-style)
  "shield-blaze": shieldBlazeImg,
  "comet-dash": cometDashImg,
  "wave-glider": waveGliderImg,
  "forest-guard": forestGuardImg,
  "luna-beacon": lunaBeaconImg,
  "sunrise-spark": sunriseSparkImg,
  "bloom-guardian": bloomGuardianImg,
  "breeze-captain": breezeCaptainImg,
  "storm-runner": stormRunnerImg,
  "star-guardian": starGuardianImg,
  "thunder-bolt": thunderBoltImg,
  "heart-shield": heartShieldImg,
  
  // Tier 15 - Bonus Adventure Pack
  "pirate-captain": pirateCaptainImg,
  "wizard-kid": wizardKidImg,
  "rock-star": rockStarImg,
  "detective-kid": detectiveKidImg,
};

// Themed background mappings for new HeroKids themed skins
export const SKIN_BACKGROUNDS: Record<string, string> = {
  // Tier 1 - Starter Heroes (Modern fresh backgrounds)
  "junior-champion": modernCitySkylineBg,
  "brave-explorer": modernJungleParkBg,
  "star-cadet": modernSpaceStationBg,
  "nature-scout": modernEcoGardenBg,
  "speed-runner": modernRacingTrackBg,
  "book-wizard": modernMagicalLibraryBg,
  "kitchen-hero": modernProfessionalKitchenBg,
  "art-master": modernArtStudioBg,
  
  // Tier 2 - Elite Heroes (Epic dramatic backgrounds)
  "tech-ninja": eliteTechCityBg,
  "ocean-guardian": eliteOceanDepthsBg,
  "sky-knight": nightSkyBg,
  "fire-phoenix": volcanicBg,
  "crystal-mage": crystalCaveBg,
  "neon-rebel": neonCityBg,
  "cosmic-drifter": nebulaBg,
  "thunder-champion": stormBg,
  
  // Tier 3 - Dinosaur Heroes (Prehistoric landscapes)
  "t-rex": cretaceousVolcanicBg,
  "triceratops": cretaceousPlainsBg,
  "stegosaurus": jurassicForestBg,
  "velociraptor": cretaceousScrublandBg,
  "brachiosaurus": jurassicSwampBg,
  "spinosaurus": cretaceousRiverDeltaBg,
  "ankylosaurus": cretaceousCoastalBg,
  "allosaurus": jurassicCanyonBg,
  
  // Tier 4 - Magical Princess World
  "princess-tiara": pinkCastleBg,
  "purple-princess": purpleCrystalPalaceBg,
  "ice-princess": iceCastleBg,
  "rainbow-princess": rainbowCastleBg,
  "nature-princess": enchantedForestBg,
  "sun-princess": goldenPalaceBg,
  "ocean-princess": underwaterPalaceBg,
  "fairy-princess": fairyGardenBg,
  
  // Tier 5 - Space Explorers
  "astronaut-kid": spaceStationBg,
  "space-cadet-blue": alienPlanetBg,
  "green-alien": rocketLaunchBg,
  "rocket-pilot": moonBaseBg,
  "moon-walker": galaxyNebulaBg,
  "galaxy-scout": spaceAcademyBg,
  "robot-astronaut": asteroidFieldBg,
  "star-captain": starshipBridgeBg,
  
  // Tier 6 - Cute Animals
  "cat-girl": sunnyMeadowBg,
  "bunny-girl": enchantedForestPurpleBg,
  "fox-girl": autumnWoodlandBg,
  "puppy-girl": flowerGardenBg,
  "panda-girl": bambooForestBg,
  "deer-girl": woodlandClearingBg,
  "raccoon-girl": hollowTreeHouseBg,
  "squirrel-girl": oakTreeParkBg,
  
  // Tier 7 - Vampire Adventure (each with unique 3D background)
  "classic-vampire": vampireCastle3dBg,
  "bat-boy": gothicGraveyard3dBg,
  "moonlight-vampire": moonlitForest3dBg,
  "gothic-vampire": gothicCathedral3dBg,
  "shadow-vampire": shadowyCrypt3dBg,
  "night-hunter": vampireMansion3dBg,
  "blood-moon-vampire": bloodMoonSky3dBg,
  "vampire-prince": vampireThrone3dBg,
  
  // Tier 8 - Ballerina Dreams
  "ballerina-pink": balletStageBg,
  "swan-ballerina": swanLakeBg,
  "purple-ballerina": balletStudioBg,
  "blue-ballerina": underwaterBalletBg,
  "golden-ballerina": sunflowerFieldBg,
  "peach-ballerina": roseGardenBg,
  "mint-ballerina": springMeadowBg,
  "rainbow-ballerina": rainbowSkyBg,
  
  // Tier 9 - Superhero Squad
  "classic-superhero": citySkylineBg,
  "lightning-speedster": lightningStormBg,
  "tech-hero": techLabBg,
  "nature-guardian": forestClearingMagicBg,
  "ice-hero": arcticIceBg,
  "fire-hero": volcanicCraterBg,
  "shadow-ninja": shadowDojoBg,
  "shield-hero": heroFortressBg,
  
  // Tier 10 - Mecha Robots (individual backgrounds)
  "titan-mech": titanMechBg,
  "cyber-warrior": cyberWarriorBg,
  "iron-guardian": ironGuardianBg,
  "plasma-bot": plasmaBotBg,
  "steel-samurai": steelSamuraiBg,
  "thunder-mech": thunderMechBg,
  "neon-droid": neonDroidBg,
  "battle-commander": battleCommanderBg,
  
  // Tier 11 - Manga Heroes (individual backgrounds)
  "ninja-shadow": ninjaShadowBg,
  "spirit-fox": spiritFoxBg,
  "dragon-slayer": dragonSlayerBg,
  "magical-girl": magicalGirlBg,
  "samurai-hero": samuraiHeroBg,
  "elemental-master": elementalMasterBg,
  "cat-fighter": catFighterBg,
  "school-hero": schoolHeroBg,
  
  // Tier 12 - Gaming Legends (individual backgrounds)
  "pro-gamer": proGamerBg,
  "pixel-warrior": pixelWarriorBg,
  "controller-king": controllerKingBg,
  "vr-champion": vrChampionBg,
  "stream-star": streamStarBg,
  "arcade-master": arcadeMasterBg,
  "console-hero": consoleHeroBg,
  "level-boss": levelBossBg,
  
  // Tier 13 - Pterosaur Sky (individual prehistoric scenes)
  "pteranodon": pteranodonBg,
  "quetzalcoatlus": quetzalcoatlusBg,
  "rhamphorhynchus": rhamphorhynchusBg,
  "pterodactylus": pterodactylusBg,
  "dimorphodon": dimorphodonBg,
  "tapejara": tapejaraBg,
  "anhanguera": anhangueraBg,
  "dsungaripterus": dsungaripterusBg,
  
  // Tier 14 - HeroKids Legacy (Logo-style backgrounds)
  "shield-blaze": shieldBlazeBg,
  "comet-dash": cometDashBg,
  "wave-glider": waveGliderBg,
  "forest-guard": forestGuardBg,
  "luna-beacon": lunaBeaconBg,
  "sunrise-spark": sunriseSparkBg,
  "bloom-guardian": bloomGuardianBg,
  "breeze-captain": breezeCaptainBg,
  "storm-runner": legacyStormRunnerBg,
  "star-guardian": legacyStarGuardianBg,
  "thunder-bolt": legacyThunderBoltBg,
  "heart-shield": legacyHeartShieldBg,
  
  // Tier 15 - Bonus Adventure Pack
  "pirate-captain": pirateShipDeckBg,
  "wizard-kid": wizardTowerBg,
  "rock-star": rockConcertStageBg,
  "detective-kid": detectiveOfficeBg,
};

// Helper to add cache-busting parameter to /objects/ URLs
function addCacheBuster(url: string | undefined, updatedAt?: Date | string | null): string | undefined {
  if (!url) return url;
  
  // Only add cache buster to /objects/ URLs (uploaded files)
  if (url.startsWith('/objects/') && updatedAt) {
    const timestamp = typeof updatedAt === 'string' ? new Date(updatedAt).getTime() : updatedAt.getTime();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${timestamp}`;
  }
  
  return url;
}

// Helper to get avatar URL - respects useCustomAvatar flag to allow custom avatar + skin background
export function getAvatarUrl(
  activeSkinId: string | null | undefined, 
  customAvatarUrl: string | null | undefined,
  useCustomAvatar: boolean = false,
  updatedAt?: Date | string | null
): string | undefined {
  // If custom avatar flag is set and there's a custom avatar, use it
  if (useCustomAvatar && customAvatarUrl) {
    // Resolve default avatar markers (e.g., "default:fox") to actual bundled URLs
    const resolvedUrl = resolveAvatarUrl(customAvatarUrl);
    if (resolvedUrl) {
      return addCacheBuster(resolvedUrl, updatedAt);
    }
  }
  
  // Otherwise, use skin avatar if available
  if (activeSkinId && SKIN_IMAGES[activeSkinId]) {
    return SKIN_IMAGES[activeSkinId];
  }
  
  // Final fallback to custom avatar (also resolve default markers)
  const resolvedFallback = resolveAvatarUrl(customAvatarUrl);
  return addCacheBuster(resolvedFallback ?? undefined, updatedAt) || undefined;
}

// Helper to get background URL for active skin
export function getBackgroundUrl(activeSkinId: string | null | undefined): string | undefined {
  if (activeSkinId && SKIN_BACKGROUNDS[activeSkinId]) {
    return SKIN_BACKGROUNDS[activeSkinId];
  }
  return undefined;
}
