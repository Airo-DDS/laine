import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from 'lucide-react';

// Define types locally for now, consider centralizing
interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
}

// Define the structure of the form data
interface AppointmentFormData {
    date: string;          // YYYY-MM-DD
    time: string;          // HH:MM
    patientId: string;     // ID of existing patient (if patientType is EXISTING)
    reason: string;
    patientType: 'NEW' | 'EXISTING';
    notes: string;
    // New patient fields (only used if patientType is NEW)
    newPatientFirstName: string;
    newPatientLastName: string;
    newPatientEmail: string;
    newPatientPhone: string;
}

interface AppointmentFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialDateTime: { start: Date; end: Date } | null;
  patients: Patient[]; // List of existing patients for the dropdown
  onSubmitSuccess: () => void; // Callback on successful save
}

const defaultFormData: AppointmentFormData = {
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    patientId: '',
    reason: '',
    patientType: 'EXISTING',
    notes: '',
    newPatientFirstName: '',
    newPatientLastName: '',
    newPatientEmail: '',
    newPatientPhone: '',
};

export default function AppointmentFormModal({
    isOpen,
    onOpenChange,
    initialDateTime,
    patients,
    onSubmitSuccess
}: AppointmentFormModalProps) {

  const [formData, setFormData] = useState<AppointmentFormData>(defaultFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill date/time when modal opens with slot info or reset otherwise
  useEffect(() => {
    if (isOpen) {
      if (initialDateTime) {
        const startDate = initialDateTime.start;
        // Format date and time carefully
        const year = startDate.getFullYear();
        const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
        const day = startDate.getDate().toString().padStart(2, '0');
        const hours = startDate.getHours().toString().padStart(2, '0');
        const minutes = startDate.getMinutes().toString().padStart(2, '0');
        
        setFormData({
          ...defaultFormData, 
          date: `${year}-${month}-${day}`, 
          time: `${hours}:${minutes}`,     
        });
      } else {
         // Reset to default if opened without slot info
         setFormData(defaultFormData);
      }
      // Reset error and loading state whenever modal opens
      setError('');
      setIsLoading(false);
    }
  }, [isOpen, initialDateTime]);

  const handleChange = (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
     const { name, value } = e.target;
     setFormData(prev => ({ ...prev, [name]: value }));
     
     // If switching patient type, clear the other type's fields
     if (name === 'patientType') {
        if (value === 'NEW') {
            setFormData(prev => ({ ...prev, patientId: ''}));
        } else {
            setFormData(prev => ({
                ...prev,
                newPatientFirstName: '',
                newPatientLastName: '',
                newPatientEmail: '',
                newPatientPhone: '',
            }));
        }
     }
  };

  // Handle Select change specifically for Radix/Shadcn components
  const handleSelectChange = (name: keyof AppointmentFormData) => (value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Trigger the same clearing logic as handleChange
    if (name === 'patientType') {
       if (value === 'NEW') {
           setFormData(prev => ({ ...prev, patientId: ''}));
       } else {
           setFormData(prev => ({
               ...prev,
               newPatientFirstName: '',
               newPatientLastName: '',
               newPatientEmail: '',
               newPatientPhone: '',
           }));
       }
    }
  };

  // Placeholder handleSubmit - Replace with your actual API logic
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    console.log("Submitting Form Data:", formData);

    // --- Start: Replace with your API Call Logic --- 
    try {
      // 1. Combine date and time
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      if (Number.isNaN(dateTime.getTime())) { // Use Number.isNaN
          throw new Error('Invalid date or time format.');
      }

      // 2. Determine Patient ID (Create new if needed)
      let finalPatientId = formData.patientId;
      if (formData.patientType === 'NEW') {
          if (!formData.newPatientFirstName || !formData.newPatientLastName) {
              throw new Error('First and last name are required for new patients.');
          }
          // Optional: Fetch dentist ID if needed for patient creation
          // const usersRes = await fetch('/api/users?role=DENTIST');
          // const users = await usersRes.json();
          // if (users.length === 0) throw new Error('No dentist found.');
          // const dentistId = users[0].id;

          const patientPayload = {
              firstName: formData.newPatientFirstName,
              lastName: formData.newPatientLastName,
              email: formData.newPatientEmail || undefined,
              phoneNumber: formData.newPatientPhone || undefined,
              // userId: dentistId, // Include if needed by your API
          };
          console.log("Creating new patient:", patientPayload);
          const patientRes = await fetch('/api/patients', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patientPayload),
          });
          if (!patientRes.ok) {
              const errData = await patientRes.json();
              throw new Error(errData.error || 'Failed to create new patient');
          }
          const newPatient = await patientRes.json();
          finalPatientId = newPatient.id;
          console.log("New patient created:", newPatient);
      } else if (!finalPatientId) {
          throw new Error('Please select an existing patient.');
      }

      // 3. Create the Appointment
      const appointmentPayload = {
          date: dateTime.toISOString(),
          patientId: finalPatientId,
          reason: formData.reason,
          patientType: formData.patientType,
          notes: formData.notes || undefined,
          status: 'SCHEDULED', // Default status, adjust as needed
      };
      console.log("Creating appointment:", appointmentPayload);
      const appointmentRes = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appointmentPayload),
      });

      if (!appointmentRes.ok) {
          const errData = await appointmentRes.json();
          throw new Error(errData.error || 'Failed to create appointment');
      }
      
      const newAppointment = await appointmentRes.json();
      console.log("Appointment created:", newAppointment);

      // 4. Success
      onSubmitSuccess(); // Call the success callback from parent

    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      console.error('Form submission error:', err);
    } finally {
      setIsLoading(false);
    }
    // --- End: Replace with your API Call Logic --- 
  };

  // Generate basic time slots (e.g., 8 AM to 5:30 PM)
  const timeSlots = useMemo(() => {
      const slots = [];
      for (let hour = 8; hour < 18; hour++) {
          slots.push(`${hour.toString().padStart(2, '0')}:00`);
          slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      return slots;
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add New Appointment</SheetTitle>
          <SheetDescription>Fill in the details below to schedule an appointment.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          {/* Date Input */} 
          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>

          {/* Time Select */} 
          <div className="space-y-1">
             <Label htmlFor="time">Time</Label>
             <Select name="time" value={formData.time} onValueChange={handleSelectChange('time')} disabled={isLoading} required>
                <SelectTrigger id="time">
                    <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                    {timeSlots.map((time: string) => ( // Add string type here
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          {/* Patient Type Select */} 
          <div className="space-y-1">
             <Label htmlFor="patientType">Patient Type</Label>
             <Select name="patientType" value={formData.patientType} onValueChange={handleSelectChange('patientType')} disabled={isLoading} required>
                <SelectTrigger id="patientType">
                    <SelectValue placeholder="Select patient type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="EXISTING">Existing Patient</SelectItem>
                    <SelectItem value="NEW">New Patient</SelectItem>
                </SelectContent>
            </Select>
          </div>

          {/* Conditional Patient Fields */} 
          {formData.patientType === 'EXISTING' ? (
            <div className="space-y-1">
               <Label htmlFor="patientId">Patient</Label>
               <Select name="patientId" value={formData.patientId} onValueChange={handleSelectChange('patientId')} disabled={isLoading} required>
                  <SelectTrigger id="patientId">
                      <SelectValue placeholder="Select existing patient" />
                  </SelectTrigger>
                  <SelectContent>
                      {patients.length > 0 ? (
                          patients.map(patient => (
                            <SelectItem key={patient.id} value={patient.id}>
                              {patient.firstName} {patient.lastName}
                            </SelectItem>
                          ))
                      ) : (
                         <SelectItem value="" disabled>No existing patients found</SelectItem> 
                      )}
                  </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3 border-t border-b py-4 px-1 my-4 border-dashed">
              <h3 className="font-medium text-sm mb-2">New Patient Information</h3>
              <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="newPatientFirstName">First Name</Label>
                    <Input
                      id="newPatientFirstName"
                      name="newPatientFirstName"
                      value={formData.newPatientFirstName}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="newPatientLastName">Last Name</Label>
                    <Input
                      id="newPatientLastName"
                      name="newPatientLastName"
                      value={formData.newPatientLastName}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                    />
                  </div>
              </div>
               <div className="space-y-1">
                <Label htmlFor="newPatientEmail">Email <span className="text-xs text-muted-foreground">(Optional)</span></Label>
                <Input
                  id="newPatientEmail"
                  type="email"
                  name="newPatientEmail"
                  value={formData.newPatientEmail}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newPatientPhone">Phone <span className="text-xs text-muted-foreground">(Optional)</span></Label>
                <Input
                  id="newPatientPhone"
                  type="tel"
                  name="newPatientPhone"
                  value={formData.newPatientPhone}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Reason Input */} 
          <div className="space-y-1">
            <Label htmlFor="reason">Reason for Visit</Label>
            <Input
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              required
              disabled={isLoading}
              placeholder="e.g., Check-up, Cleaning, Consultation"
            />
          </div>

          {/* Notes Textarea */} 
          <div className="space-y-1">
            <Label htmlFor="notes">Notes <span className="text-xs text-muted-foreground">(Optional)</span></Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              disabled={isLoading}
              placeholder="Any additional information..."
            />
          </div>

          {/* Error Display */} 
          {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
           )}

          <SheetFooter className="pt-4">
            <SheetClose asChild>
               <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
            </SheetClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
              {isLoading ? 'Saving...' : 'Save Appointment'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}