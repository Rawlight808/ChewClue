type AutoTagRule = { pattern: RegExp; tags: string[] }

const rules: AutoTagRule[] = [
  { pattern: /pizza/i, tags: ['bread', 'dairy', 'tomato', 'gluten'] },
  { pattern: /burger/i, tags: ['bread', 'red_meat', 'gluten'] },
  { pattern: /cheeseburger/i, tags: ['bread', 'red_meat', 'dairy', 'gluten'] },
  { pattern: /pasta|spaghetti|penne|linguine|fettuccine|lasagna/i, tags: ['gluten', 'tomato'] },
  { pattern: /mac\s*(and|&|n)\s*cheese/i, tags: ['gluten', 'dairy'] },
  { pattern: /grilled cheese/i, tags: ['bread', 'dairy', 'gluten'] },
  { pattern: /sandwich|sub|hoagie|panini/i, tags: ['bread', 'gluten'] },
  { pattern: /taco|burrito|quesadilla|enchilada/i, tags: ['dairy', 'spicy'] },
  { pattern: /salsa/i, tags: ['tomato', 'spicy'] },
  { pattern: /coffee|espresso|latte|cappuccino|americano/i, tags: ['caffeine'] },
  { pattern: /tea(?!\w)/i, tags: ['caffeine'] },
  { pattern: /energy\s*drink|red\s*bull|monster/i, tags: ['caffeine', 'sugar'] },
  { pattern: /beer|wine|cocktail|whiskey|vodka|tequila|margarita/i, tags: ['alcohol'] },
  { pattern: /soda|coke|pepsi|sprite/i, tags: ['sugar'] },
  { pattern: /ice\s*cream/i, tags: ['dairy', 'sugar'] },
  { pattern: /yogurt|yoghurt/i, tags: ['dairy'] },
  { pattern: /cheese/i, tags: ['dairy'] },
  { pattern: /milk(?!\w)/i, tags: ['dairy'] },
  { pattern: /cream/i, tags: ['dairy'] },
  { pattern: /butter/i, tags: ['dairy'] },
  { pattern: /egg(?:s)?(?!\w)/i, tags: ['eggs'] },
  { pattern: /omelet|omelette|frittata/i, tags: ['eggs'] },
  { pattern: /steak|beef|lamb/i, tags: ['red_meat'] },
  { pattern: /chicken|turkey|poultry/i, tags: ['chicken'] },
  { pattern: /fish|salmon|tuna|shrimp|crab|lobster|sushi|sashimi/i, tags: ['seafood'] },
  { pattern: /fries|fried|deep\s*fried|crispy/i, tags: ['fried', 'seed_oil'] },
  { pattern: /toast|bread|bagel|croissant|muffin|biscuit|roll/i, tags: ['bread', 'gluten'] },
  { pattern: /cereal|oat|granola/i, tags: ['gluten'] },
  { pattern: /donut|doughnut|cake|cookie|brownie|pastry|pie/i, tags: ['sugar', 'gluten'] },
  { pattern: /candy|chocolate|gummy/i, tags: ['sugar'] },
  { pattern: /peanut|almond|walnut|cashew|pecan|pistachio/i, tags: ['nuts'] },
  { pattern: /tofu|edamame|soy\s*sauce|tempeh|miso/i, tags: ['soy'] },
  { pattern: /kimchi|sauerkraut|kombucha|kefir/i, tags: ['fermented'] },
  { pattern: /tomato|marinara|ketchup/i, tags: ['tomato'] },
  { pattern: /apple|banana|orange|berry|berries|grape|mango|melon|peach|pear/i, tags: ['fruit'] },
  { pattern: /broccoli|spinach|kale|carrot|celery|cucumber|lettuce|pepper|onion|zucchini/i, tags: ['vegetables'] },
  { pattern: /salad/i, tags: ['vegetables', 'raw'] },
  { pattern: /smoothie/i, tags: ['fruit'] },
  { pattern: /protein\s*(shake|powder)|creatine|vitamin|probiotic|magnesium|zinc|fish\s*oil/i, tags: ['supplements'] },
  { pattern: /chips|doritos|cheetos|pretzels/i, tags: ['processed', 'seed_oil'] },
  { pattern: /hot\s*dog|sausage|bacon|deli|bologna|salami|pepperoni/i, tags: ['processed', 'red_meat'] },
  { pattern: /ramen|instant\s*noodle/i, tags: ['processed', 'gluten'] },
  { pattern: /curry|sriracha|hot\s*sauce|jalapeño|habanero|chili/i, tags: ['spicy'] },
]

export function getAutoTags(description: string): Set<string> {
  const matched = new Set<string>()
  for (const rule of rules) {
    if (rule.pattern.test(description)) {
      for (const tag of rule.tags) matched.add(tag)
    }
  }
  return matched
}
