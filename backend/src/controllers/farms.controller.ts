import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';

// ─── FARMS ───────────────────────────────────────────────────────────────────

export const getFarms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT f.*, COUNT(c.id) as crop_count
       FROM farms f LEFT JOIN crops c ON c.farm_id=f.id
       WHERE f.user_id=$1 GROUP BY f.id ORDER BY f.created_at DESC`,
      [req.user!.id]
    );
    res.json({ success: true, data: r.rows });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch farms' }); }
};

export const getNearbyFarms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lon, radius_km = '10' } = req.query;
    const radiusKm = Number(radius_km || 10);

    let centerLat, centerLon;
    if (lat && lon) {
      centerLat = Number(lat);
      centerLon = Number(lon);
    } else {
      const userR = await query('SELECT latitude, longitude FROM users WHERE id=$1', [req.user!.id]);
      const user = userR.rows[0];
      if (!user?.latitude || !user?.longitude) {
        res.json({ success: true, data: [] });
        return;
      }
      centerLat = user.latitude;
      centerLon = user.longitude;
    }

    const r = await query(
      `SELECT f.*, u.name as farmer_name, u.location as farmer_location,
              (6371 * acos(cos(radians($1)) * cos(radians(f.latitude)) *
               cos(radians(f.longitude) - radians($2)) + sin(radians($1)) * sin(radians(f.latitude)))) AS distance_km
       FROM farms f
       JOIN users u ON u.id = f.user_id
       WHERE f.latitude IS NOT NULL AND f.longitude IS NOT NULL
         AND (6371 * acos(cos(radians($1)) * cos(radians(f.latitude)) *
              cos(radians(f.longitude) - radians($2)) + sin(radians($1)) * sin(radians(f.latitude)))) <= $3
       ORDER BY distance_km ASC
       LIMIT 100`,
      [centerLat, centerLon, radiusKm]
    );

    res.json({ success: true, data: r.rows });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch nearby farms' });
  }
};

export const createFarm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, location, latitude, longitude, total_area, area_unit, soil_type } = req.body;
    if (!name) { res.status(400).json({ success: false, message: 'Farm name required' }); return; }
    const r = await query(
      `INSERT INTO farms (user_id,name,location,latitude,longitude,total_area,area_unit,soil_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user!.id, name, location, latitude || null, longitude || null, total_area || null, area_unit || 'acres', soil_type || null]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch { res.status(500).json({ success: false, message: 'Failed to create farm' }); }
};

export const getFarmById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [farmR, cropsR] = await Promise.all([
      query('SELECT * FROM farms WHERE id=$1 AND user_id=$2', [req.params.id, req.user!.id]),
      query('SELECT * FROM crops WHERE farm_id=$1 ORDER BY created_at DESC', [req.params.id]),
    ]);
    if (!farmR.rows.length) { res.status(404).json({ success: false, message: 'Farm not found' }); return; }
    res.json({ success: true, data: { ...farmR.rows[0], crops: cropsR.rows } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch farm' }); }
};

export const updateFarm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, location, latitude, longitude, total_area, soil_type } = req.body;
    const r = await query(
      `UPDATE farms SET name=COALESCE($1,name), location=COALESCE($2,location),
       latitude=COALESCE($3,latitude), longitude=COALESCE($4,longitude),
       total_area=COALESCE($5,total_area), soil_type=COALESCE($6,soil_type)
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [name, location, latitude, longitude, total_area, soil_type, req.params.id, req.user!.id]
    );
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Farm not found' }); return; }
    res.json({ success: true, data: r.rows[0] });
  } catch { res.status(500).json({ success: false, message: 'Failed to update farm' }); }
};

export const deleteFarm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await query('DELETE FROM farms WHERE id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
    res.json({ success: true, message: 'Farm deleted' });
  } catch { res.status(500).json({ success: false, message: 'Failed to delete farm' }); }
};

// ─── CROPS ───────────────────────────────────────────────────────────────────

export const getCrops = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { farm_id, status } = req.query;
    let sql = `SELECT c.*, f.name as farm_name,
                 (SELECT COUNT(*) FROM scans WHERE crop_id=c.id) as scan_count,
                 (SELECT COUNT(*) FROM alerts WHERE crop_id=c.id AND NOT is_resolved) as active_alerts
               FROM crops c LEFT JOIN farms f ON f.id=c.farm_id
               WHERE c.user_id=$1`;
    const params: unknown[] = [req.user!.id];
    if (farm_id) { sql += ` AND c.farm_id=$${params.length + 1}`; params.push(farm_id); }
    if (status) { sql += ` AND c.status=$${params.length + 1}`; params.push(status); }
    sql += ' ORDER BY c.created_at DESC';
    const r = await query(sql, params);
    res.json({ success: true, data: r.rows });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch crops' }); }
};

export const createCrop = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { farm_id, name, variety, field_name, area, area_unit, planted_date, expected_harvest_date } = req.body;
    if (!name) { res.status(400).json({ success: false, message: 'Crop name required' }); return; }
    const r = await query(
      `INSERT INTO crops (farm_id,user_id,name,variety,field_name,area,area_unit,planted_date,expected_harvest_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [farm_id || null, req.user!.id, name, variety || null, field_name || null, area || null,
       area_unit || 'acres', planted_date || null, expected_harvest_date || null]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch { res.status(500).json({ success: false, message: 'Failed to create crop' }); }
};

export const getCropById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [cropR, scansR] = await Promise.all([
      query('SELECT c.*, f.name as farm_name FROM crops c LEFT JOIN farms f ON f.id=c.farm_id WHERE c.id=$1 AND c.user_id=$2', [req.params.id, req.user!.id]),
      query('SELECT id,disease_name,confidence,severity,status,created_at FROM scans WHERE crop_id=$1 ORDER BY created_at DESC LIMIT 10', [req.params.id]),
    ]);
    if (!cropR.rows.length) { res.status(404).json({ success: false, message: 'Crop not found' }); return; }
    res.json({ success: true, data: { ...cropR.rows[0], recent_scans: scansR.rows } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch crop' }); }
};

export const updateCrop = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, variety, field_name, area, status, health_score } = req.body;
    const r = await query(
      `UPDATE crops SET name=COALESCE($1,name), variety=COALESCE($2,variety),
       field_name=COALESCE($3,field_name), area=COALESCE($4,area),
       status=COALESCE($5,status), health_score=COALESCE($6,health_score)
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [name, variety, field_name, area, status, health_score, req.params.id, req.user!.id]
    );
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Crop not found' }); return; }
    res.json({ success: true, data: r.rows[0] });
  } catch { res.status(500).json({ success: false, message: 'Failed to update crop' }); }
};

export const deleteCrop = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await query('DELETE FROM crops WHERE id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
    res.json({ success: true, message: 'Crop deleted' });
  } catch { res.status(500).json({ success: false, message: 'Failed to delete crop' }); }
};
