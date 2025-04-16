"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setError(null); // Reset error on new fetch
        setLoading(true);
        const res = await fetch('/api/patients');

        if (!res.ok) {
            const errorData = await res.text(); // Get more error details
            throw new Error(`Failed to fetch patients: ${res.status} ${res.statusText} - ${errorData}`);
        }

        const data = await res.json();
        setPatients(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error("Error fetching patients:", err); // Log error
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-1/4" />
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" /> {/* Header row skeleton */}
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
     return (
        <div className="container mx-auto p-4 md:p-6">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Patients</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="mt-4">
               <Link href="/calendar">
                   <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Calendar</Button>
               </Link>
            </div>
        </div>
     );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Patients</h1>
        <Link href="/calendar">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Calendar</Button>
        </Link>
      </div>

       <Card>
         <CardHeader>
            <CardTitle>Patient List</CardTitle>
         </CardHeader>
         <CardContent>
            <Table>
              {/* Optional: Add TableCaption if needed */}
              {/* <TableCaption>A list of registered patients.</TableCaption> */}
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Phone Number</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.length > 0 ? (
                  patients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">{patient.firstName} {patient.lastName}</TableCell>
                      <TableCell>{patient.email || <span className='text-muted-foreground'>N/A</span>}</TableCell>
                      <TableCell className="text-right">{patient.phoneNumber || <span className='text-muted-foreground'>N/A</span>}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No patients found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
         </CardContent>
       </Card>
    </div>
  );
} 