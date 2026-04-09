import { query } from '../utils/database';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  console.log('🌱 Seeding database...');

  // Demo users
  const hash = await bcrypt.hash('password123', 12);
  const users = await Promise.all([
    query(`INSERT INTO users (name,email,password_hash,phone,location,latitude,longitude,farm_size)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      ['Raj Patel','farmer1@agromind.in',hash,'9876543210','Pune, Maharashtra',18.5204,73.8567,10]),
    query(`INSERT INTO users (name,email,password_hash,phone,location,latitude,longitude,farm_size)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      ['Amit Kumar','farmer2@agromind.in',hash,'9876543211','Nashik, Maharashtra',19.9975,73.7898,15]),
  ]);
  const [u1, u2] = users.map(r => r.rows[0].id);

  // Notification prefs
  for (const uid of [u1, u2]) {
    await query(`INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [uid]);
  }

  // Farms
  const f1 = await query(`INSERT INTO farms (user_id,name,location,latitude,longitude,total_area,soil_type)
    VALUES ($1,'Patel Farm North','Pune, Maharashtra',18.5204,73.8567,10,'Black Cotton')
    ON CONFLICT DO NOTHING RETURNING id`, [u1]);
  const farmId = f1.rows[0]?.id;
  if (!farmId) { console.log('Farm already exists, skipping crops'); process.exit(0); }

  // Crops
  const cropData = [
    ['Tomato','Hybrid F1','Field A',2.5],
    ['Potato','Kufri Jyoti','Field B',3.0],
    ['Wheat','HD 2967','Field C',2.5],
    ['Cotton','Bt Cotton','Field D',2.0],
  ];
  const cropIds: string[] = [];
  for (const [name, variety, field, area] of cropData) {
    const r = await query(`INSERT INTO crops (farm_id,user_id,name,variety,field_name,area,planted_date,health_score)
      VALUES ($1,$2,$3,$4,$5,$6,NOW()-INTERVAL '45 days',$7) RETURNING id`,
      [farmId, u1, name, variety, field, area, Math.floor(70 + Math.random()*30)]);
    cropIds.push(r.rows[0].id);
  }

  // Scans
  const scanData = [
    ['Early Blight','Tomato',92,'warning',23500,'Apply copper fungicide within 24h'],
    ['Late Blight','Potato',89,'critical',45000,'Immediate fungicide spray needed'],
    ['Healthy','Wheat',98,'healthy',0,'Crop is in excellent condition'],
    ['Nitrogen Deficiency','Cotton',85,'warning',12000,'Apply urea fertilizer 20kg/acre'],
  ];
  const scanIds: string[] = [];
  for (let i = 0; i < scanData.length; i++) {
    const [disease, plant, conf, sev, loss, rec] = scanData[i];
    const r = await query(`INSERT INTO scans (user_id,crop_id,disease_name,plant_name,confidence,severity,potential_loss,recommendation,regret_insight,status,treatment_steps)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'analyzed',$10) RETURNING id`,
      [u1, cropIds[i], disease, plant, conf, sev, loss, rec,
       `If untreated, ${disease} will spread to ${Math.floor(30+Math.random()*40)}% of crop in 5 days causing ₹${loss?.toLocaleString()} loss.`,
       JSON.stringify([
         {step:1, title:'Prepare Treatment', description:`Mix recommended solution`, duration:'15 min'},
         {step:2, title:'Apply Treatment', description:`Spray affected area thoroughly`, duration:'45 min'},
         {step:3, title:'Monitor Recovery', description:`Check daily for 2 weeks`, duration:'Ongoing'},
       ])
      ]);
    scanIds.push(r.rows[0].id);
  }

  // Alerts
  const alertData = [
    [u1, cropIds[0], scanIds[0], 'Late Blight Detected – Potato Field A', 'High humidity + temp drop. Disease spread imminent.', 'critical', 'disease', 45000, 42000, 7200, 94],
    [u1, cropIds[1], scanIds[1], 'Nutrient Deficiency – Wheat Field B', 'Nitrogen 40% below optimal. Yield reduction expected.', 'warning', 'nutrient', 18000, 15000, 86400, 87],
    [u1, null, null, 'Irrigation Alert', 'Soil moisture at 32%. Optimal watering window: next 6h.', 'info', 'irrigation', 5000, 4500, 21600, 91],
    [u2, null, null, 'Pest Alert – Aphids Detected', 'Aphid population rising in cotton fields nearby.', 'warning', 'pest', 22000, 19000, 43200, 83],
  ];
  for (const [uid, cid, sid, title, desc, sev, type, loss, prev, tl, conf] of alertData) {
    await query(`INSERT INTO alerts (user_id,crop_id,scan_id,title,description,severity,type,potential_loss,preventable_loss,time_left_seconds,confidence)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uid, cid || null, sid || null, title, desc, sev, type, loss, prev, tl, conf]);
  }

  // Loss prevention records
  await query(`INSERT INTO loss_prevention_records (user_id,amount_prevented,action_taken,recorded_at)
    VALUES ($1,287450,'Multiple disease treatments and preventive measures over 6 months',NOW()-INTERVAL '1 day')`, [u1]);

  // Community posts
  const posts = [
    [u1, 'Prevented ₹34K Tomato Loss', 'Applied organic pesticide for aphid control early. AI scan detected it 3 days before visible damage.', 'Tomato', 'Pune, Maharashtra', 18.5204, 73.8567, 'Applied organic pesticide', 'Prevented 85% crop damage', 34000],
    [u2, 'Drip Irrigation Saved My Wheat', 'Implemented drip irrigation after AgroMind recommendation. Reduced water by 40%, yield up 22%.', 'Wheat', 'Nashik, Maharashtra', 19.9975, 73.7898, 'Drip irrigation system', 'Yield increased 22%', 56000],
  ];
  for (const [uid, title, content, crop, loc, lat, lng, action, result, savings] of posts) {
    await query(`INSERT INTO community_posts (user_id,title,content,crop_name,location,latitude,longitude,action_taken,result,savings,is_verified)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)`,
      [uid, title, content, crop, loc, lat, lng, action, result, savings]);
  }

  // Analytics snapshots (6 months)
  const months = ['2025-10-01','2025-11-01','2025-12-01','2026-01-01','2026-02-01','2026-03-01'];
  const prevented = [42000,56000,48000,67000,73000,89000];
  const potential = [58000,71000,62000,89000,95000,112000];
  for (let i = 0; i < months.length; i++) {
    await query(`INSERT INTO analytics_snapshots (user_id,snapshot_date,total_alerts,resolved_alerts,loss_prevented,potential_loss,scans_count,avg_response_time_hours,crop_health_avg)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [u1, months[i], 15+i*2, 12+i*2, prevented[i], potential[i], 8+i, 4.2-i*0.4, 85+i]);
  }

  console.log('✅ Seed completed successfully');
  console.log('📧 Demo accounts: farmer1@agromind.in / password123');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
