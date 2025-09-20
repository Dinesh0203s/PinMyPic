import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { Photo, FaceData } from '@shared/types';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Python face recognition service URL
const FACE_SERVICE_URL = 'http://localhost:5001';

// Start the Python face recognition service if not already running
let pythonProcess: any = null;

export function startFaceRecognitionService() {
  if (pythonProcess) {
    console.log('Face recognition service already running');
    return;
  }

  console.log('Starting face recognition service...');
  
  // Install Python dependencies and download models first
  return initializeFaceRecognitionService();
}

async function initializeFaceRecognitionService() {
  try {
    // Install Python dependencies if requirements.txt exists
    const requirementsPath = path.join(__dirname, 'face-recognition', 'requirements.txt');
    if (await fileExists(requirementsPath)) {
      console.log('Installing Python dependencies...');
      await installPythonDependencies(requirementsPath);
    }
    
    // Download models before starting the service
    console.log('Downloading face recognition models...');
    await downloadModels();
    
    // Start the Python Flask app
    pythonProcess = spawn('python', [
      path.join(__dirname, 'face-recognition', 'app.py')
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    pythonProcess.stdout.on('data', (data: Buffer) => {
      console.log(`Face service: ${data.toString()}`);
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      console.error(`Face service error: ${data.toString()}`);
    });

    pythonProcess.on('close', (code: number) => {
      console.log(`Face recognition service exited with code ${code}`);
      pythonProcess = null;
      
      // Auto-restart service if it crashes unexpectedly
      if (code !== 0) {
        console.log('Face recognition service crashed, attempting restart in 5 seconds...');
        setTimeout(() => {
          restartFaceRecognitionService();
        }, 5000);
      }
    });

    // Wait for the service to be ready (non-blocking in production)
    if (process.env.NODE_ENV === 'production') {
      // In production, start service asynchronously without blocking startup
      waitForService().then(() => {
        console.log('Face recognition service is ready');
      }).catch((err) => {
        console.warn('Face recognition service failed to start:', err);
      });
      return Promise.resolve();
    } else {
      return waitForService();
    }
    
  } catch (error) {
    console.error('Failed to initialize face recognition service:', error);
    throw error;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const fs = await import('fs');
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function installPythonDependencies(requirementsPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pip = spawn('pip', ['install', '-r', requirementsPath], {
      stdio: 'pipe',
      env: { ...process.env }
    });

    pip.stdout.on('data', (data: Buffer) => {
      console.log(`pip: ${data.toString()}`);
    });

    pip.stderr.on('data', (data: Buffer) => {
      console.error(`pip error: ${data.toString()}`);
    });

    pip.on('close', (code: number) => {
      if (code === 0) {
        console.log('Python dependencies installed successfully');
        resolve();
      } else {
        reject(new Error(`pip install failed with code ${code}`));
      }
    });
  });
}

async function downloadModels(): Promise<void> {
  return new Promise((resolve, reject) => {
    const downloadScript = spawn('python', [
      path.join(__dirname, 'face-recognition', 'download_models.py')
    ], {
      stdio: 'pipe',
      env: { ...process.env }
    });

    downloadScript.stdout.on('data', (data: Buffer) => {
      console.log(`Model download: ${data.toString()}`);
    });

    downloadScript.stderr.on('data', (data: Buffer) => {
      console.error(`Model download error: ${data.toString()}`);
    });

    downloadScript.on('close', (code: number) => {
      if (code === 0) {
        console.log('Face recognition models downloaded successfully');
        resolve();
      } else {
        console.log('Model download completed (may have been cached)');
        resolve(); // Don't fail if models are already cached
      }
    });
  });
}

async function waitForService(maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${FACE_SERVICE_URL}/health`);
      if (response.ok) {
        console.log('Face recognition service is ready');
        return true;
      }
    } catch (error) {
      // Service not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.error('Face recognition service failed to start');
  return false;
}

async function restartFaceRecognitionService() {
  console.log('Restarting face recognition service...');
  
  if (pythonProcess) {
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }
  
  // Wait a moment before restart
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    await initializeFaceRecognitionService();
    console.log('Face recognition service restarted successfully');
  } catch (error) {
    console.error('Failed to restart face recognition service:', error);
  }
}

export async function checkServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${FACE_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function processFacePhoto(fileReference: string): Promise<FaceData[]> {
  let retryCount = 0;
  const maxRetries = 2;
  
  while (retryCount <= maxRetries) {
    try {
      // Check if service is healthy before processing
      const isHealthy = await checkServiceHealth();
      if (!isHealthy) {
        if (retryCount < maxRetries) {
          console.log(`Face service unhealthy, attempting restart (retry ${retryCount + 1}/${maxRetries + 1})`);
          await restartFaceRecognitionService();
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for service to stabilize
          continue;
        } else {
          throw new Error('Face recognition service is not available after restart attempts');
        }
      }

      const response = await fetch(`${FACE_SERVICE_URL}/process-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_reference: fileReference }),
        signal: AbortSignal.timeout(150000) // 2.5 minute timeout for queue processing
      });

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('Face recognition service is overloaded, retrying...');
        } else if (response.status === 504) {
          throw new Error('Face processing timeout, retrying...');
        }
        throw new Error(`Face processing failed: ${response.statusText}`);
      }

      const result = await response.json() as { faces?: FaceData[] };
      return result.faces || [];
      
    } catch (error) {
      console.error(`Error processing face photo (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < maxRetries && error instanceof Error && error.message.includes('ECONNREFUSED')) {
        console.log(`Connection refused, attempting service restart (retry ${retryCount + 1}/${maxRetries + 1})`);
        await restartFaceRecognitionService();
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Face processing failed after all retry attempts');
}

export async function compareFaces(selfieData: string, photos: Array<Photo & { faceData?: FaceData[] }>): Promise<Array<{ photoId: string; similarity: number }>> {
  try {
    // Extract embeddings from photos that have face data
    const embeddings = photos
      .filter(photo => photo.faceData && photo.faceData.length > 0)
      .flatMap(photo => 
        photo.faceData!.map(face => ({
          photoId: photo.id,
          embedding: face.embedding
        }))
      );

    if (embeddings.length === 0) {
      return [];
    }

    const response = await fetch(`${FACE_SERVICE_URL}/compare-faces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selfieData, embeddings })
    });

    if (!response.ok) {
      throw new Error(`Face comparison failed: ${response.statusText}`);
    }

    const result = await response.json() as { matches?: Array<{ photoId: string; similarity: number }> };
    return result.matches || [];
  } catch (error) {
    console.error('Error comparing faces:', error);
    throw error;
  }
}

// Stop the Python service when the Node.js process exits
process.on('exit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

process.on('SIGINT', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  process.exit();
});

process.on('SIGTERM', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  process.exit();
});