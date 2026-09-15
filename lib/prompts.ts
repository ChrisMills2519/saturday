// Shared prompt pack. One sentence, family-safe, blank-page-proof.
// Server picks a random one when host doesn't supply a prompt,
// so the game never stalls on the same 2 hardcodes.
export const PROMPTS = [
  "Invent a family holiday. Describe it in one sentence.",
  "Invent a new pizza topping. Sell it in one sentence.",
  "[BUFF] Real life just got patched. What got buffed?",
  "[NERF] Real life just got patched. What got nerfed?",
  "[BUGFIX] Real life just got patched. What bug finally got fixed?",
  "Give the WORST advice for: my kid won't stop licking the dog.",
  "Give the WORST advice for: grandpa fell asleep at the table again.",
  "Give the WORST advice for: the Wi-Fi died during movie night.",
  "Give the WORST advice for: my sister sings in the shower at 6am.",
  "You're lost in IKEA, 1% battery. Last text to the family (40 chars)?",
  "You're stuck in traffic, 1% battery. Last text to the family?",
  "The remote is missing. Who took it, and why?",
  "Invent the dramatic history of: a single lonely sock.",
  "Invent the dramatic history of: a stained Tupperware lid.",
  "Invent the dramatic history of: the TV remote.",
  "A new Olympic sport: competitive napping. Describe the final.",
  "A rejected Valentine's candy. What does it say?",
  "The moon is now a picnic spot. What's the number one rule?",
  "Your pet is running for mayor. What's their slogan?",
  "Invent a useless superpower. Why is it secretly great?",
  "The toaster is now sentient. What's its first complaint?",
  "Write the warning label for: Grandma's meatloaf.",
  "Write the warning label for: Dad's dance moves.",
  "The family group chat just got hacked by a toddler. What did they post?",
  "Aliens abducted the dog. What's the ransom note?",
  "You found a portal in the laundry basket. Where does it go?",
  "The houseplant has a diary. What's today's entry?",
  "Invent a bedtime excuse a kid has never tried before.",
  "The fridge light never goes out. What is it hiding?",
  "Design a trap for the tooth fairy. How does it work?",
];

export function randomPrompt(exclude?: string | null): string {
  const pool = exclude ? PROMPTS.filter((p) => p !== exclude) : PROMPTS;
  return pool[Math.floor(Math.random() * pool.length)];
}
