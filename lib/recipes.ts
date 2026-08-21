// The venue's official cocktail menu — the single source of truth for quest
// builder dropdowns, campaign preset goals, and (mirrored in
// public/training/data/cocktails.js — keep in sync) the staff trivia game.
// Specs are verbatim from the house menu: measures, spirits, garnishes.

export type MenuCategory = "signature" | "spritz" | "classic" | "non_alcoholic";

export interface Recipe {
  id: string;
  name: string;
  /** Irregular plural for quest labels; defaults to rule-based pluralization. */
  plural?: string;
  category: MenuCategory;
  alcoholic: boolean;
  /** Base spirits / key liqueurs, for filters and quest flavor. */
  spirits: string[];
  /** Exact build, measures included, in menu order. */
  ingredients: string[];
  garnish: string;
}

export const MENU: Recipe[] = [
  // ---------- Hacien house signatures ----------
  {
    id: "pineapple-tommys-margarita",
    name: "Pineapple Tommy's Margarita",
    category: "signature",
    alcoholic: true,
    spirits: ["Hacien Pineapple Tequila Blanco"],
    ingredients: ["50ml Hacien Pineapple Tequila Blanco", "25ml lime juice", "25ml agave syrup"],
    garnish: "Lime wedge",
  },
  {
    id: "hugo-lemon-lime-spritz",
    name: "Hugo Lemon and Lime Spritz",
    plural: "Hugo Lemon and Lime Spritzes",
    category: "signature",
    alcoholic: true,
    spirits: ["Hacien Lemon & Lime Tequila"],
    ingredients: [
      "40ml Hacien Lemon & Lime Tequila",
      "75ml prosecco",
      "25ml elderflower cordial",
      "Soda top",
    ],
    garnish: "Lime wedge & mint sprig",
  },
  {
    id: "limoncello-garden-spritz",
    name: "Limoncello Garden Spritz",
    category: "signature",
    alcoholic: true,
    spirits: ["Hacien Tequila Blanco", "Limoncello Isolabella"],
    ingredients: [
      "25ml Hacien Tequila Blanco",
      "25ml Limoncello Isolabella",
      "75ml prosecco",
      "Soda top",
    ],
    garnish: "Cucumber wheel, lemon wheel & mint sprig",
  },
  {
    id: "hacien-cucumber-mint-spritz",
    name: "Hacien Cucumber and Mint Spritz",
    plural: "Hacien Cucumber and Mint Spritzes",
    category: "signature",
    alcoholic: true,
    spirits: ["Hacien Tequila Blanco"],
    ingredients: [
      "35ml Hacien Tequila Blanco",
      "35ml Sauvignon Blanc",
      "25ml lime juice",
      "25ml agave syrup",
      "Soda top",
    ],
    garnish: "Cucumber wheel & mint sprig",
  },
  {
    id: "hacien-pineapple-spritz",
    name: "Hacien Pineapple Spritz",
    category: "signature",
    alcoholic: true,
    spirits: ["Hacien Pineapple Tequila Blanco"],
    ingredients: [
      "50ml Hacien Pineapple Tequila Blanco",
      "15ml honey",
      "15ml lime juice",
      "4 raspberries",
      "10 mint leaves",
      "Soda top",
    ],
    garnish: "Raspberry & mint sprig",
  },
  {
    id: "grown-up-drumstick",
    name: "Grown-Up Drumstick",
    category: "signature",
    alcoholic: true,
    spirits: ["Summer Berries Tequila", "Chambord"],
    ingredients: [
      "50ml Summer Berries Tequila",
      "15ml Chambord",
      "15ml vanilla syrup",
      "15ml lime juice",
    ],
    garnish: "Strawberry",
  },
  {
    id: "summer-royale-spritz",
    name: "Summer Royale Spritz",
    category: "signature",
    alcoholic: true,
    spirits: ["Hacien Summer Berries Tequila", "Chambord"],
    ingredients: [
      "40ml Hacien Summer Berries Tequila",
      "75ml prosecco",
      "15ml Chambord",
      "15ml vanilla syrup",
      "Soda top",
    ],
    garnish: "Strawberry",
  },
  {
    id: "coffee-tequila-negroni",
    name: "Shadowed Coffee Tequila Negroni",
    category: "signature",
    alcoholic: true,
    spirits: ["Hacien Coffee Tequila", "Campari", "Martini Rosso"],
    ingredients: ["25ml Hacien Coffee Tequila", "25ml Campari", "25ml Martini Rosso"],
    garnish: "Orange peel or slice",
  },

  // ---------- Spritzes ----------
  {
    id: "elderflower-spritz",
    name: "Elderflower Spritz",
    category: "spritz",
    alcoholic: true,
    spirits: ["Romeo Prosecco", "St-Germain"],
    ingredients: ["75ml Romeo Prosecco", "25ml St-Germain elderflower liqueur", "Soda top"],
    garnish: "Lime wedge or lemon wheel & mint sprig",
  },
  {
    id: "sarti-spritz",
    name: "Sarti Spritz",
    category: "spritz",
    alcoholic: true,
    spirits: ["Romeo Prosecco", "Sarti"],
    ingredients: ["75ml Romeo Prosecco", "50ml Sarti", "Soda top"],
    garnish: "Lime wedge",
  },
  {
    id: "blush-spritz",
    name: "Blush Spritz",
    category: "spritz",
    alcoholic: true,
    spirits: ["Prosecco", "Isolabella Limoncello", "Chambord"],
    ingredients: ["75ml prosecco", "25ml Isolabella Limoncello", "25ml Chambord", "25ml soda"],
    garnish: "Lemon slice",
  },
  {
    id: "chambord-royale",
    name: "Chambord Royale",
    category: "spritz",
    alcoholic: true,
    spirits: ["Romeo Prosecco", "Chambord"],
    ingredients: ["125ml Romeo Prosecco", "25ml Chambord Black Raspberry Liqueur"],
    garnish: "Raspberry or seasonal berry",
  },
  {
    id: "aperol-spritz",
    name: "Aperol Spritz",
    category: "spritz",
    alcoholic: true,
    spirits: ["Romeo Prosecco", "Aperol"],
    ingredients: ["75ml Romeo Prosecco", "50ml Aperol", "Soda top"],
    garnish: "Orange wheel slice",
  },

  // ---------- Classics ----------
  {
    id: "mojito",
    name: "Mojito / Mojito Raspberry",
    plural: "Mojitos (classic or raspberry)",
    category: "classic",
    alcoholic: true,
    spirits: ["Bacardi Carta Blanca", "Bacardi Raspberry"],
    ingredients: [
      "50ml Bacardi Carta Blanca or Bacardi Raspberry",
      "4 lime wedges (muddled)",
      "10ml Monin Gomme",
      "100ml soda",
      "Mint leaves",
    ],
    garnish: "Mint sprig",
  },
  {
    id: "tokyo-iced-tea",
    name: "Tokyo Iced Tea",
    category: "classic",
    alcoholic: true,
    spirits: ["Smirnoff", "Gordon's gin", "Silver tequila", "Bacardi", "Midori"],
    ingredients: [
      "15ml Smirnoff",
      "15ml Gordon's gin",
      "15ml silver tequila",
      "15ml Bacardi",
      "15ml Midori",
      "25ml lemonade",
    ],
    garnish: "Lime wedge",
  },
  {
    id: "woodford-old-fashioned",
    name: "Woodford Old Fashioned",
    category: "classic",
    alcoholic: true,
    spirits: ["Woodford Reserve"],
    ingredients: [
      "50ml Woodford Reserve",
      "Brown sugar cube",
      "2 dashes Angostura bitters + dash of water",
    ],
    garnish: "Orange slice & glacé cherry",
  },
  {
    id: "negroni",
    name: "Negroni / Negroni Sevilla",
    plural: "Negronis (London Dry or Sevilla)",
    category: "classic",
    alcoholic: true,
    spirits: ["Tanqueray London Dry", "Tanqueray Flor de Sevilla", "Campari", "Martini Rosso"],
    ingredients: [
      "25ml Tanqueray London Dry or Tanqueray Flor de Sevilla",
      "25ml Campari",
      "25ml Martini Rosso",
    ],
    garnish: "Orange slice or peel",
  },
  {
    id: "gin-tiki",
    name: "Gin Tiki",
    category: "classic",
    alcoholic: true,
    spirits: ["Gordon's gin", "Malibu"],
    ingredients: ["50ml Gordon's gin", "25ml Malibu", "75ml pineapple juice", "10ml vanilla syrup"],
    garnish: "3 glacé cherries",
  },
  {
    id: "cosmopolitan",
    name: "Cosmopolitan",
    category: "classic",
    alcoholic: true,
    spirits: ["Smirnoff vodka", "Cointreau"],
    ingredients: [
      "50ml Smirnoff vodka",
      "25ml Cointreau",
      "50ml cranberry juice",
      "Juice of half a lime",
    ],
    garnish: "Orange slice or peel",
  },
  {
    id: "passionfruit-martini",
    name: "Passionfruit Martini",
    category: "classic",
    alcoholic: true,
    spirits: ["Smirnoff", "Passoa"],
    ingredients: [
      "50ml Smirnoff",
      "25ml passionfruit juice/pulp/coulis/purée",
      "15ml Passoa",
      "10ml Monin Gomme",
      "25ml prosecco",
    ],
    garnish: "Lime wedge & half a passionfruit",
  },
  {
    id: "espresso-martini",
    name: "Espresso Martini",
    category: "classic",
    alcoholic: true,
    spirits: ["Tia Maria", "Smirnoff vodka"],
    ingredients: ["25ml Tia Maria", "25ml Smirnoff vodka", "Double espresso", "15ml Monin Gomme"],
    garnish: "3 coffee beans",
  },
  {
    id: "bramble-berry",
    name: "Bramble Berry",
    plural: "Bramble Berries",
    category: "classic",
    alcoholic: true,
    spirits: ["Tanqueray Blackcurrant Royale gin", "Crème de Cassis", "Chambord"],
    ingredients: [
      "50ml Tanqueray Blackcurrant Royale gin",
      "25ml Crème de Cassis or Chambord",
      "Juice of half a lemon",
    ],
    garnish: "Berries & lemon slice",
  },

  // ---------- Non-alcoholic ----------
  {
    id: "na-pineapple-mojito",
    name: "Non-Alcoholic Pineapple Mojito",
    category: "non_alcoholic",
    alcoholic: false,
    spirits: [],
    ingredients: [
      "150-200ml pineapple juice",
      "25ml lime juice",
      "15ml grenadine syrup",
      "2 lime wedges (muddled)",
      "8-10 mint leaves",
    ],
    garnish: "Mint sprig & lime wedge",
  },
  {
    id: "na-st-clements-spritz",
    name: "Non-Alcoholic St. Clements Spritz",
    plural: "Non-Alcoholic St. Clements Spritzes",
    category: "non_alcoholic",
    alcoholic: false,
    spirits: [],
    ingredients: ["75ml orange juice", "50ml lemonade", "Squeeze of lemon juice", "Dash of Diet Coke"],
    garnish: "Orange wheel, lemon wheel & rosemary sprig",
  },
  {
    id: "na-cranberry-cooler",
    name: "Non-Alcoholic Cranberry Cooler",
    category: "non_alcoholic",
    alcoholic: false,
    spirits: [],
    ingredients: ["50ml cranberry juice", "25ml lemonade", "25ml lime juice", "15ml grenadine syrup"],
    garnish: "Lemon wheel & berries",
  },
];

// ---------- helpers ----------

export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  signature: "Hacien House Signatures",
  spritz: "Spritzes",
  classic: "Classics",
  non_alcoholic: "Non-Alcoholic",
};

export function byCategory(category: MenuCategory): Recipe[] {
  return MENU.filter((r) => r.category === category);
}

/** "Hacien Pineapple Spritz" → "Hacien Pineapple Spritzes", etc. */
export function drinkPlural(recipe: Recipe): string {
  if (recipe.plural) return recipe.plural;
  const n = recipe.name;
  if (/z$/i.test(n)) return `${n}es`;
  if (/[^aeiou]y$/i.test(n)) return `${n.slice(0, -1)}ies`;
  return `${n}s`;
}

/** Quest label for a specific menu item: "Sell 10 Hacien Pineapple Spritzes". */
export function sellQuestLabel(recipe: Recipe, target: number): string {
  return `Sell ${target} ${drinkPlural(recipe)}`;
}

/** Category-wide quest labels: "Sell 15 non-alcoholic cocktails", etc. */
export const CATEGORY_QUEST_LABELS: Record<MenuCategory, (target: number) => string> = {
  signature: (n) => `Sell ${n} Hacien signature serves`,
  spritz: (n) => `Sell ${n} spritzes (any on menu)`,
  classic: (n) => `Sell ${n} classic cocktails`,
  non_alcoholic: (n) => `Sell ${n} non-alcoholic cocktails`,
};
