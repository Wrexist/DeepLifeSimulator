# Asset Generation Prompts for DeepLifeSim

**Total Assets Needed: 34**

This document provides batch-ready prompts for AI image generation with locked style consistency.

---

## 🎨 **MASTER STYLE PRESET** (Use for ALL generations)

**Copy this into every prompt as the first line:**

```
Modern clean semi-realistic digital illustration. Soft top-down lighting. Professional cohesive color palette. Smooth reflections. Consistent rendering, same perspective, same lighting direction, same shading intensity, same brush style. Transparent background. 1024x1024. High detail but not noisy. Mobile UI friendly.
```

**Every generation prompt format:**
```
<MASTER STYLE PRESET>

<YOUR SPECIFIC PROMPT>
```

---

## 🔒 **THREE LOCKED PARAMETERS** (Add to every prompt)

To prevent style drift, add these three lines to every prompt:

```
Same lighting intensity as the reference.
Same 3/4 perspective angle.
Same level of detail, stroke weight, and shading.
```

---

## 📦 **BATCH GENERATION INSTRUCTIONS**

**DO NOT generate one-by-one. Generate in batches to lock style consistency.**

### Batch Generation Process:

1. **Generate first image** of each category as a reference
2. **Use reference image** for all subsequent images in that batch
3. **Generate entire batch** in one session
4. **Version your files** (v1, v2, final)
5. **Compress at the end** (50-70 KB per image)

---

## 🚗 **BATCH A: VEHICLES** (15 images)

### Master Style for Vehicles:
```
<MASTER STYLE PRESET>

Professional automotive illustration. 3/4 view angle. Soft top-down lighting. Clean lines. Realistic proportions. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.
```

### Generation Instructions:
**Generate all 15 vehicles in ONE batch session. Use the first generated vehicle as reference for all others.**

1. **Economy Sedan** (`economy_sedan`)
   - Prompt: `<MASTER STYLE PRESET> Modern compact sedan car, 3/4 view, clean white or silver color, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`
   - **Use as reference for all other vehicles**

2. **Compact Hatchback** (`compact_hatchback`)
   - Prompt: `<MASTER STYLE PRESET> Small modern hatchback car, 3/4 view, vibrant color (blue or red), professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

3. **Used SUV** (`used_suv`)
   - Prompt: `<MASTER STYLE PRESET> Pre-owned mid-size SUV, 3/4 view, slightly weathered appearance, dark gray or navy color, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

4. **Family SUV** (`family_suv`)
   - Prompt: `<MASTER STYLE PRESET> Modern family SUV, 3/4 view, spacious design, metallic blue or gray color, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

5. **Premium Sedan** (`sedan_premium`)
   - Prompt: `<MASTER STYLE PRESET> Luxury premium sedan, 3/4 view, elegant design, black or dark blue color, chrome accents, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

6. **Electric Vehicle** (`electric_car`)
   - Prompt: `<MASTER STYLE PRESET> Modern electric car, 3/4 view, futuristic design, white or light blue color, clean lines, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

7. **Luxury Sedan** (`luxury_sedan`)
   - Prompt: `<MASTER STYLE PRESET> High-end luxury executive sedan, 3/4 view, premium black or silver color, sophisticated design, chrome details, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

8. **Luxury SUV** (`luxury_suv`)
   - Prompt: `<MASTER STYLE PRESET> Premium luxury SUV, 3/4 view, commanding presence, black or dark gray color, elegant design, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

9. **Entry Supercar** (`supercar_entry`)
   - Prompt: `<MASTER STYLE PRESET> Entry-level supercar, 3/4 view, sporty design, bright red or yellow color, aggressive styling, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

10. **Exotic Supercar** (`exotic_supercar`)
    - Prompt: `<MASTER STYLE PRESET> Exotic Italian supercar, 3/4 view, ultra-luxury design, vibrant red or orange color, sleek aerodynamic body, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

11. **Sports Coupe** (`sports_coupe`)
    - Prompt: `<MASTER STYLE PRESET> Modern sports coupe, 3/4 view, sleek two-door design, metallic blue or silver color, performance styling, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

12. **Muscle Car** (`muscle_car`)
    - Prompt: `<MASTER STYLE PRESET> Classic American muscle car, 3/4 view, powerful V8 design, bright red or black color, aggressive stance, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

13. **Standard Motorcycle** (`standard_motorcycle`)
    - Prompt: `<MASTER STYLE PRESET> Standard commuter motorcycle, 3/4 view, practical design, black or gray color, simple styling, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

14. **Sport Motorcycle** (`sport_motorcycle`)
    - Prompt: `<MASTER STYLE PRESET> High-performance sport motorcycle, 3/4 view, racing design, bright color (red, blue, or green), aggressive styling, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

15. **Cruiser Motorcycle** (`cruiser_motorcycle`)
    - Prompt: `<MASTER STYLE PRESET> Classic cruiser motorcycle, 3/4 view, comfortable touring design, chrome details, black or dark color, professional automotive illustration, soft lighting, transparent background, modern minimalist style, realistic proportions. Match the style of reference image ID: economy_sedan. Same lighting intensity as the reference. Same 3/4 perspective angle. Same level of detail, stroke weight, and shading.`

**File Naming (with versioning):**
- `economy_sedan_v1.png` → `economy_sedan_v2.png` → `economy_sedan_final.png`
- `compact_hatchback_v1.png` → `compact_hatchback_final.png`
- (Repeat for all 15 vehicles)

---

## 🏢 **BATCH B: GARAGE UI ICONS** (3 images)

### Master Style for Garage Icons:
```
<MASTER STYLE PRESET>

Modern icon design. Isometric or flat design. Clean minimalist style. Same lighting intensity as the reference. Same perspective angle. Same level of detail, stroke weight, and shading.
```

### Generation Instructions:
**Generate all 3 icons in ONE batch session. Use the first generated icon as reference for all others.**

1. **Garage Icon** (`garage_icon`)
   - Prompt: `<MASTER STYLE PRESET> Modern garage icon, isometric or flat design, car silhouette inside, blue or gray color scheme, clean minimalist style, transparent background, 512x512px. Same lighting intensity as the reference. Same perspective angle. Same level of detail, stroke weight, and shading.`
   - **Use as reference for other garage icons**

2. **Dealership Icon** (`dealership_icon`)
   - Prompt: `<MASTER STYLE PRESET> Car dealership icon, modern showroom design, car display, professional blue or gold color scheme, clean minimalist style, transparent background, 512x512px. Match the style of reference image ID: garage_icon. Same lighting intensity as the reference. Same perspective angle. Same level of detail, stroke weight, and shading.`

3. **Insurance Icon** (`insurance_icon`)
   - Prompt: `<MASTER STYLE PRESET> Vehicle insurance icon, shield with car silhouette, professional blue or green color scheme, clean minimalist style, transparent background, 512x512px. Match the style of reference image ID: garage_icon. Same lighting intensity as the reference. Same perspective angle. Same level of detail, stroke weight, and shading.`

**File Naming (with versioning):**
- `garage_icon_v1.png` → `garage_icon_final.png`
- `dealership_icon_v1.png` → `dealership_icon_final.png`
- `insurance_icon_v1.png` → `insurance_icon_final.png`

---

## 📖 **BATCH C: SCENARIOS** (5 images)

### Master Style for Scenarios:
```
<MASTER STYLE PRESET>

Cinematic illustration. Story-driven composition. Emotional depth. Warm, hopeful color grading. Dramatic but not dark lighting. Same lighting intensity as the reference. Same cinematic composition style. Same level of detail, stroke weight, and shading.
```

### Generation Instructions:
**Generate all 5 scenarios in ONE batch session. Use the first generated scenario as reference for all others.**

1. **Rags to Riches** (`rags_to_riches`)
   - Prompt: `<MASTER STYLE PRESET> Cinematic illustration of a person starting from nothing, standing in front of a dilapidated building or empty street, determined expression, warm sunrise lighting, hopeful atmosphere, story-driven composition, modern illustration style, 1024x1024px. Same lighting intensity as the reference. Same cinematic composition style. Same level of detail, stroke weight, and shading.`
   - **Use as reference for all other scenarios**

2. **Trust Fund Baby** (`trust_fund_baby`)
   - Prompt: `<MASTER STYLE PRESET> Cinematic illustration of a young person surrounded by luxury items (money, gold, expensive objects), confident expression, golden hour lighting, opulent atmosphere, story-driven composition, modern illustration style, 1024x1024px. Match the style of reference image ID: rags_to_riches. Same lighting intensity as the reference. Same cinematic composition style. Same level of detail, stroke weight, and shading.`

3. **Immigrant Story** (`immigrant_story`)
   - Prompt: `<MASTER STYLE PRESET> Cinematic illustration of a person with luggage at an airport or new city, hopeful but uncertain expression, bright daylight lighting, new beginning atmosphere, story-driven composition, modern illustration style, 1024x1024px. Match the style of reference image ID: rags_to_riches. Same lighting intensity as the reference. Same cinematic composition style. Same level of detail, stroke weight, and shading.`

4. **Single Parent** (`single_parent`)
   - Prompt: `<MASTER STYLE PRESET> Cinematic illustration of a parent with two children, balancing responsibilities, warm family lighting, loving but challenging atmosphere, story-driven composition, modern illustration style, 1024x1024px. Match the style of reference image ID: rags_to_riches. Same lighting intensity as the reference. Same cinematic composition style. Same level of detail, stroke weight, and shading.`

5. **Second Chance** (`second_chance`)
   - Prompt: `<MASTER STYLE PRESET> Cinematic illustration of a person at a crossroads or starting fresh, determined expression, dramatic but hopeful lighting, redemption atmosphere, story-driven composition, modern illustration style, 1024x1024px. Match the style of reference image ID: rags_to_riches. Same lighting intensity as the reference. Same cinematic composition style. Same level of detail, stroke weight, and shading.`

**File Naming (with versioning):**
- `Rags to Riches_v1.png` → `Rags to Riches_final.png`
- `Trust Fund Baby_v1.png` → `Trust Fund Baby_final.png`
- `Immigrant Story_v1.png` → `Immigrant Story_final.png`
- `Single Parent_v1.png` → `Single Parent_final.png`
- `Second Chance_v1.png` → `Second Chance_final.png`

---

## 🧠 **BATCH D: MINDSET SYMBOLS** (11 images)

### Master Style for Mindsets:
```
<MASTER STYLE PRESET>

Abstract concept illustration. Symbolic representation. Clean modern design. Psychological concept style. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.
```

### Generation Instructions:
**Generate all 11 mindsets in ONE batch session. Use the first generated mindset as reference for all others.**

1. **Frugal** (`frugal`)
   - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing frugality, money-saving concept, coins or piggy bank, green and gold color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`
   - **Use as reference for all other mindsets**

2. **Workaholic** (`workaholic`)
   - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing workaholic, briefcase or clock with work symbols, blue and gray color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Match the style of reference image ID: frugal. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`

3. **Socialite** (`socialite`)
   - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing socialite, party or social gathering symbols, vibrant pink and purple color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Match the style of reference image ID: frugal. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`

4. **Optimist** (`optimist`)
   - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing optimism, sun or bright light symbols, warm yellow and orange color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Match the style of reference image ID: frugal. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`

5. **Perfectionist** (`perfectionist`)
   - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing perfectionism, stars or precise geometric shapes, purple and silver color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Match the style of reference image ID: frugal. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`

6. **Adventurous** (`adventurous`)
   - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing adventurous spirit, globe or compass symbols, teal and blue color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Match the style of reference image ID: frugal. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`

7. **Gambler** (`gambler`)
   - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing gambling, dice or risk symbols, red and gold color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Match the style of reference image ID: frugal. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`

8. **Risk Averse** (`riskAverse`)
   - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing risk aversion, shield or protection symbols, blue and silver color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Match the style of reference image ID: frugal. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`

9. **Investor** (`investor`)
   - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing investing, upward trending graph or growth symbols, green and blue color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Match the style of reference image ID: frugal. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`

10. **Big Spender** (`spender`)
    - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing big spending, shopping bag or money symbols, pink and gold color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Match the style of reference image ID: frugal. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`

11. **Hustler** (`hustler`)
    - Prompt: `<MASTER STYLE PRESET> Abstract illustration representing hustler mindset, strength or energy symbols, orange and red color scheme, clean modern design, symbolic representation, transparent background, 512x512px. Match the style of reference image ID: frugal. Same lighting intensity as the reference. Same abstract visual language. Same level of detail, stroke weight, and shading.`

**File Naming (with versioning):**
- `Frugal_v1.png` → `Frugal_final.png`
- `Workaholic_v1.png` → `Workaholic_final.png`
- (Repeat for all 11 mindsets)

---

## 📋 **GENERATION WORKFLOW**

### Step 1: Generate Reference Images
1. Generate **first image** of each batch (economy_sedan, garage_icon, rags_to_riches, frugal)
2. Review and approve these as style references
3. Save as `[name]_reference.png`

### Step 2: Batch Generation
1. **Batch A**: Generate all 15 vehicles in one session using economy_sedan as reference
2. **Batch B**: Generate all 3 garage icons in one session using garage_icon as reference
3. **Batch C**: Generate all 5 scenarios in one session using rags_to_riches as reference
4. **Batch D**: Generate all 11 mindsets in one session using frugal as reference

### Step 3: Versioning
- Save initial versions as `[name]_v1.png`
- If revisions needed, save as `[name]_v2.png`, `[name]_v3.png`, etc.
- Final approved version: `[name]_final.png`

### Step 4: Compression
**After all 34 assets are finalized:**
1. Use **TinyPNG** or **ImageOptim**
2. Compress all `*_final.png` files
3. Target: **50-70 KB per image**
4. Verify quality is maintained
5. Replace final files with compressed versions

---

## 📁 **FINAL FILE STRUCTURE**

### Vehicles (15 files):
```
assets/images/Vehicles/
  ├── economy_sedan_final.png
  ├── compact_hatchback_final.png
  ├── used_suv_final.png
  ├── family_suv_final.png
  ├── premium_sedan_final.png
  ├── electric_car_final.png *No electric car yet image yet*
  ├── luxury_sedan_final.png
  ├── luxury_suv_final.png
  ├── supercar_entry_final.png
  ├── exotic_supercar_final.png
  ├── sports_coupe_final.png
  ├── muscle_car_final.png
  ├── standard_motorcycle_final.png
  ├── sport_motorcycle_final.png
  └── cruiser_motorcycle_final.png
```

### Garage UI (3 files):
```
assets/images/Vehicles/
  ├── garage_icon_final.png
  ├── dealership_icon_final.png
  └── insurance_icon_final.png
```

### Scenarios (5 files):
```
assets/images/Scenarios/
  ├── Rags to Riches_final.png
  ├── Trust Fund Baby_final.png
  ├── Immigrant Story_final.png
  ├── Single Parent_final.png
  └── Second Chance_final.png
```

### Mindsets (11 files):
```
assets/images/Mindsets/
  ├── Frugal_final.png
  ├── Workaholic_final.png
  ├── Socialite_final.png
  ├── Optimist_final.png
  ├── Perfectionist_final.png
  ├── Adventurous_final.png *finns inte än*
  ├── Gambler_final.png
  ├── Risk Averse_final.png
  ├── Investor_final.png
  ├── Big Spender_final.png
  └── Hustler_final.png
```

---

## ✅ **GENERATION CHECKLIST**

### Batch A: Vehicles (15 images)
- [ ] Economy Sedan (reference)
- [ ] Compact Hatchback
- [ ] Used SUV
- [ ] Family SUV
- [ ] Premium Sedan
- [ ] Electric Vehicle
- [ ] Luxury Sedan
- [ ] Luxury SUV
- [ ] Entry Supercar
- [ ] Exotic Supercar
- [ ] Sports Coupe
- [ ] Muscle Car
- [ ] Standard Motorcycle
- [ ] Sport Motorcycle
- [ ] Cruiser Motorcycle

### Batch B: Garage UI (3 icons)
- [ ] Garage Icon (reference)
- [ ] Dealership Icon
- [ ] Insurance Icon

### Batch C: Scenarios (5 images)
- [ ] Rags to Riches (reference)
- [ ] Trust Fund Baby
- [ ] Immigrant Story
- [ ] Single Parent
- [ ] Second Chance

### Batch D: Mindsets (11 images)
- [ ] Frugal (reference)
- [ ] Workaholic
- [ ] Socialite
- [ ] Optimist
- [ ] Perfectionist
- [ ] Adventurous
- [ ] Gambler
- [ ] Risk Averse
- [ ] Investor
- [ ] Big Spender
- [ ] Hustler

### Post-Generation
- [ ] All assets versioned (v1, v2, final)
- [ ] All assets compressed (50-70 KB each)
- [ ] Quality verified
- [ ] Files placed in correct directories
- [ ] Code updated to use new assets

**Total: 34 assets**

---

## 🔧 **INTEGRATION NOTES**

After generating and compressing all assets:

1. **Place files in correct directories:**
   - Vehicles → `assets/images/Vehicles/`
   - Scenarios → `assets/images/Scenarios/`
   - Mindsets → `assets/images/Mindsets/` (create folder if needed)

2. **Update code references:**
   - Replace emoji icons with image paths in `lib/vehicles/vehicles.ts`
   - Replace emoji icons with image paths in `lib/scenarios/scenarioDefinitions.ts`
   - Replace emoji icons with image paths in `lib/mindset/config.ts`
   - Update `components/computer/VehicleApp.tsx` to use vehicle images
   - Update `app/(onboarding)/Scenarios.tsx` to use scenario images
   - Update `app/(onboarding)/Perks.tsx` to use mindset images

3. **Verify mobile performance:**
   - All images should be 50-70 KB after compression
   - Test loading times in React Native
   - Ensure transparent backgrounds work on both light/dark themes

---

## 💡 **TIPS FOR BEST RESULTS**

1. **Generate in batches** - Don't generate one-by-one to avoid style drift
2. **Use reference images** - Always reference the first image of each batch
3. **Lock parameters** - Always include the three locked parameters
4. **Version everything** - Keep v1, v2, final versions until you're sure
5. **Compress last** - Only compress after all assets are finalized
6. **Test on device** - Verify images look good on actual mobile screens

---

## 📝 **QUICK REFERENCE: MASTER STYLE PRESET**

Copy this for every prompt:

```
Modern clean semi-realistic digital illustration. Soft top-down lighting. Professional cohesive color palette. Smooth reflections. Consistent rendering, same perspective, same lighting direction, same shading intensity, same brush style. Transparent background. 1024x1024. High detail but not noisy. Mobile UI friendly.
```
