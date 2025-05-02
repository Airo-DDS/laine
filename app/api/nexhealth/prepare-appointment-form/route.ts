import { NextResponse } from 'next/server';

const NEXHEALTH_API_BASE_URL = 'https://nexhealth.info';
const NEXHEALTH_API_VERSION_HEADER = 'application/vnd.Nexhealth+json;version=2';

// Helper function for consistent headers
const getHeaders = (bearerToken: string) => ({
    'Accept': NEXHEALTH_API_VERSION_HEADER,
    'Authorization': `Bearer ${bearerToken}`,
});

// Helper to fetch data and handle basic errors
const fetchData = async (url: string, token: string, resourceName: string) => {
    try {
        const response = await fetch(url, { headers: getHeaders(token) });
        const data = await response.json();
        if (!response.ok) {
            console.error(`Failed to fetch ${resourceName}:`, response.status, data);
            // Return null or empty array on error to allow partial success
            return null;
        }
        // Adjust based on actual API response structure (e.g., data.data.patients)
        return data.data?.[resourceName.toLowerCase()] || data.data || [];
    } catch (error: unknown) {
        console.error(`Error fetching ${resourceName}:`, error);
        return null; // Return null on network or parsing error
    }
};

// Helper to format data for Select component
const formatForSelect = (items: Record<string, unknown>[] | null, idField = 'id', nameField = 'name') => {
    if (!Array.isArray(items)) return [];
    return items.map(item => ({
        id: item[idField],
        name: item[nameField] || `Unnamed (ID: ${item[idField]})` // Handle items without a name
    })).filter(item => item.id != null); // Ensure items have an ID
};


export async function POST(request: Request) {
    try {
        const { credentials, bearerToken } = await request.json();
        const { subdomain, locationId } = credentials;

        if (!bearerToken || !subdomain || !locationId) {
            return NextResponse.json({ success: false, message: 'Missing required fields.' }, { status: 400 });
        }

        const perPage = 200; // Fetch a decent number for dropdowns, adjust as needed

        // --- Fetch data in parallel ---
        const [
            patientsData,
            providersData,
            operatoriesData,
            appointmentTypesData
        ] = await Promise.all([
            fetchData(`${NEXHEALTH_API_BASE_URL}/patients?subdomain=${subdomain}&location_id=${locationId}&per_page=${perPage}&location_strict=true`, bearerToken, 'Patients'),
            fetchData(`${NEXHEALTH_API_BASE_URL}/providers?subdomain=${subdomain}&location_id=${locationId}&per_page=${perPage}&inactive=false`, bearerToken, 'Providers'), // Fetch only active providers
            fetchData(`${NEXHEALTH_API_BASE_URL}/operatories?subdomain=${subdomain}&location_id=${locationId}&per_page=${perPage}&active=true`, bearerToken, 'Operatories'), // Fetch only active operatories
            fetchData(`${NEXHEALTH_API_BASE_URL}/appointment_types?subdomain=${subdomain}&location_id=${locationId}&per_page=${perPage}`, bearerToken, 'Appointment_Types') // Fetch location-specific types if applicable
        ]);

        // Check if any fetch failed critically (optional, depends on requirements)
        // if (patientsData === null || providersData === null /* ... */) {
        //     return NextResponse.json({ success: false, message: 'Failed to fetch required form data.' }, { status: 500 });
        // }

        // Format data for the frontend dropdowns
        const responseData = {
             patients: formatForSelect(patientsData, 'id', 'name'), // Assuming 'name' field exists
             providers: formatForSelect(providersData, 'id', 'name'), // Assuming 'name' field exists
             operatories: formatForSelect(operatoriesData, 'id', 'name'), // Assuming 'name' field exists
             appointmentTypes: formatForSelect(appointmentTypesData, 'id', 'name') // Assuming 'name' field exists
        };

        return NextResponse.json(
            { success: true, ...responseData },
            { status: 200 }
        );

    } catch (error: unknown) {
        console.error('Error preparing appointment form data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ success: false, message: `Server error: ${errorMessage}` }, { status: 500 });
    }
} 