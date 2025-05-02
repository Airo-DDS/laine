'use client';

import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define interfaces for the data we expect
interface NexHealthCredentials {
    apiKey: string;
    subdomain: string;
    locationId: string;
}

interface Appointment {
    id: number;
    start_time: string;
    end_time: string;
    patient?: { id: number; name: string };
    provider_name?: string;
    operatory?: { id: number; name: string };
    // Add other relevant fields from the API response as needed
}

interface SelectOption {
    id: number | string; // Can be number (most IDs) or string (e.g., form IDs)
    name: string;
}

export default function NexHealthTestPage() {
    // --- State Variables ---
    const [credentials, setCredentials] = useState<NexHealthCredentials>({ apiKey: '', subdomain: '', locationId: '' });
    const [bearerToken, setBearerToken] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionLoading, setConnectionLoading] = useState(false);
    const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);

    // Appointment Fetching State
    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to today
    const [endDate, setEndDate] = useState<string>(() => {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek.toISOString().split('T')[0]; // Default to one week from today
    });
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [fetchAppointmentsLoading, setFetchAppointmentsLoading] = useState(false);
    const [fetchAppointmentsError, setFetchAppointmentsError] = useState<string | null>(null);

    // Appointment Creation State
    const [patients, setPatients] = useState<SelectOption[]>([]);
    const [providers, setProviders] = useState<SelectOption[]>([]);
    const [operatories, setOperatories] = useState<SelectOption[]>([]);
    const [appointmentTypes, setAppointmentTypes] = useState<SelectOption[]>([]);
    const [prepareFormLoading, setPrepareFormLoading] = useState(false);
    const [prepareFormError, setPrepareFormError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const [selectedPatientId, setSelectedPatientId] = useState<string>('');
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [selectedOperatoryId, setSelectedOperatoryId] = useState<string>(''); // May not be required depending on location settings
    const [selectedAppointmentTypeId, setSelectedAppointmentTypeId] = useState<string>('');
    const [newAppointmentStartTime, setNewAppointmentStartTime] = useState<string>(''); // Use datetime-local input

    const [createAppointmentLoading, setCreateAppointmentLoading] = useState(false);
    const [createAppointmentResult, setCreateAppointmentResult] = useState<{ success: boolean; message: string } | null>(null);

    // --- Handlers ---

    const handleCredentialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCredentials({ ...credentials, [e.target.id]: e.target.value });
        // Reset connection status if credentials change
        setIsConnected(false);
        setBearerToken(null);
        setConnectionResult(null);
        setAppointments([]);
        setShowCreateForm(false);
    };

    const handleTestConnection = async (event: React.FormEvent) => {
        event.preventDefault();
        setConnectionLoading(true);
        setConnectionResult(null);
        setIsConnected(false);
        setBearerToken(null);
        setAppointments([]); // Clear previous results
        setShowCreateForm(false);

        try {
            const response = await fetch('/api/nexhealth/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                setConnectionResult({ success: false, message: data.message || `Error: ${response.statusText}` });
            } else {
                setConnectionResult({ success: true, message: data.message });
                setBearerToken(data.bearerToken); // Store the token
                setIsConnected(true);
            }
        } catch (error) {
            console.error('Failed to test connection:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setConnectionResult({ success: false, message: `Client-side error: ${errorMessage}` });
        } finally {
            setConnectionLoading(false);
        }
    };

    const handleFetchAppointments = async () => {
        if (!isConnected || !bearerToken) return;
        setFetchAppointmentsLoading(true);
        setFetchAppointmentsError(null);
        setAppointments([]);

        try {
            const response = await fetch('/api/nexhealth/appointments', {
                method: 'POST', // Using POST to send credentials securely
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    credentials, // Send all credentials needed for auth + context
                    bearerToken, // Send the obtained token
                    action: 'fetch',
                    params: { startDate, endDate }
                }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                setFetchAppointmentsError(data.message || `Error: ${response.statusText}`);
            } else {
                setAppointments(data.appointments || []);
                if ((data.appointments || []).length === 0) {
                     setFetchAppointmentsError("No appointments found for the selected date range.");
                }
            }
        } catch (error) {
            console.error('Failed to fetch appointments:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setFetchAppointmentsError(`Client-side error: ${errorMessage}`);
        } finally {
            setFetchAppointmentsLoading(false);
        }
    };

     const handlePrepareCreateForm = async () => {
        if (!isConnected || !bearerToken) return;
        setPrepareFormLoading(true);
        setPrepareFormError(null);
        setShowCreateForm(false); // Hide form while loading prerequisites
        setPatients([]);
        setProviders([]);
        setOperatories([]);
        setAppointmentTypes([]);

        try {
            const response = await fetch('/api/nexhealth/prepare-appointment-form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentials, bearerToken }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                setPrepareFormError(data.message || `Error: ${response.statusText}`);
            } else {
                setPatients(data.patients || []);
                setProviders(data.providers || []);
                setOperatories(data.operatories || []);
                setAppointmentTypes(data.appointmentTypes || []);
                setShowCreateForm(true); // Show form now that data is loaded
            }
        } catch (error) {
            console.error('Failed to prepare form:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setPrepareFormError(`Client-side error: ${errorMessage}`);
        } finally {
            setPrepareFormLoading(false);
        }
    };

    const handleCreateAppointment = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!isConnected || !bearerToken) return;

        setCreateAppointmentLoading(true);
        setCreateAppointmentResult(null);

        // Convert local datetime string to ISO 8601 UTC string
        let startTimeISO = '';
        try {
            // Attempt to parse the local time and convert to ISO string (assumes browser's local timezone)
            // For production, you might need a more robust timezone handling strategy
            startTimeISO = new Date(newAppointmentStartTime).toISOString();
        } catch {
             setCreateAppointmentResult({ success: false, message: 'Invalid start date/time format.' });
             setCreateAppointmentLoading(false);
             return;
        }


        const appointmentData = {
            patientId: Number.parseInt(selectedPatientId, 10),
            providerId: Number.parseInt(selectedProviderId, 10),
            operatoryId: selectedOperatoryId ? Number.parseInt(selectedOperatoryId, 10) : undefined, // Operatory might be optional
            appointmentTypeId: Number.parseInt(selectedAppointmentTypeId, 10),
            startTime: startTimeISO,
        };

        // Basic validation
        if (
            Number.isNaN(appointmentData.patientId) || 
            Number.isNaN(appointmentData.providerId) || 
            Number.isNaN(appointmentData.appointmentTypeId) || 
            !appointmentData.startTime
        ) {
             setCreateAppointmentResult({ success: false, message: 'Missing required fields for appointment creation.' });
             setCreateAppointmentLoading(false);
             return;
        }
         // Add check for operatory if required by location (this info isn't fetched here, but important in real app)
         // if (locationRequiresOperatory && Number.isNaN(appointmentData.operatoryId)) { ... }


        try {
            const response = await fetch('/api/nexhealth/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    credentials,
                    bearerToken,
                    action: 'create',
                    params: appointmentData
                }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                setCreateAppointmentResult({ success: false, message: data.message || `Error: ${response.statusText}` });
            } else {
                setCreateAppointmentResult({ success: true, message: data.message });
                // Optionally clear the form or refetch appointments
                // handleFetchAppointments(); // Refresh list after creation
            }
        } catch (error) {
            console.error('Failed to create appointment:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setCreateAppointmentResult({ success: false, message: `Client-side error: ${errorMessage}` });
        } finally {
            setCreateAppointmentLoading(false);
        }
    };

    // --- Helper Functions ---
    const formatDateDisplay = (isoString: string | null | undefined): string => {
         if (!isoString) return 'N/A';
         try {
             // Use Intl.DateTimeFormat for locale-aware formatting
             return new Intl.DateTimeFormat(undefined, {
                 dateStyle: 'medium',
                 timeStyle: 'short',
             }).format(new Date(isoString));
         } catch {
             return 'Invalid Date';
         }
     };

    const getResultClasses = (result: { success: boolean; message: string } | null) => {
        if (!result) return '';
        return result.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    };

    // --- Render ---
    return (
        <main className="container mx-auto p-4 md:p-8 space-y-8">
            {/* Connection Card */}
            <Card>
                <CardHeader>
                    <CardTitle>NexHealth API Connection</CardTitle>
                    <CardDescription>Enter credentials to connect and interact with the API.</CardDescription>
                </CardHeader>

                <form onSubmit={handleTestConnection}>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="apiKey">API Key</Label>
                            <Input 
                                type="password" 
                                id="apiKey" 
                                value={credentials.apiKey} 
                                onChange={handleCredentialChange} 
                                required 
                                placeholder="Enter API Key" 
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="subdomain">Subdomain</Label>
                            <Input 
                                type="text" 
                                id="subdomain" 
                                value={credentials.subdomain} 
                                onChange={handleCredentialChange} 
                                required 
                                placeholder="e.g., your-practice" 
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="locationId">Location ID</Label>
                            <Input 
                                type="text" 
                                id="locationId" 
                                value={credentials.locationId} 
                                onChange={handleCredentialChange} 
                                required 
                                placeholder="Enter Location ID" 
                            />
                        </div>
                    </CardContent>

                    <CardFooter>
                        <Button 
                            type="submit" 
                            disabled={connectionLoading || !credentials.apiKey || !credentials.subdomain || !credentials.locationId} 
                            className="w-full"
                        >
                            {connectionLoading ? 'Testing...' : 'Test Connection'}
                        </Button>
                    </CardFooter>
                </form>

                {connectionResult && (
                    <div className="px-6 pb-6">
                        <Alert variant={connectionResult.success ? "default" : "destructive"}>
                            <AlertTitle className={getResultClasses(connectionResult)}>
                                {connectionResult.success ? 'Success' : 'Error'}
                            </AlertTitle>
                            <AlertDescription className={getResultClasses(connectionResult)}>
                                {connectionResult.message}
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
            </Card>

            {/* Appointments Section - Shown only if connected */}
            {isConnected && (
                <>
                    {/* Fetch Appointments Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Fetch Appointments</CardTitle>
                        </CardHeader>
                        
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="startDate">Start Date</Label>
                                    <Input 
                                        type="date" 
                                        id="startDate" 
                                        value={startDate} 
                                        onChange={(e) => setStartDate(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="endDate">End Date</Label>
                                    <Input 
                                        type="date" 
                                        id="endDate" 
                                        value={endDate} 
                                        onChange={(e) => setEndDate(e.target.value)} 
                                        required 
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-2">
                                <Button 
                                    onClick={handleFetchAppointments} 
                                    disabled={fetchAppointmentsLoading} 
                                    className="w-full"
                                >
                                    {fetchAppointmentsLoading ? 'Fetching...' : 'Fetch Appointments'}
                                </Button>
                            </div>
                        </CardContent>

                        {fetchAppointmentsError && (
                            <div className="px-6 pb-6">
                                <Alert variant="destructive">
                                    <AlertDescription>
                                        {fetchAppointmentsError}
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}

                        {fetchAppointmentsLoading && (
                            <div className="px-6 pb-6 space-y-2">
                                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                            </div>
                        )}

                        {!fetchAppointmentsLoading && appointments.length > 0 && (
                            <div className="px-6 pb-6 overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Patient</TableHead>
                                            <TableHead>Provider</TableHead>
                                            <TableHead>Start Time</TableHead>
                                            <TableHead>End Time</TableHead>
                                            <TableHead>Operatory</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {appointments.map((appt) => (
                                            <TableRow key={appt.id}>
                                                <TableCell>{appt.id}</TableCell>
                                                <TableCell>{appt.patient?.name ?? 'N/A'}</TableCell>
                                                <TableCell>{appt.provider_name ?? 'N/A'}</TableCell>
                                                <TableCell>{formatDateDisplay(appt.start_time)}</TableCell>
                                                <TableCell>{formatDateDisplay(appt.end_time)}</TableCell>
                                                <TableCell>{appt.operatory?.name ?? 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </Card>

                    {/* Create Appointment Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Create Appointment</CardTitle>
                        </CardHeader>

                        {!showCreateForm && (
                            <CardFooter>
                                <Button 
                                    onClick={handlePrepareCreateForm} 
                                    disabled={prepareFormLoading} 
                                    className="w-full"
                                >
                                    {prepareFormLoading ? 'Loading Form Data...' : 'Prepare Appointment Form'}
                                </Button>
                            </CardFooter>
                        )}
                        
                        {prepareFormError && (
                            <div className="px-6 pb-6">
                                <Alert variant="destructive">
                                    <AlertDescription>
                                        {prepareFormError}
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}

                        {showCreateForm && (
                            <form onSubmit={handleCreateAppointment}>
                                <CardContent className="space-y-4">
                                    {/* Patient Select */}
                                    <div className="space-y-1">
                                        <Label htmlFor="patientId">Patient</Label>
                                        <Select value={selectedPatientId} onValueChange={setSelectedPatientId} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Patient" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {patients.map(p => (
                                                    <SelectItem key={p.id} value={String(p.id)}>
                                                        {p.name} (ID: {p.id})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Provider Select */}
                                    <div className="space-y-1">
                                        <Label htmlFor="providerId">Provider</Label>
                                        <Select value={selectedProviderId} onValueChange={setSelectedProviderId} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Provider" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {providers.map(p => (
                                                    <SelectItem key={p.id} value={String(p.id)}>
                                                        {p.name} (ID: {p.id})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Operatory Select (Optional based on location config) */}
                                    <div className="space-y-1">
                                        <Label htmlFor="operatoryId">Operatory (Optional)</Label>
                                        <Select value={selectedOperatoryId} onValueChange={setSelectedOperatoryId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Operatory (if required)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="">None</SelectItem>
                                                {operatories.map(o => (
                                                    <SelectItem key={o.id} value={String(o.id)}>
                                                        {o.name} (ID: {o.id})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Appointment Type Select */}
                                    <div className="space-y-1">
                                        <Label htmlFor="appointmentTypeId">Appointment Type</Label>
                                        <Select value={selectedAppointmentTypeId} onValueChange={setSelectedAppointmentTypeId} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Appointment Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {appointmentTypes.map(t => (
                                                    <SelectItem key={t.id} value={String(t.id)}>
                                                        {t.name} (ID: {t.id})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Start Time Input */}
                                    <div className="space-y-1">
                                        <Label htmlFor="newAppointmentStartTime">Start Time</Label>
                                        <Input
                                            type="datetime-local"
                                            id="newAppointmentStartTime"
                                            value={newAppointmentStartTime}
                                            onChange={(e) => setNewAppointmentStartTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                </CardContent>

                                <CardFooter>
                                    <Button 
                                        type="submit" 
                                        disabled={createAppointmentLoading} 
                                        className="w-full"
                                    >
                                        {createAppointmentLoading ? 'Creating...' : 'Create Appointment'}
                                    </Button>
                                </CardFooter>
                            </form>
                        )}

                        {createAppointmentResult && (
                            <div className="px-6 pb-6">
                                <Alert variant={createAppointmentResult.success ? "default" : "destructive"}>
                                    <AlertTitle className={getResultClasses(createAppointmentResult)}>
                                        {createAppointmentResult.success ? 'Success' : 'Error'}
                                    </AlertTitle>
                                    <AlertDescription className={getResultClasses(createAppointmentResult)}>
                                        {createAppointmentResult.message}
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                    </Card>
                </>
            )}
        </main>
    );
} 