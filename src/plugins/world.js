// RiftCity world/location plugins.
// Categories, locations, tags, requirements, and location service descriptors live
// here so the world directory can grow without rewriting routing/persistence code.

export const WORLD_CATEGORIES = [
  { id: 'services', code: 'SV', name: 'Services', description: 'Core city institutions, training and public services.' },
  { id: 'shops', code: 'SH', name: 'Shops', description: 'Retail stores for equipment, supplies and valuables.' },
  { id: 'entertainment', code: 'EN', name: 'Entertainment', description: 'Nightlife, gambling and recreation.' },
  { id: 'transport', code: 'TR', name: 'Transport', description: 'Travel, shipping and vehicle-related locations.' },
  { id: 'other', code: 'OT', name: 'Other', description: 'Special locations and city destinations.' }
];

export const WORLD_LOCATIONS = [
  {
    id: 'mercy-point-medical', categoryId: 'services', code: 'SV-01', name: 'Mercy Point Medical', type: 'Hospital', status: 'OPEN',
    shortDescription: 'RiftCity\'s main hospital and emergency center.',
    description: 'The city\'s primary medical center. Hospitalized players, recovery timers and future treatment services will live here.',
    tags: ['HOSPITAL', 'RECOVERY', 'PUBLIC'], requirements: [],
    actions: [{ id: 'hospital', label: 'Hospital services', type: 'status', enabled: true, note: 'View hospitalization status and recovery timer.' }]
  },
  {
    id: 'blackridge-detention', categoryId: 'services', code: 'SV-02', name: 'Blackridge Detention Center', type: 'Jail', status: 'OPEN',
    shortDescription: 'City jail for detained and sentenced players.',
    description: 'RiftCity\'s detention center. Sentences, inmate lists, bail and future busting systems will operate from Blackridge.',
    tags: ['JAIL', 'LAW', 'PUBLIC'], requirements: [],
    actions: [{ id: 'jail', label: 'View detention center', type: 'status', enabled: true, note: 'View detention status and remaining sentence time.' }]
  },
  {
    id: 'rift-metropolitan-institute', categoryId: 'services', code: 'SV-03', name: 'Rift Metropolitan Institute', type: 'Education', status: 'OPEN',
    shortDescription: 'Courses, qualifications and long-term unlocks.',
    description: 'A city education center built for future courses, certifications, stat bonuses and specialized progression paths.',
    tags: ['EDUCATION', 'PROGRESSION'], requirements: [],
    actions: [{ id: 'education', label: 'Browse courses', type: 'education', enabled: true, note: 'Browse and enroll in persistent courses.' }]
  },
  {
    id: 'rift-civic-hall', categoryId: 'services', code: 'SV-04', name: 'Rift Civic Hall', type: 'City Hall', status: 'OPEN',
    shortDescription: 'Municipal records, licenses and city administration.',
    description: 'The administrative center of RiftCity. Public records, licenses, civic systems and future reputation features will be based here.',
    tags: ['CITY HALL', 'CIVIC', 'PUBLIC'], requirements: [],
    actions: [{ id: 'records', label: 'City records', type: 'civic', enabled: false, note: 'Civic services arrive later.' }]
  },
  {
    id: 'rift-national-bank', categoryId: 'services', code: 'SV-05', name: 'Rift National Bank', type: 'Bank', status: 'OPEN',
    shortDescription: 'Deposits, investments and financial services.',
    description: 'RiftCity\'s primary financial institution. Accounts, deposits, investments and transfers will plug into this location.',
    tags: ['BANK', 'FINANCE'], requirements: [],
    actions: [{ id: 'bank', label: 'Banking', type: 'bank', enabled: true, note: 'Checking, savings and investment services.' }]
  },
  {
    id: 'forge-athletics', categoryId: 'services', code: 'SV-06', name: 'Forge Athletics', type: 'Gym', status: 'OPEN',
    shortDescription: 'Train physical stats and unlock specialized routines.',
    description: 'A hard-edged training facility planned as the home of RiftCity\'s strength, defense, speed and dexterity training systems.',
    tags: ['GYM', 'TRAINING'], requirements: [],
    actions: [{ id: 'train', label: 'Train', type: 'gym', enabled: true, note: 'Train stats through persistent programs.' }]
  },
  {
    id: 'rift-employment-bureau', categoryId: 'services', code: 'SV-07', name: 'Rift Employment Bureau', type: 'Employment', status: 'OPEN',
    shortDescription: 'Find work, careers and starter income opportunities.',
    description: 'A public employment office for future jobs, career progression and work-related unlocks.',
    tags: ['JOBS', 'CAREERS'], requirements: [],
    actions: [{ id: 'jobs', label: 'View jobs', type: 'jobs', enabled: true, note: 'Join a career and work server-authoritative shifts.' }]
  },
  {
    id: 'rift-central-precinct', categoryId: 'services', code: 'SV-08', name: 'Rift Central Precinct', type: 'Police Station', status: 'OPEN',
    shortDescription: 'Law enforcement headquarters and bounty services.',
    description: 'Central police headquarters. Bounties, reports, warrants and future law-related systems can connect here.',
    tags: ['POLICE', 'LAW'], requirements: [],
    actions: [{ id: 'precinct', label: 'Heat & enforcement', type: 'law', enabled: true, note: 'View Heat, wanted status and fines.' }]
  },
  {
    id: 'keystone-realty', categoryId: 'services', code: 'SV-09', name: 'Keystone Realty', type: 'Property Agency', status: 'OPEN',
    shortDescription: 'Purchase, rent and manage property.',
    description: 'RiftCity\'s property brokerage. Housing, businesses and property management will eventually be accessed here.',
    tags: ['PROPERTY', 'REAL ESTATE'], requirements: [],
    actions: [{ id: 'property', label: 'Browse property', type: 'properties', enabled: true, note: 'Buy and manage persistent residences.' }]
  },
  {
    id: 'redline-garage', categoryId: 'services', code: 'SV-10', name: 'Redline Garage', type: 'Mechanic', status: 'OPEN',
    shortDescription: 'Vehicle repairs, maintenance and future upgrades.',
    description: 'A full-service garage reserved for the future vehicle repair, maintenance and modification systems.',
    tags: ['VEHICLES', 'REPAIR'], requirements: [],
    actions: [{ id: 'garage', label: 'Garage services', type: 'vehicle', enabled: false, note: 'Vehicles arrive later.' }]
  },

  {
    id: 'ironline-armory', categoryId: 'shops', code: 'SH-01', name: 'Ironline Armory', type: 'Gun Store', status: 'OPEN',
    shortDescription: 'Licensed weapons, ammunition and protective equipment.',
    description: 'A heavily secured retailer for legal weapons, ammunition and combat equipment. The inventory engine will power its stock later.',
    tags: ['WEAPONS', 'AMMO', 'RETAIL'], requirements: [],
    actions: [{ id: 'shop', label: 'Browse armory', type: 'shop', enabled: true, note: 'Buy or sell supported inventory items.' }]
  },
  {
    id: 'cornerstone-market', categoryId: 'shops', code: 'SH-02', name: 'Cornerstone Market', type: 'Grocery Store', status: 'OPEN',
    shortDescription: 'Food, drinks and everyday consumables.',
    description: 'A busy city grocery market planned for food, drinks, candy and basic consumable items.',
    tags: ['GROCERY', 'FOOD', 'RETAIL'], requirements: [],
    actions: [{ id: 'shop', label: 'Browse market', type: 'shop', enabled: true, note: 'Buy or sell supported inventory items.' }]
  },
  {
    id: 'aurelia-jewelers', categoryId: 'shops', code: 'SH-03', name: 'Aurelia Jewelers', type: 'Jewelry Store', status: 'OPEN',
    shortDescription: 'High-value jewelry, watches and gemstones.',
    description: 'An upscale jewelry retailer selling valuable goods. Its stock will eventually tie into shops, theft opportunities and the player economy.',
    tags: ['JEWELRY', 'VALUABLES', 'SECURITY'], requirements: [],
    actions: [{ id: 'shop', label: 'Browse jewelry', type: 'shop', enabled: true, note: 'Buy or sell supported inventory items.' }]
  },
  {
    id: 'northside-pharmacy', categoryId: 'shops', code: 'SH-04', name: 'Northside Pharmacy', type: 'Pharmacy', status: 'OPEN',
    shortDescription: 'Medical supplies and recovery items.',
    description: 'A neighborhood pharmacy intended for legitimate medical consumables and recovery-related items.',
    tags: ['MEDICAL', 'RETAIL'], requirements: [],
    actions: [{ id: 'shop', label: 'Browse pharmacy', type: 'shop', enabled: true, note: 'Buy or sell supported inventory items.' }]
  },
  {
    id: 'circuit-house', categoryId: 'shops', code: 'SH-05', name: 'Circuit House', type: 'Electronics Store', status: 'OPEN',
    shortDescription: 'Electronics, devices and technical equipment.',
    description: 'A specialist electronics retailer planned for devices, tools and equipment used by future hacking and crime systems.',
    tags: ['ELECTRONICS', 'TOOLS', 'RETAIL'], requirements: [],
    actions: [{ id: 'shop', label: 'Browse electronics', type: 'shop', enabled: true, note: 'Buy or sell supported inventory items.' }]
  },
  {
    id: 'district-supply-co', categoryId: 'shops', code: 'SH-06', name: 'District Supply Co.', type: 'Clothing Store', status: 'OPEN',
    shortDescription: 'Clothing, accessories and future cosmetics.',
    description: 'A practical city outfitter that can later sell clothing, accessories and cosmetic items.',
    tags: ['CLOTHING', 'RETAIL'], requirements: [],
    actions: [{ id: 'shop', label: 'Browse clothing', type: 'shop', enabled: true, note: 'Buy or sell supported inventory items.' }]
  },
  {
    id: 'second-chance-exchange', categoryId: 'shops', code: 'SH-07', name: 'Second Chance Exchange', type: 'Pawn Shop', status: 'OPEN',
    shortDescription: 'Quick sales and miscellaneous second-hand goods.',
    description: 'A no-frills pawn shop where players will eventually be able to sell miscellaneous items quickly for cash.',
    tags: ['PAWN', 'RESALE', 'RETAIL'], requirements: [],
    actions: [{ id: 'pawn', label: 'Pawn items', type: 'shop', enabled: true, note: 'Buy and sell supported inventory items.' }]
  },

  {
    id: 'meridian-casino', categoryId: 'entertainment', code: 'EN-01', name: 'The Meridian Casino', type: 'Casino', status: 'OPEN',
    shortDescription: 'RiftCity\'s flagship casino and gaming floor.',
    description: 'The future home of blackjack, poker, roulette, slots, horse betting and other casino systems.',
    tags: ['CASINO', 'GAMBLING', 'NIGHTLIFE'], requirements: [],
    actions: [{ id: 'casino', label: 'Casino floor', type: 'casino', enabled: true, note: 'Playable server-resolved in-game chip tables and game history.' }]
  },
  {
    id: 'afterdark', categoryId: 'entertainment', code: 'EN-02', name: 'Afterdark', type: 'Nightclub', status: 'OPEN',
    shortDescription: 'A late-night club for events, nightlife and special opportunities.',
    description: 'One of RiftCity\'s best-known nightlife venues. Future events, NPC encounters and nightclub-specific systems will live here.',
    tags: ['NIGHTCLUB', 'EVENTS', 'NIGHTLIFE'], requirements: [],
    actions: [{ id: 'nightclub', label: 'Enter club', type: 'nightclub', enabled: true, note: 'Nightlife reputation, VIP tiers and rotating events.' }]
  },

  {
    id: 'greywater-docks', categoryId: 'transport', code: 'TR-01', name: 'Greywater Docks', type: 'Docks', status: 'OPEN',
    shortDescription: 'Freight terminals, shipping lanes and waterfront access.',
    description: 'RiftCity\'s working docks. Cargo, shipping, smuggling opportunities and waterfront crimes can plug into Greywater later.',
    tags: ['DOCKS', 'FREIGHT', 'WATERFRONT'], requirements: [],
    actions: [{ id: 'production', label: 'Workshop district', type: 'production', enabled: true, note: 'Production facilities and timed batches.' },{id:'activities',label:'Dock activities',type:'city-activities',enabled:true,note:'Open harbour-side city activities.'}]
  },
  {
    id: 'rift-international-airport', categoryId: 'transport', code: 'TR-02', name: 'Rift International Airport', type: 'Airport', status: 'OPEN',
    shortDescription: 'International travel and future offshore destinations.',
    description: 'The main gateway out of RiftCity. Travel, foreign destinations and future offshore banking access will begin here.',
    tags: ['AIRPORT', 'TRAVEL'], requirements: [],
    actions: [{ id: 'travel', label: 'Travel terminal', type: 'travel', enabled: true, note: 'International travel, travel timers and offshore destination access.' }]
  },
  {
    id: 'blacktop-motors', categoryId: 'transport', code: 'TR-03', name: 'Blacktop Motors', type: 'Car Dealer', status: 'OPEN',
    shortDescription: 'Vehicle sales and future transportation upgrades.',
    description: 'A city vehicle dealership reserved for cars, ownership and future transportation systems.',
    tags: ['VEHICLES', 'DEALER'], requirements: [],
    actions: [{ id: 'dealer', label: 'Showroom activities', type: 'city-activities', enabled: true, note: 'Vehicle ownership is later; showroom activities are available now.' }]
  },

  {
    id: 'saint-vesper-cemetery', categoryId: 'other', code: 'OT-01', name: 'Saint Vesper Cemetery', type: 'Cemetery', status: 'OPEN',
    shortDescription: 'An old cemetery on the edge of the city.',
    description: 'A quiet historic cemetery reserved for special events, rare opportunities and future key-gated activities.',
    tags: ['CEMETERY', 'SPECIAL'], requirements: [],
    actions: [{ id: 'explore', label: 'Explore', type: 'special', enabled: false, note: 'Special activities arrive later.' }]
  },
  {
    id: 'breakwater-beach', categoryId: 'other', code: 'OT-02', name: 'Breakwater Beach', type: 'Beach', status: 'OPEN',
    shortDescription: 'Public shoreline along RiftCity\'s outer breakwater.',
    description: 'A stretch of city shoreline reserved for seasonal events and future RiftCity-specific activities.',
    tags: ['BEACH', 'PUBLIC', 'SCAVENGING'], requirements: [],
    actions: [{ id: 'beach', label: 'Explore beach', type: 'special', enabled: false, note: 'Beach activities arrive later.' }]
  },
  {
    id: 'the-exchange', categoryId: 'other', code: 'OT-03', name: 'The Exchange', type: 'Player Market', status: 'OPEN',
    shortDescription: 'RiftCity\'s player-run market for buying and selling items.',
    description: 'A neutral trading hub planned as the player marketplace. Listings, auctions and transaction fees will eventually operate here.',
    tags: ['MARKET', 'PLAYER TRADE'], requirements: [],
    actions: [{ id: 'market', label: 'Open market', type: 'auction', enabled: true, note: 'Browse and manage player item listings.' }]
  },
  {id:'riftcity-park',categoryId:'other',code:'OT-04',name:'RiftCity Park',type:'Public Park',status:'OPEN',shortDescription:'Courts, paths and rotating public activities.',description:'A central public park used for recreation and city events.',tags:['PARK','ACTIVITIES'],requirements:[],actions:[{id:'activities',label:'Park activities',type:'city-activities',enabled:true,note:'Open RiftCity-specific location activities.'}]},
  {id:'downtown-core',categoryId:'other',code:'OT-05',name:'Downtown Core',type:'City District',status:'OPEN',shortDescription:'The busiest blocks in central RiftCity.',description:'A dense commercial district with rotating city tasks and events.',tags:['DOWNTOWN','ACTIVITIES'],requirements:[],actions:[{id:'activities',label:'Downtown activities',type:'city-activities',enabled:true,note:'Open location-specific activities.'}]},
  {id:'central-transit',categoryId:'transport',code:'TR-04',name:'Central Transit',type:'Transit Hub',status:'OPEN',shortDescription:'RiftCity’s main public transit interchange.',description:'A high-traffic transport hub with short city tasks.',tags:['TRANSIT','ACTIVITIES'],requirements:[],actions:[{id:'activities',label:'Transit activities',type:'city-activities',enabled:true,note:'Open location-specific activities.'}]},
  {id:'warehouse-district',categoryId:'other',code:'OT-06',name:'Warehouse District',type:'Industrial District',status:'OPEN',shortDescription:'Storage yards and legal short-shift work.',description:'An industrial district used for contracts, production and city events.',tags:['WAREHOUSE','ACTIVITIES'],requirements:[],actions:[{id:'activities',label:'Warehouse activities',type:'city-activities',enabled:true,note:'Open location-specific activities.'}]},
  {id:'safehouse',categoryId:'other',code:'OT-07',name:'Safehouse',type:'Safehouse',status:'OPEN',shortDescription:'A quiet place for recovery and planning.',description:'A private low-profile location with recovery-focused activities.',tags:['SAFEHOUSE','RECOVERY'],requirements:[],actions:[{id:'activities',label:'Safehouse activities',type:'city-activities',enabled:true,note:'Open safehouse activities.'}]},
  {id:'rift-mall',categoryId:'shops',code:'SH-08',name:'Rift Mall',type:'Shopping Mall',status:'OPEN',shortDescription:'A multi-store commercial complex.',description:'A large shopping destination with rotating public tasks.',tags:['MALL','ACTIVITIES'],requirements:[],actions:[{id:'activities',label:'Mall activities',type:'city-activities',enabled:true,note:'Open mall activities.'}]},
  {id:'courthouse',categoryId:'services',code:'SV-11',name:'RiftCity Courthouse',type:'Courthouse',status:'OPEN',shortDescription:'Courts, public records and civic services.',description:'The city courthouse and public records center.',tags:['LAW','CIVIC'],requirements:[],actions:[{id:'activities',label:'Courthouse activities',type:'city-activities',enabled:true,note:'Open civic activities.'}]},
  {id:'company-plaza',categoryId:'services',code:'SV-12',name:'Company Plaza',type:'Business District',status:'OPEN',shortDescription:'Corporate offices and temporary work.',description:'A cluster of major employers and business services.',tags:['BUSINESS','ACTIVITIES'],requirements:[],actions:[{id:'activities',label:'Plaza activities',type:'city-activities',enabled:true,note:'Open business-district activities.'}]}

];

const CATEGORY_LOOKUP = new Map(WORLD_CATEGORIES.map(category => [category.id, category]));
const LOCATION_LOOKUP = new Map(WORLD_LOCATIONS.map(location => [location.id, location]));

export function getWorldCategory(categoryId) {
  return CATEGORY_LOOKUP.get(categoryId) || null;
}

export function getWorldLocation(locationId) {
  return LOCATION_LOOKUP.get(locationId) || null;
}
