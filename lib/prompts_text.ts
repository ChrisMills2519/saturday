// Saturday prompt library: 120 cards, 8 packs. Each has a hint shown
// on the phone so you never face a blank page.
// Packs: advice / patch / lore / label / text / slogan / imagine / open

export type Pack = "advice" | "patch" | "lore" | "label" | "text" | "slogan" | "imagine" | "open";
export type PromptCard = { pack: Pack; text: string; hint: string };

export const PROMPT_CARDS: PromptCard[] = [
  // --- Worst advice (12) ---
  { pack: "advice", text: "Give the WORST advice for: my kid won't stop licking the dog.", hint: "Worse = funnier" },
  { pack: "advice", text: "Give the WORST advice for: grandpa fell asleep at the table again.", hint: "Commit to it" },
  { pack: "advice", text: "Give the WORST advice for: the Wi-Fi died during movie night.", hint: "Absolutely wrong fix" },
  { pack: "advice", text: "Give the WORST advice for: my sister sings in the shower at 6am.", hint: "Disable, don't solve" },
  { pack: "advice", text: "Give the WORST advice for: bedtime in 5 minutes and nobody's brushed their teeth.", hint: "Chaos answer" },
  { pack: "advice", text: "Give the WORST advice for: Dad burnt the toast again.", hint: "Blame the appliance" },
  { pack: "advice", text: "Give the WORST advice for: the dog ate my homework (for real).", hint: "Legal strategy" },
  { pack: "advice", text: "Give the WORST advice for: Mom's GPS says turn into the lake.", hint: "Follow blindly" },
  { pack: "advice", text: "Give the WORST advice for: the cat knocked the plant over — again.", hint: "Punish everyone" },
  { pack: "advice", text: "Give the WORST advice for: my sibling won't share the blanket.", hint: "Diabolical take" },
  { pack: "advice", text: "Give the WORST advice for: grandpa can't find his glasses (on his head).", hint: "Make it worse" },
  { pack: "advice", text: "Give the WORST advice for: a toddler found the permanent markers.", hint: "Double down" },

  // --- Patch notes (9) ---
  { pack: "patch", text: "[BUFF] Real life just got patched. What got buffed?", hint: "e.g. Toddlers. Speed +50%" },
  { pack: "patch", text: "[NERF] Real life just got patched. What got nerfed?", hint: "e.g. Mondays. Fun −30%" },
  { pack: "patch", text: "[BUGFIX] Real life just got patched. What bug finally got fixed?", hint: "e.g. Lost socks" },
  { pack: "patch", text: "[PATCH] Version 12.2 is out. What's in the patch notes?", hint: "One line" },
  { pack: "patch", text: "[BALANCE] Grandpa buffed, Dad nerfed. What's the changelog?", hint: "Keep it mock-technical" },
  { pack: "patch", text: "[EVENT] Limited-time buff this weekend: what is it?", hint: "e.g. 2× hug XP" },
  { pack: "patch", text: "[HOTFIX] They hotfixed Monday morning. What changed?", hint: "One tweak" },
  { pack: "patch", text: "[NEW FEATURE] Life v2.1 drops a feature your family requested. What is it?", hint: "OP or useless" },
  { pack: "patch", text: "[REMOVED] They removed an item from life. What got deleted?", hint: "e.g. Mondays" },

  // --- Family lore / history (14) ---
  { pack: "lore", text: "Invent the dramatic history of: a single lonely sock.", hint: "Start WW1 of socks" },
  { pack: "lore", text: "Invent the dramatic history of: a stained Tupperware lid.", hint: "Whose crime?" },
  { pack: "lore", text: "Invent the dramatic history of: the TV remote.", hint: "Power → corruption" },
  { pack: "lore", text: "Invent the dramatic history of: the family laundry pile.", hint: "Archaeology report" },
  { pack: "lore", text: "Invent the dramatic history of: the dent in the fridge.", hint: "Witness statement" },
  { pack: "lore", text: "Invent the dramatic history of: grandma's recipe card.", hint: "Stained with… what?" },
  { pack: "lore", text: "Invent the dramatic history of: Dad's lucky chair.", hint: "Who sat there first?" },
  { pack: "lore", text: "Invent the dramatic history of: the junk drawer.", hint: "Artifact catalog" },
  { pack: "lore", text: "Invent the dramatic history of: the house plant that won't die.", hint: "Its secret" },
  { pack: "lore", text: "Invent the dramatic history of: the missing car key.", hint: "Two-year saga" },
  { pack: "lore", text: "The family photo on the fridge — what's the caption?", hint: "Too honest" },
  { pack: "lore", text: "The family's forbidden bedtime story (one sentence) is…", hint: "Kid-safe + cursed" },
  { pack: "lore", text: "The attic makes one sound at 3am. What is it whispering?", hint: "Onomatopoeia ok" },
  { pack: "lore", text: "The family group chat changed its name. What's the new name?", hint: "Dad picked it" },

  // --- Warning labels / reject candy (10) ---
  { pack: "label", text: "Write the warning label for: Grandma's meatloaf.", hint: "All caps if needed" },
  { pack: "label", text: "Write the warning label for: Dad's dance moves.", hint: "Rate it PG" },
  { pack: "label", text: "Write the warning label for: the laundry pile.", hint: "Biohazard tone" },
  { pack: "label", text: "Write the warning label for: the family karaoke mic.", hint: "Liability style" },
  { pack: "label", text: "A rejected Valentine's candy. What does it say?", hint: "One bad message" },
  { pack: "label", text: "A rejected birthday card inside cover: what does it really say?", hint: "Small print" },
  { pack: "label", text: "Fortune cookie fortune no one wanted to get:", hint: "Dark but funny" },
  { pack: "label", text: "The new board game rule that ruins Christmas:", hint: "Lawyer voice" },
  { pack: "label", text: "Instruction manual page 1 for Dad's BBQ — what does it warn?", hint: "Step 0" },
  { pack: "label", text: "Allergy warning for the family potluck — what is it really?", hint: "Undisclosed" },

  // --- Last-text one-liners (8) ---
  { pack: "text", text: "You're lost in IKEA, 1% battery. Last text to the family?", hint: "All caps permitted" },
  { pack: "text", text: "You're stuck in traffic, 1% battery. Last text to the family?", hint: "20 words max" },
  { pack: "text", text: "You're locked in the bathroom (party). Last 1% text?", hint: "Send help… or else" },
  { pack: "text", text: "Stuck in the kids' tent fort, 1% battery. Last text?", hint: "Tiny tent voice" },
  { pack: "text", text: "Dad's GPS says turn left forever. Last 1% text?", hint: "Short dispatch" },
  { pack: "text", text: "You're hiding from chores, 1% battery. Last text?", hint: "Dramatic" },
  { pack: "text", text: "Power's out. Last flashlight text before it dies?", hint: "Whisper it" },
  { pack: "text", text: "The toddler locked you out. Last text through the window?", hint: "Bargain" },

  // --- Slogans / pitches (12) ---
  { pack: "slogan", text: "Your pet is running for mayor. What's their slogan?", hint: "Yard sign size" },
  { pack: "slogan", text: "Invent a new pizza topping. Sell it in one sentence.", hint: "Menu blurb" },
  { pack: "slogan", text: "Invent a family holiday. Describe it in one sentence.", hint: "Name + ritual" },
  { pack: "slogan", text: "A new Olympic sport: competitive napping. Describe the final.", hint: "Play-by-play" },
  { pack: "slogan", text: "A useless superpower. Why is it secretly great?", hint: "Sell the upside" },
  { pack: "slogan", text: "Startup idea you'd pitch on Shark Tank from your kitchen:", hint: "One-liner pitch" },
  { pack: "slogan", text: "A bedtime excuse a kid has never tried before:", hint: "Kid logic" },
  { pack: "slogan", text: "Design a trap for the tooth fairy. How does it work?", hint: "Rube Goldberg" },
  { pack: "slogan", text: "The family talent show act no one asked for:", hint: "Tagline it" },
  { pack: "slogan", text: "Your houseplant's TED talk title is…", hint: "Subtitle optional" },
  { pack: "slogan", text: "Ad for the world's most boring museum — make it exciting.", hint: "One sentence" },
  { pack: "slogan", text: "Title of Dad's memoir. Go.", hint: "Subtitle wins" },

  // --- Imagine / world-building (20) ---
  { pack: "imagine", text: "The moon is now a picnic spot. What's the number one rule?", hint: "Park ranger tone" },
  { pack: "imagine", text: "The toaster is now sentient. What's its first complaint?", hint: "First world problem" },
  { pack: "imagine", text: "The remote is missing. Who took it, and why?", hint: "Blame + motive" },
  { pack: "imagine", text: "The family group chat just got hacked by a toddler. What did they post?", hint: "Emoji storm" },
  { pack: "imagine", text: "Aliens abducted the dog. What's the ransom note?", hint: "Formal + typo" },
  { pack: "imagine", text: "You found a portal in the laundry basket. Where does it go?", hint: "One destination" },
  { pack: "imagine", text: "The houseplant has a diary. What's today's entry?", hint: "Thirsty" },
  { pack: "imagine", text: "The fridge light never goes out. What is it hiding?", hint: "Conspiracy" },
  { pack: "imagine", text: "The Wi-Fi router has emotions. What's its mood tonight?", hint: "Personify it" },
  { pack: "imagine", text: "The car has one secret button. What does it do?", hint: "Press at own risk" },
  { pack: "imagine", text: "The couch is now a portal. Where do you end up?", hint: "Couch logic" },
  { pack: "imagine", text: "Grandma texts a typo that changes everything. What did she mean to say?", hint: "Autocorrect" },
  { pack: "imagine", text: "The school mascot quits and joins your family. Their resignation line:", hint: "Mic drop" },
  { pack: "imagine", text: "If Saturdays had a mascot, what's its catchphrase when you lose?", hint: "Trash talk" },
  { pack: "imagine", text: "You shrink to toy size in the living room. Where do you hide?", hint: "Size matters" },
  { pack: "imagine", text: "The dog learned to open the fridge. What's first on the shopping list now?", hint: "Revenge list" },
  { pack: "imagine", text: "Family chore wheel: you rigged it. What's the new rule?", hint: "Evil Jo" },
  { pack: "imagine", text: "The neighborhood watch group chat is out of control. What's the latest message?", hint: "Neighborly passive-aggression" },
  { pack: "imagine", text: "A holiday just for your pet. What happens?", hint: "Pet's agenda" },
  { pack: "imagine", text: "The thermostat is now a democracy. What was the last vote?", hint: "Sweaty politics" },

  // --- Open / short (35) ---
  { pack: "open", text: "A pizza that sings. What does it sing about?", hint: "Topping pun" },
  { pack: "open", text: "Socks for cats — product review one-liner:", hint: "One star or five" },
  { pack: "open", text: "Nap Olympics halftime show is…", hint: "Headliner?" },
  { pack: "open", text: "Flying toaster conspiracy: the truth is…", hint: "Headline" },
  { pack: "open", text: "Beard insurance: what does it cover?", hint: "Fine print" },
  { pack: "open", text: "Moon picnic packing list — the don't-forget item is…", hint: "Non-obvious" },
  { pack: "open", text: "The family inside joke explained to a stranger:", hint: "Deadpan" },
  { pack: "open", text: "Dad's browser history someone found:", hint: "Wholesome panic" },
  { pack: "open", text: "The most useless kitchen gadget is…", hint: "Still sold" },
  { pack: "open", text: "Room temperature take of the night — what's your hill to die on?", hint: "Mild + firm" },
  { pack: "open", text: "A video game review of doing the dishes:", hint: "Stars + line" },
  { pack: "open", text: "Text to the group chat that gets left on read:", hint: "Too much" },
  { pack: "open", text: "The morning after family karaoke — one text remains:", hint: "Evidence" },
  { pack: "open", text: "A Yelp review of Grandma's Wi-Fi:", hint: "One line" },
  { pack: "open", text: "Secret ingredient nobody talks about:", hint: "Reveal it" },
  { pack: "open", text: "The family's worst kept secret:", hint: "Out in the open" },
  { pack: "open", text: "That smell. No one claims it. Who did it really?", hint: "Name + alibi" },
  { pack: "open", text: "Alarm clock's apology letter:", hint: "Not sorry" },
  { pack: "open", text: "The get-rich-quick scheme that almost worked:", hint: "Headline" },
  { pack: "open", text: "Dad tries to be cool. He says…", hint: "Second-hand cringe" },
  { pack: "open", text: "The most dramatic way to say 'dinner's ready' is…", hint: "Trailer voice" },
  { pack: "open", text: "A cooking show judge reviews Dad's toast:", hint: "Scores out of 10" },
  { pack: "open", text: "Text from the cat at 3am:", hint: "All caps?" },
  { pack: "open", text: "The family Heisman speech after winning at board games:", hint: "Thank yous" },
  { pack: "open", text: "A motivational poster from the couch's perspective:", hint: "Stay" },
  { pack: "open", text: "The grocery list Dad rewrote has one suspect item:", hint: "Which?" },
  { pack: "open", text: "The neighbor's dog review of your family:", hint: "Sniff test" },
  { pack: "open", text: "A horror movie title about Mondays:", hint: "Tagline too" },
  { pack: "open", text: "The garage's midlife crisis — what does it buy?", hint: "Spray paint?" },
  { pack: "open", text: "A strange new law in the house. What is it?", hint: "Enforced how?" },
  { pack: "open", text: "Rate the family group selfie — one-line caption:", hint: "Unsponsored" },
  { pack: "open", text: "The kids reenact your wedding with stuffed animals. The review:", hint: "Critic voice" },
  { pack: "open", text: "If Dad had a catchphrase, what would it be?", hint: "He'd hate this" },
  { pack: "open", text: "Family superpower nobody asked for:", hint: "Still useful" },
  { pack: "open", text: "One rule for living with your family:", hint: "Unwritten until now" },
];

// Back-compat flat list (just text)
export const PROMPTS = PROMPT_CARDS.map((c) => c.text);

const BY_TEXT = new Map(PROMPT_CARDS.map((c) => [c.text, c] as const));

export function hintForPrompt(text: string | null): string {
  if (!text) return "One sentence. Go wild.";
  return BY_TEXT.get(text)?.hint ?? "One sentence. Go wild.";
}

export function packForPrompt(text: string | null): Pack {
  if (!text) return "open";
  return BY_TEXT.get(text)?.pack ?? "open";
}

export function randomPrompt(
  opts: { exclude?: string | null; used?: string[] } = {},
): PromptCard {
  const { exclude, used } = opts;
  const avoid = new Set<string>();
  if (exclude) avoid.add(exclude);
  if (used?.length) used.forEach((u) => avoid.add(u));
  let pool = PROMPT_CARDS.filter((p) => !avoid.has(p.text));
  if (pool.length === 0) pool = PROMPT_CARDS; // reset after full cycle
  return pool[Math.floor(Math.random() * pool.length)];
}

// Keep old signature for callers passing a single string
export function randomPromptLegacy(exclude?: string | null): string {
  return randomPrompt({ exclude }).text;
}
