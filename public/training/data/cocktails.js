/**
 * Cocktail dataset for Beat the Bartender — the venue's official menu.
 * KEEP IN SYNC with lib/recipes.ts (the app's canonical menu dataset).
 *
 * Ingredients are ordered least-to-most revealing for gameplay: commodity
 * mixers first, the giveaway branded spirit last, so early clues stay
 * ambiguous. Measures are the exact house spec — this doubles as spec
 * training for new staff.
 */
const COCKTAILS = [
  // ---------- Hacien house signatures ----------
  {
    name: "Pineapple Tommy's Margarita",
    ingredients: ["25ml lime juice", "25ml agave syrup", "50ml Hacien Pineapple Tequila Blanco"],
    garnish: "Lime wedge",
  },
  {
    name: "Hugo Lemon and Lime Spritz",
    ingredients: [
      "Soda top",
      "75ml prosecco",
      "25ml elderflower cordial",
      "40ml Hacien Lemon & Lime Tequila",
    ],
    garnish: "Lime wedge & mint sprig",
  },
  {
    name: "Limoncello Garden Spritz",
    ingredients: [
      "Soda top",
      "75ml prosecco",
      "25ml Hacien Tequila Blanco",
      "25ml Limoncello Isolabella",
    ],
    garnish: "Cucumber wheel, lemon wheel & mint sprig",
  },
  {
    name: "Hacien Cucumber and Mint Spritz",
    ingredients: [
      "Soda top",
      "25ml lime juice",
      "25ml agave syrup",
      "35ml Sauvignon Blanc",
      "35ml Hacien Tequila Blanco",
    ],
    garnish: "Cucumber wheel & mint sprig",
  },
  {
    name: "Hacien Pineapple Spritz",
    ingredients: [
      "Soda top",
      "15ml lime juice",
      "15ml honey",
      "10 mint leaves",
      "4 raspberries",
      "50ml Hacien Pineapple Tequila Blanco",
    ],
    garnish: "Raspberry & mint sprig",
  },
  {
    name: "Grown-Up Drumstick",
    ingredients: [
      "15ml lime juice",
      "15ml vanilla syrup",
      "15ml Chambord",
      "50ml Summer Berries Tequila",
    ],
    garnish: "Strawberry",
  },
  {
    name: "Summer Royale Spritz",
    ingredients: [
      "Soda top",
      "75ml prosecco",
      "15ml vanilla syrup",
      "15ml Chambord",
      "40ml Hacien Summer Berries Tequila",
    ],
    garnish: "Strawberry",
  },
  {
    name: "Shadowed Coffee Tequila Negroni",
    ingredients: ["25ml Martini Rosso", "25ml Campari", "25ml Hacien Coffee Tequila"],
    garnish: "Orange peel or slice",
  },

  // ---------- Spritzes ----------
  {
    name: "Elderflower Spritz",
    ingredients: ["Soda top", "75ml Romeo Prosecco", "25ml St-Germain elderflower liqueur"],
    garnish: "Lime wedge or lemon wheel & mint sprig",
  },
  {
    name: "Sarti Spritz",
    ingredients: ["Soda top", "75ml Romeo Prosecco", "50ml Sarti"],
    garnish: "Lime wedge",
  },
  {
    name: "Blush Spritz",
    ingredients: ["25ml soda", "75ml prosecco", "25ml Chambord", "25ml Isolabella Limoncello"],
    garnish: "Lemon slice",
  },
  {
    name: "Chambord Royale",
    ingredients: ["125ml Romeo Prosecco", "25ml Chambord Black Raspberry Liqueur"],
    garnish: "Raspberry or seasonal berry",
  },
  {
    name: "Aperol Spritz",
    ingredients: ["Soda top", "75ml Romeo Prosecco", "50ml Aperol"],
    garnish: "Orange wheel slice",
  },

  // ---------- Classics ----------
  {
    name: "Mojito / Mojito Raspberry",
    ingredients: [
      "100ml soda",
      "Mint leaves",
      "4 lime wedges (muddled)",
      "10ml Monin Gomme",
      "50ml Bacardi Carta Blanca or Bacardi Raspberry",
    ],
    garnish: "Mint sprig",
  },
  {
    name: "Tokyo Iced Tea",
    ingredients: [
      "25ml lemonade",
      "15ml Smirnoff",
      "15ml Gordon's gin",
      "15ml Bacardi",
      "15ml silver tequila",
      "15ml Midori",
    ],
    garnish: "Lime wedge",
  },
  {
    name: "Woodford Old Fashioned",
    ingredients: [
      "Brown sugar cube",
      "2 dashes Angostura bitters + dash of water",
      "50ml Woodford Reserve",
    ],
    garnish: "Orange slice & glacé cherry",
  },
  {
    name: "Negroni / Negroni Sevilla",
    ingredients: [
      "25ml Martini Rosso",
      "25ml Campari",
      "25ml Tanqueray London Dry or Tanqueray Flor de Sevilla",
    ],
    garnish: "Orange slice or peel",
  },
  {
    name: "Gin Tiki",
    ingredients: ["10ml vanilla syrup", "75ml pineapple juice", "50ml Gordon's gin", "25ml Malibu"],
    garnish: "3 glacé cherries",
  },
  {
    name: "Cosmopolitan",
    ingredients: [
      "Juice of half a lime",
      "50ml cranberry juice",
      "25ml Cointreau",
      "50ml Smirnoff vodka",
    ],
    garnish: "Orange slice or peel",
  },
  {
    name: "Passionfruit Martini",
    ingredients: [
      "10ml Monin Gomme",
      "25ml prosecco",
      "50ml Smirnoff",
      "15ml Passoa",
      "25ml passionfruit juice/pulp/coulis/purée",
    ],
    garnish: "Lime wedge & half a passionfruit",
  },
  {
    name: "Espresso Martini",
    ingredients: ["15ml Monin Gomme", "25ml Smirnoff vodka", "25ml Tia Maria", "Double espresso"],
    garnish: "3 coffee beans",
  },
  {
    name: "Bramble Berry",
    ingredients: [
      "Juice of half a lemon",
      "25ml Crème de Cassis or Chambord",
      "50ml Tanqueray Blackcurrant Royale gin",
    ],
    garnish: "Berries & lemon slice",
  },

  // ---------- Non-alcoholic ----------
  {
    name: "Non-Alcoholic Pineapple Mojito",
    ingredients: [
      "25ml lime juice",
      "8-10 mint leaves",
      "2 lime wedges (muddled)",
      "15ml grenadine syrup",
      "150-200ml pineapple juice",
    ],
    garnish: "Mint sprig & lime wedge",
  },
  {
    name: "Non-Alcoholic St. Clements Spritz",
    ingredients: ["50ml lemonade", "Squeeze of lemon juice", "Dash of Diet Coke", "75ml orange juice"],
    garnish: "Orange wheel, lemon wheel & rosemary sprig",
  },
  {
    name: "Non-Alcoholic Cranberry Cooler",
    ingredients: [
      "25ml lemonade",
      "25ml lime juice",
      "15ml grenadine syrup",
      "50ml cranberry juice",
    ],
    garnish: "Lemon wheel & berries",
  },
];
