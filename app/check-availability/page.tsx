'use client';

import { useState, useEffect } from 'react';
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

interface Appointment {
  id: string;
  date: string;
  status: string;
  patient: {
    firstName: string;
    lastName: string;
  };
}

export default function CheckAvailability() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [rawData, setRawData] = useState<ApiResponse | null>(null);
  const [currentAppointments, setCurrentAppointments] = useState<Appointment[]>([]);

  // Fetch current appointments on component mount
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await axios.get('/api/appointments');
        console.log('Raw appointments data:', response.data);
        setCurrentAppointments(response.data);
      } catch (err) {
        console.error('Error fetching appointments:', err);
        if (axios.isAxiosError(err)) {
          console.log('Error details:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            headers: err.response?.headers
          });
        }
      }
    };
    fetchAppointments();
  }, []);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult('');
    setRawData(null);

    try {
      // Create payload for the API
      const payload = {
        startDate,
        endDate
      };

      // Make API call to the live URL
      const response = await axios.post(
        'https://claire-core.vercel.app/api/claire/check-availability',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          withCredentials: false,
          timeout: 10000,
          validateStatus: (status) => status < 500
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
          <h2 className="text-lg font-semibold mb-4">Enter Date Range</h2>
          
          <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-700">
            <p className="font-semibold">Appointment Constraints:</p>
            <ul className="list-disc list-inside mt-1 text-sm">
              <li>Business hours: 24/7 - ANY day, ANY time (for demo purposes)</li>
              <li>Appointments are scheduled in 30-minute slots</li>
              <li>All times are displayed in your local timezone</li>
            </ul>
          </div>
          
          <form onSubmit={handleCheck} className="space-y-4">
            <div>
              <label htmlFor="startDate" className="block mb-1">
                Start Date (ISO format)
              </label>
              <input
                id="startDate"
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="2025-04-02T03:30:00.000Z"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block mb-1">
                End Date (ISO format)
              </label>
              <input
                id="endDate"
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="2025-04-02T04:00:00.000Z"
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
            <p className="text-gray-500">Enter a date range to check availability</p>
          )}
          
          {loading && <p className="text-blue-500">Checking availability...</p>}
        </div>
      </div>
      
      {/* Raw Response Data */}
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

      {/* Current Appointments */}
      <div className="mt-8 bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Current Appointments</h2>
        {currentAppointments.length > 0 ? (
          <>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentAppointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(appointment.date).toLocaleString('en-US', {
                          timeZone: 'America/Chicago',
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        })}
                        <span className="text-xs text-gray-500 ml-2">(CT)</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {appointment.patient.firstName} {appointment.patient.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {appointment.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Raw Appointments Data */}
            <div className="mt-4">
              <h3 className="text-md font-semibold mb-2">Raw Appointments Data</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-sm">
                {JSON.stringify(currentAppointments, null, 2)}
              </pre>
            </div>
          </>
        ) : (
          <div>
            <p className="text-gray-500 mb-4">No appointments found</p>
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
              <p>Debug Information:</p>
              <ul className="list-disc list-inside mt-2">
                <li>API Endpoint: https://claire-core.vercel.app/api/appointments</li>
                <li>Response Status: {currentAppointments ? '200' : 'No response'}</li>
                <li>Data Type: {Array.isArray(currentAppointments) ? 'Array' : typeof currentAppointments}</li>
                <li>Data Length: {Array.isArray(currentAppointments) ? currentAppointments.length : 'N/A'}</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 