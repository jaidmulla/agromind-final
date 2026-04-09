/**
 * AI Doctor Service - Complete Agricultural Decision Engine
 * 
 * 6 Engines:
 * 1. Rule Engine - Disease → Treatment mapping
 * 2. Context Engine - Weather, severity, alerts adjustment
 * 3. Cost Engine - Product pricing and total cost calculation
 * 4. Priority Engine - Urgency and priority assignment
 * 5. Community Engine - Nearby alerts context
 * 6. Regret + Urgency Engine - Deadline and loss prevention
 */

import { query } from '../utils/database';
import logger from '../utils/logger';
import { getWeatherRisk } from './weather.service';

// ── TYPE DEFINITIONS ───────────────────────────────────────────────────────

interface TreatmentProduct {
  name: string;
  quantity: string;
  unit: string;
  cost_inr: number;
}

interface Task {
  day: number;
  title: string;
  description: string;
  product?: TreatmentProduct;
  priority: 'urgent' | 'recommended' | 'optional';
  urgency_level: 'high' | 'medium' | 'low';
  reason: string;
  cost_inr: number;
}

interface RecommendationResponse {
  summary: string;
  crop_name: string;
  disease_name: string;
  severity: string;
  tasks: Task[];
  total_cost_inr: number;
  deadline_hours: number;
  urgency: string;
  community_notes: string;
  weather_impact: string;
  loss_warning: string;
  notes: string;
}

interface ScanData {
  id: string;
  user_id: string;
  crop_id?: string;
  plant_name: string;
  disease_name: string;
  severity: string;
  confidence: number;
  potential_loss: number;
  latitude?: number;
  longitude?: number;
  location?: string;
}

// ── 1️⃣ RULE ENGINE: Disease → Treatment Mapping ──────────────────────────

const DISEASE_RULES: Record<string, {
  products: TreatmentProduct[];
  day_wise_plan: Array<{ day: number; title: string; description: string }>;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  cost_estimate: number;
  deadline_hours: number;
}> = {
  'Early Blight': {
    products: [
      { name: 'Mancozeb 75% WP', quantity: '2.5', unit: 'kg per 500L', cost_inr: 350 },
      { name: 'Chlorothalonil 75% WP', quantity: '2', unit: 'kg per 500L', cost_inr: 400 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Scout & Remove Lower Leaves', description: 'Inspect field, remove all lower leaves (0-30cm), dispose in bag' },
      { day: 1, title: 'First Spray - Mancozeb', description: 'Spray Mancozeb 2.5kg in 500L water, cover all leaf surfaces' },
      { day: 2, title: 'Monitor Crop', description: 'Check for new symptoms, ensure good air circulation' },
      { day: 7, title: 'Second Spray', description: 'Repeat spray at 7-day interval' },
      { day: 14, title: 'Third Spray', description: 'Continue 7-10 day spray schedule' },
    ],
    urgency: 'high',
    cost_estimate: 2500,
    deadline_hours: 48,
  },
  'Late Blight': {
    products: [
      { name: 'Metalaxyl 8% + Mancozeb 64% WP', quantity: '2', unit: 'kg per 500L', cost_inr: 600 },
      { name: 'Cymoxanil 8% + Mancozeb 64% WP', quantity: '2.5', unit: 'kg per 500L', cost_inr: 650 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Emergency Spray', description: 'IMMEDIATE: Spray Metalaxyl+Mancozeb within 24 hours' },
      { day: 2, title: 'Remove Infected Parts', description: 'Prune all water-soaked leaves, dispose safely' },
      { day: 5, title: 'Second Spray', description: 'Repeat spray (5-7 day interval during monsoon)' },
      { day: 12, title: 'Third Spray', description: 'Continue sprays based on weather' },
    ],
    urgency: 'critical',
    cost_estimate: 4000,
    deadline_hours: 24,
  },
  'Powdery Mildew': {
    products: [
      { name: 'Sulfur 80% WP', quantity: '2.5', unit: 'kg per 500L', cost_inr: 180 },
      { name: 'Hexaconazole 5% SC', quantity: '500', unit: 'ml per 500L', cost_inr: 420 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Prune Affected Areas', description: 'Remove all affected leaves and stems, improve airflow' },
      { day: 1, title: 'First Spray - Sulfur', description: 'Spray Sulfur early morning or evening (avoid midday heat)' },
      { day: 10, title: 'Second Spray', description: 'Repeat spray if white powder persists' },
      { day: 20, title: 'Switch Treatment', description: 'If persisting, switch to Hexaconazole' },
    ],
    urgency: 'medium',
    cost_estimate: 1800,
    deadline_hours: 72,
  },
  'Leaf Spot': {
    products: [
      { name: 'Copper Oxychloride 50% WP', quantity: '2.5', unit: 'kg per 500L', cost_inr: 320 },
      { name: 'Chlorothalonil 75% WP', quantity: '2', unit: 'kg per 500L', cost_inr: 400 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Remove Diseased Leaves', description: 'Remove all spotted leaves, improve drainage' },
      { day: 1, title: 'First Spray', description: 'Spray Copper Oxychloride solution' },
      { day: 10, title: 'Second Spray', description: 'Follow-up spray after 10 days' },
    ],
    urgency: 'medium',
    cost_estimate: 2000,
    deadline_hours: 72,
  },
  'Anthracnose': {
    products: [
      { name: 'Copper Oxychloride 50% WP', quantity: '2.5', unit: 'kg per 500L', cost_inr: 320 },
      { name: 'Trichoderma 1% WP', quantity: '1', unit: 'kg per 500L', cost_inr: 280 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Prune Infected Parts', description: 'Remove all infected leaves, stems, and fruits' },
      { day: 1, title: 'First Spray - Copper', description: 'Spray Copper Oxychloride on all plant parts' },
      { day: 10, title: 'Second Spray', description: 'Repeat spray after 10 days' },
      { day: 20, title: 'Switch to Bio-fungicide', description: 'Use Trichoderma for long-term prevention' },
    ],
    urgency: 'high',
    cost_estimate: 2200,
    deadline_hours: 48,
  },
  'Rust': {
    products: [
      { name: 'Sulfur 80% WP', quantity: '2.5', unit: 'kg per 500L', cost_inr: 180 },
      { name: 'Propiconazole 25% EC', quantity: '400', unit: 'ml per 500L', cost_inr: 350 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Increase Air Circulation', description: 'Remove lower leaves, prune excess branch growth' },
      { day: 1, title: 'First Spray - Sulfur', description: 'Apply Sulfur powder early morning or late evening' },
      { day: 10, title: 'Second Spray', description: 'Follow-up spray if rust persists' },
      { day: 20, title: 'Switch to Systemic', description: 'Use Propiconazole if widespread' },
    ],
    urgency: 'medium',
    cost_estimate: 1800,
    deadline_hours: 72,
  },
  'Downy Mildew': {
    products: [
      { name: 'Dimethomorph 40% + Mancozeb 32% WS', quantity: '2', unit: 'kg per 500L', cost_inr: 550 },
      { name: 'Metalaxyl 8% + Mancozeb 64% WP', quantity: '2.5', unit: 'kg per 500L', cost_inr: 600 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Emergency Spray', description: 'URGENT: Spray Dimethomorph within 24 hours' },
      { day: 1, title: 'Remove Affected Leaves', description: 'Prune all yellow/diseased leaves' },
      { day: 5, title: 'Second Spray', description: '5-day interval spray during wet weather' },
      { day: 12, title: 'Continue Sprays', description: 'Repeat every 5-7 days until disease stops' },
    ],
    urgency: 'critical',
    cost_estimate: 3500,
    deadline_hours: 24,
  },
  'Septoria Leaf Blotch': {
    products: [
      { name: 'Chlorothalonil 75% WP', quantity: '2', unit: 'kg per 500L', cost_inr: 400 },
      { name: 'Carbendazim 50% WP', quantity: '1.5', unit: 'kg per 500L', cost_inr: 320 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Remove Lower Leaves', description: 'Remove all affected and lower leaves' },
      { day: 1, title: 'First Spray', description: 'Spray Chlorothalonil on remaining foliage' },
      { day: 14, title: 'Second Spray', description: '14-day interval spray' },
      { day: 28, title: 'Third Spray', description: 'Continue if symptoms persist' },
    ],
    urgency: 'medium',
    cost_estimate: 2000,
    deadline_hours: 72,
  },
  'Fusarium Wilt': {
    products: [
      { name: 'Trichoderma 1% WP', quantity: '1.5', unit: 'kg per 500L', cost_inr: 350 },
      { name: 'Carbendazim 50% WP', quantity: '1.5', unit: 'kg per 500L', cost_inr: 320 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Remove Infected Plant', description: 'Uproot and destroy infected plant completely' },
      { day: 1, title: 'Soil Treatment', description: 'Treat soil with Trichoderma around infected area' },
      { day: 2, title: 'Disinfect Tools', description: 'Sterilize all tools used to prevent spread' },
      { day: 7, title: 'Preventive Spray', description: 'Spray remaining plants with Carbendazim' },
    ],
    urgency: 'critical',
    cost_estimate: 2000,
    deadline_hours: 24,
  },
  'Bacterial Leaf Spot': {
    products: [
      { name: 'Copper Hydroxide 77% WP', quantity: '1.5', unit: 'kg per 500L', cost_inr: 420 },
      { name: 'Kasugamycin 3% L', quantity: '1', unit: 'L per 500L', cost_inr: 380 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Remove Infected Leaves', description: 'Remove all affected leaves and dispose safely' },
      { day: 1, title: 'First Spray - Copper', description: 'Spray Copper Hydroxide on all plant surfaces' },
      { day: 7, title: 'Second Spray', description: 'Repeat using Kasugamycin' },
      { day: 14, title: 'Alternate Sprays', description: 'Continue alternating sprays every 7 days' },
    ],
    urgency: 'high',
    cost_estimate: 2400,
    deadline_hours: 48,
  },
  'Bud Rot': {
    products: [
      { name: 'Copper Oxychloride 50% WP', quantity: '2.5', unit: 'kg per 500L', cost_inr: 320 },
      { name: 'Bordeaux Mixture 1% Sol', quantity: 'Custom', unit: 'as per need', cost_inr: 200 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Remove All Affected Buds', description: 'Prune all infected buds and young terminals' },
      { day: 1, title: 'First Spray', description: 'Spray Copper Oxychloride thoroughly' },
      { day: 10, title: 'Second Spray', description: 'Follow-up spray after 10 days' },
      { day: 20, title: 'Monitor New Growth', description: 'Watch for new symptoms on emerging buds' },
    ],
    urgency: 'high',
    cost_estimate: 1800,
    deadline_hours: 48,
  },
  'Yellow Mosaic Virus': {
    products: [
      { name: 'Neem Oil 3% EC', quantity: '2.5', unit: 'L per 500L', cost_inr: 280 },
      { name: 'Imidacloprid 17.8% SL', quantity: '300', unit: 'ml per 500L', cost_inr: 420 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Remove Infected Plant', description: 'Uproot and destroy completely' },
      { day: 1, title: 'Spray Neem Oil', description: 'Spray on remaining healthy plants for vector control' },
      { day: 2, title: 'Apply Insecticide', description: 'Spray Imidacloprid to kill aphid vectors' },
      { day: 5, title: 'Repeat Sprays', description: 'Repeat Neem + Insecticide every 5 days' },
    ],
    urgency: 'critical',
    cost_estimate: 2400,
    deadline_hours: 24,
  },
  'Leaf Curl': {
    products: [
      { name: 'Imidacloprid 17.8% SL', quantity: '300', unit: 'ml per 500L', cost_inr: 420 },
      { name: 'Thiamethoxam 25% WG', quantity: '400', unit: 'g per 500L', cost_inr: 480 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Spray for Vector Control', description: 'Apply Imidacloprid to control whiteflies' },
      { day: 2, title: 'Remove Severely Affected', description: 'Prune heavily curled leaves' },
      { day: 7, title: 'Second Spray', description: 'Repeat insecticide spray every 7 days' },
      { day: 14, title: 'Continue Control', description: 'Maintain vector pressure for 4 weeks' },
    ],
    urgency: 'high',
    cost_estimate: 2400,
    deadline_hours: 48,
  },
  'Root Knot Nematode': {
    products: [
      { name: 'Carbofuran 3% G', quantity: '15', unit: 'kg per acre', cost_inr: 650 },
      { name: 'Paecilomyces lilacinus', quantity: '2', unit: 'kg per acre', cost_inr: 350 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Assess Plant Damage', description: 'Check roots, look for galls and stunting' },
      { day: 1, title: 'Soil Treatment', description: 'Apply Carbofuran granules around root zone' },
      { day: 2, title: 'Water Thoroughly', description: 'Irrigate to activate nematicide' },
      { day: 30, title: 'Bio-nematicide', description: 'Apply Paecilomyces lilacinus for long-term control' },
    ],
    urgency: 'high',
    cost_estimate: 3000,
    deadline_hours: 48,
  },
  'Sclerotium Rot': {
    products: [
      { name: 'Trichoderma 1% WP', quantity: '1.5', unit: 'kg per 500L', cost_inr: 350 },
      { name: 'Carbendazim 50% WP', quantity: '1.5', unit: 'kg per 500L', cost_inr: 320 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Remove Affected Plants', description: 'Uproot infected plants, clear dead plant matter' },
      { day: 1, title: 'Soil Sterilization', description: 'Treat soil with Trichoderma' },
      { day: 2, title: 'Improve Drainage', description: 'Add sand/grit to improve soil aeration' },
      { day: 7, title: 'Preventive Spray', description: 'Spray remaining plants with Carbendazim' },
    ],
    urgency: 'critical',
    cost_estimate: 2200,
    deadline_hours: 24,
  },
  'Thrips Damage': {
    products: [
      { name: 'Spinosad 45% SC', quantity: '750', unit: 'ml per 500L', cost_inr: 520 },
      { name: 'Neem Oil 3% EC', quantity: '2.5', unit: 'L per 500L', cost_inr: 280 },
    ],
    day_wise_plan: [
      { day: 1, title: 'First Spray - Spinosad', description: 'Spray early morning or evening, cover leaf undersides' },
      { day: 5, title: 'Second Spray', description: 'Repeat Spinosad after 5 days' },
      { day: 10, title: 'Switch to Neem Oil', description: 'Alternate with Neem Oil for resistance management' },
      { day: 15, title: 'Continued Monitoring', description: 'Continue alternate sprays weekly' },
    ],
    urgency: 'medium',
    cost_estimate: 2400,
    deadline_hours: 72,
  },
  'Spider Mites': {
    products: [
      { name: 'Sulphur 80% WP', quantity: '2.5', unit: 'kg per 500L', cost_inr: 180 },
      { name: 'Dicofol 18.5% EC', quantity: '600', unit: 'ml per 500L', cost_inr: 380 },
    ],
    day_wise_plan: [
      { day: 1, title: 'First Spray - Sulfur', description: 'Spray Sulfur powder early morning or evening' },
      { day: 1, title: 'Increase Humidity', description: 'Water soil to increase humidity, reduce mites' },
      { day: 7, title: 'Second Spray', description: 'Repeat Sulfur if mites persist' },
      { day: 14, title: 'Switch to Acaricide', description: 'Use Dicofol if Sulfur ineffective' },
    ],
    urgency: 'medium',
    cost_estimate: 1900,
    deadline_hours: 72,
  },
  'Gray Mold (Botrytis)': {
    products: [
      { name: 'Iprodione 50% WP', quantity: '1.5', unit: 'kg per 500L', cost_inr: 450 },
      { name: 'Pyrimethanil 40% WG', quantity: '600', unit: 'g per 500L', cost_inr: 520 },
    ],
    day_wise_plan: [
      { day: 1, title: 'Improve Air Circulation', description: 'Prune excessive foliage, increase spacing' },
      { day: 1, title: 'Remove Affected Parts', description: 'Remove all gray-moldy flowers/fruits' },
      { day: 1, title: 'First Spray', description: 'Spray Iprodione thoroughly' },
      { day: 10, title: 'Second Spray', description: 'Alternate with Pyrimethanil for 5-day interval' },
    ],
    urgency: 'high',
    cost_estimate: 2600,
    deadline_hours: 48,
  },
  'Healthy': {
    products: [],
    day_wise_plan: [
      { day: 1, title: 'Continue Monitoring', description: 'Weekly crop health checks' },
      { day: 7, title: 'Preventive Care', description: 'Maintain good field hygiene and crop rotation' },
      { day: 14, title: 'Nutrient Management', description: 'Monitor soil fertility and provide balanced nutrition' },
      { day: 30, title: 'Pest Monitoring', description: 'Scout for early signs of pests or diseases' },
    ],
    urgency: 'low',
    cost_estimate: 0,
    deadline_hours: 168,
  },
};

// ── 2️⃣ CONTEXT ENGINE: Adjust based on Weather, Severity, Alerts ───────────

function adjustForContext(
  rule: typeof DISEASE_RULES['Early Blight'],
  severity: string,
  weather: { humidity: number; temperature: number; rainfall: boolean },
  nearby_alerts: number
): Task[] {
  const tasks: Task[] = [];

  // Adjust urgency based on severity
  const severityMultiplier = severity === 'critical' ? 1.5 : severity === 'warning' ? 1.0 : 0.7;
  
  // Adjust urgency for high humidity (disease-friendly conditions)
  const humidityFactor = weather.humidity > 80 ? 'high' : weather.humidity > 60 ? 'medium' : 'low';
  
  // Adjust urgency for temperature
  const tempFactor = weather.temperature > 28 ? 'high' : weather.temperature < 15 ? 'low' : 'medium';
  
  // Create context-adjusted tasks
  rule.day_wise_plan.forEach((plan, index) => {
    const product = rule.products[index % rule.products.length];
    
    // Determine priority based on day
    const priority = index <= 1 ? 'urgent' : index <= 3 ? 'recommended' : 'optional';
    
    // Determine urgency based on context
    const urgency_level =
      humidityFactor === 'high' && tempFactor === 'high' ? 'high' :
      humidityFactor === 'high' || tempFactor === 'high' ? 'medium' :
      'low';
    
    // Adjust reason based on context
    let reason = `${plan.description}.`;
    if (humidityFactor === 'high') reason += ' High humidity increases disease spread urgency.';
    if (weather.rainfall) reason += ' Rain expected - spray before rainfall.';
    if (nearby_alerts > 3) reason += ` ${nearby_alerts} nearby farmers facing the same issue.`;
    
    tasks.push({
      day: plan.day,
      title: plan.title,
      description: plan.description,
      product,
      priority,
      urgency_level,
      reason,
      cost_inr: product.cost_inr || 0,
    });
  });

  return tasks;
}

// ── 3️⃣ COST ENGINE: Calculate Costs ───────────────────────────────────────

function calculateCosts(tasks: Task[]): number {
  return tasks.reduce((sum, task) => sum + (task.cost_inr || 0), 0);
}

// ── 4️⃣ PRIORITY ENGINE: Set Priorities ────────────────────────────────────

function assignPriorities(tasks: Task[], severity: string): Task[] {
  return tasks.map((task, index) => {
    if (severity === 'critical') {
      return {
        ...task,
        priority: index <= 2 ? 'urgent' : 'recommended',
        urgency_level: index <= 2 ? 'high' : 'medium',
      };
    } else if (severity === 'warning') {
      return {
        ...task,
        priority: index <= 1 ? 'urgent' : 'recommended',
        urgency_level: index <= 1 ? 'high' : 'medium',
      };
    }
    return task;
  });
}

// ── 5️⃣ COMMUNITY ENGINE: Add Nearby Context ───────────────────────────────

function getCommonityContext(nearby_alerts: number): string {
  if (nearby_alerts >= 5) {
    return `🚨 CRITICAL SPREAD ALERT: ${nearby_alerts} farmers in your region are reporting the same disease. Act immediately to prevent further spread.`;
  } else if (nearby_alerts >= 3) {
    return `⚠️ SPREAD WARNING: ${nearby_alerts} nearby farmers facing the same issue. Early action essential.`;
  } else if (nearby_alerts > 0) {
    return `ℹ️ ${nearby_alerts} farmer(s) nearby reporting this disease. Share treatment results.`;
  }
  return 'No similar reports from nearby farmers. You may be among the first - monitor closely.';
}

// ── 6️⃣ REGRET + URGENCY ENGINE: Calculate Deadline & Loss ─────────────────

export function calculateUrgency(
  severity: string,
  weather: { humidity: number; temperature: number; rainfall: boolean },
  potential_loss: number
): { deadline_hours: number; urgency: string; loss_warning: string } {
  let deadline_hours = 72; // Default 3 days

  if (severity === 'critical') {
    deadline_hours = 24; // Must act within 24 hours
  } else if (severity === 'warning') {
    deadline_hours = 48; // Within 48 hours
  } else if (severity === 'info') {
    deadline_hours = 72; // Within 3 days
  }

  // Reduce deadline if conditions favor disease spread
  if (weather.humidity > 80) deadline_hours -= 12;
  if (weather.rainfall) deadline_hours -= 6;
  if (weather.temperature > 28) deadline_hours -= 6;

  const urgency =
    deadline_hours <= 24 ? 'CRITICAL - Act TODAY' :
    deadline_hours <= 48 ? 'HIGH - Act within 24 hours' :
    deadline_hours <= 72 ? 'MODERATE - Act within 48 hours' :
    'LOW - Plan within 3 days';

  const loss_warning =
    potential_loss > 10000
      ? `⚠️ FINANCIAL LOSS ALERT: If ignored, you may lose ₹${potential_loss.toLocaleString('en-IN')} on this crop.`
      : potential_loss > 5000
      ? `Loss Risk: ₹${potential_loss.toLocaleString('en-IN')} at stake. Immediate action recommended.`
      : `Potential Loss: ₹${potential_loss.toLocaleString('en-IN')} preventable if treated now.`;

  return { deadline_hours, urgency, loss_warning };
}

// ── MAIN AI DOCTOR FUNCTION ────────────────────────────────────────────────

export async function generateAIDoctorRecommendations(scan: ScanData): Promise<RecommendationResponse> {
  try {
    // Step 1: Get Rule Engine output
    const diseaseKey = scan.disease_name || 'Healthy';
    const rule = DISEASE_RULES[diseaseKey] || DISEASE_RULES['Healthy'];

    // Step 2: Fetch weather data for context
    const weather = await fetchWeatherData(scan.latitude, scan.longitude, scan.location);

    // Step 3: Count nearby alerts (Community Engine)
    const nearby_alerts = await countNearbyAlerts(scan.latitude, scan.longitude, scan.disease_name);

    // Step 4: Get context-adjusted tasks (Context Engine)
    const context_adjusted_tasks = adjustForContext(rule, scan.severity, weather, nearby_alerts);

    // Step 5: Assign priorities (Priority Engine)
    const priority_tasks = assignPriorities(context_adjusted_tasks, scan.severity);

    // Step 6: Calculate costs (Cost Engine)
    const total_cost = calculateCosts(priority_tasks);

    // Step 7: Calculate urgency and deadline (Regret + Urgency Engine)
    const { deadline_hours, urgency, loss_warning } = calculateUrgency(
      scan.severity,
      weather,
      scan.potential_loss
    );

    // Step 8: Get community context (Community Engine)
    const community_notes = getCommonityContext(nearby_alerts);

    // Step 9: Create weather impact statement
    const weather_impact =
      weather.humidity > 80
        ? 'High humidity favors disease spread. Spraying must start immediately.'
        : weather.rainfall
        ? 'Rain expected - apply treatment before rainfall for better efficacy.'
        : 'Current weather conditions are moderate. Act within 48 hours.';

    // Build final response
    const response: RecommendationResponse = {
      summary: `${scan.disease_name || 'Healthy'} detected on ${scan.plant_name} with ${scan.severity} severity. Confidence: ${scan.confidence}%`,
      crop_name: scan.plant_name,
      disease_name: diseaseKey,
      severity: scan.severity,
      tasks: priority_tasks,
      total_cost_inr: total_cost,
      deadline_hours,
      urgency,
      community_notes,
      weather_impact,
      loss_warning,
      notes: `Generated at ${new Date().toISOString()}. Review and start treatment immediately.`,
    };

    // Save tasks to database
    await saveTasks(scan, priority_tasks);

    // Cache recommendation
    await cacheRecommendation(scan, response);

    return response;
  } catch (err) {
    logger.error('Error in AI Doctor recommendation', err);
    throw err;
  }
}

// ── HELPER FUNCTIONS ───────────────────────────────────────────────────────

async function fetchWeatherData(
  latitude?: number,
  longitude?: number,
  location?: string
): Promise<{ humidity: number; temperature: number; rainfall: boolean }> {
  try {
    // Use real weather API if coordinates available
    if (latitude && longitude) {
      const weatherData = await getWeatherRisk(latitude, longitude);
      return {
        humidity: weatherData.humidity,
        temperature: weatherData.temperature,
        rainfall: weatherData.rain_probability > 30 || weatherData.description.toLowerCase().includes('rain'),
      };
    }
    
    // Fallback with realistic defaults
    logger.warn(`Weather data unavailable for location [${latitude}, ${longitude}, ${location}]`);
    return { humidity: 65, temperature: 25, rainfall: false };
  } catch (err) {
    logger.warn('Weather API error, using defaults', { err: String(err) });
    return { humidity: 65, temperature: 25, rainfall: false };
  }
}

async function countNearbyAlerts(
  latitude?: number,
  longitude?: number,
  disease?: string
): Promise<number> {
  try {
    if (!latitude || !longitude) return 0;

    const result = await query(
      `SELECT COUNT(*) as count FROM nearby_alerts 
       WHERE ST_Distance_Sphere(
         ST_Point(longitude, latitude),
         ST_Point($1, $2)
       ) <= 5000
       AND disease_name ILIKE $3`,
      [longitude, latitude, disease || '%']
    );

    return parseInt(result.rows[0]?.count || 0);
  } catch (err) {
    logger.warn('Could not fetch nearby alerts count', err);
    return 0;
  }
}

async function saveTasks(scan: ScanData, tasks: Task[]): Promise<void> {
  try {
    for (const task of tasks) {
      await query(
        `INSERT INTO ai_doctor_tasks 
         (user_id, scan_id, day, task_title, task_description, product_name, 
          priority, urgency_level, reason, cost_inr, disease_name, disease_severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          scan.user_id,
          scan.id,
          task.day,
          task.title,
          task.description,
          task.product?.name,
          task.priority,
          task.urgency_level,
          task.reason,
          task.cost_inr,
          scan.disease_name,
          scan.severity,
        ]
      );
    }
  } catch (err) {
    logger.warn('Could not save AI Doctor tasks', err);
  }
}

async function cacheRecommendation(scan: ScanData, response: RecommendationResponse): Promise<void> {
  try {
    await query(
      `INSERT INTO ai_doctor_recommendations 
       (user_id, scan_id, summary, crop_name, disease_name, severity, 
        total_cost_inr, deadline_hours, urgency, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT DO NOTHING`,
      [
        scan.user_id,
        scan.id,
        response.summary,
        response.crop_name,
        response.disease_name,
        response.severity,
        response.total_cost_inr,
        response.deadline_hours,
        response.urgency,
        response.notes,
      ]
    );
  } catch (err) {
    logger.warn('Could not cache AI Doctor recommendation', err);
  }
}

// ── TASK COMPLETION ───────────────────────────────────────────────────────

export async function completeTask(taskId: string): Promise<void> {
  try {
    await query(
      `UPDATE ai_doctor_tasks SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [taskId]
    );
  } catch (err) {
    logger.error('Error completing task', err);
    throw err;
  }
}

export async function getTasks(userId: string, scanId?: string): Promise<Task[]> {
  try {
    let sql = `SELECT * FROM ai_doctor_tasks WHERE user_id = $1`;
    const params: string[] = [userId];

    if (scanId) {
      sql += ` AND scan_id = $2`;
      params.push(scanId);
    }

    sql += ` ORDER BY day ASC`;

    const result = await query(sql, params);
    return result.rows || [];
  } catch (err) {
    logger.error('Error fetching tasks', err);
    return [];
  }
}

// ── MULTILINGUAL TRANSLATION ──────────────────────────────────────────────

const HINDI_TRANSLATIONS: Record<string, string> = {
  // Diseases
  'Early Blight': 'अर्ली ब्लाइट (तना एवं पत्ती धब्बा)',
  'Late Blight': 'लेट ब्लाइट (झुलसा रोग)',
  'Powdery Mildew': 'चूर्णी आसिता (सफेद चूर्ण)',
  'Leaf Spot': 'पत्ती धब्बा रोग',
  'Anthracnose': 'एन्थ्रेक्नोज (काले धब्बे)',
  'Rust': 'गेरुई रोग (जंग)',
  'Downy Mildew': 'डाउनी मिल्ड्यू रोग',
  'Septoria Leaf Blotch': 'सेप्टोरिया पत्ती धब्बा',
  'Fusarium Wilt': 'फ्यूजेरियम उकठा रोग',
  'Bacterial Leaf Spot': 'जीवाणु पत्ती धब्बा',
  'Bud Rot': 'कली सड़न रोग',
  'Yellow Mosaic Virus': 'पीला मोज़ेक वायरस',
  'Leaf Curl': 'पत्ती मुड़न रोग',
  'Root Knot Nematode': 'मूल गाँठ सूत्रकृमि',
  'Sclerotium Rot': 'स्क्लेरोशियम सड़न',
  'Thrips Damage': 'थ्रिप्स कीट नुकसान',
  'Spider Mites': 'लाल मकड़ी के कण',
  'Gray Mold (Botrytis)': 'ग्रे मोल्ड (बोट्राइटिस)',
  'Healthy': 'स्वस्थ',
  
  // Actions
  'Scout & Remove Lower Leaves': 'अवलोकन करें एवं निचली पत्तियों को हटाएं',
  'First Spray': 'पहली स्प्रे',
  'Monitor Crop': 'रोप की निगरानी करें',
  'Second Spray': 'दूसरी स्प्रे',
  'Prune Infected Areas': 'संक्रमित भागों को काटें',
  'Remove Affected Leaves': 'प्रभावित पत्तियों को हटाएं',
  'Increase Air Circulation': 'हवा का संचार बढ़ाएं',
  'Uproot and Destroy': 'पौधे को उखाड़ें और नष्ट करें',
  'Soil Treatment': 'मिट्टी का उपचार',
  'Emergency Spray': 'आपातकालीन स्प्रे',
  'Continue Monitoring': 'निगरानी जारी रखें',
  'Preventive Care': 'रोकथाम की देखभाल',
  
  // Units and quantities
  'kg per 500L': 'किग्रा प्रति 500 लीटर',
  'ml per 500L': 'मिली प्रति 500 लीटर',
  'L per 500L': 'लीटर प्रति 500 लीटर',
  'g per 500L': 'ग्राम प्रति 500 लीटर',
  'kg per acre': 'किग्रा प्रति एकड़',
  
  // Severity levels
  'critical': 'गंभीर',
  'warning': 'चेतावनी',
  'info': 'जानकारी',
  'healthy': 'स्वस्थ',
  
  // Priority levels
  'urgent': 'तुरंत',
  'recommended': 'अनुशंसित',
  'optional': 'वैकल्पिक',
};

const MARATHI_TRANSLATIONS: Record<string, string> = {
  // Diseases
  'Early Blight': 'मुक्त ब्लाइट (लड कोरड)',
  'Late Blight': 'उशीरा ब्लाइट (होळ)',
  'Powdery Mildew': 'पांढरा चूर्ण',
  'Leaf Spot': 'पाता रोग',
  'Anthracnose': 'अँथ्राक्नोज',
  'Rust': 'गारुण रोग',
  'Downy Mildew': 'डाउनी मिल्ड्यू',
  'Septoria Leaf Blotch': 'सेप्टोरिया पाता रोग',
  'Fusarium Wilt': 'फ्यूजेरियम मुरझण',
  'Bacterial Leaf Spot': 'जीवाणु पाता रोग',
  'Bud Rot': 'कळी सडण रोग',
  'Yellow Mosaic Virus': 'पिवळा मोज़ेक व्हायरस',
  'Leaf Curl': 'पाता वाकून जाणे',
  'Root Knot Nematode': 'मुळ गाठ सूत्रकृमी',
  'Sclerotium Rot': 'स्क्लेरोशियम सडण',
  'Thrips Damage': 'थ्रिप्स कीटक नुकसान',
  'Spider Mites': 'लाल कणा',
  'Gray Mold (Botrytis)': 'राखाडी बुरशी',
  'Healthy': 'निरोगी',
  
  // Actions
  'Scout & Remove Lower Leaves': 'पाहणी करा आणि खालच्या पात्यांना हटवा',
  'First Spray': 'पहिली फवारणी',
  'Monitor Crop': 'पिकाचे निरीक्षण करा',
  'Second Spray': 'दुसरी फवारणी',
  'Prune Infected Areas': 'संक्रमित भागांची छाटणी करा',
  'Remove Affected Leaves': 'प्रभावित पाती हटवा',
  'Increase Air Circulation': 'हवेचे प्रभाव वाढवा',
  'Uproot and Destroy': 'रोप उखाडून नष्ट करा',
  'Soil Treatment': 'मातीचे उपचार',
  'Emergency Spray': 'आपातकालीन फवारणी',
  'Continue Monitoring': 'निरीक्षण सुरू ठेवा',
  'Preventive Care': 'प्रतिबंधात्मक काळजी',
  
  // Units
  'kg per 500L': 'किग्रा प्रति 500 लीटर',
  'ml per 500L': 'मिली प्रति 500 लीटर',
  'L per 500L': 'लीटर प्रति 500 लीटर',
  'g per 500L': 'ग्राम प्रति 500 लीटर',
  'kg per acre': 'किग्रा प्रति एकर',
  
  // Severity
  'critical': 'गंभीर',
  'warning': 'सावधता',
  'info': 'माहिती',
  'healthy': 'निरोगी',
  
  // Priority
  'urgent': 'तुरंत',
  'recommended': 'शिफारस केलेले',
  'optional': 'वैकल्पिक',
};

function translateText(text: string, language: 'hi' | 'mr'): string {
  const dictionary = language === 'hi' ? HINDI_TRANSLATIONS : MARATHI_TRANSLATIONS;
  return dictionary[text] || text; // Fallback to original if not translated
}

export function translateRecommendations(
  recommendation: RecommendationResponse,
  language: 'en' | 'hi' | 'mr'
): RecommendationResponse {
  if (language === 'en') return recommendation;

  const translatedTasks = recommendation.tasks.map((task) => ({
    ...task,
    title: translateText(task.title, language),
    description: translateText(task.description, language),
    reason: translateText(task.reason, language),
    product: task.product ? {
      ...task.product,
      name: task.product.name,
      quantity: task.product.quantity,
      unit: translateText(task.product.unit, language),
      cost_inr: task.product.cost_inr,
    } : undefined,
    priority: translateText(task.priority, language) as 'urgent' | 'recommended' | 'optional',
    urgency_level: translateText(task.urgency_level, language) as 'high' | 'medium' | 'low',
  }));

  return {
    ...recommendation,
    summary: translateText(recommendation.summary, language),
    disease_name: translateText(recommendation.disease_name, language),
    severity: translateText(recommendation.severity, language),
    urgency: translateText(recommendation.urgency, language),
    community_notes: translateText(recommendation.community_notes, language),
    weather_impact: translateText(recommendation.weather_impact, language),
    loss_warning: translateText(recommendation.loss_warning, language),
    tasks: translatedTasks,
  };
}
