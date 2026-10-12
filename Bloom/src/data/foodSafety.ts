/**
 * Food safety guide for Bloom.
 *
 * Content is general nutrition guidance only and is not medical advice.
 * Recommendations vary by country; always follow the advice of your own
 * midwife, doctor or dietitian.
 *
 * Levels: 'avoid' = skip for the whole pregnancy, 'limit' = safe in capped
 * amounts, 'caution' = usually fine but check preparation or ask your provider.
 */
import type { FoodSafetyItem } from '@/types'

export const FOOD_SAFETY: FoodSafetyItem[] = [
  {
    id: 'high-mercury-fish',
    name: 'High-mercury fish (swordfish, marlin, shark, king mackerel, bigeye tuna)',
    level: 'avoid',
    reason: 'These large predatory fish accumulate mercury, which can harm the developing nervous system.',
    alternative: 'Salmon, sardines, trout, cod, haddock or pollock, 2–3 portions a week.',
  },
  {
    id: 'canned-light-tuna',
    name: 'Tuna (canned light or fresh steaks)',
    level: 'limit',
    reason: 'Tuna carries more mercury than most fish, so keep to about 2 small cans of light tuna per week and avoid tuna steaks.',
    alternative: 'Tinned sardines, mackerel (not king) or salmon for omega-3.',
  },
  {
    id: 'raw-fish-sushi',
    name: 'Raw fish and sushi made with raw fish',
    level: 'avoid',
    reason: 'Raw fish can carry listeria and parasites that are more dangerous during pregnancy.',
    alternative: 'Sushi with fully cooked fish, cooked prawns or vegetable rolls.',
  },
  {
    id: 'raw-shellfish',
    name: 'Raw or undercooked shellfish (oysters, clams, mussels)',
    level: 'avoid',
    reason: 'Raw shellfish is a common source of norovirus, vibrio and listeria food poisoning.',
    alternative: 'Shellfish cooked until the shells open and the flesh is opaque.',
  },
  {
    id: 'smoked-seafood',
    name: 'Cold-smoked seafood (smoked salmon, lox, smoked trout)',
    level: 'avoid',
    reason: 'Refrigerated cold-smoked fish is not cooked and can harbour listeria.',
    alternative: 'Hot-smoked fish that has been cooked through, or smoked fish heated until steaming in a cooked dish.',
  },
  {
    id: 'local-caught-fish',
    name: 'Fish caught in local rivers or lakes without advisories',
    level: 'caution',
    reason: 'Local waterways can carry mercury or industrial pollutants, so check local fish advisories before eating.',
    alternative: 'Commercially sourced low-mercury fish when no advisory information is available.',
  },
  {
    id: 'raw-eggs',
    name: 'Raw or runny eggs (homemade mayonnaise, mousse, soft-boiled, Caesar dressing)',
    level: 'avoid',
    reason: 'Raw or undercooked eggs may contain salmonella, which can cause severe vomiting and dehydration.',
    alternative: 'Eggs cooked until both white and yolk are firm, or pasteurised egg products.',
  },
  {
    id: 'undercooked-meat',
    name: 'Raw or undercooked meat (rare steak, tartare, pink burgers)',
    level: 'avoid',
    reason: 'Undercooked meat can carry toxoplasmosis, salmonella and E. coli, all of which are riskier in pregnancy.',
    alternative: 'Meat cooked until no pink remains and juices run clear (75°C internal).',
  },
  {
    id: 'deli-meats',
    name: 'Cold deli meats (ham, salami, turkey slices, prosciutto)',
    level: 'avoid',
    reason: 'Ready-to-eat sliced meats can be contaminated with listeria, which can cross the placenta.',
    alternative: 'Freshly cooked meat, or deli meat heated until steaming hot.',
  },
  {
    id: 'hot-dogs',
    name: 'Hot dogs and frankfurters unless steaming hot',
    level: 'caution',
    reason: 'Pre-cooked sausages may harbour listeria unless reheated to steaming hot right before eating.',
    alternative: 'Heat thoroughly until steaming and avoid liquid from the packaging.',
  },
  {
    id: 'pate-liver',
    name: 'Pâté and liver (including liver sausage)',
    level: 'avoid',
    reason: 'Liver is extremely high in retinol (vitamin A), which can cause birth defects, and chilled pâtés can contain listeria.',
    alternative: 'Hummus, bean dips or cooked lean meats.',
  },
  {
    id: 'soft-mould-cheese',
    name: 'Soft mould-ripened cheeses (brie, camembert, chèvre with rind)',
    level: 'avoid',
    reason: 'These moist, low-acid cheeses allow listeria to grow, even when made with pasteurised milk.',
    alternative: 'Hard cheeses or pasteurised soft cheeses like cottage cheese, mozzarella, ricotta and cream cheese; or cook brie until piping hot.',
  },
  {
    id: 'blue-cheese',
    name: 'Soft blue-veined cheeses (gorgonzola, roquefort, danish blue)',
    level: 'avoid',
    reason: 'Soft blue cheeses carry a higher listeria risk because of their moisture and mould ripening.',
    alternative: 'Hard blue cheeses like stilton, or any blue cheese cooked until steaming.',
  },
  {
    id: 'unpasteurised-dairy',
    name: 'Unpasteurised (raw) milk and cheeses made from it',
    level: 'avoid',
    reason: 'Raw milk can contain listeria, E. coli and campylobacter that pasteurisation would destroy.',
    alternative: 'Pasteurised milk, yogurt and cheese, which are equally nutritious.',
  },
  {
    id: 'unpasteurised-juice',
    name: 'Unpasteurised juice and cider (fresh-pressed from stalls or farms)',
    level: 'avoid',
    reason: 'Fresh unpasteurised juice can carry E. coli and salmonella from the raw fruit.',
    alternative: 'Pasteurised juice, or juice you squeeze yourself from washed fruit and drink immediately.',
  },
  {
    id: 'raw-sprouts',
    name: 'Raw sprouts (alfalfa, bean, clover, radish)',
    level: 'avoid',
    reason: 'Sprout seeds can harbour salmonella and E. coli that cannot be washed off.',
    alternative: 'Sprouts cooked thoroughly, or crunchy shredded cabbage and lettuce.',
  },
  {
    id: 'unwashed-produce',
    name: 'Unwashed fruit and vegetables',
    level: 'caution',
    reason: 'Soil residue can carry toxoplasmosis and listeria, so wash all produce well before eating.',
    alternative: 'Rinse under running water and scrub firm produce; peel when in doubt.',
  },
  {
    id: 'pre-made-salads',
    name: 'Pre-made deli salads (coleslaw, potato salad, pre-cut fruit, bagged salad)',
    level: 'caution',
    reason: 'Ready-to-eat chilled salads have been linked to listeria outbreaks when stored too long.',
    alternative: 'Make salads fresh at home and eat within a day; rewash bagged leaves.',
  },
  {
    id: 'leftover-rice',
    name: 'Cooked rice left at room temperature',
    level: 'avoid',
    reason: 'Bacillus cereus spores multiply in rice left out and produce toxins that reheating does not destroy.',
    alternative: 'Cool rice within an hour, refrigerate, and eat within 24 hours after reheating until steaming.',
  },
  {
    id: 'caffeine',
    name: 'Caffeine (coffee, tea, cola, chocolate)',
    level: 'limit',
    reason: 'More than about 200 mg a day is linked with low birth weight and miscarriage risk.',
    alternative: 'One regular coffee (or two cups of tea) a day, then switch to decaf or water.',
  },
  {
    id: 'energy-drinks',
    name: 'Energy drinks',
    level: 'avoid',
    reason: 'They combine high caffeine with taurine and other stimulants that have not been shown safe in pregnancy.',
    alternative: 'Sparkling water with fruit, or a short walk and a protein snack for an energy lift.',
  },
  {
    id: 'alcohol',
    name: 'Alcohol',
    level: 'avoid',
    reason: 'No amount of alcohol is known to be safe; it crosses the placenta and can cause fetal alcohol spectrum disorders.',
    alternative: 'Alcohol-free mocktails, kombucha labelled under 0.5% or sparkling water with bitters-free garnishes.',
  },
  {
    id: 'herbal-teas',
    name: 'Herbal teas and supplements',
    level: 'caution',
    reason: 'Many herbs (e.g. liquorice root, dong quai, pennyroyal, large amounts of raspberry leaf) are not tested in pregnancy or may stimulate the uterus.',
    alternative: 'Ginger, peppermint or rooibos in moderation, and check any blend with your provider.',
  },
  {
    id: 'vitamin-a-supplements',
    name: 'High-dose vitamin A (retinol) supplements and fish liver oil',
    level: 'avoid',
    reason: 'Excess retinol is teratogenic and can cause birth defects.',
    alternative: 'A pregnancy-specific multivitamin with beta-carotene rather than retinol.',
  },
  {
    id: 'sugary-drinks',
    name: 'High-sugar drinks (soda, sweetened juices, frappés)',
    level: 'limit',
    reason: 'Frequent sugary drinks raise the risk of excessive weight gain and gestational diabetes.',
    alternative: 'Water infused with fruit, milk or diluted 100% juice.',
  },
  {
    id: 'artificial-sweeteners',
    name: 'Artificial sweeteners (saccharin, large amounts of aspartame or sucralose)',
    level: 'caution',
    reason: 'Most approved sweeteners are considered safe in moderation, but saccharin crosses the placenta and evidence on heavy use is limited.',
    alternative: 'Small amounts of sugar, fruit or stevia-based sweeteners.',
  },
  {
    id: 'licorice',
    name: 'Liquorice (large amounts of black liquorice sweets or root)',
    level: 'caution',
    reason: 'Glycyrrhizin in liquorice has been linked to raised blood pressure and preterm birth when eaten in large quantities.',
    alternative: 'An occasional small piece is unlikely to cause harm; choose other sweets regularly.',
  },
  {
    id: 'refrigerated-meat-spreads',
    name: 'Refrigerated meat spreads and smoked fish spreads',
    level: 'avoid',
    reason: 'Chilled ready-to-eat spreads are a known listeria risk.',
    alternative: 'Shelf-stable canned fish or meat spreads, or home-made hummus.',
  },
  {
    id: 'raw-flour-dough',
    name: 'Raw dough and cake batter',
    level: 'avoid',
    reason: 'Raw flour can carry E. coli and raw egg can carry salmonella.',
    alternative: 'Wait for the baked result, or use heat-treated flour and pasteurised eggs for edible dough.',
  },
]
