import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(__dirname, '..', 'data');
const schemesPath = path.join(dataDir, 'schemes.json');
const inputsPath = path.join(dataDir, 'input-recommendations.json');

const loadJson = <T>(filePath: string, fallback: T): T => {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

type Scheme = {
  id: string;
  category?: string;
  applicable_states: string[];
  applicable_crops: string[];
  [key: string]: unknown;
};

const SCHEMES_DB = loadJson<Scheme[]>(schemesPath, []);
const INPUT_RECOMMENDATIONS = loadJson<Record<string, {
  fertilizers: Array<{ name: string; dose: string; timing: string; price_per_kg: number }>;
  pesticides: Array<{ name: string; dose: string; timing: string; price_per_litre: number; organic: boolean }>;
  best_practices: string[];
}>>(inputsPath, {});

export const getSchemes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { crop, state, category } = req.query;
    const userR = await query('SELECT location FROM users WHERE id=$1', [req.user!.id]);
    const userLocation = (userR.rows[0]?.location || '').toLowerCase();

    let schemes = SCHEMES_DB.filter(s => {
      if (category && s.category !== category) return false;
      if (state) {
        const st = (state as string).toLowerCase();
        if (!s.applicable_states.includes('all') && !s.applicable_states.some(ss => ss.toLowerCase().includes(st))) return false;
      }
      if (crop) {
        const c = (crop as string).toLowerCase();
        if (!s.applicable_crops.includes('all') && !s.applicable_crops.some(sc => sc.toLowerCase().includes(c))) return false;
      }
      return true;
    });

    // Boost Maharashtra schemes if user is in Maharashtra
    if (userLocation.includes('maharashtra')) {
      schemes = [
        ...schemes.filter(s => s.applicable_states.includes('Maharashtra')),
        ...schemes.filter(s => !s.applicable_states.includes('Maharashtra')),
      ];
    }

    res.json({ success: true, data: schemes, total: schemes.length });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch schemes' });
  }
};

export const getSchemeById = async (req: AuthRequest, res: Response): Promise<void> => {
  const scheme = SCHEMES_DB.find(s => s.id === req.params.id);
  if (!scheme) { res.status(404).json({ success: false, message: 'Scheme not found' }); return; }
  res.json({ success: true, data: scheme });
};

export const getInputRecommendations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { crop } = req.params;
    const cropValue = Array.isArray(crop) ? crop[0] : crop;
    const cropKey = (cropValue || 'tomato').toLowerCase().replace(/[^a-z]/g, '');
    const data = INPUT_RECOMMENDATIONS[cropKey] || INPUT_RECOMMENDATIONS.tomato;
    if (!data) {
      res.status(404).json({ success: false, message: 'No input recommendations found for this crop' });
      return;
    }

    const totalFertCost = data.fertilizers.reduce((s, f) => {
      const qty = parseFloat(f.dose.split(' ')[0]);
      return s + qty * f.price_per_kg;
    }, 0);

    res.json({
      success: true,
      data: {
        crop: cropValue,
        fertilizers: data.fertilizers,
        pesticides: data.pesticides,
        best_practices: data.best_practices,
        estimated_input_cost_inr: Math.round(totalFertCost),
        organic_options: data.pesticides.filter(p => p.organic),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch recommendations' });
  }
};
