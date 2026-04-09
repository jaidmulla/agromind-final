import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';

export const getPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { crop, limit = '20', offset = '0' } = req.query;
    let sql = `SELECT p.*, u.name as author_name, u.location as author_location,
                 EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id=p.id AND pl.user_id=$1) as liked_by_me
               FROM community_posts p
               JOIN users u ON u.id = p.user_id
               WHERE 1=1`;
    const params: unknown[] = [req.user!.id];
    if (crop) { sql += ` AND p.crop_name ILIKE $${params.length + 1}`; params.push(`%${crop}%`); }
    sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const r = await query(sql, params);
    res.json({ success: true, data: r.rows });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
};

export const getMapPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lon, radius = '10' } = req.query;
    const radiusKm = Number(radius || 10);

    if (!lat || !lon) {
      // If no location provided, return all posts with coordinates
      const r = await query(
        `SELECT p.id, p.title, p.crop_name, p.location, p.latitude, p.longitude,
                p.savings, p.result, p.action_taken, p.is_verified, p.created_at, 
                u.name as author_name
         FROM community_posts p
         JOIN users u ON u.id = p.user_id
         WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
         ORDER BY p.created_at DESC LIMIT 100`
      );
      res.json({ success: true, data: r.rows });
      return;
    }

    // With location - calculate distance and filter by radius
    const centerLat = Number(lat);
    const centerLon = Number(lon);

    const r = await query(
      `SELECT p.id, p.title, p.crop_name, p.location, p.latitude, p.longitude,
              p.savings, p.result, p.action_taken, p.is_verified, p.created_at,
              u.name as author_name,
              (6371 * acos(cos(radians($1)) * cos(radians(p.latitude)) *
               cos(radians(p.longitude) - radians($2)) + sin(radians($1)) * sin(radians(p.latitude)))) AS distance_km
       FROM community_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
         AND (6371 * acos(cos(radians($1)) * cos(radians(p.latitude)) *
              cos(radians(p.longitude) - radians($2)) + sin(radians($1)) * sin(radians(p.latitude)))) <= $3
       ORDER BY distance_km ASC LIMIT 100`,
      [centerLat, centerLon, radiusKm]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('getMapPosts error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch map posts' });
  }
};

export const getPostById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [postR, commentsR] = await Promise.all([
      query(
        `SELECT p.*, u.name as author_name, u.location as author_location,
                EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id=p.id AND pl.user_id=$2) as liked_by_me
         FROM community_posts p JOIN users u ON u.id=p.user_id
         WHERE p.id=$1`,
        [req.params.id, req.user!.id]
      ),
      query(
        `SELECT c.*, u.name as author_name FROM post_comments c
         JOIN users u ON u.id=c.user_id WHERE c.post_id=$1 ORDER BY c.created_at ASC`,
        [req.params.id]
      ),
    ]);
    if (!postR.rows.length) { res.status(404).json({ success: false, message: 'Post not found' }); return; }
    res.json({ success: true, data: { ...postR.rows[0], comments: commentsR.rows } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
};

export const createPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, crop_name, location, latitude, longitude, action_taken, result, savings } = req.body;
    if (!content) { res.status(400).json({ success: false, message: 'Content is required' }); return; }

    // Verify farmer for badge
    const verifyR = await query(
      `SELECT COUNT(DISTINCT s.id) >= 3 AND COUNT(DISTINCT a.id) >= 1 as is_verified
       FROM users u
       LEFT JOIN scans s ON s.user_id=u.id
       LEFT JOIN alerts a ON a.user_id=u.id AND a.is_resolved=true
       WHERE u.id=$1`,
      [req.user!.id]
    );
    const isVerified = verifyR.rows[0]?.is_verified || false;

    const r = await query(
      `INSERT INTO community_posts (user_id,title,content,crop_name,location,latitude,longitude,action_taken,result,savings,is_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user!.id, title, content, crop_name, location, latitude || null, longitude || null, action_taken, result, savings || null, isVerified]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
};

export const toggleLike = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await query(
      'SELECT id FROM post_likes WHERE post_id=$1 AND user_id=$2',
      [req.params.id, req.user!.id]
    );
    let liked: boolean;
    if (existing.rows.length) {
      await query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
      await query('UPDATE community_posts SET likes_count=GREATEST(0,likes_count-1) WHERE id=$1', [req.params.id]);
      liked = false;
    } else {
      await query('INSERT INTO post_likes (post_id,user_id) VALUES ($1,$2)', [req.params.id, req.user!.id]);
      await query('UPDATE community_posts SET likes_count=likes_count+1 WHERE id=$1', [req.params.id]);
      liked = true;
    }
    const r = await query('SELECT likes_count FROM community_posts WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: { liked, likes_count: r.rows[0]?.likes_count || 0 } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to toggle like' });
  }
};

export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;
    if (!content) { res.status(400).json({ success: false, message: 'Content required' }); return; }
    const r = await query(
      `INSERT INTO post_comments (post_id,user_id,content) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, req.user!.id, content]
    );
    await query('UPDATE community_posts SET comments_count=comments_count+1 WHERE id=$1', [req.params.id]);
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
};

export const deletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query('DELETE FROM community_posts WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.user!.id]);
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Post not found' }); return; }
    res.json({ success: true, message: 'Post deleted' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
};
