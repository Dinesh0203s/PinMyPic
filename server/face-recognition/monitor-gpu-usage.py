#!/usr/bin/env python3
"""
GPU Memory Usage Monitor for 80% GPU Utilization
Monitors GPU memory usage and provides optimization recommendations
"""

import time
import subprocess
import json
import sys
import os

def get_gpu_memory_info():
    """Get GPU memory information using nvidia-smi."""
    try:
        result = subprocess.run([
            'nvidia-smi', '--query-gpu=memory.total,memory.used,memory.free,utilization.gpu',
            '--format=csv,noheader,nounits'
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            gpu_info = []
            for line in lines:
                parts = line.split(', ')
                if len(parts) >= 4:
                    gpu_info.append({
                        'total_mb': int(parts[0]),
                        'used_mb': int(parts[1]),
                        'free_mb': int(parts[2]),
                        'utilization_percent': int(parts[3])
                    })
            return gpu_info
        else:
            print(f"Error getting GPU info: {result.stderr}")
            return None
    except Exception as e:
        print(f"Error running nvidia-smi: {e}")
        return None

def calculate_optimal_settings(gpu_info):
    """Calculate optimal settings for 80% GPU usage."""
    if not gpu_info:
        return None
    
    gpu = gpu_info[0]  # Use first GPU
    total_mb = gpu['total_mb']
    used_mb = gpu['used_mb']
    free_mb = gpu['free_mb']
    
    # Calculate 80% of total GPU memory
    target_usage_mb = int(total_mb * 0.8)
    available_for_processing = target_usage_mb - used_mb
    
    # Estimate memory per image (higher resolution = more memory)
    memory_per_image_2048 = 15  # MB per 2048px image
    memory_per_image_1920 = 12  # MB per 1920px image
    memory_per_image_1024 = 8   # MB per 1024px image
    
    # Calculate optimal batch sizes
    optimal_batch_2048 = max(1, available_for_processing // memory_per_image_2048)
    optimal_batch_1920 = max(1, available_for_processing // memory_per_image_1920)
    optimal_batch_1024 = max(1, available_for_processing // memory_per_image_1024)
    
    # Calculate optimal concurrent workers
    # Each worker needs memory for processing
    memory_per_worker = 200  # MB per worker
    optimal_workers = max(1, available_for_processing // memory_per_worker)
    
    return {
        'total_gpu_memory_mb': total_mb,
        'current_usage_mb': used_mb,
        'current_usage_percent': (used_mb / total_mb) * 100,
        'target_usage_mb': target_usage_mb,
        'target_usage_percent': 80.0,
        'available_for_processing_mb': available_for_processing,
        'optimal_batch_sizes': {
            '2048px': optimal_batch_2048,
            '1920px': optimal_batch_1920,
            '1024px': optimal_batch_1024
        },
        'optimal_workers': optimal_workers,
        'memory_per_image': {
            '2048px': memory_per_image_2048,
            '1920px': memory_per_image_1920,
            '1024px': memory_per_image_1024
        }
    }

def monitor_gpu_usage(duration_seconds=60, interval_seconds=5):
    """Monitor GPU usage for specified duration."""
    print("GPU Memory Usage Monitor - 80% Utilization Target")
    print("=" * 60)
    
    start_time = time.time()
    measurements = []
    
    try:
        while time.time() - start_time < duration_seconds:
            gpu_info = get_gpu_memory_info()
            if gpu_info:
                gpu = gpu_info[0]
                current_time = time.time() - start_time
                
                measurement = {
                    'timestamp': current_time,
                    'used_mb': gpu['used_mb'],
                    'free_mb': gpu['free_mb'],
                    'utilization_percent': gpu['utilization_percent'],
                    'usage_percent': (gpu['used_mb'] / gpu['total_mb']) * 100
                }
                measurements.append(measurement)
                
                print(f"[{current_time:5.1f}s] "
                      f"Used: {gpu['used_mb']:4d}MB "
                      f"Free: {gpu['free_mb']:4d}MB "
                      f"Usage: {(gpu['used_mb']/gpu['total_mb'])*100:5.1f}% "
                      f"GPU: {gpu['utilization_percent']:3d}%")
            
            time.sleep(interval_seconds)
    
    except KeyboardInterrupt:
        print("\nMonitoring stopped by user")
    
    # Calculate statistics
    if measurements:
        avg_usage = sum(m['usage_percent'] for m in measurements) / len(measurements)
        max_usage = max(m['usage_percent'] for m in measurements)
        min_usage = min(m['usage_percent'] for m in measurements)
        
        print("\n" + "=" * 60)
        print("GPU Usage Statistics:")
        print(f"Average Usage: {avg_usage:.1f}%")
        print(f"Maximum Usage: {max_usage:.1f}%")
        print(f"Minimum Usage: {min_usage:.1f}%")
        
        if avg_usage < 70:
            print("⚠️  GPU usage is below 70% - consider increasing batch sizes")
        elif avg_usage > 85:
            print("⚠️  GPU usage is above 85% - consider reducing batch sizes")
        else:
            print("✅ GPU usage is optimal (70-85%)")
    
    return measurements

def main():
    """Main function."""
    print("GPU Memory Optimization Monitor")
    print("=" * 40)
    
    # Get current GPU info
    gpu_info = get_gpu_memory_info()
    if not gpu_info:
        print("❌ Could not get GPU information. Make sure nvidia-smi is available.")
        return
    
    # Calculate optimal settings
    optimal = calculate_optimal_settings(gpu_info)
    if optimal:
        print(f"GPU Memory: {optimal['total_gpu_memory_mb']}MB total")
        print(f"Current Usage: {optimal['current_usage_mb']}MB ({optimal['current_usage_percent']:.1f}%)")
        print(f"Target Usage: {optimal['target_usage_mb']}MB (80%)")
        print(f"Available for Processing: {optimal['available_for_processing_mb']}MB")
        print()
        print("Optimal Settings for 80% GPU Usage:")
        print(f"  Max Workers: {optimal['optimal_workers']}")
        print(f"  Batch Size (2048px): {optimal['optimal_batch_sizes']['2048px']}")
        print(f"  Batch Size (1920px): {optimal['optimal_batch_sizes']['1920px']}")
        print(f"  Batch Size (1024px): {optimal['optimal_batch_sizes']['1024px']}")
        print()
    
    # Start monitoring
    print("Starting GPU monitoring (60 seconds)...")
    print("Press Ctrl+C to stop early")
    print()
    
    measurements = monitor_gpu_usage(60, 5)
    
    if measurements:
        print("\n📊 Monitoring complete!")
        print("Use these settings in your configuration for optimal 80% GPU usage.")

if __name__ == "__main__":
    main()




