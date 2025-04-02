"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string | null;
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load patients
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/patients');
        
        if (!res.ok) {
          throw new Error('Failed to fetch patients');
        }
        
        const data = await res.json();
        setPatients(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPatients();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-8">Loading patients...</div>;
  }
  
  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Patients</h1>
        <Link 
          href="/calendar" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to Calendar
        </Link>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 border-b text-left">Name</th>
              <th className="py-2 px-4 border-b text-left">Email</th>
              <th className="py-2 px-4 border-b text-left">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {patients.length > 0 ? (
              patients.map(patient => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4">{patient.firstName} {patient.lastName}</td>
                  <td className="py-2 px-4">{patient.email || 'N/A'}</td>
                  <td className="py-2 px-4">{patient.phoneNumber || 'N/A'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="py-4 text-center text-gray-500">
                  No patients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 