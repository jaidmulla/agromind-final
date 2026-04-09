import { motion } from 'motion/react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { useState } from 'react';
import { Loader2, CloudRain, Thermometer, Wind, Droplets } from 'lucide-react';
import { useLossPrevention, useAlertTypes, useCropPerformance, useResponseTimes, useWeatherRisk } from '../../hooks';

export function Analytics() {
  const [range, setRange] = useState<'week' | 'month' | 'year'>('month');
  const { data: lossData = [], isLoading: l1 } = useLossPrevention(range);
  const { data: alertTypes = [], isLoading: l2 } = useAlertTypes();
  const { data: cropPerf = [], isLoading: l3 } = useCropPerformance();
  const { data: responseTimes = [], isLoading: l4 } = useResponseTimes();
  const { data: weather } = useWeatherRisk();

  const isLoading = l1 || l2 || l3 || l4;

  const riskColor = weather?.disease_risk_score
    ? weather.disease_risk_score > 70 ? '#D32F2F' : weather.disease_risk_score > 40 ? '#FF6F00' : '#2E7D32'
    : '#2E7D32';

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Analytics</h1>
            <p className="text-muted-foreground">Track performance and loss prevention metrics</p>
          </div>
          <div className="flex gap-2">
            {(['week','month','year'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${
                  range === r ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}>{r}</button>
            ))}
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Loss Prevention Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-xl font-bold mb-1">Loss Prevention vs Potential Loss</h2>
            <p className="text-sm text-muted-foreground mb-6">Financial impact of early detection (₹)</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lossData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']} />
                <Legend />
                <Line type="monotone" dataKey="prevented" stroke="#2E7D32" strokeWidth={2.5} dot={{ fill: '#2E7D32' }} name="Loss Prevented" />
                <Line type="monotone" dataKey="potential" stroke="#D32F2F" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Potential Loss" />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <div className="grid grid-cols-2 gap-6">
            {/* Alert Types Pie */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-xl font-bold mb-1">Alert Distribution</h2>
              <p className="text-sm text-muted-foreground mb-6">By type</p>
              {alertTypes.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No alerts yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={alertTypes} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                      {alertTypes.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* Weather Risk */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-xl font-bold mb-1">Weather Disease Risk</h2>
              <p className="text-sm text-muted-foreground mb-4">{weather?.city || 'Your Region'} · Live</p>
              {weather ? (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-32 h-32 rounded-full border-8 flex items-center justify-center"
                      style={{ borderColor: riskColor }}>
                      <div className="text-center">
                        <p className="text-3xl font-bold" style={{ color: riskColor }}>{weather.disease_risk_score}</p>
                        <p className="text-xs text-muted-foreground">Risk Score</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
                      <Thermometer className="w-4 h-4 text-orange-500" />
                      <span>{weather.temperature}°C</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
                      <Droplets className="w-4 h-4 text-blue-500" />
                      <span>{weather.humidity}% Humidity</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
                      <CloudRain className="w-4 h-4 text-blue-400" />
                      <span>{weather.rainfall}mm Rain</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
                      <Wind className="w-4 h-4 text-gray-500" />
                      <span>{weather.wind_speed} km/h</span>
                    </div>
                  </div>
                  {weather.risk_factors.length > 0 && (
                    <div className="space-y-1">
                      {weather.risk_factors.map((f, i) => (
                        <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span style={{ color: riskColor }}>•</span> {f}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  Loading weather data...
                </div>
              )}
            </motion.div>
          </div>

          {/* Crop Performance */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-xl font-bold mb-1">Crop Performance</h2>
            <p className="text-sm text-muted-foreground mb-6">Health score and yield by crop</p>
            {cropPerf.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Add crops to see performance</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cropPerf}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="crop" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="yield" fill="#2E7D32" name="Yield %" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="health" fill="#4CAF50" name="Health Score" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Response Times */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-card rounded-2xl border border-border p-6">
            <h2 className="text-xl font-bold mb-1">Alert Response Times</h2>
            <p className="text-sm text-muted-foreground mb-6">Avg hours to resolve by week</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={responseTimes}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="avgTime" fill="#1565C0" name="Avg Hours" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="resolved" fill="#2E7D32" name="Resolved" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}
    </div>
  );
}
