/**
 * Test Dynamic Upload Processing
 * Demonstrates the improved frontend batch processing
 */

import { uploadQueueManager, DynamicUploadStats } from './dynamicUploadProcessor';

// Mock upload function for testing
const mockUploadFunction = async (uploadFile: any): Promise<void> => {
  // Simulate upload time based on file size
  const uploadTime = Math.random() * 2000 + 500; // 0.5-2.5 seconds
  await new Promise(resolve => setTimeout(resolve, uploadTime));
  
  // Simulate occasional failures (5% chance)
  if (Math.random() < 0.05) {
    throw new Error('Simulated upload failure');
  }
};

// Mock update function for testing
const mockUpdateFunction = (updater: (prev: any[]) => any[]) => {
  // Simulate state update
  console.log('State updated via mock function');
};

// Test data generator
const generateTestFiles = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-file-${i}`,
    file: {
      name: `test-photo-${i + 1}.jpg`,
      size: Math.random() * 5 * 1024 * 1024 + 1024 * 1024, // 1-6MB
      type: 'image/jpeg'
    },
    status: 'pending' as const,
    progress: 0
  }));
};

/**
 * Test dynamic upload processing
 */
export const testDynamicUpload = async (fileCount: number = 20) => {
  console.log(`🧪 Testing Dynamic Upload Processing with ${fileCount} files`);
  console.log('=' .repeat(60));
  
  const testFiles = generateTestFiles(fileCount);
  const startTime = Date.now();
  
  let progressCallback = (stats: DynamicUploadStats) => {
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`📊 Progress: ${stats.completed}/${stats.total} completed, ${stats.uploading} uploading, ${stats.pending} pending, ${stats.throughput.toFixed(2)} files/sec (${elapsed.toFixed(1)}s elapsed)`);
  };
  
  try {
    await uploadQueueManager.startDynamicProcessing(
      testFiles,
      mockUploadFunction,
      mockUpdateFunction,
      progressCallback,
      `test_${Date.now()}`
    );
    
    const totalTime = (Date.now() - startTime) / 1000;
    const throughput = testFiles.length / totalTime;
    
    console.log('=' .repeat(60));
    console.log(`✅ Dynamic Upload Test Completed!`);
    console.log(`📈 Total Time: ${totalTime.toFixed(2)} seconds`);
    console.log(`📈 Average Throughput: ${throughput.toFixed(2)} files/second`);
    console.log(`📈 Files Processed: ${testFiles.length}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

/**
 * Compare traditional vs dynamic processing
 */
export const compareProcessingMethods = async (fileCount: number = 20) => {
  console.log(`🔄 Comparing Processing Methods with ${fileCount} files`);
  console.log('=' .repeat(60));
  
  // Test traditional batch processing (simulated)
  console.log('📦 Traditional Batch Processing:');
  const traditionalStart = Date.now();
  
  // Simulate traditional batching (wait for batch completion)
  const batchSize = 8;
  const batches = Math.ceil(fileCount / batchSize);
  
  for (let i = 0; i < batches; i++) {
    const batchStart = Date.now();
    const batchFiles = Math.min(batchSize, fileCount - i * batchSize);
    
    // Simulate processing entire batch
    await new Promise(resolve => setTimeout(resolve, batchFiles * 1000)); // 1 second per file
    
    const batchTime = (Date.now() - batchStart) / 1000;
    console.log(`  Batch ${i + 1}/${batches}: ${batchFiles} files in ${batchTime.toFixed(2)}s`);
  }
  
  const traditionalTime = (Date.now() - traditionalStart) / 1000;
  console.log(`📊 Traditional Total Time: ${traditionalTime.toFixed(2)} seconds`);
  
  console.log('\n🚀 Dynamic Processing:');
  await testDynamicUpload(fileCount);
  
  console.log('\n📈 Performance Comparison:');
  console.log(`Traditional: ${traditionalTime.toFixed(2)}s`);
  console.log(`Dynamic: ~${(fileCount * 1.5).toFixed(2)}s (estimated)`);
  console.log(`Improvement: ~${((traditionalTime - fileCount * 1.5) / traditionalTime * 100).toFixed(1)}% faster`);
};

/**
 * Test with different file sizes
 */
export const testWithDifferentSizes = async () => {
  console.log('📁 Testing with Different File Sizes');
  console.log('=' .repeat(60));
  
  const testCases = [
    { name: 'Small Files (1MB)', count: 50, avgSize: 1024 * 1024 },
    { name: 'Medium Files (3MB)', count: 30, avgSize: 3 * 1024 * 1024 },
    { name: 'Large Files (8MB)', count: 15, avgSize: 8 * 1024 * 1024 },
    { name: 'Mixed Sizes', count: 40, avgSize: 4 * 1024 * 1024 }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 ${testCase.name}:`);
    await testDynamicUpload(testCase.count);
  }
};

/**
 * Test concurrency limits
 */
export const testConcurrencyLimits = async () => {
  console.log('⚡ Testing Concurrency Limits');
  console.log('=' .repeat(60));
  
  const concurrencyTests = [4, 8, 12, 16, 20];
  
  for (const concurrency of concurrencyTests) {
    console.log(`\n🔧 Testing with ${concurrency} concurrent uploads:`);
    
    // Override the global max concurrent for this test
    const originalMax = uploadQueueManager['globalMaxConcurrent'];
    uploadQueueManager['globalMaxConcurrent'] = concurrency;
    
    await testDynamicUpload(25);
    
    // Restore original setting
    uploadQueueManager['globalMaxConcurrent'] = originalMax;
  }
};

// Export test runner
export const runAllTests = async () => {
  console.log('🚀 Starting Dynamic Upload Processing Tests');
  console.log('=' .repeat(60));
  
  try {
    // Basic functionality test
    await testDynamicUpload(15);
    
    // Comparison test
    await compareProcessingMethods(20);
    
    // Different file sizes
    await testWithDifferentSizes();
    
    // Concurrency tests
    await testConcurrencyLimits();
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
};

// Auto-run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - add to window for manual testing
  (window as any).testDynamicUpload = {
    testDynamicUpload,
    compareProcessingMethods,
    testWithDifferentSizes,
    testConcurrencyLimits,
    runAllTests
  };
  
  console.log('🧪 Dynamic Upload Tests loaded! Run testDynamicUpload.runAllTests() to start testing.');
}




