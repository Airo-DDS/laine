import { NextResponse } from 'next/server';

const NEXHEALTH_API_BASE_URL = 'https://nexhealth.info';
const NEXHEALTH_API_VERSION_HEADER = 'application/vnd.Nexhealth+json;version=2';

// Helper function for consistent headers
const getHeaders = (bearerToken: string, includeContentType = false) => {
    const headers: Record<string, string> = {
        'Accept': NEXHEALTH_API_VERSION_HEADER,
        'Authorization': `Bearer ${bearerToken}`,
    };
    if (includeContentType) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
};


export async function POST(request: Request) {
    try {
        const { credentials, bearerToken, action, params } = await request.json();
        const { subdomain, locationId } = credentials;

        // Basic validation
        if (!bearerToken || !subdomain || !locationId || !action || !params) {
            return NextResponse.json({ success: false, message: 'Missing required fields in request.' }, { status: 400 });
        }

        // --- Action: Fetch Appointments ---
        if (action === 'fetch') {
            const { startDate, endDate } = params;
            if (!startDate || !endDate) {
                 return NextResponse.json({ success: false, message: 'Missing start or end date for fetching.' }, { status: 400 });
            }

            // Construct URL with required params
            const url = new URL(`${NEXHEALTH_API_BASE_URL}/appointments`);
            url.searchParams.append('subdomain', subdomain);
            url.searchParams.append('location_id', locationId);
            url.searchParams.append('start', `${startDate}T00:00:00Z`); // Assume start of day UTC
            url.searchParams.append('end', `${endDate}T23:59:59Z`);     // Assume end of day UTC
            url.searchParams.append('per_page', '100'); // Limit results per page
            // Include related data for better display
            url.searchParams.append('include[]', 'patient');
            url.searchParams.append('include[]', 'operatory');
            // provider_name is included by default, no need for include[]=provider

            try {
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: getHeaders(bearerToken),
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error('NexHealth Fetch Appointments Failed:', response.status, data);
                    return NextResponse.json(
                        { success: false, message: `Failed to fetch appointments: ${data.description || response.statusText}` },
                        { status: response.status }
                    );
                }

                // The actual appointments are nested under data.data (or similar based on API spec)
                // Adjust based on the actual structure seen in testing
                const appointments = data.data?.appointments || data.data || [];


                return NextResponse.json(
                    { success: true, appointments: appointments },
                    { status: 200 }
                );

            } catch (error: unknown) {
                console.error('Error fetching NexHealth appointments:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                return NextResponse.json({ success: false, message: `Server error fetching appointments: ${errorMessage}` }, { status: 500 });
            }
        }

        // --- Action: Create Appointment ---
        else if (action === 'create') {
            const { patientId, providerId, operatoryId, appointmentTypeId, startTime } = params;

             if (!patientId || !providerId || !appointmentTypeId || !startTime) {
                 return NextResponse.json({ success: false, message: 'Missing required appointment details.' }, { status: 400 });
             }

            // Create URL with query parameters
            const appointmentsUrl = new URL(`${NEXHEALTH_API_BASE_URL}/appointments`);
            appointmentsUrl.searchParams.append('subdomain', subdomain);
            appointmentsUrl.searchParams.append('location_id', locationId);
            appointmentsUrl.searchParams.append('notify_patient', 'false'); // Don't notify for tests

            const requestBody = {
                appt: {
                    patient_id: patientId,
                    provider_id: providerId,
                    operatory_id: operatoryId, // Include if provided, API might handle null/undefined if optional
                    start_time: startTime, // Expecting ISO 8601 format string
                    appointment_type_id: appointmentTypeId,
                    // end_time is often derived from appointment_type minutes, but check if API requires it
                }
            };

            try {
                const response = await fetch(appointmentsUrl.toString(), {
                    method: 'POST',
                    headers: getHeaders(bearerToken, true), // Include Content-Type
                    body: JSON.stringify(requestBody),
                });

                const data = await response.json();

                // NexHealth often returns 201 Created or 202 Accepted for async operations
                if (response.status !== 201 && response.status !== 200 && response.status !== 202) {
                     console.error('NexHealth Create Appointment Failed:', response.status, data);
                     return NextResponse.json(
                         { success: false, message: `Failed to create appointment: ${data.description || response.statusText} (Status: ${response.status})` },
                         { status: response.status }
                     );
                }

                // Appointment creation is async, success means it was accepted
                const createdAppointmentId = data.data?.appt?.id;
                const successMessage = createdAppointmentId
                    ? `Appointment creation request accepted (ID: ${createdAppointmentId}). It may take time to sync.`
                    : 'Appointment creation request accepted. It may take time to sync.';


                return NextResponse.json(
                    { success: true, message: successMessage, appointmentId: createdAppointmentId },
                    { status: response.status } // Return the actual success status (200, 201, 202)
                );

            } catch (error: unknown) {
                 console.error('Error creating NexHealth appointment:', error);
                 const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                 return NextResponse.json({ success: false, message: `Server error creating appointment: ${errorMessage}` }, { status: 500 });
            }
        }

        // --- Invalid Action ---
        else {
            return NextResponse.json({ success: false, message: 'Invalid action specified.' }, { status: 400 });
        }

    } catch (error: unknown) {
        console.error('Error in appointments handler:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ success: false, message: `Server error: ${errorMessage}` }, { status: 500 });
    }
} 