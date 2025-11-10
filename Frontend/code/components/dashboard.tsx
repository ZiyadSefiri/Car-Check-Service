"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getAuthToken, decodeToken } from "@/lib/auth"
import { Copy, LogOut, Calendar, BarChart3 } from "lucide-react"

interface DashboardProps {
  onLogout: () => void
  onNavigateToBooking: () => void
  onNavigateToAdmin?: () => void
  isAdmin?: boolean
}

export default function Dashboard({ onLogout, onNavigateToBooking, onNavigateToAdmin, isAdmin }: DashboardProps) {
  const [token, setToken] = useState<string | null>(null)
  const [tokenData, setTokenData] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const authToken = getAuthToken()
    if (authToken) {
      setToken(authToken)
      const decoded = decodeToken(authToken)
      setTokenData(decoded)
    }
  }, [])

  const copyTokenToClipboard = () => {
    if (token) {
      navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-card p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome, {tokenData?.name || "User"}! {isAdmin && <span className="text-primary">(Admin)</span>}
            </p>
          </div>
          <Button onClick={onLogout} variant="outline" className="gap-2 bg-transparent">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        {/* Session Token Card */}
        <Card className="p-6 mb-6 shadow-lg">
          <h2 className="text-xl font-semibold text-foreground mb-4">Session Token</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Your authentication token for API requests and integrations:
          </p>

          <div className="bg-card border border-input rounded-lg p-4 mb-4">
            <code className="text-xs text-foreground break-all font-mono">
              {token ? `${token.substring(0, 50)}...` : "Loading..."}
            </code>
          </div>

          <Button onClick={copyTokenToClipboard} variant="secondary" className="gap-2 w-full">
            <Copy className="w-4 h-4" />
            {copied ? "Copied!" : "Copy Full Token"}
          </Button>
        </Card>

        {/* Token Info Card */}
        <Card className="p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-foreground mb-4">Token Information</h2>

          <div className="space-y-3">
            <div className="flex justify-between items-start border-b border-input pb-3">
              <span className="text-muted-foreground">User ID</span>
              <span className="text-foreground font-mono text-sm">{tokenData?.sub || "N/A"}</span>
            </div>
            <div className="flex justify-between items-start border-b border-input pb-3">
              <span className="text-muted-foreground">Name</span>
              <span className="text-foreground font-mono text-sm">{tokenData?.name || "N/A"}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Token Type</span>
              <span className="text-foreground font-mono text-sm">Bearer</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              💡 Use this token for API requests by adding it to the Authorization header:{" "}
              <code className="bg-card px-2 py-1 rounded">Authorization: Bearer {"<token>"}</code>
            </p>
          </div>
        </Card>

        {/* Admin Section Card */}
        {isAdmin && onNavigateToAdmin && (
          <Card className="p-6 mt-6 shadow-lg border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Admin Panel</h2>
                <p className="text-sm text-muted-foreground">View booking reports and analytics</p>
              </div>
              <BarChart3 className="w-6 h-6 text-blue-500 opacity-50" />
            </div>
            <Button onClick={onNavigateToAdmin} className="mt-4 w-full bg-blue-600 text-white hover:bg-blue-700">
              Go to Admin Dashboard
            </Button>
          </Card>
        )}

        {/* Integration Example */}
        <Card className="p-6 mt-6 shadow-lg">
          <h2 className="text-xl font-semibold text-foreground mb-4">Integration Example</h2>
          <pre className="bg-card p-4 rounded-lg text-xs text-foreground overflow-x-auto border border-input">
            {`fetch('https://api.example.com/data', {
  headers: {
    'Authorization': 'Bearer ' + sessionStorage.getItem('auth_token')
  }
})
.then(res => res.json())
.then(data => console.log(data))`}
          </pre>
        </Card>

        {/* Booking Card */}
        <Card className="p-6 mt-6 shadow-lg border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Book a Car</h2>
              <p className="text-sm text-muted-foreground">Reserve your next ride with our available vehicles</p>
            </div>
            <Calendar className="w-6 h-6 text-primary opacity-50" />
          </div>
          <Button
            onClick={onNavigateToBooking}
            className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Go to Booking
          </Button>
        </Card>
      </div>
    </div>
  )
}
