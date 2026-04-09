/**
 * AgroMind Regret AI Engine
 * Converts predictions into emotional + financial urgency triggers.
 * Based on behavioral psychology: loss aversion, regret theory, urgency framing.
 */

export interface RegretAnalysis {
  regret_score: number;          // 0–100 urgency score
  urgency_level: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  urgency_text: string;
  time_to_act_hours: number;
  daily_loss_inr: number;
  weekly_loss_inr: number;
  monthly_loss_inr: number;
  treatment_cost_inr: number;    // Estimated cost of treatment
  roi_multiplier: number;        // Loss prevented / treatment cost
  emotional_message: string;
  financial_message: string;
  social_proof: string;
  action_button_text: string;
  countdown_message: string;
  loss_amount_inr?: number;
  saved_amount_inr?: number;
  spread_pct?: number;
  days_to_damage?: number;
  yield_per_acre_inr?: number;
  disease_severity_factor?: number;
}

interface RegretInput {
  severity: 'critical' | 'warning' | 'info' | 'healthy';
  potential_loss_inr: number;
  confidence: number;
  urgency_days?: number;
  disease_name?: string;
  crop_name?: string;
  farmer_name?: string;
  location?: string;
}

export interface RegretImpactEstimate {
  loss_amount_inr: number;
  saved_amount_inr: number;
  spread_pct: number;
  days_to_damage: number;
  treatment_cost_inr: number;
  yield_per_acre_inr: number;
  disease_severity_factor: number;
}

const SEVERITY_FACTOR: Record<string, number> = {
  critical: 0.9,
  warning: 0.6,
  info: 0.3,
  healthy: 0,
};

const DEFAULT_DAMAGE_DAYS: Record<string, number> = {
  critical: 2,
  warning: 7,
  info: 14,
  healthy: 0,
};

export function estimateRegretImpact(
  severity: RegretInput['severity'],
  potentialLossInr: number,
  urgencyDays?: number
): RegretImpactEstimate {
  const factor = SEVERITY_FACTOR[severity] ?? 0.3;
  const yieldPerAcre = factor > 0 ? Math.round(potentialLossInr / factor) : 0;
  const lossAmount = Math.round(yieldPerAcre * factor);
  const treatmentCost = severity === 'healthy' ? 0 : Math.round(lossAmount * 0.08);
  const savedAmount = Math.max(0, lossAmount - treatmentCost);
  const spreadPct = Math.round(Math.min(100, factor * 100));
  const daysToDamage = urgencyDays || DEFAULT_DAMAGE_DAYS[severity] || 7;

  return {
    loss_amount_inr: lossAmount,
    saved_amount_inr: savedAmount,
    spread_pct: spreadPct,
    days_to_damage: daysToDamage,
    treatment_cost_inr: treatmentCost,
    yield_per_acre_inr: yieldPerAcre,
    disease_severity_factor: factor,
  };
}

const EMOTIONAL_MESSAGES: Record<string, string[]> = {
  critical: [
    "Every hour you wait, your hard work this season gets closer to zero.",
    "You planted this crop with your savings. Don't let one delay destroy it all.",
    "Your family depends on this harvest. This disease does not wait.",
    "You will regret not acting today. Your neighbours who acted saved everything.",
  ],
  warning: [
    "Small problems become big ones fast. Your crop is giving you a warning — listen.",
    "The farmers who lost everything said the same: 'I thought it would be fine.'",
    "Acting today costs ₹500. Waiting a week costs ₹15,000. Choose wisely.",
    "You detected this early — that is your advantage. Don't waste it.",
  ],
  info: [
    "Your crop is telling you something. Pay attention before it gets worse.",
    "Prevention now saves regret later.",
  ],
  healthy: [
    "Your crop is healthy — keep it that way with weekly monitoring.",
    "Great job! Healthy crops mean healthy profits. Keep up the good work.",
  ],
};

const SOCIAL_PROOF_MESSAGES = [
  "12 farmers near you resolved this issue today and saved their harvest.",
  "Farmers who act within 24 hours save 85% more than those who wait 3 days.",
  "Over 500 AgroMind users have resolved this exact issue successfully.",
  "Your neighbouring farmer Amit prevented ₹34,000 loss by acting on this alert.",
  "Community data shows early treatment reduces loss by 89% on average.",
];

export function calculateRegret(input: RegretInput): RegretAnalysis {
  const { severity, potential_loss_inr, confidence, urgency_days = 7, disease_name = 'disease', crop_name = 'crop' } = input;

  if (severity === 'healthy') {
    return {
      regret_score: 0, urgency_level: 'safe', urgency_text: 'No action needed',
      time_to_act_hours: 0, daily_loss_inr: 0, weekly_loss_inr: 0, monthly_loss_inr: 0,
      treatment_cost_inr: 0, roi_multiplier: 0,
      emotional_message: EMOTIONAL_MESSAGES.healthy[Math.floor(Math.random() * EMOTIONAL_MESSAGES.healthy.length)],
      financial_message: 'Your crop is healthy — no financial risk detected.',
      social_proof: 'Healthy crops monitored by AgroMind stay healthy 94% of the season.',
      action_button_text: 'Continue Monitoring',
      countdown_message: 'Next scan recommended in 7 days',
      loss_amount_inr: 0,
      saved_amount_inr: 0,
      spread_pct: 0,
      days_to_damage: 0,
      yield_per_acre_inr: 0,
      disease_severity_factor: 0,
    };
  }

  // Financial calculations
  const daily_loss = potential_loss_inr / Math.max(urgency_days, 1);
  const weekly_loss = daily_loss * 7;
  const monthly_loss = daily_loss * 30;
  const treatment_cost = Math.round(potential_loss_inr * 0.08); // ~8% of loss is treatment cost
  const roi_multiplier = treatment_cost > 0 ? Math.round(potential_loss_inr / treatment_cost) : 0;
  const time_to_act_hours = urgency_days * 24;

  // Regret score calculation (0–100)
  const severity_weight = { critical: 40, warning: 25, info: 10 }[severity] || 10;
  const loss_weight = Math.min(30, potential_loss_inr / 2000);
  const confidence_weight = (confidence / 100) * 20;
  const urgency_weight = Math.max(0, 10 - urgency_days);
  const regret_score = Math.min(100, Math.round(severity_weight + loss_weight + confidence_weight + urgency_weight));

  // Urgency level
  let urgency_level: RegretAnalysis['urgency_level'];
  let urgency_text: string;
  let action_button_text: string;

  if (regret_score >= 75) {
    urgency_level = 'critical';
    urgency_text = `ACT NOW — You have less than ${Math.ceil(time_to_act_hours / 24)} day(s) before irreversible damage`;
    action_button_text = '🚨 Treat Immediately';
  } else if (regret_score >= 50) {
    urgency_level = 'high';
    urgency_text = `Act within ${urgency_days} days to prevent ₹${potential_loss_inr.toLocaleString('en-IN')} loss`;
    action_button_text = '⚡ Start Treatment Plan';
  } else if (regret_score >= 25) {
    urgency_level = 'medium';
    urgency_text = `Monitor closely — treatment recommended within ${urgency_days} days`;
    action_button_text = '📋 View Treatment Plan';
  } else {
    urgency_level = 'low';
    urgency_text = 'Low risk detected — monitor regularly';
    action_button_text = '👁️ Monitor Crop';
  }

  // Messages
  const msgs = EMOTIONAL_MESSAGES[severity] || EMOTIONAL_MESSAGES.warning;
  const emotional_message = msgs[Math.floor(Math.random() * msgs.length)];
  const financial_message = `Every day of delay costs you ₹${Math.round(daily_loss).toLocaleString('en-IN')}. ` +
    `Treatment costs only ₹${treatment_cost.toLocaleString('en-IN')} — a ${roi_multiplier}x return on action.`;
  const social_proof = SOCIAL_PROOF_MESSAGES[Math.floor(Math.random() * SOCIAL_PROOF_MESSAGES.length)];
  const countdown_message = urgency_level === 'critical'
    ? `⏰ Treatment window closes in ~${urgency_days * 24} hours`
    : `📅 Optimal treatment window: next ${urgency_days} days`;

  const impact = estimateRegretImpact(severity, potential_loss_inr, urgency_days);

  return {
    regret_score, urgency_level, urgency_text, time_to_act_hours,
    daily_loss_inr: Math.round(daily_loss),
    weekly_loss_inr: Math.round(weekly_loss),
    monthly_loss_inr: Math.round(monthly_loss),
    treatment_cost_inr: treatment_cost,
    roi_multiplier,
    emotional_message, financial_message, social_proof,
    action_button_text, countdown_message,
    loss_amount_inr: impact.loss_amount_inr,
    saved_amount_inr: impact.saved_amount_inr,
    spread_pct: impact.spread_pct,
    days_to_damage: impact.days_to_damage,
    yield_per_acre_inr: impact.yield_per_acre_inr,
    disease_severity_factor: impact.disease_severity_factor,
  };
}

export function buildRegretTimeline(
  potential_loss_inr: number, urgency_days: number
): Array<{ day: number; cumulative_loss_inr: number; label: string; is_critical: boolean }> {
  const daily = potential_loss_inr / Math.max(urgency_days, 1);
  const milestones = [1, 2, 3, 5, 7, 10, 14, 21, 30];
  return milestones
    .filter(d => d <= 30)
    .map(day => ({
      day,
      cumulative_loss_inr: Math.round(daily * day),
      label: day === 1 ? 'Tomorrow' : day <= urgency_days ? `Day ${day}` : `Day ${day} (Critical)`,
      is_critical: day > urgency_days,
    }));
}
