'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';

// Define interfaces for the API response
interface ApiResult {
  tool_call_id?: string;
  toolCallId?: string;
  status?: string;
  message?: string;
  result?: string;
  error?: string;
}

interface ApiResponse {
  results?: ApiResult[];
  tool_call_id?: string;
  status?: string;
  message?: string;
  error?: string;
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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [rawData, setRawData] = useState<ApiResponse | null>(null);
  const [currentAppointments, setCurrentAppointments] = useState<Appointment[]>([]);

  // Available time slots (30-minute intervals)
  const timeSlots = [
    '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30', 
    '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', 
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', 
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', 
    '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
  ];

  // Fetch current appointments on component mount
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await axios.get('/api/appointments');
        console.log('Raw appointments data:', response.data);
        setCurrentAppointments(response.data);
      } catch (err) {
        console.error('Error fetching appointments:', err);
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
      // Combine date and time into ISO format
      const startDate = new Date(`${date}T${time}`).toISOString();
      
      // Create payload for the API
      const payload = {
        tool_call_id: "check-from-ui",
        parameters: {
          startDate
        }
      };

      console.log('Sending payload:', payload);

      // Make API call to the local endpoint for faster development testing
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api/laine/check-availability'
        : 'https://laine-core.vercel.app/api/laine/check-availability';
        
      const response = await axios.post(
        apiUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 10000
        }
      );

      // Handle response
      console.log('API response:', response.data);
      setRawData(response.data);
      
      if (response.status === 200) {
        if (response.data.message) {
          // New API format
          setResult(response.data.message);
        } else if (response.data.results?.[0]?.result) {
          // Old API format
          setResult(response.data.results[0].result);
        } else if (response.data.error || response.data.results?.[0]?.error) {
          // Error format
          setError(response.data.error || response.data.results?.[0]?.error || 'Unknown error');
        } else {
          setError("No clear result found in the response");
        }
      } else {
        setError(`Unexpected response status: ${response.status}`);
      }
    } catch (err) {
      console.error('Error checking availability:', err);
      if (axios.isAxiosError(err)) {
        const errorMessage = err.response?.data?.message || 
                           err.response?.data?.error || 
                           err.message;
        setError(`Failed to check availability: ${errorMessage}`);
        setRawData(err.response?.data || null);
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
          <h2 className="text-lg font-semibold mb-4">Enter Date and Time</h2>
          
          <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-700">
            <p className="font-semibold">Appointment Information:</p>
            <ul className="list-disc list-inside mt-1 text-sm">
              <li>Hours: 24/7 - ANY day, ANY time (for demo purposes)</li>
              <li>Appointments are scheduled in 30-minute slots</li>
              <li>All times are displayed in your local timezone</li>
            </ul>
          </div>
          
          <form onSubmit={handleCheck} className="space-y-4">
            <div>
              <label htmlFor="date" className="block mb-1">Date</label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label htmlFor="time" className="block mb-1">Time</label>
              <select
                id="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-2 border rounded"
                required
              >
                {timeSlots.map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
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
          
          <div className="mt-4">
            <p className="text-xs text-gray-500">
              Selected date and time in ISO format: 
              {date && time ? new Date(`${date}T${time}`).toISOString() : 'None selected'}
            </p>
          </div>
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
            <p className="text-gray-500">Select a date and time to check availability</p>
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
                        {new Date(appointment.date).toLocaleString()}
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
            <a 
              href="/calendar"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go to Calendar to Add Appointments
            </a>
          </div>
        )}
      </div>
      
      <div className="mt-8 flex justify-between">
        <Link 
          href="/"
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Dashboard
        </Link>
        <a 
          href="/calendar"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Manage Appointments
        </a>
      </div>
    </div>
  );
} 