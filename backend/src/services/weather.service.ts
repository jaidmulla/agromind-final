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
    throw new Error('OPENWEATHER_API_KEY is not configured');
  }
  return apiKey;
}

function buildDiseaseRisk(data: {
  humidity: number;
  temperature: number;
  rainfall: number;
  rainProbability: number;
  windSpeedKmh: number;
  uvIndex: number;
}) {
  let riskScore = 30;
  const riskFactors: string[] = [];

  if (data.humidity > 80) { riskScore += 30; riskFactors.push('High humidity (>80%) favors fungal diseases'); }
  else if (data.humidity > 65) { riskScore += 15; riskFactors.push('Moderate humidity may encourage disease'); }
  else riskFactors.push('Lower humidity reduces fungal pressure');

  if (data.temperature >= 18 && data.temperature <= 25) { riskScore += 25; riskFactors.push('Temperature optimal for late blight and other cool-wet pathogens'); }
  else if (data.temperature > 25 && data.temperature <= 30) { riskScore += 20; riskFactors.push('Temperature favors early blight and bacterial leaf diseases'); }
  else riskFactors.push('Temperature is outside peak range for many leaf pathogens');

  if (data.rainfall > 0 || data.rainProbability >= 60) {
    riskScore += 20;
    riskFactors.push('Rainfall or wet leaves can accelerate disease spread');
  }
  if (data.windSpeedKmh > 25) { riskScore += 10; riskFactors.push('High winds can spread spores across fields'); }
  if (data.uvIndex < 3) { riskScore += 10; riskFactors.push('Low UV can support longer pathogen survival on leaves'); }

  return {
    disease_risk_score: Math.min(100, Math.max(0, riskScore)),
    risk_factors: riskFactors,
  };
}

function getWeatherDescription(code: number): { condition: string; description: string; icon: string } {
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
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Valid latitude and longitude are required for weather analysis');
  }

  try {
    const apiKey = getOpenWeatherApiKey();
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const res = await axios.get(url, { timeout: 7000 });
    const temperature = Number(res.data?.main?.temp);
    const humidity = Number(res.data?.main?.humidity);
    const windSpeedKmh = Number(res.data?.wind?.speed) * 3.6;
    const rainfall = Number(res.data?.rain?.['1h'] || res.data?.rain?.['3h'] || 0);
    const condition = String(res.data?.weather?.[0]?.main || 'Unknown');
    const description = String(res.data?.weather?.[0]?.description || condition);
    const icon = String(res.data?.weather?.[0]?.icon || '04d');

    if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
      throw new Error('Incomplete weather payload from OpenWeather');
    }

    const risk = buildDiseaseRisk({
      humidity,
      temperature,
      rainfall,
      rainProbability: rainfall > 0 ? 80 : 10,
      windSpeedKmh,
      uvIndex: 5,
    });

    return {
      lat,
      lon,
      temperature: Math.round(temperature),
      humidity: Math.round(humidity),
      rainfall: Math.round(rainfall * 10) / 10,
      wind_speed: Math.round(windSpeedKmh),
      rain_probability: rainfall > 0 ? 80 : 10,
      uv_index: 5,
      description,
      condition,
      icon,
      city: String(res.data?.name || 'Your Farm'),
      ...risk,
    };
  } catch (openWeatherErr) {
    logger.info('OpenWeather unavailable; trying Open-Meteo live weather', {
      err: openWeatherErr instanceof Error ? openWeatherErr.message : String(openWeatherErr),
      lat,
      lon,
    });
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index,precipitation,rain&hourly=precipitation_probability&forecast_days=1&timezone=auto`;
    const res = await axios.get(url, { timeout: 7000 });
    const current = res.data.current;

    const temp = Number(current?.temperature_2m);
    const humidity = Number(current?.relative_humidity_2m);
    const windSpeedKmh = Number(current?.wind_speed_10m);
    const uvIndex = Number(current?.uv_index);
    const weatherCode = Number(current?.weather_code);
    const rainfall = Number(current?.rain ?? current?.precipitation ?? 0);
    const rainProbability = Array.isArray(res.data?.hourly?.precipitation_probability)
      ? Math.max(...res.data.hourly.precipitation_probability.slice(0, 12).map((v: unknown) => Number(v) || 0))
      : (rainfall > 0 ? 70 : 10);

    if (!Number.isFinite(temp) || !Number.isFinite(humidity)) {
      throw new Error('Incomplete weather payload from Open-Meteo');
    }

    const weather = getWeatherDescription(weatherCode);
    const risk = buildDiseaseRisk({
      humidity,
      temperature: temp,
      rainfall,
      rainProbability,
      windSpeedKmh,
      uvIndex,
    });

    return {
      lat,
      lon,
      temperature: Math.round(temp),
      humidity: Math.round(humidity),
      rainfall: Math.round(rainfall * 10) / 10,
      wind_speed: Math.round(windSpeedKmh),
      rain_probability: Math.round(rainProbability),
      uv_index: Math.round(uvIndex * 10) / 10,
      description: weather.description,
      condition: weather.condition,
      icon: weather.icon,
      city: 'Your Farm',
      ...risk,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn('Weather API failed', { err: errMsg, lat, lon });
    throw new Error('Live weather data is unavailable. Check weather API/network configuration.');
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
