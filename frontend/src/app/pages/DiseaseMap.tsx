import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, AlertTriangle, Users, Filter, Layers, Search, Satellite } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { alertsApi, farmsApi } from '../../services/api';
import { useNearbyAlerts, useMapPosts } from '../../hooks';
import { useLocation } from '../../contexts/LocationContext';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#D32F2F',
  warning: '#FF6F00',
  info: '#1565C0',
  healthy: '#2E7D32',
};

// Satellite tile layer
const SATELLITE_LAYER = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export function DiseaseMap() {
  const { selectedLocation } = useLocation();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  
  const markersRef = useRef<{
    alerts: L.CircleMarker[];
    farms: L.CircleMarker[];
    success: L.CircleMarker[];
    heatmap: L.CircleMarker[];
  }>({ alerts: [], farms: [], success: [], heatmap: [] });
  
  const [locationSearch, setLocationSearch] = useState('');
  const [searchLat, setSearchLat] = useState<number | undefined>(selectedLocation?.lat);
  const [searchLon, setSearchLon] = useState<number | undefined>(selectedLocation?.lon);
  const [isSatellite, setIsSatellite] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showFarms, setShowFarms] = useState(true);
  const [showSuccess, setShowSuccess] = useState(true);
  const [diseaseFilter, setDiseaseFilter] = useState('all');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocationName, setSelectedLocationName] = useState(selectedLocation?.displayName || '');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);

  // Initialize with selected location
  useEffect(() => {
    if (selectedLocation && !searchLat && !searchLon) {
      setSearchLat(selectedLocation.lat);
      setSearchLon(selectedLocation.lon);
      setSelectedLocationName(selectedLocation.displayName || selectedLocation.name);
      setLocationSearch(selectedLocation.displayName || selectedLocation.name);
    }
  }, [selectedLocation]);

  const { data: nearbyAlerts = [] } = useNearbyAlerts(searchLat, searchLon, 15);
  const { data: mapPosts = [] } = useMapPosts(searchLat, searchLon, 15);
  const { data: heatmapData = [] } = useQuery({
    queryKey: ['alerts-heatmap'],
    queryFn: alertsApi.heatmap,
    staleTime: 60_000,
  });
  const { data: nearbyFarms = [] } = useQuery({
    queryKey: ['farms-nearby', searchLat, searchLon],
    queryFn: () => farmsApi.nearby(10, { lat: searchLat, lon: searchLon }),
    staleTime: 60_000,
  });

  const getDiseaseName = (alert: any) => {
    const fromMeta = alert?.metadata?.disease_name;
    if (fromMeta) return String(fromMeta);
    if (alert?.title) return String(alert.title).replace(/\s*detected$/i, '');
    return '';
  };

  const diseaseOptions = Array.from(
    new Set(nearbyAlerts.map(getDiseaseName).filter(Boolean))
  );

  // Search locations with Nominatim
  const searchLocations = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=in`
      );
      const results = await response.json();
      setLocationSuggestions(results.slice(0, 6));
    } catch (err) {
      console.error('Location search error:', err);
      setLocationSuggestions([]);
    }
  };

  const selectSearchLocation = (loc: any) => {
    const displayName = loc.display_name.split(',').slice(0, 2).join(',');
    setSearchLat(parseFloat(loc.lat));
    setSearchLon(parseFloat(loc.lon));
    setLocationSearch(displayName);
    setSelectedLocationName(loc.display_name.split(',')[0]);
    setLocationSuggestions([]);
    // Center map immediately
    if (mapInstance.current) {
      mapInstance.current.setView([parseFloat(loc.lat), parseFloat(loc.lon)], 12);
    }
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Use selected location if available, otherwise default to India
    const initialLat = searchLat || 20.5937;
    const initialLon = searchLon || 78.9629;
    const initialZoom = searchLat && searchLon ? 11 : 4.5;

    const map = L.map(mapRef.current).setView([initialLat, initialLon], initialZoom);

    // Add satellite tile layer
    const tileLayer = L.tileLayer(SATELLITE_LAYER, {
      attribution: '&copy; Esri',
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Add zoom controls
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Clear all markers
  const clearMarkers = () => {
    Object.values(markersRef.current).forEach((markers) => {
      markers.forEach((marker) => marker.remove());
    });
    markersRef.current = { alerts: [], farms: [], success: [], heatmap: [] };
  };

  // Search location and center map
  const searchLocation = async () => {
    if (!locationSearch.trim() || !mapInstance.current) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationSearch)}&format=json&limit=1`
      );
      const results = await response.json();

      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);

        // Set searched location coordinates
        setSearchLat(latNum);
        setSearchLon(lonNum);

        // Center map on search result
        mapInstance.current.setView([latNum, lonNum], 12);

        // Remove old search marker
        if (searchMarkerRef.current) searchMarkerRef.current.remove();

        // Add marker for search location
        searchMarkerRef.current = L.marker([latNum, lonNum], {
          title: display_name,
          icon: L.icon({
            iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0Ij48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBmaWxsPSIjRkZCNzBEIiBzdHJva2U9IiNGRjZGMDAiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==',
            iconSize: [32, 32],
          }),
        })
          .bindPopup(`<strong>Search Location</strong><br>${display_name}`)
          .addTo(mapInstance.current);
      }
    } catch (error) {
      console.error('Location search error:', error);
    }
  };

  // Toggle satellite/map view
  const toggleMapView = () => {
    if (!mapInstance.current || !tileLayerRef.current) return;

    mapInstance.current.removeLayer(tileLayerRef.current);

    if (isSatellite) {
      // Switch to OSM
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstance.current);
    } else {
      // Switch to satellite
      tileLayerRef.current = L.tileLayer(SATELLITE_LAYER, {
        attribution: '&copy; Esri',
        maxZoom: 19,
      }).addTo(mapInstance.current);
    }

    setIsSatellite(!isSatellite);
  };

  // Update markers when data changes
  useEffect(() => {
    if (!mapInstance.current) return;

    const map = mapInstance.current;
    clearMarkers();

    const filteredAlerts = nearbyAlerts.filter((a: any) =>
      diseaseFilter === 'all' ? true : getDiseaseName(a) === diseaseFilter
    );

    // Add heatmap markers (lighter)
    if (showHeatmap) {
      const heatData = diseaseFilter === 'all' ? heatmapData : filteredAlerts;
      heatData.forEach((h: any) => {
        const lat = Number(h.latitude);
        const lng = Number(h.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: 'rgba(255, 235, 0, 0.4)',
            color: 'rgba(255, 193, 7, 0.8)',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.4,
          });
          marker.addTo(map);
          markersRef.current.heatmap.push(marker);
        }
      });
    }

    // Add alert markers
    if (showAlerts) {
      filteredAlerts.forEach((a: any) => {
        const lat = Number(a.latitude);
        const lng = Number(a.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const color = a.severity === 'critical' ? '#FF0000' : a.severity === 'warning' ? '#FF6600' : '#00FF00';
          const marker = L.circleMarker([lat, lng], {
            radius: 7,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
          });

          marker.bindPopup(
            `<div style="font-family: sans-serif; min-width: 180px;">
              <strong>${a.title || 'Disease Alert'}</strong><br/>
              <span style="color:${color}; font-weight:bold;">${(a.severity || '').toUpperCase()}</span><br/>
              ${a.distance_km ? `<small>${Number(a.distance_km).toFixed(1)} km away</small>` : ''}
            </div>`
          );

          marker.addTo(map);
          markersRef.current.alerts.push(marker);
        }
      });
    }

    // Add farm markers
    if (showFarms) {
      nearbyFarms.forEach((f: any) => {
        const lat = Number(f.latitude);
        const lng = Number(f.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const marker = L.circleMarker([lat, lng], {
            radius: 5,
            fillColor: '#00FF7F',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 1,
          });

          marker.bindPopup(
            `<div style="font-family: sans-serif; min-width: 180px;">
              <strong>${f.name || 'Farm'}</strong><br/>
              <small>${f.farmer_name || ''}</small>
            </div>`
          );

          marker.addTo(map);
          markersRef.current.farms.push(marker);
        }
      });
    }

    // Add success story markers
    if (showSuccess) {
      mapPosts.forEach((p: any) => {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const marker = L.circleMarker([lat, lng], {
            radius: 6,
            fillColor: '#00FFFF',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 1,
          });

          marker.bindPopup(
            `<div style="font-family: sans-serif; min-width: 180px;">
              <strong>${p.title || p.crop_name || 'Success Story'}</strong><br/>
              ${p.savings ? `<span style="color:#2E7D32; font-weight:bold;">₹${Number(p.savings).toLocaleString('en-IN')} saved</span><br/>` : ''}
              <small>By ${p.author_name || 'Farmer'}</small>
            </div>`
          );

          marker.addTo(map);
          markersRef.current.success.push(marker);
        }
      });
    }

    // Auto-fit map bounds to show all markers
    const allMarkers = [
      ...markersRef.current.heatmap,
      ...markersRef.current.alerts,
      ...markersRef.current.farms,
      ...markersRef.current.success
    ];

    if (allMarkers.length > 0) {
      const bounds = L.latLngBounds(
        allMarkers.map(m => (m as any)._latlng || (m as any).getLatLng())
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [showHeatmap, showAlerts, showFarms, showSuccess, nearbyAlerts, heatmapData, nearbyFarms, mapPosts, diseaseFilter]);

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Disease Outbreak Map</h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">Live disease spread, nearby farms, and success stories</p>
              {selectedLocationName && (
                <div className="ml-4 px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> {selectedLocationName}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: AlertTriangle, label: 'Nearby Disease Alerts', value: nearbyAlerts.length, color: '#D32F2F', bg: '#FFEBEE' },
          { icon: MapPin, label: 'Farms within 15 km', value: nearbyFarms.length, color: '#1565C0', bg: '#E3F2FD' },
          { icon: Users, label: 'Success Stories', value: mapPosts.length, color: '#2E7D32', bg: '#E8F5E9' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: bg }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Location Search */}
      <div className="mb-4 flex gap-2">
        <div className="flex-1 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search city (e.g., san, pune, kolhapur)..."
              value={locationSearch}
              onChange={(e) => {
                setLocationSearch(e.target.value);
                searchLocations(e.target.value);
              }}
              onKeyPress={(e) => e.key === 'Enter' && searchLocation()}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {locationSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                {locationSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectSearchLocation(suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm flex items-center gap-2 border-b last:border-b-0 focus:outline-none"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate">{suggestion.display_name.split(',')[0]}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{suggestion.display_name.split(',').slice(1, 3).join(',')}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={searchLocation}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>
        <button
          onClick={toggleMapView}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            isSatellite
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Satellite className="w-4 h-4" />
          {isSatellite ? 'Satellite' : 'Map'}
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="w-4 h-4" /> Layers
        </div>
        <select
          value={diseaseFilter}
          onChange={(e) => setDiseaseFilter(e.target.value)}
          className="px-3 py-1.5 rounded-full text-sm border border-border bg-background"
        >
          <option value="all">All Diseases</option>
          {diseaseOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button onClick={() => setShowHeatmap(v => !v)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${showHeatmap ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground'}`}>
          Heatmap
        </button>
        <button onClick={() => setShowAlerts(v => !v)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${showAlerts ? 'bg-[#D32F2F] text-white' : 'bg-muted text-muted-foreground'}`}>
          Alerts
        </button>
        <button onClick={() => setShowFarms(v => !v)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${showFarms ? 'bg-[#1565C0] text-white' : 'bg-muted text-muted-foreground'}`}>
          Farms
        </button>
        <button onClick={() => setShowSuccess(v => !v)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${showSuccess ? 'bg-[#1B5E20] text-white' : 'bg-muted text-muted-foreground'}`}>
          Success Stories
        </button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Layers className="w-4 h-4" /> {isSatellite ? 'Satellite View' : 'OpenStreetMap'}
        </div>
      </div>

      {/* Map */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl border border-border overflow-hidden" style={{ height: '520px' }}>
        <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      </motion.div>

      {/* Legend */}
      <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#D32F2F]" />
          <span>Critical/Warning alert</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#2E7D32]" />
          <span>Farm locations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#1B5E20]" />
          <span>Success stories</span>
        </div>
      </div>
    </div>
  );
}
