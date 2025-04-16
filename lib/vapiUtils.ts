import { randomUUID } from 'node:crypto';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai';

function logUtil(scope: string, message: string, data?: unknown) {
    console.log(`[${new Date().toISOString()}] [${scope}] ${message}`);
    if (data !== undefined) {
        console.log(JSON.stringify(data, null, 2));
    }
}

// --- Vapi API Call Helper (Modified for FormData) ---
// This helper now needs to handle both JSON and FormData
async function vapiFetchUtil(endpoint: string, options: RequestInit & { body?: BodyInit | null | FormData } = {}): Promise<unknown> {
    if (!VAPI_API_KEY) {
        throw new Error("VAPI_API_KEY environment variable is not set.");
    }
    const url = `${VAPI_BASE_URL}${endpoint}`;
    const isFormData = options.body instanceof FormData;

    logUtil('vapiFetchUtil', `Calling Vapi: ${options.method || 'GET'} ${url}`, isFormData ? '(FormData body)' : (options.body ? '(JSON body)' : ''));

    const headers: HeadersInit = {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        // DO NOT set Content-Type for FormData, let fetch do it
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
    };

    const response = await fetch(url, {
        ...options,
        headers: headers,
    });

    let responseData: unknown;
    try {
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            responseData = null;
        } else {
            // Assume JSON unless proven otherwise, handle potential errors
             const contentType = response.headers.get("content-type");
             if (contentType?.includes("application/json")) {
                 responseData = await response.json();
             } else {
                 // If not JSON, read as text for debugging, especially for errors
                 const textResponse = await response.text();
                 if (!response.ok) {
                     throw new Error(`Vapi request failed with status ${response.status}. Response: ${textResponse}`);
                 }
                 logUtil('vapiFetchUtil', `Vapi call ${options.method || 'GET'} ${url} succeeded (${response.status}) but response was not JSON. Body: ${textResponse}`);
                 responseData = textResponse; // Or null if text isn't useful
             }
        }
    } catch (e) {
        if (response.ok && !(e instanceof SyntaxError)) { // Don't throw if OK status but non-JSON body was expected/handled
             logUtil('vapiFetchUtil', `Vapi call ${options.method || 'GET'} ${url} succeeded (${response.status}) but response parsing failed or was not JSON.`);
             responseData = null;
        } else {
             logUtil('vapiFetchUtil', `Vapi call ${options.method || 'GET'} ${url} failed (${response.status}) and/or response parsing failed.`);
             const errorMsg = e instanceof Error ? e.message : 'Unknown parsing error';
             throw new Error(`Vapi request failed with status ${response.status}. Error: ${errorMsg}`);
        }
    }

    if (!response.ok) {
        logUtil('vapiFetchUtil', `Vapi Error: ${response.status} ${response.statusText}`, responseData);
        let errorMessage = `Request failed with status ${response.status}`;
        if (responseData && typeof responseData === 'object') {
             if ('message' in responseData && responseData.message) errorMessage = String(responseData.message);
             else if ('error' in responseData && responseData.error) errorMessage = String(responseData.error);
        } else if (typeof responseData === 'string') {
            errorMessage = responseData; // Use text response if available for non-JSON errors
        }
        throw new Error(`Vapi API Error: ${errorMessage}`);
    }

    logUtil('vapiFetchUtil', `Vapi Success: ${options.method || 'GET'} ${url} (${response.status})`, responseData);
    return responseData;
}


// --- File Upload Utility ---
export async function uploadFileToVapi(content: string, filename: string): Promise<string> {
    logUtil('uploadFileToVapi', `Preparing to upload file: ${filename}`);
    const blob = new Blob([content], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', blob, filename); // Vapi expects the field name 'file'

    const fileData = await vapiFetchUtil('/file', {
        method: 'POST',
        body: formData, // Pass FormData directly
        // No Content-Type header here!
    });

    const vapiFileId = (fileData && typeof fileData === 'object' && 'id' in fileData && typeof fileData.id === 'string') ? fileData.id : null;
    if (!vapiFileId) {
        throw new Error('Vapi did not return a valid file ID after upload.');
    }
    logUtil('uploadFileToVapi', `File uploaded successfully: ${vapiFileId}`);
    return vapiFileId;
}

// --- Generate Vapi Names Utility ---
export function generateVapiNamesUtil(topicName: string) {
    const safeName = topicName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_{2,}/g, '_').substring(0, 30); // Limit base name length
    const uniqueSuffix = randomUUID().substring(0, 8);
    const base = `${safeName}_${uniqueSuffix}`;
    return {
        vapiFileName: `kb_${base}.txt`,
        vapiToolName: `query_${base}`, // Max 64 chars for function name
        vapiKbName: `kb_${base}`,
        vapiDescription: `Knowledge about: ${topicName.trim()}`,
    };
}

// --- Export vapiFetch for other routes if needed ---
export const vapiFetch = vapiFetchUtil; 