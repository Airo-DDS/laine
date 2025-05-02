import { NextResponse } from 'next/server';

const NEXHEALTH_API_BASE_URL = 'https://nexhealth.info'; // Use test environment
const NEXHEALTH_API_VERSION_HEADER = 'application/vnd.Nexhealth+json;version=2';

export async function POST(request: Request) {
  try {
    const { apiKey, subdomain, locationId } = await request.json();

    // Basic validation
    if (!apiKey || !subdomain || !locationId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: apiKey, subdomain, or locationId.' },
        { status: 400 }
      );
    }

    // --- Step 1: Authenticate to get Bearer Token ---
    let bearerToken = '';
    try {
      const authResponse = await fetch(`${NEXHEALTH_API_BASE_URL}/authenticates`, {
        method: 'POST',
        headers: {
          'Accept': NEXHEALTH_API_VERSION_HEADER,
          'Authorization': apiKey, // Use API Key directly for this specific call
        },
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json().catch(() => ({})); // Try to parse error
        console.error('NexHealth Authentication Failed:', authResponse.status, errorData);
        return NextResponse.json(
          { success: false, message: `Authentication failed: ${errorData.description || authResponse.statusText}` },
          { status: authResponse.status }
        );
      }

      const authData = await authResponse.json();
      if (!authData.data?.token) {
         console.error('NexHealth Authentication Error: Token not found in response');
         return NextResponse.json(
           { success: false, message: 'Authentication succeeded but no token was returned.' },
           { status: 500 }
         );
      }
      bearerToken = authData.data.token;

    } catch (error: unknown) {
      console.error('Error during NexHealth authentication request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return NextResponse.json(
        { success: false, message: `Authentication request error: ${errorMessage}` },
        { status: 500 }
      );
    }

    // --- Step 2: Make a Test API Call (e.g., fetch location details) ---
    try {
      const testUrl = `${NEXHEALTH_API_BASE_URL}/locations/${locationId}?subdomain=${subdomain}`;
      // Alternative test: fetch 1 appointment:
      // const testUrl = `${NEXHEALTH_API_BASE_URL}/appointments?subdomain=${subdomain}&location_id=${locationId}&per_page=1`;

      const testResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': NEXHEALTH_API_VERSION_HEADER,
          'Authorization': `Bearer ${bearerToken}`, // Use Bearer Token now
        },
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.json().catch(() => ({}));
        console.error('NexHealth Test API Call Failed:', testResponse.status, errorData);
        return NextResponse.json(
          { success: false, message: `Test API call failed: ${errorData.description || testResponse.statusText} (Status: ${testResponse.status})` },
          { status: testResponse.status }
        );
      }

      // Optional: Parse response to provide more context
      const testData = await testResponse.json();
      let successMessage = 'Connection successful! Authenticated and able to fetch data.';
      if (testData?.data?.location?.name) {
         successMessage = `Connection successful! Authenticated and fetched details for location: ${testData.data.location.name}.`;
      } else if (testData?.data?.appointments?.length !== undefined) {
         successMessage = `Connection successful! Authenticated and fetched ${testData.data.appointments.length} appointment(s) (limit 1).`;
      }

      // *** Return the token on success ***
      return NextResponse.json(
        { success: true, message: successMessage, bearerToken: bearerToken },
        { status: 200 }
      );

    } catch (error: unknown) {
      console.error('Error during NexHealth test API call:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return NextResponse.json(
        { success: true, message: `Authentication successful, but test API call failed: ${errorMessage}`, bearerToken: bearerToken },
        { status: 200 } // Status 200 because auth worked
      );
    }

  } catch (error: unknown) {
    // Catch errors from request parsing or other unexpected issues
    console.error('Error in test-connection handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, message: `Server error: ${errorMessage}` },
      { status: 500 }
    );
  }
} 