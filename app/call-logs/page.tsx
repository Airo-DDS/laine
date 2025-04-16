"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Eye, RefreshCw } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import CallDetailModal from '@/components/CallDetailModal'; // Import the modal

// Interface matching the data from the API route
interface CallLogInfo {
  id: string;
  createdAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  status: string;
  endedReason: string | null;
  transcript: string | null;
  summary: string | null;
  structuredData: Record<string, unknown> | null;
  recordingUrl: string | null;
}

export default function CallLogsPage() {
  const [calls, setCalls] = useState<CallLogInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCallDetail, setSelectedCallDetail] = useState<CallLogInfo | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Fetch calls function
  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all logs for the org by default, add assistantId filter later if needed
      const res = await fetch('/api/call-logs'); // Removed assistantId query param for now

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `Failed to fetch call logs (${res.status})`);
      }

      const data: CallLogInfo[] = await res.json();
      // Sort by creation date descending
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCalls(data);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error("Error fetching call logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Function to format date concisely
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
    });
  };

  // Function to format duration
  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds < 0) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Handle opening the detail modal
  const handleViewDetails = (call: CallLogInfo) => {
    setSelectedCallDetail(call);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Call Logs</h1>
        <Button variant="outline" size="sm" onClick={fetchCalls} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Logs</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="border rounded-lg overflow-hidden shadow-sm bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Date/Time</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">End Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Skeleton rows with better keys
              Array.from({ length: 5 }).map((_, i) => {
                const skeletonId = `skeleton-row-${Date.now()}-${i}`;
                return (
                  <TableRow key={skeletonId}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-10" /></TableCell>
                  </TableRow>
                );
              })
            ) : calls.length === 0 && !error ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No call logs found.
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell className="font-medium text-xs sm:text-sm">{formatDate(call.createdAt)}</TableCell>
                  <TableCell className="text-xs sm:text-sm">{formatDuration(call.durationSeconds)}</TableCell>
                  <TableCell>
                    <Badge variant={call.status === 'ended' ? 'secondary' : 'default'} className="capitalize text-xs">
                      {call.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground truncate max-w-[200px]">
                    {call.endedReason || 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(call)}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View Details</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Modal */}
      <CallDetailModal
        isOpen={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        callDetail={selectedCallDetail}
      />
    </div>
  );
} 