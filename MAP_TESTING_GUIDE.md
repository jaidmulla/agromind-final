# 🧪 Map Features - Testing Guide & Examples

## 1. SETUP & PREREQUISITES

### Getting Started
```bash
# 1. Navigate to project
cd /Users/jaid/Documents/Hackethone/DYP\ Kolhapur/agromind-final

# 2. Verify all services running
docker compose ps

# 3. Open browser
open http://localhost

# 4. Navigate to Disease Map
Login → Visit "Disease Outbreak Map" from sidebar
```

### Demo Credentials
```
Email:    farmer1@agromind.in
Password: password123
Location: Select any (Kolhapur, Pune, Ratnagiri, etc.)
```

---

## 2. TEST SCENARIOS

### Test 1: Location Selection on Login ✅

**Expected Behavior:**
```
1. Visit http://localhost/login
2. Type location name: "Kolhapur"
3. Autocomplete suggestions appear
4. Click on suggestion
5. Location displays with ✓ checkmark
6. Button enables: "Sign In"
```

**Verification:**
```
✓ Location stored in LocationContext
✓ LocationContext syncs to localStorage
✓ Can be verified via browser DevTools: Application → Storage → localStorage
  Key: "agromind_location"
  Value: {"lat":17.6549,"lon":73.2317,"name":"Kolhapur","displayName":"..."}
```

---

### Test 2: Map Auto-Centering 📍

**Expected Behavior:**
```
1. After login with Kolhapur
2. Map automatically centers on: 17.6549°N, 73.2317°E
3. Zoom level: 11 (regional view)
4. Header shows: "Kolhapur" location tag
```

**SQL Query Executed:**
```sql
-- Backend identifies your location
SELECT latitude, longitude 
FROM community_posts 
WHERE latitude BETWEEN 17.4549 AND 17.8549
  AND longitude BETWEEN 73.0317 AND 73.4317
LIMIT 100;
```

---

### Test 3: Nearby Disease Alerts (15km) 🚨

**Setup:**
```
Location: Kolhapur
Radius: 15 km (auto)
```

**Execution:**
```bash
# Backend receives:
GET /api/v1/alerts/nearby?lat=17.6549&lon=73.2317&radius=15

# Query executed:
SELECT a.*, u.name, u.location,
       COALESCE(a.latitude, u.latitude) as latitude,
       COALESCE(a.longitude, u.longitude) as longitude,
       -- Haversine distance calculation
       (6371 * acos(cos(radians(17.6549)) * cos(radians(lat)) * 
        cos(radians(lon) - radians(73.2317)) + 
        sin(radians(17.6549)) * sin(radians(lat)))) AS distance_km
FROM alerts a
JOIN users u ON u.id = a.user_id
WHERE NOT a.is_resolved
  AND distance_km <= 15
ORDER BY distance_km ASC
LIMIT 20;
```

**Expected Results:**
```
Alerts Found: 5-15 (sample data)

Sample Data:
[
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Tomato Early Blight Detected",
    severity: "critical",
    latitude: 17.62,
    longitude: 73.28,
    distance_km: 2.3,
    created_at: "2026-04-08T10:30:00Z"
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    title: "Onion Pink Root",
    severity: "warning",
    latitude: 17.70,
    longitude: 73.24,
    distance_km: 4.1,
    created_at: "2026-04-08T09:15:00Z"
  },
  ...
]

Display on Map:
- 🔴 Red markers at coordinates
- Popup shows title, severity, distance
- Ordered by proximity (closest first)
```

**Verification Checklist:**
```
☐ Red markers appear on map
☐ Number matches stat card (5-15)
☐ Markers clickable with accurate popups
☐ Distance calculations reasonable
☐ Severity color-coding correct
☐ All within 15km radius
```

---

### Test 4: Farms Within 15 km 🌾

**Setup:**
```
Location: Kolhapur
Search Radius: 15 km (explicit in code)
```

**Execution:**
```bash
# Backend receives:
GET /api/v1/farms/nearby?radius_km=15&lat=17.6549&lon=73.2317

# Query executed:
SELECT f.*, u.name as farmer_name, u.location,
       (6371 * acos(cos(radians(17.6549)) * cos(radians(f.latitude)) * 
        cos(radians(f.longitude) - radians(73.2317)) + 
        sin(radians(17.6549)) * sin(radians(f.latitude)))) AS distance_km
FROM farms f
JOIN users u ON u.id = f.user_id
WHERE f.latitude IS NOT NULL 
  AND f.longitude IS NOT NULL
  AND distance_km <= 15
ORDER BY distance_km ASC
LIMIT 50;
```

**Expected Results:**
```
Farms Found: 8-15 (sample database)

Sample Data:
[
  {
    id: "farm-001",
    name: "Patel Family Farm",
    farmer_name: "Rajesh Patel",
    latitude: 17.60,
    longitude: 73.25,
    total_area: 15.5,
    soil_type: "Black Soil",
    distance_km: 1.8
  },
  {
    id: "farm-002",
    name: "Singh Organic Farm",
    farmer_name: "Priya Singh",
    latitude: 17.70,
    longitude: 73.32,
    total_area: 25.0,
    soil_type: "Red Soil",
    distance_km: 6.2
  },
  ...
]

Display on Map:
- 🟢 Green markers at coordinates
- Popup shows farm name, farmer name
- Smaller circles than alerts (5px vs 7px)
- Full opacity (more visible)
```

**Verification Checklist:**
```
☐ Green markers appear on map
☐ Number matching stat card (8-15)
☐ Popups show correct farm names
☐ All within 15km radius
☐ Farmers identifiable
☐ Can click to see neighbor farms
```

---

### Test 5: Success Stories (Community Posts) ✅

**Setup:**
```
Location: Kolhapur
Radius: 15 km
Filter: All crops (default)
```

**Execution:**
```bash
# Backend receives:
GET /api/v1/community/map-posts?lat=17.6549&lon=73.2317&radius=15

# Query executed:
SELECT cp.*, u.name as author_name,
       COUNT(DISTINCT l.id) as likes_count,
       COUNT(DISTINCT c.id) as comments_count,
       (6371 * acos(cos(radians(17.6549)) * cos(radians(cp.latitude)) * 
        cos(radians(cp.longitude) - radians(73.2317)) + 
        sin(radians(17.6549)) * sin(radians(cp.latitude)))) AS distance_km
FROM community_posts cp
LEFT JOIN post_likes l ON l.post_id = cp.id
LEFT JOIN post_comments c ON c.post_id = cp.id
JOIN users u ON u.id = cp.user_id
WHERE cp.latitude IS NOT NULL 
  AND cp.longitude IS NOT NULL
  AND distance_km <= 15
GROUP BY cp.id, u.id
ORDER BY distance_km ASC, cp.created_at DESC
LIMIT 100;
```

**Expected Results:**
```
Success Stories Found: 5-10 (sample database)

Sample Data:
[
  {
    id: "post-001",
    title: "Saved my Tomato Crop! 🎉",
    content: "Applied integrated pest management, lost no plants...",
    crop_name: "Tomato",
    author_name: "Farmer Singh",
    location: "Kolhapur City",
    latitude: 17.65,
    longitude: 73.25,
    action_taken: "Applied neem spray + removed infected leaves",
    result: "Disease stopped. 20% yield improvement.",
    savings: 12500,  // INR
    likes_count: 24,
    comments_count: 7,
    is_verified: true,
    distance_km: 1.2,
    created_at: "2026-04-05T14:30:00Z"
  },
  {
    id: "post-002",
    title: "Wheat Disease Recovery",
    content: "Used bio-pesticide instead of chemical...",
    crop_name: "Wheat",
    author_name: "Devi Farmer",
    location: "Ratnagiri District",
    latitude: 17.80,
    longitude: 73.40,
    action_taken: "Bio-pesticide application",
    result: "Recovered 80% of crop. Zero chemical residue.",
    savings: 8750,
    likes_count: 18,
    comments_count: 4,
    is_verified: true,
    distance_km: 14.5,
    created_at: "2026-04-07T09:00:00Z"
  },
  ...
]

Display on Map:
- 🔵 Cyan markers at coordinates
- Popup shows title, author, savings amount
- Shows verification badge
- Clickable to view full post
```

**Verification Checklist:**
```
☐ Cyan markers appear on map
☐ Number matching stat card (5-10)
☐ Popups show title & savings amount
☐ Verified badge visible
☐ All within 15km radius
☐ Clicking marker shows story details
```

---

### Test 6: Heatmap - Disease Concentration 🔥

**Setup:**
```
Global heatmap (not location-filtered)
Groups nearby alerts into geographic clusters
```

**Execution:**
```bash
# Backend receives:
GET /api/v1/alerts/heatmap

# Query executed:
SELECT ROUND(CAST(COALESCE(a.latitude, u.latitude) AS NUMERIC), 2) AS latitude,
       ROUND(CAST(COALESCE(a.longitude, u.longitude) AS NUMERIC), 2) AS longitude,
       COUNT(*)::INT AS alert_count,
       MAX(a.severity) AS severity
FROM alerts a
JOIN users u ON u.id = a.user_id
WHERE COALESCE(a.latitude, u.latitude) IS NOT NULL 
  AND COALESCE(a.longitude, u.longitude) IS NOT NULL
  AND NOT a.is_resolved
GROUP BY ROUND(CAST(COALESCE(a.latitude, u.latitude) AS NUMERIC), 2),
         ROUND(CAST(COALESCE(a.longitude, u.longitude) AS NUMERIC), 2)
ORDER BY alert_count DESC
LIMIT 250;
```

**Expected Results:**
```
Heatmap Clusters: 80-150 (aggregated from 500+ alerts)

Sample Aggregation:
[
  {
    latitude: 17.65,    // Rounded to 0.01° (~1.1 km grid)
    longitude: 73.25,
    alert_count: 23,    // 23 alerts in this 1.1km x 1.1km area
    severity: "critical" // Highest severity in cluster
  },
  {
    latitude: 17.70,
    longitude: 73.30,
    alert_count: 15,
    severity: "warning"
  },
  {
    latitude: 17.60,
    longitude: 73.20,
    alert_count: 8,
    severity: "warning"
  },
  ...
]

Display on Map:
- 🟡 Yellow circles (semi-transparent)
- Fill: rgba(255, 235, 0, 0.4) - light yellow
- Border: rgba(255, 193, 7, 0.8) - darker yellow
- Overlapping circles show concentration
- Darker areas = more alerts
```

**Visualization Example:**
```
High Density Area (23 alerts):
●●●●●●●●●●
●●●●●●●●●●  ← Many overlapping circles
●●●●●●●●●●  → Bright appearance

Medium Density Area (8 alerts):
  ●●●●
  ●●●●        → Few overlapping circles
              → Lighter appearance
```

**Verification Checklist:**
```
☐ Yellow markers appear (semi-transparent)
☐ Total count matches database
☐ Denser zones show darker appearance
☐ Clusters grouped by ~1.1 km
☐ Can toggle off with "Heatmap" button
☐ Shows disease outbreak zones clearly
```

---

### Test 7: Layer Toggle (Interactive) 🎛️

**Test Case: Toggle Disease Alerts**
```
Initial State:
- showAlerts = true
- 20 red markers visible

Action:
- Click "Alerts" button

Expected:
- Button becomes gray (inactive)
- All 20 red markers disappear
- Other layers (farms, stories, heatmap) remain visible
- Stat card still shows "5" nearby alerts (data cached)

Action:
- Click "Alerts" button again

Expected:
- Button becomes red (active)
- All 20 red markers reappear
- Same positions, same data
```

**Code Test:**
```typescript
// In DiseaseMap component
const [showAlerts, setShowAlerts] = useState(true);

// Button click handler
onClick={() => setShowAlerts(v => !v)}

// Conditional rendering in useEffect
if (showAlerts) {
  filteredAlerts.forEach((a: any) => {
    const marker = L.circleMarker([lat, lng], {
      radius: 7,
      fillColor: color,
      ...
    });
    marker.addTo(map);  // ← Makes visible
    markersRef.current.alerts.push(marker);
  });
}
```

---

### Test 8: Disease Filter 🦠

**Initial State:**
```
Disease Filter = "all"
Shows: All 20+ alerts in area
```

**Test: Filter for "Tomato Early Blight"**
```
Action:
1. Open "All Diseases" dropdown
2. Select "Tomato Early Blight"

Backend (Client-side filtering):
const filteredAlerts = nearbyAlerts.filter((a: any) =>
  diseaseFilter === 'all' ? true : getDiseaseName(a) === diseaseFilter
);

Expected:
- Dropdown shows: "Tomato Early Blight" selected
- Only 3-5 markers matching this disease appear
- Other disease markers disappear
- Heatmap unaffected (global, not filtered)

Verification:
✓ Disease dropdown populated from alert titles
✓ Filtering is instant (client-side)
✓ No new API call made
✓ Alerts count might change
```

**Sample Disease Options:**
```
All Diseases (default)
├─ Tomato Early Blight
├─ Onion Pink Root
├─ Wheat Rust
├─ Potato Late Blight
└─ Rice Blast
```

---

### Test 9: Map View Toggle (Satellite/OSM) 🛰️

**Initial State:**
```
isSatellite = true
Map shows: ESRI satellite imagery
Button: "Satellite" (purple)
```

**Action: Click Satellite Button**
```
Function executed:
const toggleMapView = () => {
  mapInstance.current.removeLayer(tileLayerRef.current);
  
  if (isSatellite) {
    // Switch to OSM
    tileLayerRef.current = L.tileLayer(OSM_URL, {...}).addTo(map);
  } else {
    // Switch to Satellite
    tileLayerRef.current = L.tileLayer(SATELLITE_URL, {...}).addTo(map);
  }
  
  setIsSatellite(!isSatellite);
};

Expected Result:
1. Satellite tiles fade out (~200ms transition)
2. Street map tiles fade in
3. All markers remain in same positions
4. Button text changes to "Map"
5. Button background changes to gray

Map Details with OSM:
- Street names visible
- Building labels
- Political boundaries
- Street-level accuracy
```

---

### Test 10: Location Search 🔍

**Action: Search for Different Location**
```
1. Type in search box: "Pune"
2. Click "Search" button

Backend execution:
const response = await fetch(
  `nominatim.openstreetmap.org/search?q=Pune&format=json&limit=1`
);
// Nominatim API returns coordinates

Expected API response:
{
  "place_id": 280580341,
  "lat": "18.5204",
  "lon": "73.8567",
  "display_name": "Pune, Maharashtra, India"
}

Frontend action:
1. setSearchLat(18.5204)
2. setSearchLon(73.8567)
3. mapInstance.setView([18.5204, 73.8567], 12)
4. Place orange marker at location

Result:
- Map pans to Pune (animation ~500ms)
- New zoom level: 12
- New nearby data fetched:
  - useNearbyAlerts(18.5204, 73.8567, 15) fires
  - useMapPosts(18.5204, 73.8567, 15) fires
  - farmsApi.nearby(10, {lat: 18.5204, lon: 73.8567}) fires
- All markers update to show Pune area
- Stats update: new number of alerts/farms/stories
```

---

## 3. DATABASE INSPECTION

### Check Real Data in Database

```bash
# Connect to database
psql -U agromind_user -d agromind_db -h localhost

# View recent alerts
SELECT id, title, severity, latitude, longitude, created_at 
FROM alerts 
WHERE is_resolved = false 
ORDER BY created_at DESC 
LIMIT 10;

# View farms
SELECT id, name, user_id, latitude, longitude 
FROM farms 
ORDER BY created_at DESC 
LIMIT 10;

# View community posts
SELECT id, title, crop_name, savings, latitude, longitude, is_verified
FROM community_posts 
ORDER BY created_at DESC 
LIMIT 10;

# Count alerts by severity
SELECT severity, COUNT(*) 
FROM alerts 
WHERE is_resolved = false 
GROUP BY severity;

# View heatmap aggregation (manually)
SELECT ROUND(CAST(latitude AS NUMERIC), 2) AS lat,
       ROUND(CAST(longitude AS NUMERIC), 2) AS lon,
       COUNT(*) as count
FROM alerts
WHERE is_resolved = false 
  AND latitude IS NOT NULL 
  AND longitude IS NOT NULL
GROUP BY lat, lon
ORDER BY count DESC
LIMIT 20;
```

---

## 4. BROWSER DEVTOOLS INSPECTION

### Check Fetched Data

```javascript
// In browser console
// React Query stores cache in window

// View all cached queries
window.__REACT_QUERY_CACHE__

// Or check Network tab:
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by XHR/Fetch
4. Look for:
   - /alerts/nearby
   - /community/map-posts
   - /farms/nearby
   - /alerts/heatmap

// View response:
- Click request
- View "Response" tab
- See actual JSON data returned

// Check performance:
- Timing tab shows
  - Queued: time waiting
  - Duration: transfer time
  - Total: request + wait + transfer
```

---

## 5. COMMON ISSUES & SOLUTIONS

### Issue: Map Shows No Markers
```
Diagnosis:
1. Check console for errors (F12 → Console)
2. Network tab - are API calls succeeding?
3. Check if location has coordinates

Solution:
- Verify latitude/longitude in database: NOT NULL
- Check user location set in registration
- Look for SQL distance calculation errors
```

### Issue: Slow Map Loading
```
Diagnosis:
- Time to Interactive > 2 seconds

Causes:
1. Large number of markers (420+)
2. Slow database queries
3. Slow network

Solutions:
- Ensure indexes created on (lat, lon, is_resolved)
- Limit result sets: 20 alerts, 50 farms, 100 posts, 250 clusters
- Cache more aggressively
```

### Issue: Markers Not Updating
```
Diagnosis:
- Changed location but markers not changing

Causes:
1. Stale React Query cache
2. searchLat/searchLon not updated

Solutions:
- Clear browser cache
- Force invalidation: qc.invalidateQueries()
- Check LocationContext updated correctly
```

---

## 6. PERFORMANCE BENCHMARKS

### Expected Metrics
```
┌─────────────────────────────────────────────────┐
│ Metric             │ Expected    │ Your Result │
├─────────────────────────────────────────────────┤
│ API Response Time  │ < 150ms     │ ___ms      │
│ Map Render Time    │ < 20ms      │ ___ms      │
│ Total E2E          │ < 500ms     │ ___ms      │
│ Markers Rendered   │ < 420       │ ___        │
│ Zoom Performance   │ < 300ms     │ ___ms      │
│ Pan Performance    │ < 200ms     │ ___ms      │
└─────────────────────────────────────────────────┘

Measurement Method:
1. Open DevTools
2. Performance tab
3. Start recording
4. Perform action (zoom, pan, toggle layer)
5. Stop recording
6. Analyze timeline
```

---

## Validation Checklist ✅

```
FOR EACH TEST SCENARIO:
☐ Data loads within 500ms
☐ Correct number of markers shown
☐ Markers appear at correct coordinates
☐ Popups display accurate information
☐ Colors match design specification
☐ Toggles work instantly
☐ Filters apply correctly
☐ Map pans/zooms smoothly
☐ All markers clickable
☐ No console errors
☐ Data reflects database state
☐ Location changes update all queries
```
