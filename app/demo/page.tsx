// app/demo/page.tsx
"use client";

import type { FC } from 'react';
import { Suspense } from 'react';
import { Placeholder } from '../../components/Placeholder';

const DemoPage: FC = () => {
  return (
    <main className="min-h-screen items-center justify-center p-4 md:p-10 lg:p-16">
      <Suspense fallback={<div>Loading...</div>}>
        <div className="mx-auto flex max-w-screen-2xl flex-col items-center">
          <h1 className="mb-8 text-4xl font-bold tracking-tight">Meet Laine Demo</h1>
          <div className="mb-4 w-full rounded-md bg-slate-50 p-4">
            <Placeholder className="h-[600px] w-full">Laine Demo</Placeholder>
          </div>
        </div>
      </Suspense>
    </main>
  );
};

export default DemoPage;