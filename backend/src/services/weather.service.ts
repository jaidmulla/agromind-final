import axios from 'axios';
import logger from '../utils/logger';
import { query } from '../utils/database';

export interface WeatherData {
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

function getOpenWeatherApiKey(): string {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey || apiKey === 'your_openweather_key_here') {
    throw new Error('OPENWEATHER_API_KEY is not configured. This is optional - weather features will use mock data without it. Get a free key at https://openweathermap.org/api');
  }
  return apiKey;
}

// Fallback weather data when OpenWeather API is not available
function getMockWeatherData(lat: number, lon: number): WeatherData {
  const description = 'Partly cloudy with typical farm conditions';
  const conditions = ['Scattered clouds', 'Overcast', 'Fair', 'Partly cloudy'];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  const weatherIcons = ['01d', '02d', '03d', '04d'];
  const icon = weatherIcons[Math.floor(Math.random() * weatherIcons.length)];
  
  // Default moderate weather risk
  const temperature = 24;
  const humidity = 65;
  const rainfall = 0;
  const windSpeedKmh = 12;
  const rainProbability = 20;
  const uvIndex = 5;

  let riskScore = 30;
  const riskFactors: string[] = [
    'Moderate humidity - monitor for fungal diseases',
    'Temperature favorable for some pathogens',
    'Regular scouting recommended',
    'Current conditions suggests low disease pressure',
  ];

  return {
    lat,
    lon,
    temperature,
    humidity,
    rainfall,
    wind_speed: windSpeedKmh,
    rain_probability: rainProbability,
    uv_index: uvIndex,
    description,
    condition,
    icon,
    city: 'Your Farm',
    disease_risk_score: riskScore,
    risk_factors: riskFactors,
  };
}

export async function getCoordinatesByCity(city: string): Promise<{ lat: number; lon: number; resolvedCity: string }> {
  try {
    // Use Nominatim (OpenStreetMap) - free, no API key needed!
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    const res = await axios.get(url, { timeout: 7000, headers: { 'User-Agent': 'AgroMind' } });
    const location = Array.isArray(res.data) ? res.data[0] : null;

    if (!location || typeof location.lat !== 'string' || typeof location.lon !== 'string') {
      throw new Error(`Unable to resolve location for city '${city}'`);
    }

    return {
      lat: parseFloat(location.lat),
      lon: parseFloat(location.lon),
      resolvedCity: location.display_name?.split(',')[0] || city,
    };
  } catch (err) {
    logger.warn('Geocoding failed', { err: String(err), city });
    throw err;
  }
}

export async function getWeatherRisk(lat: number, lon: number): Promise<WeatherData> {
  try {
    // Use Open-Meteo API - completely FREE, no API key needed!
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index&timezone=auto`;
    const res = await axios.get(url, { timeout: 7000 });
    const current = res.data.current;

    const temp = Number(current?.temperature_2m);
    const humidity = Number(current?.relative_humidity_2m);
    const windSpeedKmh = Number(current?.wind_speed_10m);
    const uvIndex = Number(current?.uv_index);
    const weatherCode = Number(current?.weather_code);

    if (!Number.isFinite(temp) || !Number.isFinite(humidity)) {
      throw new Error('Incomplete weather payload from Open-Meteo');
    }

    // WMO Weather Interpretation Codes
    const getWeatherDescription = (code: number): { condition: string; description: string; icon: string } => {
      if (code === 0) return { condition: 'Clear', description: 'Clear sky', icon: '01d' };
      if (code === 1 || code === 2) return { condition: 'Partly cloudy', description: 'Partly cloudy', icon: '02d' };
      if (code === 3) return { condition: 'Overcast', description: 'Overcast', icon: '04d' };
      if (code >= 45 && code <= 48) return { condition: 'Foggy', description: 'Foggy', icon: '50d' };
      if (code >= 51 && code <= 67) return { condition: 'Drizzle', description: 'Light rain', icon: '09d' };
      if (code >= 71 && code <= 77) return { condition: 'Snow', description: 'Snow', icon: '13d' };
      if (code === 80 || code === 81 || code === 82) return { condition: 'Rain showers', description: 'Rain showers', icon: '09d' };
      if (code >= 85 && code <= 86) return { condition: 'Snow showers', description: 'Snow showers', icon: '13d' };
      if (code >= 90 && code <= 99) return { condition: 'Thunderstorm', description: 'Thunderstorm', icon: '11d' };
      return { condition: 'Unknown', description: 'Unknown conditions', icon: '04d' };
    };

    const weather = getWeatherDescription(weatherCode);

    // Disease risk calculation
    let riskScore = 0;
    const riskFactors: string[] = [];

    if (humidity > 80) { riskScore += 30; riskFactors.push('High humidity (>80%) favors fungal diseases'); }
    else if (humidity > 65) { riskScore += 15; riskFactors.push('Moderate humidity may encourage disease'); }

    if (temp >= 18 && temp <= 25) { riskScore += 25; riskFactors.push('Temperature optimal for Late Blight'); }
    else if (temp >= 25 && temp <= 30) { riskScore += 20; riskFactors.push('Temperature favors Early Blight'); }

    if (weatherCode >= 51 && weatherCode <= 82) {
      riskScore += 20;
      riskFactors.push('Rainfall/moisture increases disease spread risk');
    }
    if (windSpeedKmh > 25) { riskScore += 10; riskFactors.push('High winds can spread spores across fields'); }
    if (uvIndex < 3) { riskScore += 10; riskFactors.push('Low UV can support longer pathogen survival on leaves'); }

    return {
      lat,
      lon,
      temperature: Math.round(temp),
      humidity: Math.round(humidity),
      rainfall: 0,
      wind_speed: Math.round(windSpeedKmh),
      rain_probability: weatherCode >= 51 && weatherCode <= 82 ? 70 : 10,
      uv_index: Math.round(uvIndex * 10) / 10,
      description: weather.description,
      condition: weather.condition,
      icon: weather.icon,
      city: 'Your Farm',
      disease_risk_score: Math.min(100, riskScore),
      risk_factors: riskFactors.length > 0 ? riskFactors : ['Current conditions stable for crop monitoring'],
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn('Weather API failed', { err: errMsg, lat, lon });
    
    // Return mock data as fallback
    logger.info('Returning mock weather data (Open-Meteo API unavailable)');
    return getMockWeatherData(lat, lon);
  }
}

export async function saveWeatherSnapshot(userId: string, data: WeatherData): Promise<void> {
  try {
    await query(
      `INSERT INTO weather_snapshots
       (user_id, latitude, longitude, city, temperature, humidity, wind_speed, rainfall,
        rain_probability, uv_index, condition, description, icon, disease_risk_score, risk_factors)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        userId,
        data.lat,
        data.lon,
        data.city,
        data.temperature,
        data.humidity,
        data.wind_speed,
        data.rainfall,
        data.rain_probability,
        data.uv_index,
        data.condition,
        data.description,
        data.icon,
        data.disease_risk_score,
        JSON.stringify(data.risk_factors || []),
      ]
    );
  } catch (err) {
    logger.warn('Failed to persist weather snapshot', { err: String(err) });
  }
}
