export type TimeGroup = 'Morning' | 'Midday' | 'Afternoon' | 'Evening' | 'Night'

export const TIME_GROUP_ORDER: TimeGroup[] = ['Morning', 'Midday', 'Afternoon', 'Evening', 'Night']

export interface SupplementCatalogEntry {
  id: string
  name: string
  category: string
  categoryColor: string
  dose: string
  timing: string
  timeGroup: TimeGroup
  sortOrder: number
  timing_rationale: string
  benefits: string[]
  mechanism: string
  interactions?: string
}

export const SUPPLEMENT_CATALOG: SupplementCatalogEntry[] = [
  {
    id: 'humantra',
    name: 'Humantra',
    category: 'Hydration',
    categoryColor: 'blue',
    dose: 'Per label',
    timing: 'On wake',
    timeGroup: 'Morning',
    sortOrder: 0,
    timing_rationale: 'You wake up ~8hrs dehydrated. Humantra\'s electrolyte blend immediately restores plasma osmolality and kickstarts fluid absorption before food or caffeine. Morning is the highest-leverage hydration window of the day.',
    benefits: [
      'Restores sodium, potassium, and magnesium lost overnight',
      'Rapidly improves plasma osmolality and cellular hydration',
      'Reduces morning fatigue and brain fog driven by dehydration',
      'Primes fluid absorption before food or caffeine',
    ],
    mechanism: 'Electrolytes (Na⁺, K⁺, Mg²⁺, Cl⁻) maintain cell membrane electrochemical potential and drive water into cells via osmosis. Sodium in particular activates aquaporin channels that facilitate cellular water uptake — plain water without electrolytes absorbs slower and passes through faster.',
    interactions: 'Safe to take alongside Concentrace and Creatine. Avoid very high sodium intake if managing blood pressure.',
  },
  {
    id: 'concentrace',
    name: 'Concentrace',
    category: 'Trace Minerals',
    categoryColor: 'blue',
    dose: 'Per label (typically 40 drops)',
    timing: 'On wake',
    timeGroup: 'Morning',
    sortOrder: 1,
    timing_rationale: 'Trace minerals serve as enzymatic cofactors that activate metabolic processes throughout the day. Taking on wake ensures they are bioavailable when your body transitions from fasting to active state. Stacks naturally with Humantra — add drops directly to the drink.',
    benefits: [
      '72+ ionic trace minerals including zinc, selenium, manganese, chromium',
      'Supports hundreds of enzymatic reactions across energy metabolism',
      'Replenishes minerals depleted by sweating and filtered water consumption',
      'May support thyroid function (iodine, selenium) and immune response (zinc)',
    ],
    mechanism: 'ConcenTrace is a concentrated ionic mineral solution from the Great Salt Lake, desalinated to remove excess sodium. Ionic minerals carry an electrical charge that allows direct cellular uptake without digestion — they act as cofactors activating enzymes that would otherwise be inactive due to modern dietary mineral depletion.',
    interactions: 'Very high doses can cause loose stools — stick to label dosing. The magnesium content complements but does not replace dedicated Magnesium Glycinate at night.',
  },
  {
    id: 'creatine-5g',
    name: 'Creatine 5g',
    category: 'Performance',
    categoryColor: 'cyan',
    dose: '5g creatine monohydrate',
    timing: 'On wake',
    timeGroup: 'Morning',
    sortOrder: 2,
    timing_rationale: 'Creatine timing is largely irrelevant — what matters is daily consistency to maintain saturated phosphocreatine stores. Morning anchors it to a reliable habit. Some evidence suggests post-workout may be marginally superior on training days, but the difference is trivial vs. the benefit of never missing a dose.',
    benefits: [
      'Increases muscle phosphocreatine stores for rapid ATP resynthesis',
      'Improves high-intensity exercise performance and power output',
      'Supports cognitive performance and working memory',
      'Accelerates recovery between training sets and sessions',
      'One of the most researched and safety-proven supplements in existence',
    ],
    mechanism: 'Creatine phosphate donates a phosphate group to ADP → ATP, bypassing the slower oxidative phosphorylation pathway. This fuels the first 8–12 seconds of maximal effort. Chronic supplementation raises total muscle creatine ~20%, expanding this energy buffer. Cognitive benefits likely stem from the same ATP-resynthesis mechanism in neurons.',
    interactions: 'Caffeine does not blunt creatine effectiveness despite old studies. Safe with all other supplements in this stack. No loading phase needed at 5g/day — stores saturate within ~4 weeks.',
  },
  {
    id: 'seed-ds01',
    name: 'Seed DS-01 Daily Synbiotic',
    category: 'Gut Health',
    categoryColor: 'green',
    dose: '2 capsules per Seed protocol',
    timing: '12:00 PM',
    timeGroup: 'Midday',
    sortOrder: 3,
    timing_rationale: 'Seed recommends midday, away from other supplements, to avoid interactions with high-dose minerals. The ViaCap nested capsule survives stomach acid without needing food; spacing from morning supplements reduces competitive absorption issues with zinc and iron.',
    benefits: [
      'Increases gut microbiome diversity across 24 clinically studied strains',
      'Supports synthesis of short-chain fatty acids (butyrate, propionate)',
      'Strengthens intestinal barrier integrity',
      'Modulates immune function — ~70% of immune tissue is gut-associated',
      'Linked to improved gut motility and reduced bloating',
    ],
    mechanism: 'DS-01 contains 53.6B AFU across Lactobacillus and Bifidobacterium strains, encapsulated in a patented nested capsule (ViaCap) that bypasses stomach acid. The prebiotic outer capsule (non-fermenting polysaccharides) selectively feeds beneficial bacteria in the colon rather than fermenting prematurely in the small intestine.',
    interactions: 'Space ≥2hrs from antibiotics if ever needed. Iron supplements can inhibit some probiotic strains — current schedule correctly separates Ferroglobibin to evening.',
  },
  {
    id: 'omega3',
    name: 'Omega-3',
    category: 'Anti-Inflammatory',
    categoryColor: 'amber',
    dose: 'Per label — typically 1–2g EPA+DHA',
    timing: 'Post-lunch',
    timeGroup: 'Afternoon',
    sortOrder: 4,
    timing_rationale: 'Omega-3 fatty acids absorb significantly better with a fat-containing meal. Post-lunch provides consistent dietary fat for absorption and avoids the mild nausea some experience taking fish oil on an empty stomach.',
    benefits: [
      'EPA+DHA reduce systemic inflammation via prostaglandin and leukotriene pathways',
      'DHA is a structural component of neuronal membranes — supports cognition and mood',
      'Linked to improved HRV and cardiovascular health markers',
      'May reduce DOMS and support exercise recovery',
      'Supports healthy triglyceride levels',
    ],
    mechanism: 'EPA and DHA are incorporated into cell membrane phospholipids, altering membrane fluidity and receptor signaling. They are precursors to resolvins and protectins — specialized pro-resolving mediators that actively resolve inflammation rather than merely suppressing it. DHA is concentrated in the brain and retina; adequate supply supports synaptic plasticity.',
    interactions: 'High-dose fish oil (>3g/day) may have mild anti-platelet effects. Can be taken alongside Multivitamin — fat in the meal aids absorption of both.',
  },
  {
    id: 'multivitamin',
    name: 'Multivitamin',
    category: 'Foundational',
    categoryColor: 'amber',
    dose: 'Per product label',
    timing: 'Post-lunch',
    timeGroup: 'Afternoon',
    sortOrder: 5,
    timing_rationale: 'Fat-soluble vitamins (A, D, E, K) absorb 30–50% better with dietary fat. Post-lunch ensures food is present for optimal absorption. Separating from morning iron (Ferroglobibin at dinner) avoids calcium competing with iron uptake.',
    benefits: [
      'Covers micronutrient gaps that diet alone may not fill consistently',
      'B-complex vitamins support energy metabolism and NAD⁺ synthesis',
      'Vitamin D supports testosterone production, immune function, and bone density',
      'Zinc supports testosterone, immune response, and protein synthesis',
      'Vitamin K2 works synergistically with Vitamin D for calcium metabolism',
    ],
    mechanism: 'Multivitamins provide cofactors and substrates for enzymatic reactions across metabolism. B vitamins are coenzymes in the citric acid cycle and electron transport chain. Vitamin D acts as a steroid hormone, regulating gene expression in immune cells and endocrine tissue. Zinc is required for >300 enzymes including those in DNA synthesis and protein metabolism.',
    interactions: 'Calcium in the multivitamin can compete with iron absorption — kept well separated from Ferroglobibin in current schedule. Avoid taking with high-tannin foods (coffee/tea).',
  },
  {
    id: 'ferroglobibin',
    name: 'Ferroglobibin',
    category: 'Micronutrient',
    categoryColor: 'orange',
    dose: 'Per Ferroglobibin label',
    timing: 'Pre-dinner (with OJ)',
    timeGroup: 'Evening',
    sortOrder: 6,
    timing_rationale: 'Take with ~120ml orange juice — Vitamin C converts Fe³⁺ to the absorbable Fe²⁺ form, increasing uptake by up to 3x. Pre-dinner avoids calcium from dairy (dinner) and is well away from the morning multivitamin\'s calcium and zinc, both of which compete with iron absorption.',
    benefits: [
      'Iron is required for haemoglobin synthesis — oxygen transport to muscles and brain',
      'Supports energy levels and reduces fatigue from suboptimal iron stores',
      'Ferritin levels support immune function and exercise recovery',
      'Important for endurance athletes with high red blood cell turnover',
    ],
    mechanism: 'Non-haem iron is absorbed in the Fe²⁺ form in the duodenum. Ascorbic acid (Vitamin C from OJ) acts as a reducing agent converting Fe³⁺ → Fe²⁺ and forms a soluble iron-ascorbate chelate that resists precipitation in the alkaline duodenum — dramatically improving absorption over taking iron alone.',
    interactions: 'Must avoid: calcium/dairy, coffee/tea (tannins), high-fibre foods, zinc — all strongly inhibit absorption. Current pre-dinner timing (away from multivitamin, Concentrace, and Seed) is optimally positioned for maximum uptake.',
  },
  {
    id: 'magnesium-glycinate',
    name: 'Magnesium Glycinate 360mg',
    category: 'Recovery + Sleep',
    categoryColor: 'purple',
    dose: '360mg elemental magnesium as glycinate chelate',
    timing: 'Before bed',
    timeGroup: 'Night',
    sortOrder: 7,
    timing_rationale: 'Magnesium promotes relaxation via NMDA receptor antagonism and GABA potentiation — effects that directly support sleep onset. Taking pre-sleep aligns with overnight muscle repair and the ~10pm cortisol nadir. Glycinate form (bound to glycine, itself a calming amino acid) avoids the laxative effect of oxide or citrate forms.',
    benefits: [
      'Improves sleep onset latency and sleep quality (especially deep/slow-wave sleep)',
      'Supports HRV — magnesium is required for parasympathetic nervous system tone',
      'Reduces muscle cramping and facilitates overnight muscle protein synthesis',
      'Cofactor in 300+ enzymatic reactions including ATP production',
      'May reduce cortisol and support healthy testosterone levels',
    ],
    mechanism: 'Magnesium modulates the NMDA glutamate receptor (reducing excitatory signaling) and enhances GABA-A receptor binding (the primary inhibitory neurotransmitter). Glycine, the chelating amino acid, has independent sleep-promoting effects including mild core body temperature reduction. Mg²⁺ is also required for Na/K-ATPase pump function, maintaining cellular electrochemical gradients during repair.',
    interactions: 'Can slightly reduce absorption of some antibiotics — space 2hrs if needed. Generally very well tolerated; glycinate form rarely causes GI upset unlike oxide or citrate.',
  },
  {
    id: 'humantra-stack',
    name: 'Humantra + Concentrace + Creatine HMB',
    category: 'Hydration',
    categoryColor: 'blue',
    dose: 'Per label',
    timing: '500ml water before coffee',
    timeGroup: 'Morning',
    sortOrder: 0,
    timing_rationale: 'You wake up ~8hrs dehydrated. Taking this stack on wake restores electrolytes and trace minerals while creatine HMB supports muscle recovery and performance.',
    benefits: [
      'Restores sodium, potassium, and magnesium lost overnight',
      'Primes fluid absorption before food or caffeine',
      'Supports muscle phosphocreatine stores for ATP resynthesis',
      'Trace minerals activate enzymatic processes throughout the day',
    ],
    mechanism: 'Electrolytes maintain cell membrane potential and drive water into cells. ConcenTrace ionic minerals serve as enzymatic cofactors. Creatine HMB phosphate donates phosphate to ADP → ATP for rapid energy resynthesis.',
  },
  {
    id: 'rituals-omega3',
    name: 'Rituals Omega-3 DHA+EPA',
    category: 'Anti-Inflammatory',
    categoryColor: 'amber',
    dose: 'Per label',
    timing: 'With food',
    timeGroup: 'Afternoon',
    sortOrder: 4,
    timing_rationale: 'Omega-3 fatty acids absorb significantly better with a fat-containing meal. Post-lunch provides consistent dietary fat for absorption.',
    benefits: [
      'EPA+DHA reduce systemic inflammation',
      'DHA supports cognition and mood as a structural neuronal membrane component',
      'Linked to improved HRV and cardiovascular health',
      'Supports healthy triglyceride levels',
    ],
    mechanism: 'EPA and DHA are incorporated into cell membrane phospholipids, altering fluidity and receptor signaling. Precursors to resolvins and protectins — pro-resolving mediators that actively resolve inflammation.',
  },
  {
    id: 'rituals-multivitamin',
    name: 'Rituals Essential Men 18+ Multivitamin',
    category: 'Foundational',
    categoryColor: 'amber',
    dose: 'Per product label',
    timing: 'With food',
    timeGroup: 'Afternoon',
    sortOrder: 5,
    timing_rationale: 'Fat-soluble vitamins (A, D, E, K) absorb 30–50% better with dietary fat. Post-lunch ensures food is present for optimal absorption.',
    benefits: [
      'Covers micronutrient gaps that diet alone may not fill consistently',
      'B-complex vitamins support energy metabolism and NAD⁺ synthesis',
      'Vitamin D supports testosterone production, immune function, and bone density',
      'Zinc supports testosterone, immune response, and protein synthesis',
    ],
    mechanism: 'Multivitamins provide cofactors and substrates for enzymatic reactions across metabolism. Fat-soluble vitamins require dietary fat for absorption into lymphatic circulation.',
  },
  {
    id: 'ferroglobibin-oj',
    name: 'Ferroglobibin + OJ',
    category: 'Micronutrient',
    categoryColor: 'orange',
    dose: 'Per Ferroglobibin label',
    timing: 'Pre-dinner (with OJ)',
    timeGroup: 'Evening',
    sortOrder: 6,
    timing_rationale: 'Take with ~120ml orange juice — Vitamin C converts Fe³⁺ to the absorbable Fe²⁺ form, increasing uptake by up to 3x. Pre-dinner avoids calcium from dairy and keeps it away from the multivitamin\'s calcium and zinc.',
    benefits: [
      'Iron is required for haemoglobin synthesis — oxygen transport to muscles and brain',
      'Supports energy levels and reduces fatigue from suboptimal iron stores',
      'Ferritin supports immune function and exercise recovery',
    ],
    mechanism: 'Non-haem iron is absorbed in the Fe²⁺ form. Ascorbic acid from OJ converts Fe³⁺ → Fe²⁺ and forms a soluble iron-ascorbate chelate, dramatically improving absorption.',
    interactions: 'Must avoid: calcium/dairy, coffee/tea (tannins), high-fibre foods, zinc — all strongly inhibit absorption.',
  },
  // ── Aliases for old supplement names (historical log entries) ─────────────────
  {
    id: 'humantra-concentrace-old',
    name: 'Humantra + Concentrace',
    category: 'Hydration',
    categoryColor: 'blue',
    dose: 'Per label',
    timing: 'On wake',
    timeGroup: 'Morning',
    sortOrder: 0,
    timing_rationale: 'Morning hydration stack taken on wake to restore overnight electrolyte deficit.',
    benefits: ['Restores electrolytes lost overnight', 'Primes fluid absorption before food or caffeine'],
    mechanism: 'Electrolytes maintain cell membrane potential and drive water into cells via osmosis.',
  },
  {
    id: 'omega3-rituals-old',
    name: 'Omega-3 (Rituals)',
    category: 'Anti-Inflammatory',
    categoryColor: 'amber',
    dose: 'Per label',
    timing: 'With food',
    timeGroup: 'Afternoon',
    sortOrder: 4,
    timing_rationale: 'Omega-3 fatty acids absorb significantly better with a fat-containing meal.',
    benefits: ['EPA+DHA reduce systemic inflammation', 'DHA supports cognition and mood'],
    mechanism: 'EPA and DHA are incorporated into cell membrane phospholipids, altering fluidity and signaling.',
  },
  {
    id: 'mens-multivitamin-old',
    name: "Men's Multivitamin 18+",
    category: 'Foundational',
    categoryColor: 'amber',
    dose: 'Per product label',
    timing: 'With food',
    timeGroup: 'Afternoon',
    sortOrder: 5,
    timing_rationale: 'Fat-soluble vitamins absorb best with dietary fat present at lunch.',
    benefits: ['Covers micronutrient gaps', 'B-complex supports energy metabolism', 'Vitamin D supports testosterone and immune function'],
    mechanism: 'Multivitamins provide cofactors for enzymatic reactions across metabolism.',
  },
  // ── Current supplement names not yet in catalog ────────────────────────────
  {
    id: 'creatine',
    name: 'Creatine',
    category: 'Performance',
    categoryColor: 'cyan',
    dose: '5g creatine monohydrate',
    timing: 'Morning',
    timeGroup: 'Morning',
    sortOrder: 2,
    timing_rationale: 'Daily consistency matters more than timing for maintaining saturated phosphocreatine stores. Morning anchors it to a reliable habit.',
    benefits: [
      'Increases muscle phosphocreatine stores for rapid ATP resynthesis',
      'Improves high-intensity exercise performance and power output',
      'Supports cognitive performance and working memory',
    ],
    mechanism: 'Creatine phosphate donates a phosphate group to ADP → ATP, fueling the first 8–12 seconds of maximal effort.',
  },
  {
    id: 'vitamin-d3',
    name: 'Vitamin D3',
    category: 'Foundational',
    categoryColor: 'amber',
    dose: 'Per label (typically 2000–5000 IU)',
    timing: 'Morning with food',
    timeGroup: 'Morning',
    sortOrder: 2,
    timing_rationale: 'Fat-soluble vitamin — absorbs best with dietary fat. Morning ensures it works with the diurnal cortisol peak and supports daytime hormone signaling.',
    benefits: [
      'Supports testosterone production and endocrine function',
      'Critical for immune regulation and bone density',
      'Linked to improved mood and reduced depression risk',
      'Deficiency is extremely common, especially in lower-sunlight climates',
    ],
    mechanism: 'Vitamin D3 is converted to calcitriol in the liver and kidneys, acting as a steroid hormone that regulates gene expression in immune cells, muscle tissue, and the endocrine system.',
  },
  {
    id: 'magnesium-glycinate-short',
    name: 'Magnesium Glycinate',
    category: 'Recovery + Sleep',
    categoryColor: 'purple',
    dose: '200–400mg elemental magnesium as glycinate chelate',
    timing: 'Before bed',
    timeGroup: 'Night',
    sortOrder: 7,
    timing_rationale: 'Magnesium promotes relaxation via NMDA receptor antagonism and GABA potentiation — effects that directly support sleep onset.',
    benefits: [
      'Improves sleep onset latency and sleep quality',
      'Supports HRV and parasympathetic nervous system tone',
      'Reduces muscle cramping and facilitates overnight muscle protein synthesis',
    ],
    mechanism: 'Magnesium modulates the NMDA glutamate receptor and enhances GABA-A receptor binding. Glycine has independent sleep-promoting effects.',
  },
  {
    id: 'whey-protein',
    name: 'Whey Protein',
    category: 'Performance',
    categoryColor: 'cyan',
    dose: '25–40g per serving',
    timing: 'Post-workout',
    timeGroup: 'Morning',
    sortOrder: 3,
    timing_rationale: 'Post-workout protein intake maximizes muscle protein synthesis during the anabolic window when muscle is most receptive to amino acids.',
    benefits: [
      'Provides rapidly absorbed complete amino acid profile',
      'Stimulates muscle protein synthesis via leucine-mTOR pathway',
      'Supports recovery and reduces DOMS',
      'Convenient way to hit daily protein targets',
    ],
    mechanism: 'Whey is a fast-digesting protein with high leucine content (~11%). Leucine directly activates mTORC1, the master regulator of muscle protein synthesis, independently of total caloric intake.',
  },
  {
    id: 'pre-workout',
    name: 'Pre-Workout',
    category: 'Performance',
    categoryColor: 'cyan',
    dose: 'Per product label',
    timing: '20–30 min pre-workout',
    timeGroup: 'Morning',
    sortOrder: 1,
    timing_rationale: 'Taken 20–30 min before training to allow caffeine and other actives to peak in bloodstream during the workout window.',
    benefits: [
      'Caffeine improves focus, power output, and endurance',
      'Beta-alanine buffers muscle acidity during high-intensity efforts',
      'Citrulline increases nitric oxide production and blood flow',
    ],
    mechanism: 'Caffeine antagonizes adenosine receptors, reducing perceived effort and increasing catecholamine release. Beta-alanine raises carnosine levels, buffering lactic acid accumulation.',
  },
  {
    id: 'electrolytes',
    name: 'Electrolytes',
    category: 'Hydration',
    categoryColor: 'blue',
    dose: 'Per product label',
    timing: 'Intra-workout',
    timeGroup: 'Morning',
    sortOrder: 2,
    timing_rationale: 'Electrolyte replacement during training prevents dehydration-driven performance drops and maintains nerve conduction and muscle contraction.',
    benefits: [
      'Replaces sodium, potassium, and magnesium lost through sweat',
      'Maintains plasma osmolality and muscle contraction efficiency',
      'Prevents cramping and fatigue from electrolyte depletion',
    ],
    mechanism: 'Na⁺, K⁺, and Mg²⁺ maintain the electrochemical gradients required for neuromuscular signaling. Sodium is the primary driver of fluid retention and cellular hydration during exercise.',
  },
  {
    id: 'zinc',
    name: 'Zinc',
    category: 'Micronutrient',
    categoryColor: 'orange',
    dose: 'Per label (typically 15–30mg)',
    timing: 'Evening, away from iron',
    timeGroup: 'Evening',
    sortOrder: 6,
    timing_rationale: 'Evening zinc avoids competition with iron (Ferroglobibin) for absorption at the duodenal transporter. Zinc also supports overnight testosterone synthesis.',
    benefits: [
      'Required for testosterone synthesis and reproductive function',
      'Supports immune function — zinc deficiency impairs T-cell activity',
      'Cofactor in >300 enzymes including those in DNA synthesis and protein metabolism',
      'Supports wound healing and skin integrity',
    ],
    mechanism: 'Zinc acts as a cofactor for enzymes across metabolism including RNA polymerase, alkaline phosphatase, and superoxide dismutase. It is directly involved in luteinizing hormone signaling, which drives testosterone production in Leydig cells.',
    interactions: 'Competes with iron and calcium for absorption — keep evening timing away from Ferroglobibin.',
  },
  {
    id: 'rituals-melatonin',
    name: 'Rituals Melatonin 5mg',
    category: 'Sleep',
    categoryColor: 'indigo',
    dose: '5mg',
    timing: 'Before bed — Sunday only',
    timeGroup: 'Night',
    sortOrder: 9,
    timing_rationale: 'Melatonin taken on Sunday anchors the circadian rhythm at the start of the week, helping to keep sleep timing consistent across weekdays.',
    benefits: [
      'Signals onset of sleep to the circadian system',
      'Helps anchor consistent sleep timing (circadian anchor)',
      'Reduces sleep onset latency when timed correctly',
    ],
    mechanism: 'Melatonin is produced by the pineal gland in response to darkness. Exogenous melatonin binds MT1 and MT2 receptors in the suprachiasmatic nucleus, shifting circadian phase and promoting sleep onset.',
    interactions: 'Avoid bright light after taking. May interact with blood thinners or immune-modulating medications.',
  },
  {
    id: 'sleep-restore-pm02',
    name: 'Sleep + Restore PM02',
    category: 'Sleep',
    categoryColor: 'indigo',
    dose: 'Per product label',
    timing: 'Before bed',
    timeGroup: 'Night',
    sortOrder: 8,
    timing_rationale: 'PM sleep formulas contain adaptogens and calming compounds that require ~30–60 min to take effect. Taking before bed allows the formula to be active at sleep onset. Stacks well with Magnesium Glycinate — complementary mechanisms (Mg handles receptor-level calming; PM02 handles hormonal/adaptogenic support).',
    benefits: [
      'Supports faster sleep onset and deeper sleep architecture',
      'Adaptogens reduce cortisol and support overnight hormonal recovery',
      'May improve sleep stage cycling including REM and SWS',
      'Supports next-day HRV and WHOOP recovery score',
      'Growth hormone pulses during SWS — quality sleep amplifies its effect',
    ],
    mechanism: 'PM02-style formulas commonly combine: KSM-66 ashwagandha (cortisol modulation via HPA axis), L-theanine (α-wave promotion, GABA-B agonism), and sometimes phosphatidylserine (blunts cortisol), or apigenin (GABA-A partial agonist). The combined effect reduces arousal and enhances parasympathetic dominance during sleep.',
    interactions: 'If the formula contains melatonin, avoid bright light after taking. Some adaptogens may interact with thyroid medications — check with a provider if applicable.',
  },
]

export function getCatalogEntry(supplementName: string): SupplementCatalogEntry | undefined {
  return SUPPLEMENT_CATALOG.find(
    e => e.name.toLowerCase() === supplementName.toLowerCase(),
  )
}

function inferTimeGroup(timeTaken: string): TimeGroup {
  const [h, m] = timeTaken.split(':').map(Number)
  const mins = h * 60 + (m || 0)
  if (mins >= 300 && mins < 660) return 'Morning'   // 5am–11am
  if (mins >= 660 && mins < 780) return 'Midday'    // 11am–1pm
  if (mins >= 780 && mins < 1080) return 'Afternoon' // 1pm–6pm
  if (mins >= 1080 && mins < 1320) return 'Evening'  // 6pm–10pm
  return 'Night'
}

export function groupSupplementsByTime<T extends { supplement_name: string; time_taken?: string | null }>(
  items: T[],
): { group: TimeGroup; items: T[] }[] {
  const grouped = new Map<TimeGroup, T[]>()

  for (const item of items) {
    const catalog = getCatalogEntry(item.supplement_name)
    const group: TimeGroup = catalog?.timeGroup
      ?? (item.time_taken ? inferTimeGroup(item.time_taken) : 'Night')
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group)!.push(item)
  }

  // Sort items within each group by sortOrder
  for (const [, arr] of grouped) {
    arr.sort((a, b) => {
      const aOrder = getCatalogEntry(a.supplement_name)?.sortOrder ?? 99
      const bOrder = getCatalogEntry(b.supplement_name)?.sortOrder ?? 99
      return aOrder - bOrder
    })
  }

  return TIME_GROUP_ORDER
    .filter(g => grouped.has(g))
    .map(g => ({ group: g, items: grouped.get(g)! }))
}

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-950/40', text: 'text-blue-400', border: 'border-blue-800/40' },
  cyan: { bg: 'bg-cyan-950/40', text: 'text-cyan-400', border: 'border-cyan-800/40' },
  green: { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-800/40' },
  amber: { bg: 'bg-amber-950/40', text: 'text-amber-400', border: 'border-amber-800/40' },
  orange: { bg: 'bg-orange-950/40', text: 'text-orange-400', border: 'border-orange-800/40' },
  purple: { bg: 'bg-purple-950/40', text: 'text-purple-400', border: 'border-purple-800/40' },
  indigo: { bg: 'bg-indigo-950/40', text: 'text-indigo-400', border: 'border-indigo-800/40' },
}
