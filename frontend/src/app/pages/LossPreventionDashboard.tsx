import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart, Bar } from 'recharts';

interface LossRecord {
  id: string;
  crop_name: string;
  disease_name?: string;
  amount_prevented: number;
  action_taken: string;
  recorded_at: string;
  severity?: string;
}

interface LossStats {
  total_actions: number;
  total_prevented: number;
  avg_prevented: number;
  max_prevented: number;
  min_prevented: number;
  last_action_date?: string;
}

interface LossByType {
  action_taken: string;
  count: number;
  total: number;
  avg: number;
}

interface LossByCrop {
  crop_name: string;
  actions_count: number;
  total_prevented: number;
}

const LossPreventionDashboard: React.FC = () => {
  const [stats, setStats] = useState<LossStats | null>(null);
  const [records, setRecords] = useState<LossRecord[]>([]);
  const [byType, setByType] = useState<LossByType[]>([]);
  const [byCrop, setByCrop] = useState<LossByCrop[]>([]);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ crop: '', minAmount: '' });

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const [statsRes, recordsRes] = await Promise.all([
        fetch(`/api/v1/losses/stats?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/v1/losses?limit=10&offset=0`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        if (data.success) {
          setStats(data.data.summary);
          setByType(data.data.by_action_type);
          setByCrop(data.data.by_crop);
        }
      }

      if (recordsRes.ok) {
        const data = await recordsRes.json();
        if (data.success) {
          setRecords(data.data.records);
        }
      }
    } catch (error) {
      console.error('Failed to fetch loss data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (filter.crop) params.append('crop_name', filter.crop);
      if (filter.minAmount) params.append('min_amount', filter.minAmount);

      const res = await fetch(`/api/v1/losses/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRecords(data.data.records);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [period]);

  if (loading && !stats) {
    return <div className="p-6">Loading loss prevention data...</div>;
  }

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Loss Prevention Tracking</h1>
        <p className="text-gray-600">Monitor and analyze your crop loss prevention actions</p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {['7', '30', '90', '365'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded ${
              period === p 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Last {p === '365' ? 'Year' : `${p} days`}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-gray-600 text-sm">Total Actions</p>
            <p className="text-2xl font-bold text-blue-600">{stats.total_actions}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-gray-600 text-sm">Total Prevented</p>
            <p className="text-2xl font-bold text-green-600">₹{stats.total_prevented.toLocaleString()}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-gray-600 text-sm">Average Prevention</p>
            <p className="text-2xl font-bold text-orange-600">₹{Math.round(stats.avg_prevented).toLocaleString()}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-gray-600 text-sm">Maximum</p>
            <p className="text-2xl font-bold text-red-600">₹{stats.max_prevented.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-gray-600 text-sm">Minimum</p>
            <p className="text-2xl font-bold text-purple-600">₹{stats.min_prevented.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Action Type */}
        {byType.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Prevention Actions</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={byType.map(t => ({ name: t.action_taken, value: t.count }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {byType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* By Crop */}
        {byCrop.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Prevention by Crop</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byCrop}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="crop_name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_prevented" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Search Records</h3>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Crop name"
            value={filter.crop}
            onChange={(e) => setFilter({ ...filter, crop: e.target.value })}
            className="flex-1 px-4 py-2 border rounded"
          />
          <input
            type="number"
            placeholder="Min amount (₹)"
            value={filter.minAmount}
            onChange={(e) => setFilter({ ...filter, minAmount: e.target.value })}
            className="flex-1 px-4 py-2 border rounded"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Search
          </button>
        </div>

        {/* Records Table */}
        {records.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Crop</th>
                  <th className="px-4 py-2 text-left">Action</th>
                  <th className="px-4 py-2 text-right">Amount Prevented</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{record.crop_name || 'Unknown'}</td>
                    <td className="px-4 py-2">{record.action_taken}</td>
                    <td className="px-4 py-2 text-right font-semibold text-green-600">
                      ₹{record.amount_prevented.toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(record.recorded_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LossPreventionDashboard;
