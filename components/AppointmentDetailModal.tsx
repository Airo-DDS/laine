import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trash2, AlertCircle } from "lucide-react";

// Assuming Appointment type is defined centrally or passed appropriately
// If not, define a basic version here or import it
interface Appointment {
    id: string;
    date: Date;
    reason: string;
    status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
    patientType: 'NEW' | 'EXISTING';
    notes?: string | null;
    patient: {
        firstName: string;
        lastName: string;
    };
}

interface AppointmentDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onDeleteSuccess: () => void; // Callback after successful delete
}

export default function AppointmentDetailModal({ isOpen, onOpenChange, appointment, onDeleteSuccess }: AppointmentDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (!appointment) return;

    // Optional: Add a confirmation step here if desired
    // if (!confirm('Are you sure you want to delete this appointment?')) {
    //   return;
    // }

    setIsDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, { method: 'DELETE' });
      if (!response.ok) {
        let errorMsg = 'Failed to delete appointment';
        try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
        } catch {
            /* Ignore JSON parsing error */
        }
        throw new Error(errorMsg);
      }
      onDeleteSuccess(); // Call callback on success
    } catch (err) { 
      setError(err instanceof Error ? err.message : 'Could not delete appointment');
      console.error("Delete error:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Use useEffect to reset state when modal visibility changes
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setError('');
      setIsDeleting(false);
    }
  }, [isOpen]);

  if (!appointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appointment Details</DialogTitle>
          <DialogDescription>
            {appointment.reason} for {appointment.patient.firstName} {appointment.patient.lastName}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2 text-sm">
          <p><strong>Date & Time:</strong> {appointment.date.toLocaleString()}</p>
          <p><strong>Status:</strong> 
            <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
              appointment.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
              appointment.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
              appointment.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
              appointment.status === 'SCHEDULED' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-800' // Fallback for SCHEDULED
            }`}>
              {appointment.status}
            </span>
          </p>
          <p><strong>Patient Type:</strong> 
             <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                appointment.patientType === 'NEW' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
            }`}>
                {appointment.patientType}
            </span>
          </p>
          {appointment.notes && <p><strong>Notes:</strong> {appointment.notes}</p>}
          
          {error && (
            <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
           )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="order-last sm:order-first">
            {isDeleting ? 'Deleting...' : <><Trash2 className="mr-2 h-4 w-4" /> Delete</>}
          </Button>
          <div className="flex gap-2">
            {/* Add Edit Button placeholder if needed */}
            {/* <Button variant="outline" disabled={isDeleting}>Edit</Button> */}
             <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 