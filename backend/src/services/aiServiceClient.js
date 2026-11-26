const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

function getAiBaseUrl() {
  return (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}

async function checkAiHealth() {
  try {
    const { data } = await axios.get(`${getAiBaseUrl()}/health`, { timeout: 3000 });
    return { reachable: true, ...data };
  } catch (err) {
    return {
      reachable: false,
      status: 'unreachable',
      error: err.message,
    };
  }
}

async function analyzeClaimImage(filePath, originalName, mimeType) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: originalName || path.basename(filePath),
    contentType: mimeType || 'image/jpeg',
  });

  try {
    const response = await axios.post(`${getAiBaseUrl()}/predict`, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      timeout: 30000,
    });
    return response.data;
  } catch (err) {
    if (err.response) {
      const detail = err.response.data?.detail || err.response.statusText || 'AI service returned an error';
      const error = new Error(`AI verification failed: ${detail}`);
      error.statusCode = err.response.status;
      throw error;
    }
    const error = new Error(
      `Python AI verification service is unreachable at ${getAiBaseUrl()}. Please ensure FastAPI is running.`
    );
    error.statusCode = 503;
    throw error;
  }
}

async function detectVehicleDamage(filePath, originalName, mimeType) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: originalName || path.basename(filePath),
    contentType: mimeType || 'image/jpeg',
  });

  try {
    const response = await axios.post(`${getAiBaseUrl()}/detect-damage`, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      timeout: 30000,
    });
    return response.data;
  } catch (err) {
    return {
      model_status: 'model_unavailable',
      detections: [],
      detection_count: 0,
      message: `YOLO damage service unavailable: ${err.message}`,
    };
  }
}

module.exports = {
  checkAiHealth,
  analyzeClaimImage,
  detectVehicleDamage,
};
