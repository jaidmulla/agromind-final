import axios from 'axios';
import logger from '../utils/logger';

// ────────────────────────────────────────────────────────────────────────────
// Plant.id Integration — Leaf disease detection API
// ────────────────────────────────────────────────────────────────────────────

const PLANT_ID_API_URL = 'https://api.plant.id/v2/identify';
const API_KEY = process.env.PLANT_ID_API_KEY;

export interface PlantIDResponse {
  success: boolean;
  plant_name?: string;
  disease_name?: string;
  probability?: number;
  cause?: string;
  treatment?: string;
  classification?: string;
  message?: string;
  error?: string;
}

/**
 * Analyze leaf image using Plant.id API
 * @param imageBase64 - Base64 encoded image
 * @param userId - User ID (for logging)
 * @returns Plant identification and disease info
 */
export const analyzePlantDisease = async (
  imageBase64: string,
  userId: string,
): Promise<PlantIDResponse> => {
  try {
    // Validate API key
    if (!API_KEY) {
      logger.error('PLANT_ID_API_KEY not configured');
      return {
        success: false,
        message: 'Leaf analysis service not configured',
        error: 'Missing API key',
      };
    }

    // Make request to Plant.id API
    const response = await axios.post(
      PLANT_ID_API_URL,
      {
        images: [imageBase64],
        modifiers: ['crops_fast', 'similar_images'],
        disease_details: ['cause', 'treatment', 'classification'],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': API_KEY,
        },
        timeout: 30000, // 30 seconds timeout
      },
    );

    // Parse response
    const result = response.data;

    // Check if identification was successful
    if (!result.is_plant?.confirmed) {
      return {
        success: false,
        message: 'Image does not contain a clear plant leaf',
        error: 'No valid plant detected',
      };
    }

    // Extract plant info
    const plantName = result.plant_details?.name || 'Unknown Plant';
    const suggestions = result.suggestions || [];

    if (suggestions.length === 0) {
      return {
        success: true,
        plant_name: plantName,
        disease_name: 'Healthy',
        probability: 100,
        cause: 'No disease detected',
        treatment: 'Continue with regular maintenance',
        classification: 'healthy',
      };
    }

    // Get first suggestion (highest probability)
    const topSuggestion = suggestions[0];
    const diseaseName = topSuggestion.disease?.name || 'Unknown Disease';
    const probability = Math.round((topSuggestion.probability || 0) * 100);
    const diseaseInfo = topSuggestion.disease || {};

    // Log identification
    logger.info(`Plant identified: ${plantName}, Disease: ${diseaseName}, Probability: ${probability}%`, {
      userId,
      plantName,
      diseaseName,
      probability,
    });

    return {
      success: true,
      plant_name: plantName,
      disease_name: diseaseName,
      probability,
      cause: diseaseInfo.description || 'See treatment recommendations',
      treatment: diseaseInfo.treatment?.description || 'Consult with an agricultural expert',
      classification: diseaseName === 'Healthy' ? 'healthy' : 'diseased',
    };
  } catch (error: any) {
    logger.error('Error analyzing leaf with Plant.id API:', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // Determine error message based on error type
    let message = 'Failed to analyze leaf image';
    if (error.response?.status === 401 || error.response?.status === 403) {
      message = 'Leaf analysis service authentication failed';
    } else if (error.response?.status === 429) {
      message = 'Too many requests. Please try again later.';
    } else if (error.code === 'ECONNABORTED') {
      message = 'Leaf analysis took too long. Please try again.';
    }

    return {
      success: false,
      message,
      error: error.message,
    };
  }
};

/**
 * Calculate image hash for deduplication (simple implementation)
 */
export const calculateImageHash = (base64String: string): string => {
  // Simple hash: take first 32 chars of base64
  // In production, use a proper hash algorithm like SHA-256
  return base64String.substring(0, 32);
};

/**
 * Validate image before sending to Plant.id
 */
export const validateImage = (base64String: string): { valid: boolean; message: string } => {
  if (!base64String || base64String.length === 0) {
    return {
      valid: false,
      message: 'Image is empty',
    };
  }

  // Check maximum size (5MB in base64 = ~3.75MB actual)
  const maxSizeInChars = 5 * 1024 * 1024;
  if (base64String.length > maxSizeInChars) {
    return {
      valid: false,
      message: 'Image is too large. Maximum size is 5MB.',
    };
  }

  // Verify base64 format
  if (!/^[A-Za-z0-9+/=]+$/.test(base64String)) {
    return {
      valid: false,
      message: 'Invalid image format',
    };
  }

  return {
    valid: true,
    message: 'Image is valid',
  };
};

export default {
  analyzePlantDisease,
  calculateImageHash,
  validateImage,
};
