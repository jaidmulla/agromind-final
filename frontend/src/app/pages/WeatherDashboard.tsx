import { useState } from 'react';
import { motion } from 'motion/react';
import { CloudRain, Droplets, Loader2, MapPin, Search, Sun, Thermometer, Wind } from 'lucide-react';
import { useWeatherRisk } from '../../hooks';

const iconUrl = (icon: string) => `https://openweathermap.org/img/wn/${icon}@2x.png`;

export function WeatherDashboard() {
  const [city, setCity] = useState('');
  const [query, setQuery] = useState<{ lat?: number; lon?: number; city?: string }>({});

  const weatherQuery = useWeatherRisk(query);
  const weather = weatherQuery.data;

  const handleCitySearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = city.trim();
    if (!trimmed) return;
    setQuery({ city: trimmed });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setQuery({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        // Keep previous query; error message is shown by backend-driven query failures.
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 }
    );
  };

  return (
    <div className="p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold mb-2">Real-Time Weather</h1>
        <p className="text-muted-foreground">Live OpenWeather conditions and disease-risk signals for your farm area.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-border bg-card p-4 md:p-6"
      >
        <form className="flex flex-col md:flex-row gap-3" onSubmit={handleCitySearch}>
          <div className="relative flex-1">
            <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-9 py-2.5"
              placeholder="Enter city (e.g. Ichalkaranji)"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2.5 text-white font-medium"
          >
            <Search className="w-4 h-4" /> Search
          </button>
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium"
          >
            <MapPin className="w-4 h-4" /> Use GPS
          </button>
        </form>
      </motion.div>

      {weatherQuery.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading weather...
        </div>
      )}

      {weatherQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load weather. Check location input and OpenWeather API configuration.
        </div>
      )}

      {weather && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <h2 className="text-2xl font-bold">{weather.city}</h2>
                <p className="text-sm text-muted-foreground capitalize">{weather.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <img src={iconUrl(weather.icon)} alt={weather.condition} className="w-14 h-14" />
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Condition</p>
                  <p className="font-semibold">{weather.condition}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard label="Temperature" value={`${weather.temperature}°C`} icon={Thermometer} />
              <MetricCard label="Humidity" value={`${weather.humidity}%`} icon={Droplets} />
              <MetricCard label="Wind Speed" value={`${weather.wind_speed} km/h`} icon={Wind} />
              <MetricCard label="Rain Probability" value={`${weather.rain_probability}%`} icon={CloudRain} />
              <MetricCard label="UV Index" value={`${weather.uv_index}`} icon={Sun} />
              <MetricCard label="Rainfall (1h)" value={`${weather.rainfall} mm`} icon={CloudRain} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Disease Weather Risk</h3>
              <span className="text-sm font-semibold">{weather.disease_risk_score}/100</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-3">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${weather.disease_risk_score}%`,
                  backgroundColor:
                    weather.disease_risk_score >= 70
                      ? '#D32F2F'
                      : weather.disease_risk_score >= 40
                        ? '#FF8F00'
                        : '#2E7D32',
                }}
              />
            </div>
            <div className="space-y-1.5">
              {weather.risk_factors.map((factor) => (
                <p className="text-sm text-muted-foreground" key={factor}>• {factor}</p>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl bg-muted px-4 py-3">
      <div className="flex items-center gap-2 mb-1 text-muted-foreground text-xs uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
