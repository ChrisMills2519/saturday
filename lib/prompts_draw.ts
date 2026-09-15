// Drawful prompts: one sketch, short title, optional hint for the phone editor.
// Family-safe, noun-friendly (like Drawful) — players draw the thing, answers are voted.
export type DrawPrompt = { text: string; hint: string };

export const DRAW_PROMPTS: DrawPrompt[] = [
  { text: "Dad's epic dance move", hint: "Show the pose" },
  { text: "The haunted Tupperware", hint: "Add the face" },
  { text: "A very disappointed snowman", hint: "What's his complaint?" },
  { text: "The TV remote's secret life", hint: "It's scheming" },
  { text: "Competitive napping finals", hint: "Draw the champion" },
  { text: "The fridge light's party", hint: "Who's invited?" },
  { text: "Family mascot for the laundry portal", hint: "Cute + mysterious" },
  { text: "Tooth fairy trap (works too well)", hint: "Show the catch" },
  { text: "Grandma's meatloaf — classified", hint: "Stamp it CONFIDENTIAL" },
  { text: "Dog running for mayor", hint: "Campaign sign included" },
  { text: "Socks trying to escape", hint: "Show the tunnel" },
  { text: "Awful Valentine's candy rejected", hint: "What does it say?" },
  { text: "The sock's dramatic backstory", hint: "Epic poster" },
  { text: "Aliens abduct the dog — ransom note", hint: "Scrawled in goo" },
  { text: "A bedtime excuse: not yet tried", hint: "Draw the excuse" },
  { text: "IKEA maze at night (1% battery)", hint: "Show the path" },
  { text: "Worst pizza topping ever", hint: "Draw the slice" },
  { text: "Family holiday we just invented", hint: "Show the tradition" },
  { text: "Pet superpower reveal", hint: "Zap!" },
  { text: "The plant kept a diary", hint: "Draw the page" },
  { text: "A spooky babysitter", hint: "Draw their smile" },
  { text: "Sticky note from the future", hint: "Wobbly letters" },
  { text: "The cat stole the car", hint: "Getaway pose" },
  { text: "Breakfast cereal mascot gone rogue", hint: "Angry spoon" },
  { text: "A family group chat emoji too far", hint: "Draw it huge" },
  { text: "Dad bod superhero suit", hint: "Cape optional" },
  { text: "Fridge magnet that won't let go", hint: "Clenched fist" },
  { text: "The world's worst birthday cake", hint: "Crooked + proud" },
  { text: "Robot vacuum with a vendetta", hint: "Laser eyes" },
  { text: "Grandpa streaming video games", hint: "Headset + cat" },
];

export const DRAW_PROMPTS_BY_TEXT = new Map(DRAW_PROMPTS.map((p) => [p.text, p] as const));

export function drawHintFor(text: string | null): string {
  if (!text) return "Draw it bold — stick figures count!";
  return DRAW_PROMPTS_BY_TEXT.get(text)?.hint ?? "Draw it bold — stick figures count!";
}

export function randomDrawPrompt(exclude?: string | null): DrawPrompt {
  const pool = exclude ? DRAW_PROMPTS.filter((p) => p.text !== exclude) : DRAW_PROMPTS;
  return pool[Math.floor(Math.random() * pool.length)];
}
