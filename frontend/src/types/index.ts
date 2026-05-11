// ─── Auth ────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  farm_size?: number;
  farm_size_unit?: string;
  language?: string;
  profile_image_url?: string;
  is_verified?: boolean;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ─── Farm & Crop ─────────────────────────────────────────────────────────────
export interface Farm {
  id: string;
  user_id: string;
  name: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  total_area?: number;
  area_unit?: string;
  soil_type?: string;
  crop_count?: number;
  created_at: string;
}

export interface Crop {
  id: string;
  farm_id?: string;
  user_id: string;
  name: string;
  variety?: string;
  field_name?: string;
  area?: number;
  area_unit?: string;
  planted_date?: string;
  expected_harvest_date?: string;
  status: 'growing' | 'harvested' | 'failed';
  health_score: number;
  farm_name?: string;
  scan_count?: number;
  active_alerts?: number;
  created_at: string;
}

// ─── Scan ─────────────────────────────────────────────────────────────────────
export interface TreatmentStep {
  step: number;
  title: string;
  description: string;
  duration: string;
  product?: string;
  dosage?: string;
  urgency?: string;
  estimated_cost_inr?: number;
}

export interface DiseaseInfo {
  scientific_name: string;
  affected_crops: string[];
  spread_mechanism: string;
  prevention: string;
  symptoms?: string[];
  causes?: string[];
  organic_treatment?: string;
  chemical_treatment?: string;
  prevention_tips?: string[];
  recovery_chances?: string;
  recommended_fertilizer?: string;
  irrigation_suggestions?: string;
  weather_risk_analysis?: {
    humidity_risk: string;
    temperature_risk: string;
    rainfall_impact: string;
    disease_spread_probability: string;
    recommendation: string;
  } | null;
  next_monitoring_time?: string;
  yield_loss_percent?: number;
  behavioral_triggers?: Record<string, any>;
}

export interface Scan {
  id: string;
  report_id?: string;
  user_id: string;
  crop_id?: string;
  farm_id?: string;
  image_url?: string;
  disease_name: string;
  plant_name: string;
  confidence: number;
  severity: 'critical' | 'warning' | 'info' | 'healthy';
  potential_loss: number;
  yield_loss_percent?: number;
  currency: string;
  recommendation: string;
  regret_insight: string;
  treatment_steps: TreatmentStep[];
  disease_info: DiseaseInfo;
  source?: 'ai' | 'combined' | 'ml';
  ai_provider?: 'gemini' | 'ollama' | 'ml';
  needs_clearer_image?: boolean;
  status: 'pending' | 'analyzed' | 'resolved' | 'ignored';
  crop_name?: string;
  farm_name?: string;
  resolved_at?: string;
  created_at: string;
}

// ─── Alert ───────────────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  user_id: string;
  crop_id?: string;
  farm_id?: string;
  scan_id?: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'disease' | 'pest' | 'nutrient' | 'irrigation' | 'weather' | 'system';
  potential_loss: number;
  preventable_loss: number;
  time_left_seconds: number;
  confidence: number;
  metadata?: Record<string, any>;
  latitude?: number;
  longitude?: number;
  is_read: boolean;
  is_resolved: boolean;
  resolved_at?: string;
  crop_name?: string;
  farm_name?: string;
  farmer_name?: string;
  farmer_location?: string;
  distance_km?: number;
  created_at: string;
}

export interface AlertStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  resolved: number;
  total_loss_prevented: number;
  today_prevented: number;
  crops_monitored: number;
  protection_rate: number;
  currency: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────
export interface RecentScan {
  id: string;
  disease_name: string;
  plant_name: string;
  confidence: number;
  severity: 'critical' | 'warning' | 'info' | 'healthy';
  image_url?: string;
  status: string;
  created_at: string;
}

export interface DashboardStats {
  total_loss_prevented: number;
  today_prevented: number;
  active_alerts: number;
  critical_alerts: number;
  crops_monitored: number;
  protection_rate: number;
  recent_scans: RecentScan[];
  currency: string;
}

export interface DiseaseReport {
  id: string;
  user_id: string;
  crop_id?: string;
  scan_id?: string;
  crop_name?: string;
  plant_name?: string;
  image_path: string;
  image_url?: string;
  disease_name: string;
  confidence: number;
  treatment: string;
  severity: 'low' | 'medium' | 'high';
  potential_loss?: number;
  regret_insight?: string;
  status?: string;
  disease_info?: DiseaseInfo;
  treatment_steps?: TreatmentStep[];
  created_at: string;
}

export interface ContractDashboard {
  active_alerts: number;
  crops_monitored: number;
  protection_rate: number;
  recent_scans: Array<{
    report_id: string;
    scan_id?: string;
    disease_name: string;
    plant_name?: string;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
    image_path?: string;
    created_at: string;
  }>;
}

export interface LossPreventionPoint {
  label: string;
  prevented: number;
  potential: number;
}

export interface AlertTypePoint {
  name: string;
  value: number;
  color: string;
}

export interface CropPerformancePoint {
  crop: string;
  yield: number;
  health: number;
  alerts: number;
}

export interface ResponseTimePoint {
  week: string;
  avgTime: number;
  resolved: number;
}

export interface WeatherRisk {
  lat: number;
  lon: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  wind_speed: number;
  rain_probability: number;
  uv_index: number;
  description: string;
  condition: string;
  icon: string;
  city: string;
  disease_risk_score: number;
  risk_factors: string[];
}

// ─── Community ───────────────────────────────────────────────────────────────
export interface CommunityPost {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  crop_name?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  action_taken?: string;
  result?: string;
  savings?: number;
  image_url?: string;
  likes_count: number;
  comments_count: number;
  is_verified: boolean;
  liked_by_me?: boolean;
  author_name?: string;
  author_location?: string;
  comments?: PostComment[];
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  author_name?: string;
  created_at: string;
}

// ─── Settings ────────────────────────────────────────────────────────────────
export interface NotificationPreferences {
  id: string;
  user_id: string;
  critical_alerts: boolean;
  warning_alerts: boolean;
  info_alerts: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  nearby_farmer_alerts: boolean;
  weekly_report: boolean;
  community_updates: boolean;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}
