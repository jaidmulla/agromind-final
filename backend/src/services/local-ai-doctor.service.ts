// ChatGPT-like AI Doctor - Conversational farming assistant
// Provides intelligent responses to any farming-related question

interface UserContext {
  name?: string;
  location?: string;
  farm_size?: string | number;
  crops?: string[];
  alerts?: string[];
}

interface AIResponse {
  message: string;
  suggestions?: string[];
}

// Comprehensive farming knowledge base
const FARMING_KB = {
  diseases: {
    'early blight': {
      symptoms: 'Brown/black circular spots (3-15mm) with concentric rings (target-like) on lower leaves first, yellow halo around spots, leaves yellow and drop',
      causes: 'Fungus Alternaria solani, spreads in wet conditions (humidity >60%), warm 25-28°C, water splash',
      prevention: 'Use resistant varieties (Arka Vikas, Arka Ashish), remove lower leaves, improve air circulation, stake plants',
      treatment_products: [
        { name: 'Mancozeb 75% WP', price: '₹350/500g', dosage: '2.5kg per 500L water (0.5%)', effectiveness: '85-90%' },
        { name: 'Chlorothalonil 75% WP', price: '₹400/500g', dosage: '2kg per 500L water (0.4%)', effectiveness: '88-92%' },
        { name: 'Carbendazim 50% WP', price: '₹280/500g', dosage: '1kg per 500L water (0.2%)', effectiveness: '80-85%' },
        { name: 'Copper Oxychloride 50% WP', price: '₹320/500g', dosage: '2.5kg per 500L water (0.5%)', effectiveness: '75-82%' }
      ],
      schedule: '7-10 days interval, start when plants are 30cm tall, 4-6 sprays during season',
      cost_per_acre: '₹2,500-3,500 (including spraying labor)',
      urgency: 'MODERATE-HIGH - Spreads quickly once started',
      yield_impact: 'Without treatment: 40-50% loss | With treatment: Save 85-90%',
      action_plan: `
**WEEK-BY-WEEK TREATMENT PLAN:**
Week 1: Scout field, remove lower leaves, apply Mancozeb 5kg
Week 2: Monitor, spray again at 7 days
Week 3: If rain, spray Chlorothalonil 5kg
Week 4-8: Spray every 7-10 days as per rain/humidity
Week 9+: Continue until harvest if needed
`
    },
    'late blight': {
      symptoms: 'Water-soaked spots on leaves (irregular shape), white fungal growth on leaf undersides, stem blackening, soft rot in fruits/tubers',
      causes: 'Fungus Phytophthora infestans, spreads in cool, wet conditions (15-25°C), critical in July-August monsoon',
      prevention: 'Use resistant varieties, improve air circulation, avoid overhead irrigation, crop rotation 2+ years gap',
      treatment_products: [
        { name: 'Mancozeb 75% WP', price: '₹350/500g', dosage: '2.5kg per 500L water', effectiveness: '80-85%' },
        { name: 'Metalaxyl 8% + Mancozeb 64% WP', price: '₹600/250g', dosage: '2kg per 500L water', effectiveness: '90-95%' },
        { name: 'Cymoxanil 8% + Mancozeb 64% WP', price: '₹650/250g', dosage: '2.5kg per 500L water', effectiveness: '92-96%' }
      ],
      schedule: '5-7 days during monsoon, 2-3 sprays before monsoon starts as prevention',
      cost_per_acre: '₹4,000-5,500',
      urgency: 'CRITICAL - Can destroy entire crop within 3-5 days',
      yield_impact: 'Without treatment: 90%+ loss | With treatment: Save 80-90%',
      action_plan: `
**MONSOON CRITICAL PROTOCOL:**
1. Spray prophylactically BEFORE monsoon (May end)
2. Scout field DAILY for first spots
3. First sign = Spray TODAY, repeat in 5 days
4. Heavy rain = Spray immediately after (24-48 hours)
5. Continue 5-7 day intervals through September
`
    },
    'powdery mildew': {
      symptoms: 'White powder coating on leaves, stems, flowers (fungal spores). Leaves curl, shrivel, and drop. Reduced photosynthesis',
      causes: 'Fungal infection (various Erysiphe spp), high humidity (60-90%), warm days 20-28°C with cool nights',
      prevention: 'Improve plant spacing, ensure good drainage, avoid nitrogen excess, prune lower branches',
      treatment_products: [
        { name: 'Sulfur 80% WP', price: '₹180/kg', dosage: '2.5kg per 500L water (0.5%)', effectiveness: '85-92%' },
        { name: 'Potassium Bicarbonate 85% WP', price: '₹550/500g', dosage: '2.5kg per 500L water', effectiveness: '88-94%' },
        { name: 'Hexaconazole 5% SC', price: '₹420/1L', dosage: '500ml per 500L water', effectiveness: '90-95%' },
        { name: 'Propiconazole 25% EC', price: '₹380/500ml', dosage: '250ml per 500L water', effectiveness: '88-93%' }
      ],
      schedule: '10-14 days interval, early morning or evening spray, start when first leaves appear',
      cost_per_acre: '₹1,500-2,500',
      urgency: 'MODERATE - Usually manageable with early intervention',
      yield_impact: 'Without treatment: 20-30% yield loss | With treatment: Save 85-90%',
      action_plan: `
**PREVENTIVE + CURATIVE APPROACH:**
Week 1-4: Weekly sulfur spray as prevention
Week 5+: If white powder found = Switch to Hexaconazole/Propiconazole
Spray every 10 days until harvest
Avoid spraying at peak heat (>30°C)
Evening spray better than morning
`
    },
    'leaf spot': {
      symptoms: 'Brown/black circular spots with concentric rings, spots merge causing large yellow areas, leaf yellowing and dropping',
      causes: 'Various fungi (Septoria, Cercospora, Alternaria), high moisture, overhead irrigation, poor drainage',
      prevention: 'Remove infected leaves, improve drainage, rotate crops 2 years, avoid overhead irrigation at base',
      treatment_products: [
        { name: 'Copper Oxychloride 50% WP', price: '₹320/500g', dosage: '2.5kg per 500L water', effectiveness: '80-88%' },
        { name: 'Mancozeb 75% WP', price: '₹350/500g', dosage: '2.5kg per 500L water', effectiveness: '82-90%' },
        { name: 'Chlorothalonil 75% WP', price: '₹400/500g', dosage: '2kg per 500L water', effectiveness: '85-92%' }
      ],
      schedule: '10-14 days interval, start 30-45 days after planting, 3-4 sprays',
      cost_per_acre: '₹2,000-3,000',
      urgency: 'MODERATE',
      yield_impact: 'Without treatment: 25-35% loss | With treatment: Save 80-85%',
      action_plan: `
**EARLY IDENTIFICATION STRATEGY:**
1. Check lower leaves weekly
2. Remove spotted leaves immediately (burn them)
3. Improve air circulation (trim lower branches)
4. First spot found = Start spray cycle
5. Spray every 10-12 days
`
    },
    'stem rot': {
      symptoms: 'Soft, watery decay starting from soil level, black discoloration spreading upward, plant wilts and collapses despite wet soil',
      causes: 'Sclerotium rolfsii fungus, warm soil (25-35°C), poor drainage, high soil moisture',
      prevention: 'Good drainage, crop rotation (3+ year gap), avoid overhead irrigation at base, mulch to prevent soil contact',
      treatment_products: [
        { name: 'Trichoderma (Powder)', price: '₹200/kg', dosage: '10kg per acre into soil', effectiveness: '60-75%' },
        { name: 'Mancozeb 75% WP', price: '₹350/500g', dosage: '2.5kg per 500L water', effectiveness: '70-80%' },
        { name: 'Carbendazim 50% WP', price: '₹280/500g', dosage: '1kg per 500L water + drench soil', effectiveness: '75-85%' }
      ],
      schedule: 'Trichoderma at planting, Mancozeb drench immediately when found, repeat every 5 days',
      cost_per_acre: '₹3,000-4,500',
      urgency: 'CRITICAL - Highly contagious, no cure once advanced',
      yield_impact: 'Without treatment: Plant dies | With early action: Save 40-60% of plants',
      action_plan: `
**URGENT DAMAGE CONTROL (Once Found):**
Step 1: Remove affected plant immediately (dig 15cm around it)
Step 2: Burn/destroy the plant (don't compost)
Step 3: Soil drench with Carbendazim + Trichoderma
Step 4: Improve drainage (remove water standing)
Step 5: Scout daily for new cases
Step 6: Alternate crop (avoid nightshades for 3 years)

**Prevention for Next Season:**
- Trichoderma treatment at planting
- Perfect drainage
- Resistant varieties
- Never plant in same field <3 years
`
    },
    'rust': {
      symptoms: 'Orange/brown powdery pustules on leaf undersides, yellow spots on upper surface, leaves drop early',
      causes: 'Rust fungi (Uromyces, Puccinia), high humidity, moderate temperature 15-25°C',
      prevention: 'Use resistant varieties, improve air circulation, regular scouting, remove crop debris',
      treatment_products: [
        { name: 'Hexaconazole 5% SC', price: '₹420/1L', dosage: '500ml per 500L water', effectiveness: '88-94%' },
        { name: 'Propiconazole 25% EC', price: '₹380/500ml', dosage: '250ml per 500L water', effectiveness: '85-92%' },
        { name: 'Sulfur 80% WP', price: '₹180/kg', dosage: '2.5kg per 500L water', effectiveness: '80-88%' }
      ],
      schedule: '10-14 days interval, start prevention sprays in July, continue through October',
      cost_per_acre: '₹2,000-3,000',
      urgency: 'MODERATE',
      yield_impact: 'Without treatment: 15-25% loss | With treatment: Save 85-90%',
      action_plan: `
**EARLY SEASON PREVENTION:**
Week 1-4: Weekly Hexaconazole spray from July
Week 5+: Scout leaves undersides 3x/week
If rust found = Continue strict 10-day spray schedule
Continue through harvest
`
    }
  },
  
  pests: {
    'aphids': {
      description: 'Small soft-bodied insects, green or brown, cluster on new growth',
      damage: 'Suck plant juices, cause leaf curling and yellowing, transmit viruses',
      organic_control: 'Neem oil 3% (5L per 500L water), Insecticidal soap, strong water spray',
      chemical_control: 'Dimethoate 0.03%, Imidacloprid 0.005%, Acetamiprid 0.02%',
      cost: '₹400-800 per acre',
      severity: 'MODERATE'
    },
    'spider mites': {
      description: 'Tiny reddish spiders, visible webbing on leaves',
      damage: 'Suck leaf sap causing bronze/yellow spots, severe defoliation',
      organic_control: 'Neem oil, Sulfur dust 2.5kg per 500L water',
      chemical_control: 'Dicofol 0.05%, Hexathiazox 0.01%',
      cost: '₹500-1000 per acre',
      severity: 'MODERATE'
    },
    'mealybugs': {
      description: 'Soft-bodied insects covered in white waxy powder',
      damage: 'Suck sap, secrete honeydew causing sooty mold',
      organic_control: '80% Neem oil, Carbaryl 0.1%',
      chemical_control: 'Acetamiprid 0.02%, Imidacloprid 0.005%',
      cost: '₹600-1200 per acre',
      severity: 'MODERATE'
    },
    'caterpillars': {
      description: 'Crawling larvae, green or brown, visible feeding damage',
      damage: 'Eat leaves causing holes, skeletonization, reduced photosynthesis',
      organic_control: 'Bacillus thuringiensis (BT spray), Spinosad',
      chemical_control: 'Endosulfan 35% EC, Chlorpyrifos 20% EC',
      cost: '₹400-900 per acre',
      severity: 'MODERATE-HIGH'
    },
    'whiteflies': {
      description: 'Tiny white flying insects, found on leaf undersides',
      damage: 'Suck sap, transmit viruses, cause yellowing',
      organic_control: 'Neem oil, Yellow sticky traps',
      chemical_control: 'Imidacloprid 17.8% SL, Buprofezin 25% SC',
      cost: '₹500-1000 per acre',
      severity: 'MODERATE'
    }
  },

  fertilizers: {
    'tomato': ['NPK 19:19:19 at planting - 500kg per acre', 'Top dress with Urea 40-50kg at flowering', 'Potassium-rich fertilizer 40-50kg for fruit quality', 'Micronutrients: Zinc 25kg, Boron 10kg per acre', 'Estimated cost: ₹10,000-15,000 per acre'],
    'potato': ['Well-composted FYM - 10-15 tonnes per acre', 'NPK 10:26:26 at planting - 400-500kg per acre', 'Top dress Urea 50kg at earthing-up', 'Avoid excess Nitrogen to prevent diseases', 'Estimated cost: ₹8,000-12,000 per acre'],
    'wheat': ['Basal dressing: NPK 10:26:26 - 250kg per acre', 'Top dress Urea 40kg at tillering', 'Apply Urea 40kg at boot stage', 'Trace elements: Zinc 25kg, Boron 10kg per acre', 'Estimated cost: ₹7,000-10,000 per acre'],
    'rice': ['Well-composted FYM - 8-10 tonnes per acre', 'NPK 40:20:20 as basal dose', 'Urea 40kg at tillering', 'Urea 40kg at boot stage', 'Estimated cost: ₹9,000-13,000 per acre'],
    'cotton': ['FYM 5-10 tonnes per acre + Neem cake 500kg', 'NPK 40:20:20 at planting', 'Top dress Urea 50kg at flowering', 'Potassium 40kg at fruiting stage', 'Estimated cost: ₹12,000-18,000 per acre']
  },

  irrigation: {
    'drip': { description: 'Water directly to plant root zone', water_savings: '40-60%', cost: '₹90,000-1,20,000 per acre', subsidy: '50-90% available', best_for: 'Tomato, Chili, Vegetables, Sugarcane', roi_years: '2-3 years' },
    'sprinkler': { description: 'Water distributed like rain from overhead', water_savings: '25-40%', cost: '₹60,000-80,000 per acre', subsidy: '40-70% available', best_for: 'Wheat, Maize, Pulses', roi_years: '3-4 years' },
    'flood': { description: 'Traditional flooding method', water_savings: 'Low', cost: 'Low if using well', subsidy: 'None', best_for: 'Paddy, Sugarcane', roi_years: 'N/A' }
  },

  government_schemes: {
    'PM-KISAN': { amount: '₹6,000 per year',  documents: 'Aadhaar, Land records, Bank account', processing: '15-30 days' },
    'Fasal Bima': { amount: '₹35,000-70,000 per acre', documents: 'Land records, Crop name', processing: '2-3 months for claims' },
    'KCC': { amount: 'Up to ₹3,00,000', interest: '4% per annum', processing: '15 days' },
    'PMKSY': { amount: '50-90% subsidy for drip/sprinkler', documents: 'Land records, Design approval', processing: '1-2 months' }
  }
};

function generateContextualResponse(message: string, context: UserContext, language: 'en' | 'hi' | 'mr' = 'en'): string {
  const msg = message.toLowerCase();
  const cropContext = context.crops?.[0] || (language === 'hi' ? 'आपकी फसल' : language === 'mr' ? 'तुमचे पीक' : 'your crop');
  const locationContext = context.location || (language === 'hi' ? 'आपके क्षेत्र' : language === 'mr' ? 'तुमच्या क्षेत्र' : 'your region');
  const farmerName = context.name || (language === 'hi' ? 'किसान' : language === 'mr' ? 'शेतकरी' : 'Farmer');
  
  // Helper function to translate key headings
  const t = (en: string, hi: string, mr: string): string => {
    if (language === 'hi') return hi;
    if (language === 'mr') return mr;
    return en;
  };
  
  // PRIORITY 1: Insurance & Loss Prevention (check FIRST)
  if (msg.includes('loss') || msg.includes('insurance') || msg.includes('fasal bima') || msg.includes('protect') || msg.includes('damage') ||
      msg.includes('नुकसान') || msg.includes('बीमा') || msg.includes('सुरक्षा') || msg.includes('रक्षा') ||
      msg.includes('नुकसान') || msg.includes('विमा') || msg.includes('सुरक्षण') || msg.includes('संरक्षण')) {
    if (language === 'hi') {
      return `
🛡️ **फसल सुरक्षा और बीमा रणनीति**

**महत्वपूर्ण आंकड़े:**
- बिना उपचार की बीमारी: ₹50,000-1,00,000 नुकसान प्रति एकड़
- जल्दी पहचान + उपचार: ₹80,000-90,000 बचाएं
- बीमा सुरक्षा: ₹35,000-70,000 प्रति एकड़ क्लेम

**3 सुरक्षा स्तंभ:**

**1. जल्दी पहचान (रोकथाम = 80% समाधान)**
- हफ्ते में 3 बार खेत की जांच करें
- देखें: काले धब्बे, मुरझाना, पीलापन, कीट के समूह
- AgroMind AI Scan से तुरंत बीमारी की पहचान करें

**2. तेजी से कार्रवाई (6-12 घंटे में कार्य करें)**
- पहले संकेत पर: तुरंत खेत की जांच करें
- 10% प्रभावित: आज ही स्प्रे करें
- 30%+ प्रभावित: गंभीर - तुरंत उपचार करें
- उपचार की लागत: ₹1,000-2,000 प्रति एकड़
- बिना उपचार का नुकसान: ₹50,000+ प्रति एकड़

**3. बीमा सुरक्षा**
- प्रधानमंत्री फसल बीमा योजना में नामांकन करें
- प्रीमियम: ₹1,500-5,000 प्रति एकड़ (आप 50% भुगतान करें, सरकार 50% भुगतान करे)
- कवरेज: ₹35,000-70,000 यदि फसल विफल हो
- कवर करता है: प्राकृतिक आपदा, बीमारी, कीट, मौसम नुकसान
- फसल नुकसान के 10 दिन में दावा दाखिल करें

**लागत-लाभ विश्लेषण:**
- रोकथाम निवेश: ₹6,000-11,000/एकड़/साल
- बीमा प्रीमियम: ₹2,500-5,000/एकड़ (50% सरकारी सब्सिडी)
- सुरक्षित मूल्य: ₹50,000-1,00,000 फसल
- **लाभ: रोकथाम में तोड़, रोकथाम पर ₹20,000-80,000+ रिटर्न!**

**बीमा का दावा कैसे करें:**
1. नुकसान के 10 दिन में बीमा को सूचित करें
2. तस्वीरें + नुकसान का दस्तावेज प्रदान करें
3. अनुमोदित सर्वेक्षक फसल का मूल्यांकन करेंगे
4. अनुमोदन के 2-3 महीने में भुगतान

रोकथाम ₹10,000 खर्च करता है और ₹50,000+ बचाता है - यह स्मार्ट निवेश है!`;
    } else if (language === 'mr') {
      return `
🛡️ **पीक संरक्षण आणि विमा रणनीति**

**महत्वपूर्ण आंकडे:**
- अनुपचारित आजार: ₹50,000-1,00,000 नुकसान प्रति एकर
- लवकर शोध + उपचार: ₹80,000-90,000 वाचवा
- विमा संरक्षण: ₹35,000-70,000 प्रति एकर दावा

**3 संरक्षण स्तंभ:**

**1. लवकर शोध (प्रतिबंध = 80% उपाय)**
- आठवड्यांत 3 वेळा शेत तपासा
- पहा: काळे डाग, मुरझणे, पिवळेपणा, कीटांचे समूह
- AgroMind AI Scan वरून तुरंत आजार ओळखा

**2. वेगाने कारवाई (6-12 तासात करा)**
- पहिल्या चिन्हावर: तुरंत शेत तपासा
- 10% प्रभावित: आज स्प्रे करा
- 30%+ प्रभावित: गंभीर - तुरंत उपचार करा
- उपचाराची किंमत: ₹1,000-2,000 प्रति एकर
- अनुपचारित नुकसान: ₹50,000+ प्रति एकर

**3. विमा संरक्षण**
- प्रधानमंत्री फसल विमा योजनेत नोंदणी करा
- प्रिमियम: ₹1,500-5,000 प्रति एकर (तुम्ही 50%, सरकार 50%)
- कव्हरेज: ₹35,000-70,000 जर पीक अयशस्वी होईल
- कव्हर करते: नैसर्गिक आपत्ती, आजार, कीटक, हवामान नुकसान
- पीक नुकसानानंतर 10 दिवसांत दावा दाखल करा

**खर्च-लाभ विश्लेषण:**
- प्रतिबंध गुंतवणूक: ₹6,000-11,000/एकर/वर्ष
- विमा प्रिमियम: ₹2,500-5,000/एकर (50% सरकारी अनुदान)
- संरक्षित मूल्य: ₹50,000-1,00,000 पीक
- **लाभ: प्रतिबंधावर ₹20,000-80,000+ परतावा!**

**विमा दावा कसा करा:**
1. नुकसानानंतर 10 दिवसांत विमाकर्त्यांना सूचित करा
2. फोटो + नुकसानाची कागदपत्रे द्या
3. मंजूर सर्वेक्षक पीकाचा मूल्यांकन करतील
4. मंजूरीनंतर 2-3 महिन्यात पेमेंट

प्रतिबंध ₹10,000 खर्च करते आणि ₹50,000+ वाचवते - हा स्मार्ट गुंतवणूक आहे!`;
    }
    
    // Default English
    return `
🛡️ **LOSS PREVENTION & INSURANCE STRATEGY**

**REAL NUMBERS THAT MATTER:**
- Untreated disease: ₹50,000-1,00,000 loss per acre
- Early detection + treatment: Save ₹80,000-90,000
- Insurance protection: ₹35,000-70,000 per acre claim

**3 PILLARS OF PROTECTION:**

**1. EARLY DETECTION (Prevention = 80% of solution)**
- Scout fields 3 times per week
- Check for: Spots, wilting, yellowing, pest clusters
- Use AgroMind AI Scan for instant disease detection

**2. QUICK ACTION (Must act within 6-12 hours)**
- At first sign □ Scout field immediately
- At 10% affected → Spray today
- At 30%+ affected → CRITICAL - spray immediately
- Treatment cost: ₹1,000-2,000 per acre
- Loss if untreated: ₹50,000+ per acre

**3. INSURANCE PROTECTION**
- Enroll in Pradhan Mantri Fasal Bima Yojana
- Premium: ₹1,500-5,000 per acre (you pay 50%, govt pays 50%)
- Coverage: ₹35,000-70,000 if crop fails
- Covers: Natural disasters, disease, pests , weather damage
- Claim within 10 days of crop loss (provide photos)

**COST-BENEFIT ANALYSIS:**
- Prevention investment: ₹6,000-11,000/acre/year
- Insurance premium: ₹2,500-5,000/acre (50% subsidy)
- Protected value: ₹50,000-1,00,000 crop
- **Benefit: Break even on prevention, ₹20,000-80,000+ return if loss prevented!**

**HOW TO CLAIM INSURANCE:**
1. Notify insurance within 10 days of loss
2. Provide photos + documentation of damage
3. Approved surveyors will assess crop
4. Payment within 2-3 months of approval

Prevention costs ₹10,000 and saves ₹50,000+ - that's the smart investment!`;
  }
  
  // PRIORITY 2: Government Schemes (high value)
  else if (msg.includes('scheme') || msg.includes('subsidy') || msg.includes('loan') || msg.includes('government') || msg.includes('pm-kisan') || msg.includes('kcc') ||
           msg.includes('योजना') || msg.includes('अनुदान') || msg.includes('कर्ज') || msg.includes('सरकार') ||
           msg.includes('योजना') || msg.includes('अनुदान') || msg.includes('कर्ज') || msg.includes('सरकार')) {
    if (language === 'hi') {
      return `
💰 **सरकारी किसान योजनाएं - आपके लिए ₹3+ लाख!**

**4 महत्वपूर्ण योजनाएं:**

**1️⃣ प्रधानमंत्री किसान सम्मान निधि (PM-KISAN)**
- राशि: ₹6,000/साल (₹2,000 हर 4 महीने)
- कौन: सभी जमीन वाले किसान
- आवेदन: pmkisan.gov.in या तहसील में
- समय: 15-30 दिन स्वीकृति

**2️⃣ फसल बीमा योजना (Fasal Bima)**
- प्रीमियम: ₹1,500-5,000/एकड़ (50% सरकार भरे)
- दावा: ₹35,000-70,000 प्रति एकड़
- आवेदन: फसल नुकसान के 10 दिन में
- समय: 2-3 महीने में भुगतान

**3️⃣ किसान क्रेडिट कार्ड (KCC)**
- कर्ज: ₹3,00,000 तक
- ब्याज दर: 4% प्रति साल (सरकार 3% सब्सिडी दे)
- समय: 15 दिन स्वीकृति
- आवेदन: अपने नजदीकी बैंक में

**4️⃣ कृषि सिंचन योजना (PMKSY)**
- सब्सिडी: 50-90% ड्रिप/स्प्रिंकलर के लिए
- कीमत: ₹90,000-1,20,000 (आप केवल ₹10,000-60,000 दें!)
- भुगतान: बाकी KCC से 4% ब्याज पर
- समय: 1-2 महीने स्वीकृति

**5 एकड़ किसान के लिए कुल लाभ (1 साल में):**
- PM-KISAN: ₹6,000
- बीमा सब्सिडी: ₹12,500
- ड्रिप सब्सिडी: ₹3,00,000 (एकबारी!)
- **कुल: ₹3+ LAKHS सरकारी सहायता!**

**आवश्यक दस्तावेज:**
✓ आधार कार्ड
✓ जमीन के कागज (7/12)
✓ बैंक खाता विवरण
✓ खेत की तस्वीरें

**अभी आवेदन करें - पड़ाव दर पड़ाव:**
1. दस्तावेज तैयार करें (सब कुछ एक जगह रखें)
2. बैंक जाएं KCC + बीमा के लिए
3. जिला कृषि कार्यालय जाएं ड्रिप सब्सिडी के लिए
4. pmkisan.gov.in पर ऑनलाइन आवेदन करें

सरकार आपको पैसे देने के लिए इंतजार कर रही है!`;
    } else if (language === 'mr') {
      return `
💰 **सरकारी शेतकरी योजना - तुम्हासाठी ₹3+ लाख!**

**4 महत्वपूर्ण योजना:**

**1️⃣ पंतप्रधान शेतकरी सन्मान निधी (PM-KISAN)**
- रक्कम: ₹6,000/वर्ष (₹2,000 प्रत्येक 4 महिन्यांत)
- कोण: सर्व जमिनीधारक शेतकरी
- अर्ज: pmkisan.gov.in किंवा तहसील येथे
- वेळ: 15-30 दिवस मंजूरी

**2️⃣ पीक विमा योजना (Fasal Bima)**
- प्रीमियम: ₹1,500-5,000/एकर (50% सरकार भरेल)
- दावा: ₹35,000-70,000 प्रति एकर
- अर्ज: पीकाचे नुकसान 10 दिवस मध्ये
- वेळ: 2-3 महिने मध्ये प्रदान

**3️⃣ शेतकरी क्रेडिट कार्ड (KCC)**
- कर्ज: ₹3,00,000 पर्यंत
- व्याज दर: 4% प्रति वर्ष (सरकार 3% अनुदान)
- वेळ: 15 दिवस मंजूरी
- अर्ज: तुमच्या जवळच्या बँकेत

**4️⃣ सिंचन योजना (PMKSY)**
- अनुदान: 50-90% ड्रिप/स्प्रिंकलर साठी
- किंमत: ₹90,000-1,20,000 (तुम केवळ ₹10,000-60,000 द!)
- भरणे: बाकी KCC ने 4% व्याजावर
- वेळ: 1-2 महिने मंजूरी

**5 एकर शेतकरीसाठी एकूण लाभ (1 वर्षात):**
- PM-KISAN: ₹6,000
- विमा अनुदान: ₹12,500
- ड्रिप अनुदान: ₹3,00,000 (एकदा!)
- **एकूण: ₹3+ LAKHS सरकारी मदत!**

**आवश्यक दस्तऐवज:**
✓ आधार कार्ड
✓ जमिनीचे कागदपत्र (7/12)
✓ बँक खाता तपशील
✓ शेताची छायाचित्रे

**आता अर्ज करा - पायरी पायरीने:**
1. दस्तऐवज तयार करा (सर्व एक जागी ठेवा)
2. बँकेत जा KCC + विमासाठी
3. जिल्हा कृषी कार्यालयात जा ड्रिप अनुदानसाठी
4. pmkisan.gov.in वर ऑनलाइन अर्ज करा

सरकार तुम्हाला पैसे देण्यासाठी प्रतीक्षा करत आहे!`;
    } else {
      // English - default
      return `
💰 **GOVERNMENT SUPPORT FOR FARMERS**

**4 MUST-HAVE SCHEMES:**

**1️⃣ PM-KISAN**
- Amount: ₹6,000/year (₹2,000 every 4 months)
- Who: All landholding farmers
- Apply: pmkisan.gov.in or local revenue office
- Time: 15-30 days approval

**2️⃣ CROP INSURANCE (Fasal Bima)**
- Premium: ₹1,500-5,000/acre (50% government paid)
- Claim: ₹35,000-70,000 per acre
- File: Within 10 days of crop damage
- Time: 2-3 months for payout

**3️⃣ KCC (Kisan Credit Card)**
- Loan: Up to ₹3,00,000
- Interest: 4% per year (government subsidized)
- Time: 15 days approval
- Apply: Your nearest bank

**4️⃣ PMKSY (Irrigation Subsidy)**
- Subsidy: 50-90% for drip/sprinkler
- Cost: ₹90,000-1,20,000 per acre (you pay only ₹10,000-60,000!)
- Loan: Remaining amount at 4% KCC interest
- Time: 1-2 months

**GOVERNMENT SUPPORT EXAMPLE (5-acre farm):**
- PM-KISAN: ₹6,000/year guaranteed
- Insurance subsidy: ₹12,500 (50% of premium)
- Drip irrigation: ₹3-4.5 lakhs subsidy (one-time!)
- **Total: ₹3+ LAKHS government support in Year 1!**

**Document Checklist:**
✓ Aadhaar card
✓ Land records (7/12 document)
✓ Bank account details
✓ Farm photos (for insurance)

**Apply Today - Next Action:**
1. Collect documents (have everything ready)
2. Visit bank for KCC + Insurance
3. Visit District Agriculture Office for drip subsidy
4. Apply online PM-KISAN at pmkisan.gov.in

Government support is WAITING for you!`;
    }
  }
  
  // PRIORITY 3: Diseases (common problem) - WITH REAL TREATMENT DATA
  else if (msg.includes('disease') || msg.includes('infected') || msg.includes('spots') || msg.includes('sick') || msg.includes('blight') || msg.includes('mildew') || msg.includes('rot') || msg.includes('rust') ||
           msg.includes('बीमारी') || msg.includes('संक्रमण') || msg.includes('धब्बे') || msg.includes('रोग') ||
           msg.includes('रोग') || msg.includes('संक्रमण') || msg.includes('डाग') || msg.includes('आजार')) {
    
    // Check for crop-specific plans
    const userCrop = context.crops?.[0]?.toLowerCase() || '';
    const isTomato = userCrop.includes('tomato');
    const isPotato = userCrop.includes('potato');
    
    // Check for specific disease matches
    const diseases = FARMING_KB.diseases as Record<string, any>;
    for (const [disease, info] of Object.entries(diseases)) {
      if (msg.includes(disease)) {
        const productsText = info.treatment_products.map((p: any) => 
          `• **${p.name}** - ${p.price}\n  Dosage: ${p.dosage} | Effectiveness: ${p.effectiveness}`
        ).join('\n');
        
        // Get crop-specific plan if available
        let cropSpecificSection = '';
        if ((isTomato || isPotato) && CROP_SPECIFIC_PLANS[userCrop]?.[disease]) {
          const cropPlan = CROP_SPECIFIC_PLANS[userCrop][disease];
          cropSpecificSection = `

---

**🌍 CROP-SPECIFIC PLAN FOR ${userCrop.toUpperCase()}:**

**Crop-Specific Impact:**
${cropPlan.crop_specific_info}

**Resistant Varieties Ready to Plant:**
${cropPlan.resistant_varieties}

**Spray Schedule For Your Crop:**
${cropPlan.spray_schedule}

**Recovery Timeline:**
${cropPlan.recovery_time}

**Financial Impact For Your Crop:**
${cropPlan.profit_impact}

**Soil & Field Management:**
${cropPlan.soil_management}

**Next Season Prevention:**
${cropPlan.next_season_prevention}`;
        }
        
        return `
🌾 **${disease.toUpperCase()} - REAL TREATMENT PLAN${isTomato || isPotato ? ` FOR ${userCrop.toUpperCase()}` : ''}**

**💡 Symptoms (How to Identify):**
${info.symptoms}

**🔍 Root Cause:**
${info.causes}

**✅ Prevention (Do This First):**
${info.prevention.split(',').map((p: string) => '• ' + p.trim()).join('\n')}

---

**💊 TREATMENT PRODUCTS - Real Indian Market Options:**

${productsText}

**📅 Spraying Schedule:**
${info.schedule}

**💰 Total Cost Per Acre: ${info.cost_per_acre}**

**⚠️ Urgency Level: ${info.urgency}**

**📊 Yield Impact:**
${info.yield_impact}

---

**🎯 ${info.action_plan}**
${cropSpecificSection}

---

**❓ Quick Questions:**
1. Have you seen first spots yet? → Start spraying TODAY
2. Does your field have good drainage? → Critical for fungal diseases
3. What's the weather forecast? → Rain = Higher disease risk = Spray more often
4. Do you have a sprayer and safety gear? → Check before buying fungicides

**🚀 Next Action:**
1. Buy fungicide TODAY (choose from products above)
2. Scout your field this evening
3. Plan first spray for tomorrow morning (5-7am)
4. Set phone reminder for next spray (${info.schedule.split(',')[0]})
`;
      }
    }
    
    if (language === 'hi') {
      return `🌾 **रोग की पहचान और प्रबंधन**

${cropContext} में आम रोग ${locationContext} में:
- कवक संक्रमण (मानसून की नमी)
- जीवाणु संक्रमण (गीली परिस्थितियां)
- वायरस संक्रमण (कीटों द्वारा)

**पहचान की प्रक्रिया:**
1. पत्तियों के ऊपर और नीचे देखें
2. धब्बे, पाउडर, मुरझाना नोट करें
3. तुरंत निदान के लिए AgroMind AI Scan का उपयोग करें
4. स्थानीय KVK से पुष्टि मांगें

**कार्रवाई की सीमा:**
- ✓ पहला संकेत: तुरंत खेत की जांच करें
- ✓ 10% प्रभावित: आज स्प्रे करें
- ✓ 30%+ प्रभावित: गंभीर - तुरंत उपचार

**लागत-लाभ:**
- रोकथाम: ₹500-1,000/एकड़
- उपचार: ₹3,000-5,000/एकड़
- रोकथाम हमेशा सस्ता होता है!

**अगला कदम:** सटीक निदान के लिए AI Scan में फोटो अपलोड करें!`;
    } else if (language === 'mr') {
      return `🌾 **रोगाची ओळख आणि व्यवस्थापन**

${cropContext} मध्ये सामान्य रोग ${locationContext} मध्ये:
- बुरशांचा रोग (मान्सूनी ओलावा)
- जीवाणू संक्रमण (ओल्या परिस्थितीत)
- व्हायरस संक्रमण (कीटांद्वारे)

**ओळख करण्याची प्रक्रिया:**
1. पानांच्या वर आणि खाली बघा
2. डाग, पावडर, मुरझणे नोट करा
3. तात्काळ निदानासाठी AgroMind AI Scan वापरा
4. स्थानिक KVK कडून पुष्टीकरण घ्या

**कार्यवाहीची सीमा:**
- ✓ पहिला संकेत: तात्काळ शेत तपास करा
- ✓ 10% प्रभावित: आज स्प्रे करा
- ✓ 30%+ प्रभावित: गंभीर - तात्काळ उपचार

**लागत-लाभ:**
- प्रतिबंध: ₹500-1,000/एकर
- उपचार: ₹3,000-5,000/एकर
- प्रतिबंध हमेशा स्वस्त असतो!

**पुढील पाऊल:** सटीक निदानासाठी AI Scan मध्ये फोटो अपलोड करा!`;
    } else {
      return `🌾 **Disease Identification & Management**

Common diseases affecting ${cropContext} in ${locationContext}:
- Fungal (monsoon season humidity)
- Bacterial (wet conditions)
- Viral (insect transmission)

**Quick ID Process:**
1. Check leaf surfaces (top AND bottom)
2. Note spots, powder, wilting, decay
3. Use AgroMind AI Scan for instant diagnosis
4. Ask local KVK for confirmation

**Action Thresholds:**
- ✓ First symptom: Scout field immediately
- ✓ 10% affected: Spray today
- ✓ 30%+ affected: CRITICAL - urgent treatment

**Cost-Benefit:**
- Prevention: ₹500-1,000/acre
- Treatment: ₹3,000-5,000/acre
- Prevention is ALWAYS cheaper!

**Next Step:** Upload photo to AI Scan for exact diagnosis!`;
    }
  }
  
  // PRIORITY 4: Pests
  else if (msg.includes('pest') || msg.includes('insect') || msg.includes('worm') || msg.includes('bug') || msg.includes('mite') || msg.includes('aphid') || msg.includes('caterpillar') || msg.includes('whitefly') || msg.includes('whiteflies') || msg.includes('mealybug') || msg.includes('spider') ||
           msg.includes('कीट') || msg.includes('कीड़े') || msg.includes('कीड़ा') || msg.includes('कीटक') ||
           msg.includes('कीटक') || msg.includes('किडे') || msg.includes('कीड़े') || msg.includes('कीटांची')) {
    const pests = FARMING_KB.pests as Record<string, any>;
    for (const [pest, info] of Object.entries(pests)) {
      if (msg.includes(pest) || (pest === 'whiteflies' && msg.includes('whitefly'))) {
        return `
🐛 **PEST CONTROL: ${pest.toUpperCase()}**

**What It Looks Like:**
${info.description}

**Damage It Causes:**
${info.damage}

**ORGANIC CONTROL (Start Here - Safest):**
${info.organic_control}

**CHEMICAL CONTROL (If Organic Fails):**
${info.chemical_control}

**Severity: ${info.severity} | Cost:**  ${info.cost}

**CONTROL ACTION PLAN:**
1. Scout 5 plants from different areas
2. Count pests per plant
3. Check economic threshold:
   - <10%: Monitor (wait 3-5 days)
   - 10-30%: Prepare to spray
   - >30%: Spray TODAY!
4. Apply spray early morning (5-7 AM) or late evening (4-6 PM)
5. Wear protective gear (mask, gloves)
6. Check results after 7 days
7. Repeat every 10-14 days if needed

**PREVENTION FOR NEXT SEASON:**
- Clean field debris after harvest
- Rotate crops annually
- Use sticky traps for early warning
- Plant resistant varieties
- Maintain field sanitation

**Cost Analysis:**
- Organic: ₹500-1,000/acre
- Chemical: ₹1,500-2,500/acre
- Prevention: ₹2,000-3,000/season
- **Prevents ₹20,000-50,000 crop loss!**`;
      }
    }
    
    if (language === 'hi') {
      return `🐛 **कीट प्रबंधन ${cropContext} के लिए**

**निरीक्षण प्रोटोकॉल:**
1. 5-10 यादृच्छिक पौधों की जांच करें
2. पत्तियों के नीचे देखें (कीट वहां छिपते हैं)
3. प्रति पत्ती कीटों की गणना करें
4. नोटबुक में रिकॉर्ड करें

**कब स्प्रे करें:**
- <5 कीटें/पत्ती: करीब से निगरानी करें
- 5-20 कीटें/पत्ती: 3 दिन बाद फिर से जांचें
- >20 कीटें/पत्ती: आज ही स्प्रे करें!

**जैविक तरीके:**
- नीम का तेल 3%: ₹500-800/लीटर
- BT स्प्रे: ₹800-1,200/लीटर
- पीले चिपचिपे जाल: ₹20-50 प्रत्येक

**IPM (एकीकृत कीट प्रबंधन सर्वश्रेष्ठ दृष्टिकोण):**
- प्रतिरोधी किस्मों + जैविक तरीके मिलाएं
- 2-3 तरीके एक साथ का उपयोग करें
- पैसा बचाएं और पर्यावरण की रक्षा करें
- लागत: ₹3,000-5,000/मौसम

रोकथाम उपचार से सस्ता है!`;
    } else if (language === 'mr') {
      return `🐛 **कीट व्यवस्थापन ${cropContext} साठी**

**निरीक्षण प्रोटोकॉल:**
1. 5-10 यादृच्छिक वनस्पतींचा तपास करा
2. पानांच्या खाली बघा (कीटक तेथे लपलेले असतात)
3. प्रति पान कीटकांची गणना करा
4. नोटबुकात नोंद करा

**केव्हा स्प्रे करावे:**
- <5 कीटक/पान: बारकाईने निरीक्षण करा
- 5-20 कीटक/पान: 3 दिवस बाद पुन्हा तपासा
- >20 कीटक/पान: आज स्प्रे करा!

**जैविक पद्धती:**
- नीमचे तेल 3%: ₹500-800/लीटर
- BT स्प्रे: ₹800-1,200/लीटर
- पिवळे चिपचिपे जाळे: ₹20-50 प्रत्येक

**IPM (एकीकृत कीटक व्यवस्थापन सर्वोत्तम पद्धती):**
- प्रतिरोधक जाती + जैविक पद्धती मिक्स करा
- 2-3 पद्धती एकत्र वापरा
- पैसा वाचवा आणि पर्यावरणाची संरक्षा करा
- खर्च: ₹3,000-5,000/ऋतु

प्रतिबंध उपचारापेक्षा स्वस्त आहे!`;
    } else {
      return `🐛 **Pest Management for ${cropContext}**

**Scouting Protocol:**
1. Check 5-10 random plants
2. Look undersides of leaves (pests hide there)
3. Count pests per leaf
4. Record in notebook

**When to Spray:**
- <5 pests/leaf: Monitor closely
- 5-20 pests/leaf: Watch and check again in 3 days
- >20 pests/leaf: SPRAY TODAY!

**Organic Methods:**
- Neem oil 3%: ₹500-800/liter
- BT spray: ₹800-1,200/liter
- Yellow sticky traps: ₹20-50 each

**IPM (Integrated Pest Management Best Approach):**
- Mix resistant varieties + organic methods
- Use 2-3 methods together
- Save money AND protect environment
- Cost: ₹3,000-5,000/season

Prevention is cheaper than treatment!`;
    }
  }
  
  // PRIORITY 5: Fertilizer
  else if (msg.includes('fertilizer') || msg.includes('nutrient') || msg.includes('npk') || msg.includes('urea') ||
           msg.includes('खाद') || msg.includes('पोषक') || msg.includes('यूरिया') || msg.includes('NPK') ||
           msg.includes('खत') || msg.includes('पोषण') || msg.includes('युरिया') || msg.includes('पोषक')) {
    const fertilizers = FARMING_KB.fertilizers as Record<string, string[]>;
    for (const [crop, advice] of Object.entries(fertilizers)) {
      if (msg.includes(crop)) {
        return `
🌾 **FERTILIZER PLAN FOR ${crop.toUpperCase()}**

${advice.map(line => '• ' + line).join('\n')}

**3-STAGE APPLICATION:**

**STAGE 1: Land Prep**
- FYM: 10-15 tonnes/acre
- Cost: ₹5,000-8,000
- Benefit: Better soil structure

**STAGE 2: At Planting**
- Apply base NPK fertilizer
- Mix micronutrients (Zinc, Boron)
- Ensure soil moisture

**STAGE 3: Top Dressing (30-60 days)**
- Apply Urea 40-50kg/acre
- Mix with soil 10cm away from stem
- Irrigate 2-3 hours after

**SOIL TESTING IS CRITICAL:**
- Get FREE soil test under Soil Health Card
- Learn exact nutrient levels needed
- Prevent over/under fertilizing
- Save ₹2,000-3,000!

**EXPECTED RESULTS:**
- Correct fertilization: 20-30% yield increase
- Financial gain: ₹40,000-60,000 extra income

**ORGANIC ALTERNATIVE:**
- Vermicompost: 2-3 tonnes/acre (₹12,000-15,000)
- Neem cake: 500kg/acre (₹5,000-7,000)
- Better long-term soil health

**Government Subsidy:**
- Bio-fertilizers: ₹500-1,000 per bag (50% subsidy)
- Apply at agriculture department

Soil test FIRST = Correct fertilizer = 30% more yield!`;
      }
    }
    
    if (language === 'hi') {
      return `🌾 **खाद योजना ${cropContext} के लिए**

**महत्वपूर्ण पहला कदम: मिट्टी परीक्षण**
- मिट्टी स्वास्थ्य कार्ड योजना के तहत मुफ्त
- परीक्षण: NPK, सूक्ष्म पोषक, pH, जैविक पदार्थ
- व्यक्तिगत सिफारिशें देता है
- 5-7 दिन लगते हैं
- **₹2,000-3,000 बर्बाद खाद में बचाता है!**

**3-चरण रणनीति:**
1. **तैयारी (रोपण से पहले):** FYM 10-15 टन/एकड़
2. **आधार आवेदन (रोपण):** NPK सिफारिश के अनुसार
3. **शीर्ष ड्रेसिंग (30-60 दिन):** यूरिया का पक्ष अनुप्रयोग

**लागत विभाजन (1 एकड़):**
- FYM: ₹8,000
- आधार खाद: ₹6,000-8,000
- शीर्ष ड्रेसिंग: ₹3,000-4,000
- **कुल: ₹17,000-20,000**

**निवेश पर रिटर्न:**
- सही समय: 20-30% पैदावार में वृद्धि
- अतिरिक्त आय: ₹40,000-60,000!
- ROI: 200-300%!

**कार्य आइटम:**
1. निकटतम मिट्टी परीक्षण प्रयोगशाला खोजें
2. मिट्टी परीक्षण प्राप्त करें (मुफ्त, 7 दिन)
3. सिफारिश रिपोर्ट प्राप्त करें
4. बिल्कुल सिफारिश के अनुसार लागू करें

मिट्टी परीक्षण खेती की सफलता की कुंजी है!`;
    } else if (language === 'mr') {
      return `🌾 **खत योजना ${cropContext} साठी**

**महत्वपूर्ण पहिला पाऊल: मातीचे परीक्षण**
- मातीचे आरोग्य कार्ड योजनेंतर्गत विनामूल्य
- परीक्षण: NPK, सूक्ष्म पोषक, pH, जैविक पदार्थ
- व्यक्तिगत शिफारशी देते
- 5-7 दिवस लागतात
- **₹2,000-3,000 वेकाच खतात बचवते!**

**3-पायरी रणनीती:**
1. **तयारी (रोपणापूर्वी):** FYM 10-15 टन/एकर
2. **आधार अनुप्रयोग (रोपण):** NPK शिफारशीप्रमाणे
3. **शीर्ष ड्रेसिंग (30-60 दिवस):** यूरिया बाजूचा अनुप्रयोग

**लागत विभाजन (1 एकर):**
- FYM: ₹8,000
- आधार खत: ₹6,000-8,000
- शीर्ष ड्रेसिंग: ₹3,000-4,000
- **एकूण: ₹17,000-20,000**

**गुंतवणुकीवर परतावा:**
- योग्य वेळ: 20-30% उत्पादन वाढ
- अतिरिक्त उत्पन्न: ₹40,000-60,000!
- ROI: 200-300%!

**कार्या:**
1. जवळचीची मातीचे परीक्षण प्रयोगशाळा शोधा
2. मातीचे परीक्षण घ्या (विनामूल्य, 7 दिवस)
3. शिफारशीची अहवाल प्राप्त करा
4. नुसताच शिफारशीप्रमाणे लागू करा

मातीचे परीक्षण हे शेतीच्या यशाची चावी आहे!`;
    } else {
      return `🌾 **Fertilizer Planning for ${cropContext}}**

**Critical First Step: Soil Testing**
- FREE under Soil Health Card Scheme
- Tests: NPK, micronutrients, pH, organic matter
- Gives personalized recommendations
- Takes 5-7 days
- **Saves ₹2,000-3,000 in wasted fertilizer!**

**3-Stage Strategy:**
1. **Preparation (before planting):** FYM 10-15 tonnes/acre
2. **Base Application (planting):** NPK as per recommendation
3. **Top Dressing (30-60 days):** Urea side-dressing

**Cost Breakdown (1 acre):**
- FYM: ₹8,000
- Base fertilizer: ₹6,000-8,000
- Top dressing: ₹3,000-4,000
- **Total: ₹17,000-20,000**

**Return on Investment:**
- Correct timing: 20-30% yield increase
- Additional income: ₹40,000-60,000!
- ROI: 200-300% !

**Action Items:**
1. Find nearest Soil Testing Lab
2. Get soil test (FREE, 7 days)
3. Get recommendation report
4. Apply exactly as recommended

Soil test is THE key to farming success!`;
    }
  }
  
  // PRIORITY 6: Irrigation
  else if (msg.includes('irrigation') || msg.includes('water') || msg.includes('drip') || msg.includes('sprinkler') ||
           msg.includes('सिंचाई') || msg.includes('पानी') || msg.includes('ड्रिप') || msg.includes('फव्वारा') ||
           msg.includes('सिंचन') || msg.includes('पाणी') || msg.includes('ड्रिप') || msg.includes('फव्वारे')) {
    return `
💧 **IRRIGATION SYSTEM GUIDE**

**3 MAIN OPTIONS:**

**1. DRIP (Most Efficient) ⭐ RECOMMENDED**
- Water saved: 40-60%
- Cost: ₹90,000-1,20,000/acre
- **Subsidy: 50-90% available!**
- You pay: Only ₹10,000-60,000!
- PaybackTime: 2-3 years through savings
- Best for: Tomato, Chili, Vegetables

**2. SPRINKLER (Medium Efficiency)**
- Water saved: 25-40%
- Cost: ₹60,000-80,000/acre
- Subsidy: 40-70%
- Payback: 3-4 years
- Best for: Wheat, Maize, Pulses

**3. FLOOD (Traditional)**
- Low subsidy, high water use
- Best for: Paddy, Sugarcane only

**SEASONAL IRRIGATION SCHEDULE:**

**Monsoon (Jun-Sep):**
- Rainfall usually sufficient
- Focus on drainage
- Check soil before irrigating

**Winter (Oct-Mar):**
- Every 10-15 days
- 50mm depth per irrigation

**Summer (Apr-May):**
- Every 5-7 days
- Early morning (5-7 AM) to save water
- Avoid midday (50% evaporates!)

**SOIL MOISTURE CHECK (No Equipment):**
1. Dig 15cm hole
2. Squeeze soil
3. If forms ball → Sufficient
4. If crumbles → Irrigate immediately

**WATER SAVINGS EXAMPLE (Drip vs Flood):**
- Flood: ₹20,000-30,000/season cost
- Drip: ₹5,000-8,000/season cost
- **Saves: ₹12,000-25,000 per season!**

**Combined Annual Benefits:**
- Water: ₹15,000-25,000
- Labor: ₹10,000-15,000
- Electricity: ₹10,000-20,000
- Yield increase: ₹40,000-60,000
- **TOTAL: ₹75,000-1,20,000/year!**

**HOW TO GET 50-90% SUBSIDY:**
1. Visit District Agriculture Office
2. Show land documents
3. Get temporary sanction
4. Install via approved vendor
5. Final inspection → Subsidy paid
- Timeline: 3-6 months

**Combined with KCC Loan:**
- Get drip subsidy: 50-90%
- Get remaining as KCC loan at 4% interest
- Pay back after harvest
- **Zero upfront cost essentially!**

Drip irrigation is an INVESTMENT that pays for itself in 2-3 years!`;
  }
  
  // DEFAULT: Helpful guide for any question
  else {
    if (language === 'hi') {
      return `
🌾 **मैं किसी भी कृषि प्रश्न में मदद के लिए यहां हूं!**

नमस्ते ${farmerName}! मैं एक बुद्धिमान AI डॉक्टर हूं जो आपकी मदद के लिए प्रशिक्षित हूं:

**📚 विषय जो मैं जानता हूं:**
1. **🌿 रोग** - पहचान, उपचार, रोकथाम (लेट ब्लाइट, पाउडर फफूंदी, पत्ती धब्बा, तने की सड़न, जंग)
2. **🐛 कीट** - नियंत्रण विधियां जैविक और रासायनिक (एफिड्स, स्पाइडर माइट्स, व्हाइटफ्लाइज़, कैटरपिलर, मीलीबग्स)
3. **🥗 खाद** - NPK योजना, लागत, मिट्टी परीक्षण (टमाटर, आलू, गेहूं, चावल, कपास)
4. **💧 सिंचाई** - ड्रिप सिस्टम, स्प्रिंकलर, पानी के समय, सरकारी सब्सिडी
5. **💰 सरकारी योजनाएं** - PM-KISAN, फसल बीमा, KCC कर्ज, PMKSY सब्सिडी
6. **🛡️ नुकसान रोकना** - बीमा, जल्दी पहचान, उपचार प्रोटोकॉल
7. **🌤️ मौसम** - मानसून, सूखा, ठंढ प्रबंधन
8. **📊 पूर्ण खेती** - पैदावार, लागत, लाभप्रदता

**सर्वश्रेष्ठ उत्तर कैसे प्राप्त करें:**
✓ विशिष्ट फसल का नाम बताएं (टमाटर, आलू, आदि)
✓ विशिष्ट समस्या का वर्णन करें`;
    } else if (language === 'mr') {
      return `
🌾 **मी कोणत्याही कृषी प्रश्नात मदत करण्यासाठी येथे आहे!**

नमस्कार ${farmerName}! मी एक बुद्धिमान AI डॉक्टर आहे जो तुम्हाला मदत करण्यासाठी प्रशिक्षित आहे:

**📚 विषय जे मी जाणतो:**
1. **🌿 रोग** - ओळख, उपचार, प्रतिबंध (लेट ब्लाइट, पावडर फफूंदी, पानाचा डाग, तने सड, गंज)
2. **🐛 कीटक** - नियंत्रण पद्धती जैविक आणि रासायनिक (एफिड्स, स्पाइडर माइट्स, व्हाइटफ्लाइज़, कॅटरपिलर, मीलीबग्स)
3. **🥗 खत** - NPK योजना, लागत, मातीचे परीक्षण (टमाटर, बटाटे, गहू, तांदूळ, कपास)
4. **💧 सिंचन** - ड्रिप सिस्टम, फव्वारे, पाण्याचे वेळापत्रक, सरकारी अनुदान
5. **💰 सरकारी योजना** - PM-KISAN, पीक विमा, KCC कर्ज, PMKSY अनुदान
6. **🛡️ नुकसान प्रतिबंध** - विमा, लवकर ओळख, उपचार प्रोटोकॉल
7. **🌤️ हवामान** - मान्सून, दुष्काळ, हिमवर्षा व्यवस्थापन
8. **📊 संपूर्ण शेती** - उत्पन्न, लागत, लाभप्रदता

**सर्वोत्तम उत्तर कसे मिळवायचे:**
✓ विशिष्ट पीक नाव सांगा (टमाटर, बटाटे, इ.)
✓ विशिष्ट समस्येचे वर्णन करा`;
    } else {
      return `
🌾 **I'm Here to Help with Any Farming Question!**

Hello ${farmerName}! I'm an intelligent AI Doctor trained to help with:

**📚 TOPICS I KNOW:**
1. **🌿 Diseases** - Identification, treatment, prevention (Late Blight, Powdery Mildew, Leaf Spot, Stem Rot, Rust)
2. **🐛 Pests** - Control methods organic & chemical (Aphids, Spider Mites, Whiteflies, Caterpillars, Mealybugs)
3. **🥗 Fertilizers** - NPK planning, costs, soil testing for Tomato, Potato, Wheat, Rice, Cotton
4. **💧 Irrigation** - Drip systems, sprinklers, water schedules, government subsidies
5. **💰 Government Schemes** - PM-KISAN, Fasal Bima Insurance, KCC Loans, PMKSY Subsidy  
6. **🛡️ Loss Prevention** - Insurance, early detection, treatment protocols
7. **🌤️ Weather** - Monsoon, drought, frost management
8. **📊 Complete Farming** - Yields, costs, profitability

**HOW TO GET BEST ANSWERS:**
✓ Name the specific crop (Tomato, Potato, etc)
✓ Describe the specific problem
✓ Mention your location (affects recommendations)

**TRY ASKING:**
- "My tomato has brown spots - what disease?"
- "Fertilizer plan for 2 acres wheat with costs"
- "Drip irrigation subsidy and government support"
- "How to prevent late blight on potato?"
- "What insurance coverage available?"

**🎯 QUICK TIPS:**
- Use **AI Scan** to upload leaf photos for instant diagnosis
- Check **Regret** to see potential ₹ losses if untreated
- See nearby **Disease Map** to learn from other farmers

What farming question can I help you with today? 🌱`;
    }
  }
}

// CROP-SPECIFIC TREATMENT PLANS
const CROP_SPECIFIC_PLANS: Record<string, Record<string, any>> = {
  'tomato': {
    'early blight': {
      crop_specific_info: 'Tomato is HIGHLY SUSCEPTIBLE to early blight. Affects both leaves and fruits, causing spot lesions and fruit rot.',
      resistant_varieties: 'Use Arka Vikas, Arka Ashish, or Sungold varieties',
      spray_schedule: '4-6 sprays needed during season (May-November)',
      recovery_time: '3-4 weeks to full recovery after treatment',
      total_cost: '₹2,500-3,500 for fungicides + labor for 1 acre',
      profit_impact: 'Untreated loss: 40-50% (₹40,000-₹50,000 loss) | Treated: Save ₹35,000-45,000',
      soil_management: 'Ensure pH 6.0-6.5, good drainage, mulch to prevent soil splash',
      next_season_prevention: 'Rotate with non-solanaceous crops, use FYM 15 tonnes/acre'
    },
    'late blight': {
      crop_specific_info: 'CRITICAL FOR TOMATO. Can destroy entire crop in 3-5 days during monsoon.',
      resistant_varieties: 'Limited options - focus on prevention',
      spray_schedule: '2-3 preventive sprays BEFORE monsoon (April-May), then 5-7 day intervals during monsoon (June-September)',
      recovery_time: 'Once symptomatic, difficult to recover - prevention is key',
      total_cost: '₹4,000-5,500 for premium fungicides + daily scouting labor',
      profit_impact: 'Untreated loss: 90%+ (crop failure) | Treated: Save ₹80,000-100,000',
      soil_management: 'Perfect drainage essential, avoid overhead irrigation' ,
      next_season_prevention: '3-year crop rotation gap (no solanaceous crops in same field)'
    },
    'bacterial wilt': {
      crop_specific_info: 'PERMANENT wilt, no recovery possible once infected. Prevention only option.',
      symptoms: 'Wilting starts on one side of plant, progresses rapidly, brown vascular discoloration',
      spread: 'Via insects (especially flea beetles), contaminated tools, soil',
      prevention: 'NO CHEMICAL CURE - Focus on prevention only',
      resistant_varieties: 'No truly resistant varieties, but Arka Vikas more tolerant',
      management: 'Remove wilted plants immediately and burn. Insect control critical: Neem oil sprays every 7 days',
      total_cost: '₹1,500-2,000 for insect control + removal labor',
      profit_impact: 'Untreated loss: Infected plants die (₹20,000-30,000 per acre) | With prevention: Save 70-80%',
      recovery: 'ZERO - Infected plants cannot recover. Prevention is 100% solution.'
    }
  },
  'potato': {
    'late blight': {
      crop_specific_info: 'MOST CRITICAL POTATO DISEASE. Can destroy entire crop in 5-7 days and affect stored tubers.',
      resistant_varieties: 'Use Jyoti, Kufri Alankar, Kufri Badshah, Kufri Jyoti',
      spray_schedule: '2 preventive sprays in May-June, then 5-7 day intervals from July-September (6-8 sprays total)',
      recovery_time: 'Cannot recover once advanced - focus on preventing spread to tubers',
      total_cost: '₹4,500-6,000 for fungicides + frequent spraying labor',
      profit_impact: 'Untreated loss: 80-90% (₹80,000-120,000) | Treated: Save ₹70,000-100,000',
      tuber_rot_prevention: 'Proper haulm killing (cutting 2 weeks before harvest) prevents tuber infection',
      soil_management: 'Well-drained fields essential, avoid waterlogging completely',
      next_season_prevention: 'Resistant variety + soil treatment with Trichoderma before planting'
    },
    'early blight': {
      crop_specific_info: 'Less destructive than late blight but causes significant leaf loss and reduced yields.',
      resistant_varieties: 'Kufri Sadabahar, Kufri Chipsona, Jyoti',
      spray_schedule: 'Start preventive sprays 30 days after planting, then every 10-14 days (4-6 sprays)',
      recovery_time: '2-3 weeks to new leaf growth',
      total_cost: '₹2,000-3,000 for fungicides',
      profit_impact: 'Untreated loss: 25-35% (₹25,000-35,000) | Treated: Save ₹15,000-25,000',
      leaf_removal: 'Remove lower infected leaves manually to improve air circulation',
      haulm_management: 'Better air circulation = better disease control and yield',
      next_season: 'Use seed potatoes from disease-free sources certified by Department'
    },
    'bacterial wilt': {
      crop_specific_info: 'Caused by Ralstonia (similar to tomato). Insects transmit mainly via flea beetles.',
      symptoms: 'Wilting during day despite wet soil, plant collapses when weather is hot',
      prevention: 'Insect control is critical - flea beetles are vectors',
      resistant_varieties: 'Jyoti & Kufri Alankar show some tolerance',
      management: 'Neem oil spray every 7-10 days starting from 30 days after planting',
      total_cost: '₹1,500-2,500 for insect control throughout season',
      profit_impact: 'Untreated loss: 15-20% (infected plants die) | With prevention: Save 85-90%',
      recovery: 'ZERO recovery - prevention only via insect control'
    },
    'early blight recovery plan': {
      week1: 'Scout field, remove lower leaves, spray with Mancozeb',
      week2: 'Repeat spray, continue lower leaf removal if needed',
      week3: 'Check for improvement, continue spray every 10-14 days',
      week4_plus: 'Maintain spray schedule until haulm killing (2 weeks before harvest)',
      yields_during_recovery: 'With treatment: Recover 70-80% of normal yield',
      tuber_size: 'Small top leaves = less carbohydrate production = smaller tubers (1-3% yield loss)',
      storage: 'Harvest slightly late to allow tuber healing (15-18 days after haulm killing)'
    }
  }
};

export function getAIResponse(
  message: string,
  userContext: UserContext,
  language: 'en' | 'hi' | 'mr' = 'en'
): AIResponse {
  let response = generateContextualResponse(message, userContext, language);
  
  return {
    message: response,
    suggestions: generateFollowUpQuestions(message, userContext, language)
  };
}

function generateFollowUpQuestions(message: string, context: UserContext, language: 'en' | 'hi' | 'mr' = 'en'): string[] {
  const msg = message.toLowerCase();
  
  if (language === 'hi') {
    if (msg.includes('disease') || msg.includes('spots') || msg.includes('infected') || msg.includes('बीमारी')) {
      return [
        'उपचार के विकल्प क्या हैं?',
        'उपचार की लागत कितनी होगी?',
        'कौन सी रोकथाम सबसे अच्छी है?'
      ];
    } else if (msg.includes('fertilizer') || msg.includes('खाद')) {
      return [
        'खाद को सही तरीके से कैसे लगाएं?',
        'जैविक विकल्प क्या हैं?',
        'सर्वश्रेष्ठ आवेदन समय कब है?'
      ];
    } else if (msg.includes('pest') || msg.includes('insect') || msg.includes('कीट')) {
      return [
        'जैविक नियंत्रण विकल्प क्या हैं?',
        'कीटों से कब उपचार शुरू करूं?',
        'स्प्रे कितनी बार दोहराया जाए?'
      ];
    } else if (msg.includes('irrigation') || msg.includes('drip') || msg.includes('सिंचाई')) {
      return [
        'लागत और ROI क्या होगा?',
        'सरकारी सब्सिडी उपलब्ध है?',
        'पानी की बचत कितनी होगी?'
      ];
    } else if (msg.includes('scheme') || msg.includes('loan') || msg.includes('insurance') || msg.includes('योजना')) {
      return [
        'मैं इन योजनाओं के लिए कैसे आवेदन करूं?',
        'मुझे कौन से दस्तावेज चाहिए?',
        'प्रसंस्करण में कितना समय लगेगा?'
      ];
    }
    return [
      'अनुमानित लागत क्या है?',
      'मैं इसे कैसे लागू करूं?',
      'समय सीमा क्या है?'
    ];
  } else if (language === 'mr') {
    if (msg.includes('disease') || msg.includes('spots') || msg.includes('infected') || msg.includes('रोग')) {
      return [
        'उपचारास कोणते पर्याय आहेत?',
        'उपचारास किती खर्च होईल?',
        'कोणती प्रतिबंधक उपाय सर्वोत्तम आहे?'
      ];
    } else if (msg.includes('fertilizer') || msg.includes('खत')) {
      return [
        'खत कसे योग्यरीत लावावे?',
        'जैविक पर्याय काय आहेत?',
        'सर्वोत्तम वेळ कधी आहे?'
      ];
    } else if (msg.includes('pest') || msg.includes('insect') || msg.includes('कीटक')) {
      return [
        'जैविक नियंत्रण पर्याय काय आहेत?',
        'कीटकांवर उपचार कधी करावे?',
        'स्प्रे किती वेळा करावा?'
      ];
    } else if (msg.includes('irrigation') || msg.includes('drip') || msg.includes('सिंचन')) {
      return [
        'खर्च आणि ROI काय असेल?',
        'सरकारी अनुदान उपलब्ध आहे?',
        'पाण्याची बचत किती होईल?'
      ];
    } else if (msg.includes('scheme') || msg.includes('loan') || msg.includes('insurance') || msg.includes('योजना')) {
      return [
        'मी या योजनांसाठी कसे अर्ज करू?',
        'मुझे कौनते कागदपत्र चाहिजेत?',
        'प्रक्रिया किती वेळ लागेल?'
      ];
    }
    return [
      'अंदाजे खर्च किती आहे?',
      'मी हे कसे करू?',
      'वेळेची मर्यादा काय आहे?'
    ];
  }
  
  // Default English
  if (msg.includes('disease') || msg.includes('spots') || msg.includes('infected')) {
    return [
      'What are the treatment options available?',
      'How much will treatment cost?',
      'What preventive measures work best?'
    ];
  } else if (msg.includes('fertilizer')) {
    return [
      'How do I apply fertilizer correctly?',
      'What about organic alternatives?',
      'When is the best application time?'
    ];
  } else if (msg.includes('pest') || msg.includes('insect')) {
    return [
      'What organic control options exist?',
      'When should I start treating pests?',
      'How often do I need to repeat spraying?'
    ];
  } else if (msg.includes('irrigation') || msg.includes('drip')) {
    return [
      'What is the cost and ROI?',
      'Are there government subsidies available?',
      'How much water will I save?'
    ];
  } else if (msg.includes('scheme') || msg.includes('loan') || msg.includes('insurance')) {
    return [
      'How do I apply for these schemes?',
      'What documents do I need?',
      'How long does processing take?'
    ];
  }
  
  return [
    'What is the estimated cost?',
    'How do I implement this?',
    'What is the timeline?'
  ];
}
