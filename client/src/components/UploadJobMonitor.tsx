import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadJob {
  id: string;
  eventId: string;
  userId: string;
  totalFiles: number;
  processedFiles: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  errors: string[];
}

export function UploadJobMonitor() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [loading, setLoading] = useState(false);
  
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/upload-jobs');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching upload jobs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchJobs();
    
    // Auto-refresh every 5 seconds if there are active jobs
    const interval = setInterval(() => {
      if (jobs.some(job => job.status === 'processing' || job.status === 'queued')) {
        fetchJobs();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [jobs]);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="bg-blue-500 text-white">Processing</Badge>;
      default:
        return <Badge variant="outline">Queued</Badge>;
    }
  };
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const calculateDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };
  
  if (jobs.length === 0 && !loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">No upload jobs yet</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Jobs
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchJobs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(job.status)}
                  <span className="font-medium">Job {job.id.slice(-8)}</span>
                  {getStatusBadge(job.status)}
                </div>
                <span className="text-sm text-gray-500">
                  {calculateDuration(job.startTime, job.endTime)}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{job.processedFiles} / {job.totalFiles} files</span>
                </div>
                <Progress 
                  value={(job.processedFiles / job.totalFiles) * 100} 
                  className="h-2"
                />
              </div>
              
              <div className="text-xs text-gray-500">
                <div>Started: {formatTime(job.startTime)}</div>
                {job.endTime && <div>Completed: {formatTime(job.endTime)}</div>}
              </div>
              
              {job.errors.length > 0 && (
                <div className="text-xs text-red-500">
                  {job.errors.length} errors occurred
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
