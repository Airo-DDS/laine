"use client"

import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function AICustomiserPage() {
  return (
    <div className="flex flex-col p-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <h1 className="text-2xl font-bold">AI Customiser</h1>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full rounded-md bg-background pl-8 md:w-[200px] lg:w-[300px]"
            />
          </div>
          <div className="flex h-9 w-9 items-center justify-center">
            <div className="relative">
              <div className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-500/25 animate-pulse" />
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
          </Button>
        </div>
      </div>
      <div className="mt-8">
        {/* AI Customiser content will be added here */}
      </div>
    </div>
  )
} 