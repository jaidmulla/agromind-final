import { query } from '../utils/database';
import logger from '../utils/logger';

// ── Scheme Recommendation Engine ───────────────────────────────────────────

export interface SchemeMatch {
  id: string;
  code: string;
  title: string;
  category: string;
  crop_match: number; // 0-100
  disease_match: number; // 0-100
  location_match: number; // 0-100
  eligibility_score: number; // 0-100 (weighted average)
  metadata: any;
}

const CROP_KEYWORDS: Record<string, string[]> = {
  rice: ['rice', 'paddy'],
  wheat: ['wheat'],
  maize: ['maize', 'corn'],
  sugarcane: ['sugarcane', 'sugar'],
  cotton: ['cotton'],
  groundnut: ['groundnut', 'peanut'],
  pulses: ['lentil', 'dal', 'chickpea', 'gram', 'pulse'],
  vegetables: ['tomato', 'onion', 'cabbage', 'carrot', 'potato', 'vegetable'],
  fruits: ['apple', 'mango', 'banana', 'citrus', 'fruit'],
  spices: ['turmeric', 'chili', 'pepper', 'spice'],
};

const DISEASE_KEYWORDS: Record<string, string[]> = {
  fungal: ['blast', 'blight', 'rust', 'mildew', 'anthracnose', 'powdery', 'fungal'],
  bacterial: ['leaf streak', 'bacterial', 'bacterial leaf', 'wilt'],
  viral: ['mosaic', 'viral', 'streak', 'yellowing'],
  pest: ['pest', 'insect', 'bug', 'aphid', 'mite', 'weevil'],
  nutrient: ['nutrient', 'deficiency', 'chlorosis', 'yellowing'],
};

const STATE_KEYWORDS: Record<string, string[]> = {
  maharashtra: ['maharashtra', 'mh', 'kolhapur', 'nagpur', 'mumbai', 'pune'],
  karnataka: ['karnataka', 'kg', 'bangalore', 'bengaluru'],
  tamilnadu: ['tamil nadu', 'tn', 'tamil', 'tnau', 'madras'],
  punjab: ['punjab', 'pb', 'patiala', 'amritsar'],
  uttar_pradesh: ['uttar pradesh', 'up', 'lucknow'],
  bihar: ['bihar', 'patna'],
  madhya_pradesh: ['madhya pradesh', 'mp', 'indore'],
};

const SCHEMES = [
  {
    code: 'PMFBY',
    title: 'Pradhan Mantri Fasal Bima Yojana',
    category: 'insurance',
    applicable_crops: ['rice', 'wheat', 'maize', 'cotton', 'groundnut', 'sugarcane', 'pulses'],
    applicable_diseases: ['fungal', 'bacterial', 'viral', 'pest'],
    min_eligibility: 40,
  },
  {
    code: 'PM-KISAN',
    title: 'Pradhan Mantri Kisan Samman Nidhi',
    category: 'income-support',
    applicable_crops: ['all'],
    applicable_diseases: ['all'],
    min_eligibility: 30,
  },
  {
    code: 'PKVY',
    title: 'Paramparagat Krishi Vikas Yojana',
    category: 'organic-farming',
    applicable_crops: ['vegetables', 'spices', 'fruits', 'pulses'],
    applicable_diseases: ['fungal', 'pest'],
    min_eligibility: 50,
  },
  {
    code: 'RKVY',
    title: 'Rashtriya Krishi Vikas Yojana',
    category: 'agricultural-infrastructure',
    applicable_crops: ['all'],
    applicable_diseases: ['all'],
    min_eligibility: 35,
  },
  {
    code: 'AIBP',
    title: 'Accelerated Irrigation Schemes',
    category: 'irrigation',
    applicable_crops: ['rice', 'wheat', 'sugarcane', 'cotton'],
    applicable_diseases: ['all'],
    min_eligibility: 40,
  },
  {
    code: 'ATMA',
    title: 'Agricultural Technology Management Agency',
    category: 'extension-services',
    applicable_crops: ['all'],
    applicable_diseases: ['all'],
    min_eligibility: 25,
  },
  {
    code: 'NFSM',
    title: 'National Food Security Mission',
    category: 'productivity',
    applicable_crops: ['rice', 'wheat', 'pulses'],
    applicable_diseases: ['fungal', 'bacterial'],
    min_eligibility: 45,
  },
  {
    code: 'MIDH',
    title: 'Mission for Integrated Development of Horticulture',
    category: 'horticulture',
    applicable_crops: ['fruits', 'vegetables', 'spices'],
    applicable_diseases: ['all'],
    min_eligibility: 50,
  },
  {
    code: 'NMSA',
    title: 'National Mission on Soil Health Card',
    category: 'soil-health',
    applicable_crops: ['all'],
    applicable_diseases: ['nutrient'],
    min_eligibility: 30,
  },
  {
    code: 'DDU-GKY',
    title: 'Deen Dayal Upadhyaya Grameen Kaushalya Yojana',
    category: 'skill-training',
    applicable_crops: ['all'],
    applicable_diseases: ['all'],
    min_eligibility: 25,
  },
];

function matchKeywords(input: string, keywords: string[]): number {
  if (!input) return 0;
  const lower = input.toLowerCase();
  const matches = keywords.filter(k => lower.includes(k));
  return (matches.length / keywords.length) * 100;
}

function getCropCategory(cropName: string): string {
  for (const [category, keywords] of Object.entries(CROP_KEYWORDS)) {
    if (keywords.some(k => cropName.toLowerCase().includes(k))) {
      return category;
    }
  }
  return 'other';
}

function getDiseaseCategory(diseaseName: string): string {
  for (const [category, keywords] of Object.entries(DISEASE_KEYWORDS)) {
    if (keywords.some(k => diseaseName.toLowerCase().includes(k))) {
      return category;
    }
  }
  return 'other';
}

function getStateFromLocation(location: string): string {
  for (const [state, keywords] of Object.entries(STATE_KEYWORDS)) {
    if (keywords.some(k => location.toLowerCase().includes(k))) {
      return state;
    }
  }
  return 'other';
}

// ── Recommend Schemes Based on Farmer Data ─────────────────────────────────

export async function recommendSchemes(
  cropName: string,
  diseaseName: string,
  location: string
): Promise<SchemeMatch[]> {
  try {
    const cropCategory = getCropCategory(cropName);
    const diseaseCategory = getDiseaseCategory(diseaseName);
    const state = getStateFromLocation(location);

    const matches: SchemeMatch[] = SCHEMES.map(scheme => {
      // Crop match (0-100)
      let cropMatch = 0;
      if (scheme.applicable_crops.includes('all')) {
        cropMatch = 100;
      } else {
        cropMatch = scheme.applicable_crops.some(c => c === cropCategory)
          ? matchKeywords(cropName, scheme.applicable_crops as any)
          : 0;
      }

      // Disease match (0-100)
      let diseaseMatch = 0;
      if (scheme.applicable_diseases.includes('all')) {
        diseaseMatch = 100;
      } else {
        diseaseMatch = scheme.applicable_diseases.some(d => d === diseaseCategory)
          ? matchKeywords(diseaseName, scheme.applicable_diseases as any)
          : 0;
      }

      // Location match (0-100) - assume 70 if state matches, 50 otherwise
      const locationMatch = state !== 'other' ? 70 : 50;

      // Weighted eligibility score
      const eligibilityScore = Math.round(cropMatch * 0.4 + diseaseMatch * 0.35 + locationMatch * 0.25);

      return {
        id: scheme.code,
        code: scheme.code,
        title: scheme.title,
        category: scheme.category,
        crop_match: Math.round(cropMatch),
        disease_match: Math.round(diseaseMatch),
        location_match: Math.round(locationMatch),
        eligibility_score: Math.max(scheme.min_eligibility, eligibilityScore),
        metadata: {
          applicable_crops: scheme.applicable_crops,
          applicable_diseases: scheme.applicable_diseases,
        },
      };
    });

    // Filter and sort by eligibility score (descending)
    return matches
      .filter(m => m.eligibility_score >= 30)
      .sort((a, b) => b.eligibility_score - a.eligibility_score)
      .slice(0, 5);
  } catch (err) {
    logger.error('Scheme recommendation failed:', err);
    return [];
  }
}

// ── Save Scheme Recommendation to DB ───────────────────────────────────────

export async function saveSchemesForScan(
  scanId: string,
  schemes: SchemeMatch[]
): Promise<void> {
  try {
    for (const scheme of schemes) {
      await query(
        `INSERT INTO schemes (code, title, category, metadata)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO NOTHING`,
        [
          scheme.code,
          scheme.title,
          scheme.category,
          JSON.stringify({
            eligibility_score: scheme.eligibility_score,
            crop_match: scheme.crop_match,
            disease_match: scheme.disease_match,
            location_match: scheme.location_match,
            scan_id: scanId,
          }),
        ]
      );
    }
  } catch (err) {
    logger.error('Failed to save schemes:', err);
  }
}
