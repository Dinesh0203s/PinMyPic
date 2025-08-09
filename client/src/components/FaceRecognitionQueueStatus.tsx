import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Users, Clock, Zap, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QueueStatus {
  queueSize: number;
  activeProcessing: number;
  processing: boolean;
  maxConcurrent: number;
  userConcurrencyLimit: number;
  activeUsers: number;
  processedCount: number;
  errorCount: number;
  avgProcessingTime: number;
  throughputPerMinute: number;
  uptime: number;
}

interface UserQueueStatus {
  queuedItems: number;
  processingItems: number;
  maxAllowed: number;
  position: number | null;
}

export function FaceRecognitionQueueStatus() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [userStatus, setUserStatus] = useState<UserQueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchQueueStatus = async () => {
    try {
      const [queueResponse, userResponse] = await Promise.all([
        fetch('/api/face-queue/status'),
        fetch('/api/face-queue/user-status')
      ]);

      if (!queueResponse.ok || !userResponse.ok) {
        throw new Error('Failed to fetch queue status');
      }

      const queueData = await queueResponse.json();
      const userData = await userResponse.json();

      setQueueStatus(queueData);
      setUserStatus(userData);
      setError(null);
    } catch (err) {
      console.error('Error fetching queue status:', err);
      setError('Failed to load queue status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchQueueStatus, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getQueueLoadStatus = (): { status: 'low' | 'medium' | 'high'; color: string } => {
    if (!queueStatus) return { status: 'low', color: 'green' };
    
    const loadPercentage = (queueStatus.queueSize / 50) * 100; // Consider 50+ as high load
    
    if (loadPercentage >= 80) return { status: 'high', color: 'red' };
    if (loadPercentage >= 40) return { status: 'medium', color: 'yellow' };
    return { status: 'low', color: 'green' };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading queue status...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const loadStatus = getQueueLoadStatus();

  return (
    <div className="space-y-4">
      {/* User Queue Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Your Face Recognition Queue
          </CardTitle>
          <CardDescription>
            Current status of your face recognition requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userStatus && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {userStatus.queuedItems}
                </div>
                <div className="text-sm text-gray-600">Queued</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {userStatus.processingItems}
                </div>
                <div className="text-sm text-gray-600">Processing</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {userStatus.maxAllowed}
                </div>
                <div className="text-sm text-gray-600">Max Allowed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {userStatus.position || '-'}
                </div>
                <div className="text-sm text-gray-600">Queue Position</div>
              </div>
            </div>
          )}

          {userStatus && userStatus.queuedItems > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Queue Progress</span>
                <span>{userStatus.position ? `Position ${userStatus.position}` : 'Processing'}</span>
              </div>
              <Progress 
                value={userStatus.position ? Math.max(0, 100 - (userStatus.position / 10) * 100) : 100} 
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Queue Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              System Queue Status
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={loadStatus.status === 'high' ? 'destructive' : loadStatus.status === 'medium' ? 'default' : 'secondary'}>
                {loadStatus.status.toUpperCase()} LOAD
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchQueueStatus}
                className="gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Real-time system performance and queue metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queueStatus && (
            <div className="space-y-4">
              {/* Main Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">
                    {queueStatus.queueSize}
                  </div>
                  <div className="text-sm text-blue-800">Total Queued</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-xl font-bold text-orange-600">
                    {queueStatus.activeProcessing}
                  </div>
                  <div className="text-sm text-orange-800">Processing Now</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-xl font-bold text-green-600">
                    {queueStatus.activeUsers}
                  </div>
                  <div className="text-sm text-green-800">Active Users</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-xl font-bold text-purple-600">
                    {queueStatus.throughputPerMinute}
                  </div>
                  <div className="text-sm text-purple-800">Per Minute</div>
                </div>
              </div>

              {/* Processing Capacity */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Processing Capacity</span>
                  <span>{queueStatus.activeProcessing} / {queueStatus.maxConcurrent} slots</span>
                </div>
                <Progress 
                  value={(queueStatus.activeProcessing / queueStatus.maxConcurrent) * 100} 
                  className="h-3"
                />
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Processed:</span>
                  <span className="ml-1 font-semibold">{queueStatus.processedCount}</span>
                </div>
                <div>
                  <span className="text-gray-600">Errors:</span>
                  <span className="ml-1 font-semibold text-red-600">{queueStatus.errorCount}</span>
                </div>
                <div>
                  <span className="text-gray-600">Avg Time:</span>
                  <span className="ml-1 font-semibold">{formatTime(queueStatus.avgProcessingTime / 1000)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Uptime:</span>
                  <span className="ml-1 font-semibold">{formatTime(queueStatus.uptime)}</span>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${queueStatus.processing ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-gray-600">
                    Queue {queueStatus.processing ? 'Active' : 'Stopped'}
                  </span>
                </div>
                
                {queueStatus.queueSize > 20 && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-orange-500" />
                    <span className="text-orange-600">High volume - expect delays</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-refresh toggle */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Queue status updates automatically every 10 seconds</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={autoRefresh ? 'text-green-600' : 'text-gray-400'}
        >
          Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
        </Button>
      </div>
    </div>
  );
}