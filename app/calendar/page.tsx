"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Calendar, Views, dateFnsLocalizer } from 'react-big-calendar';
import type { ToolbarProps } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import AppointmentFormModal from '@/components/AppointmentFormModal';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';

// Define types
interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  // Add other patient fields as needed by the form
}

interface Appointment {
  id: string;
  date: Date; // Should be a Date object after parsing
  reason: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'; // Example statuses
  patientType: 'NEW' | 'EXISTING';
  notes?: string | null;
  patientId: string;
  patient: Patient; // Include patient data for display/form
}

// Type for data coming directly from API before parsing date
interface AppointmentData extends Omit<Appointment, 'date' | 'patient'> {
  date: string; // Date as string from API
  patient: Patient;
}

// Type for event object used by react-big-calendar
interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Appointment; // Store original appointment
}

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: locales['en-US'] }),
  getDay,
  locales,
});

// Custom Toolbar Component
const CustomToolbar = (toolbar: ToolbarProps<CalendarEvent>) => {
  const goToBack = () => toolbar.onNavigate('PREV');
  const goToNext = () => toolbar.onNavigate('NEXT');
  const goToCurrent = () => toolbar.onNavigate('TODAY');

  return (
    <div className="rbc-toolbar mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Title - Always at top on mobile, centered on desktop */}
      <div className="w-full sm:w-auto text-center sm:order-2">
        <span className="rbc-toolbar-label text-lg font-semibold">
          {toolbar.label}
        </span>
      </div>
      
      {/* Navigation buttons - Left side on desktop */}
      <div className="flex items-center gap-2 sm:order-1">
        <Button variant="outline" size="sm" onClick={goToBack} className="min-w-[70px]">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Prev
        </Button>
        <Button variant="outline" size="sm" onClick={goToCurrent} className="min-w-[70px]">
          Today
        </Button>
        <Button variant="outline" size="sm" onClick={goToNext} className="min-w-[70px]">
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* View switcher - Right side on desktop */}
      <div className="flex items-center gap-2 sm:order-3">
        <Button 
          variant={toolbar.view === 'week' ? 'secondary' : 'outline'} 
          size="sm" 
          onClick={() => toolbar.onView('week')}
          className="min-w-[60px]"
        >
          Week
        </Button>
        <Button 
          variant={toolbar.view === 'day' ? 'secondary' : 'outline'} 
          size="sm" 
          onClick={() => toolbar.onView('day')}
          className="min-w-[50px]"
        >
          Day
        </Button>
      </div>
    </div>
  );
};

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [newAppointmentSlot, setNewAppointmentSlot] = useState<{ start: Date; end: Date } | null>(null);

  // Load appointments and patients
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentsRes, patientsRes] = await Promise.all([
        fetch('/api/appointments'),
        fetch('/api/patients')
      ]);

      if (!appointmentsRes.ok) throw new Error(`Appointments fetch failed: ${appointmentsRes.statusText} (${appointmentsRes.status})`);
      if (!patientsRes.ok) throw new Error(`Patients fetch failed: ${patientsRes.statusText} (${patientsRes.status})`);

      const appointmentsData: AppointmentData[] = await appointmentsRes.json();
      const patientsData: Patient[] = await patientsRes.json();

      // Important: Parse date strings into Date objects
      const parsedAppointments = appointmentsData.map((apt) => ({
          ...apt,
          date: new Date(apt.date)
        }));
        
        setAppointments(parsedAppointments);
        setPatients(patientsData);
      } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred fetching data';
      setError(message);
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
  }, []);
    
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Transform appointments for react-big-calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => appointments.map(apt => {
    // Basic assumption: 30 min duration. Adjust if you store duration.
    const endTime = new Date(apt.date.getTime() + 30 * 60000); 
    return {
      title: `${apt.patient.firstName} ${apt.patient.lastName} - ${apt.reason}`,
      start: apt.date,
      end: endTime,
      resource: apt, // Attach original data
    };
  }), [appointments]);

  // Event Handlers
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedAppointment(event.resource);
    setIsDetailOpen(true);
    console.log("Selected Event:", event.resource); // For debugging
  }, []);
  
  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date }) => {
    setNewAppointmentSlot({ start: slotInfo.start, end: slotInfo.end });
    setSelectedAppointment(null); // Ensure no previous detail is shown
    setIsFormOpen(true);
    console.log("Selected Slot:", slotInfo); // For debugging
  }, []);

  const handleNavigate = useCallback((newDate: Date) => {
    setCurrentDate(newDate);
  }, []);

  // Modal Success Handlers
  const handleAppointmentSaveSuccess = () => {
    setIsFormOpen(false);
    setNewAppointmentSlot(null);
    fetchData(); // Re-fetch data to show the new appointment
  }

  const handleAppointmentDeleteSuccess = () => {
    setIsDetailOpen(false);
    setSelectedAppointment(null);
    fetchData(); // Re-fetch data after deleting
  }

  // Style Getter (Phase 5)
  const eventStyleGetter = (event: CalendarEvent, start: Date, end: Date, isSelected: boolean) => {
    const appointment = event.resource;
    let newClassName = 'rbc-event flex items-center text-xs leading-tight'; // Base styles
    
    // Add status-specific styles (adjust Tailwind classes as needed for your theme)
    switch (appointment.status) {
      case 'CONFIRMED':
        newClassName += ' bg-green-100 border-green-300 text-green-800 hover:bg-green-200';
        break;
      case 'CANCELLED':
        newClassName += ' bg-red-100 border-red-300 text-red-800 hover:bg-red-200 line-through opacity-75';
        break;
      case 'COMPLETED':
         newClassName += ' bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200 opacity-80';
         break;
      default:
        newClassName += ' bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'; // Use theme colors
        break;
    }

    // Add selection style from react-big-calendar default CSS or custom overrides
     if (isSelected) {
       newClassName += ' rbc-selected'; // Rely on CSS for selection style
     }

    return { className: newClassName };
  };

  if (loading && appointments.length === 0) {
    return (
       <div className="container mx-auto p-4 md:p-6 space-y-4">
         <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-32" />
          </div>
         </div>
         <Skeleton className="h-10 w-full" />
         <Skeleton className="h-[60vh] md:h-[70vh] w-full" />
       </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 flex flex-col h-[calc(100vh-theme(space.16))]">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Appointment Calendar</h1>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => {
            setNewAppointmentSlot(null);
            setSelectedAppointment(null);
            setIsFormOpen(true);
          }}>
            <CalendarPlus className="mr-2 h-4 w-4" /> Add Appointment
          </Button>
          <Link href="/patients">
            <Button variant="outline">View Patients</Button>
          </Link>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex-1 min-h-0 bg-card p-2 sm:p-4 rounded-lg border shadow-sm">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          views={[Views.WEEK, Views.DAY]}
          defaultView={Views.WEEK}
          date={currentDate}
          onNavigate={handleNavigate}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable={true}
          components={{
            toolbar: CustomToolbar,
          }}
          eventPropGetter={eventStyleGetter}
          step={30}
          timeslots={2}
          min={new Date(0, 0, 0, 8, 0, 0)}
          max={new Date(0, 0, 0, 18, 0, 0)}
          popup={true}
                  />
                </div>
                
      <AppointmentFormModal
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialDateTime={newAppointmentSlot}
        patients={patients}
        onSubmitSuccess={handleAppointmentSaveSuccess}
      />

      <AppointmentDetailModal
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        appointment={selectedAppointment}
        onDeleteSuccess={handleAppointmentDeleteSuccess}
      />
    </div>
  );
} 