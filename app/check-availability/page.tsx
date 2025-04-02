'use client';

import { useState } from 'react';
import { parse } from 'date-fns';
import axios from 'axios';

// Define interfaces for the API response
interface ApiResult {
  toolCallId: string;
  result?: string;
  error?: string;
}

interface ApiResponse {
  results: ApiResult[];
}

export default function CheckAvailability() {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [rawData, setRawData] = useState<ApiResponse | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult('');
    setRawData(null);

    try {
      // Try to parse the input text as a date
      let startDate: Date;
      let endDate: Date;

      try {
        // Try to parse inputs like "April.3 1:30pm"
        startDate = parse(inputText, 'MMMM d h:mma', new Date());
        
        // Set end date 30 minutes later
        endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + 30);
      } catch {
        setError('Could not parse the date. Please use a format like "April 3 1:30pm"');
        setLoading(false);
        return;
      }

      // Format dates for API call
      const formattedStartDate = startDate.toISOString();
      const formattedEndDate = endDate.toISOString();

      // Create payload for the API
      const payload = {
        startDate: formattedStartDate,
        endDate: formattedEndDate
      };

      // Make API call
      const response = await axios.post(
        'https://claire-core.vercel.app/api/claire/check-availability',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          withCredentials: false,
          timeout: 10000, // 10 second timeout
          validateStatus: (status) => status < 500 // Don't reject on 4xx status codes
        }
      );

      // Handle response
      setRawData(response.data);
      
      if (response.status === 200 && response.data?.results?.[0]?.result) {
        setResult(response.data.results[0].result);
      } else if (response.data?.results?.[0]?.error) {
        setError(response.data.results[0].error);
      } else {
        setError("No clear result found in the response");
      }
    } catch (err) {
      console.error('Error checking availability:', err);
      if (axios.isAxiosError(err)) {
        const errorMessage = err.response?.data?.message || 
                           err.response?.data?.error || 
                           err.message;
        setError(`Failed to check availability: ${errorMessage}`);
        setRawData(err.response?.data || null);
        console.log('Error details:', {
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          headers: err.response?.headers
        });
      } else {
        setError('Failed to check availability. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Check Appointment Availability</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column - Input */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Enter Date & Time</h2>
          <form onSubmit={handleCheck} className="space-y-4">
            <div>
              <label htmlFor="dateTime" className="block mb-1">
                Date and Time (e.g., &ldquo;April 3 1:30pm&rdquo;)
              </label>
              <input
                id="dateTime"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="April 3 1:30pm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full p-2 rounded ${
                loading
                  ? 'bg-gray-400'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {loading ? 'Checking...' : 'Check Availability'}
            </button>
          </form>
        </div>
        
        {/* Right column - Results */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Availability Results</h2>
          
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              <p>{error}</p>
            </div>
          )}
          
          {result && (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4">
              <p>{result}</p>
            </div>
          )}
          
          {!error && !result && !loading && (
            <p className="text-gray-500">Enter a date and time to check availability</p>
          )}
          
          {loading && <p className="text-blue-500">Checking availability...</p>}
        </div>
      </div>
      
      {/* Raw appointment data */}
      <div className="mt-8 bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Raw Response Data</h2>
        {rawData ? (
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-sm">
            {JSON.stringify(rawData, null, 2)}
          </pre>
        ) : (
          <p className="text-gray-500">No data available</p>
        )}
      </div>
    </div>
  );
} 