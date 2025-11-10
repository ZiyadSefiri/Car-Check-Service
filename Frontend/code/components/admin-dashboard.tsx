"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAuthHeader } from "@/lib/auth"
import { ArrowLeft, LogOut, Calendar, Users, Car, TrendingUp } from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface AdminDashboardProps {
  onBack: () => void
  onLogout: () => void
}

interface BookingSummary {
  total_bookings: number
  total_users: number
  total_cars: number
  bookings_today: number
  bookings_this_week: number
  bookings_this_month: number
}

interface DashboardSummary {
  total_bookings: number
  active_users: number
  total_cars: number
  today_bookings: number
  upcoming_bookings: number
  popular_car: string | null
  busiest_time: string | null
}

interface CarUtilization {
  car_id: number
  model: string
  license_plate: string
  total_bookings: number
  utilization_percentage: number
}

interface UserActivity {
  user_id: number
  email: string
  total_bookings: number
  last_booking_date: string | null
}

interface PopularSlot {
  time_slot: string
  booking_count: number
}

interface DailyRevenue {
  date: string
  total_bookings: number
  revenue: number
}

export default function AdminDashboard({ onBack, onLogout }: AdminDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<"overview" | "cars" | "users" | "revenue">("overview")

  // Dashboard data
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null)
  const [bookingSummary, setBookingSummary] = useState<BookingSummary | null>(null)
  const [carUtilization, setCarUtilization] = useState<CarUtilization[]>([])
  const [userActivity, setUserActivity] = useState<UserActivity[]>([])
  const [popularSlots, setPopularSlots] = useState<PopularSlot[]>([])
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([])

  // Date range filter
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    setError("")

    try {
      const headers = getAuthHeader()

      // Fetch dashboard summary
      const dashRes = await fetch("http://localhost:8180/reports/dashboard", {
        headers,
      })
      if (dashRes.ok) {
        setDashboardSummary(await dashRes.json())
      }

      // Fetch booking summary
      const bookRes = await fetch("http://localhost:8180/reports/bookings/summary", {
        headers,
      })
      if (bookRes.ok) {
        setBookingSummary(await bookRes.json())
      }

      // Fetch car utilization
      const carsRes = await fetch("http://localhost:8180/reports/cars/utilization?days=30", {
        headers,
      })
      if (carsRes.ok) {
        setCarUtilization(await carsRes.json())
      }

      // Fetch user activity
      const usersRes = await fetch("http://localhost:8180/reports/users/activity?limit=10", {
        headers,
      })
      if (usersRes.ok) {
        setUserActivity(await usersRes.json())
      }

      // Fetch popular slots
      const slotsRes = await fetch("http://localhost:8180/reports/popular-slots?days=30", {
        headers,
      })
      if (slotsRes.ok) {
        setPopularSlots(await slotsRes.json())
      }

      // Fetch daily revenue
      const revenueRes = await fetch("http://localhost:8180/reports/revenue/daily?days=7&price_per_booking=50.0", {
        headers,
      })
      if (revenueRes.ok) {
        setDailyRevenue(await revenueRes.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const handleDateRangeSearch = async () => {
    if (!startDate || !endDate) {
      setError("Please select both start and end dates")
      return
    }

    try {
      const headers = getAuthHeader()
      const response = await fetch(
        `http://localhost:8180/reports/bookings/by-date?start_date=${startDate}&end_date=${endDate}`,
        { headers },
      )

      if (response.ok) {
        console.log("[v0] Bookings data fetched:", await response.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch bookings")
    }
  }

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-foreground">Loading admin dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Booking Analytics & Reports</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onBack} variant="outline" className="gap-2 bg-transparent">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button onClick={onLogout} variant="outline" className="gap-2 bg-transparent">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>

        {error && (
          <Card className="p-4 mb-6 bg-destructive/10 border-destructive/20">
            <p className="text-destructive text-sm">{error}</p>
          </Card>
        )}

        {/* Summary Cards */}
        {dashboardSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Bookings</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{dashboardSummary.total_bookings}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </Card>

            <Card className="p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Active Users</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{dashboardSummary.active_users}</p>
                </div>
                <Users className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </Card>

            <Card className="p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Cars</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{dashboardSummary.total_cars}</p>
                </div>
                <Car className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </Card>

            <Card className="p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Today's Bookings</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{dashboardSummary.today_bookings}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-500 opacity-50" />
              </div>
            </Card>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {dashboardSummary?.upcoming_bookings !== undefined && (
            <Card className="p-4 shadow-lg">
              <p className="text-muted-foreground text-sm">Upcoming Bookings</p>
              <p className="text-2xl font-bold text-foreground mt-2">{dashboardSummary.upcoming_bookings}</p>
            </Card>
          )}
          {dashboardSummary?.popular_car && (
            <Card className="p-4 shadow-lg">
              <p className="text-muted-foreground text-sm">Popular Car</p>
              <p className="text-lg font-bold text-foreground mt-2 truncate">{dashboardSummary.popular_car}</p>
            </Card>
          )}
          {dashboardSummary?.busiest_time && (
            <Card className="p-4 shadow-lg">
              <p className="text-muted-foreground text-sm">Busiest Time</p>
              <p className="text-2xl font-bold text-foreground mt-2">{dashboardSummary.busiest_time}</p>
            </Card>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-input">
          {(["overview", "cars", "users", "revenue"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition-colors capitalize ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Popular Time Slots Chart */}
            {popularSlots.length > 0 && (
              <Card className="p-6 shadow-lg">
                <h2 className="text-lg font-semibold text-foreground mb-4">Popular Time Slots</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={popularSlots}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time_slot" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#f3f4f6" }}
                    />
                    <Bar dataKey="booking_count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Booking Summary */}
            {bookingSummary && (
              <Card className="p-6 shadow-lg">
                <h2 className="text-lg font-semibold text-foreground mb-4">Booking Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-muted-foreground text-sm">Total Users</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{bookingSummary.total_users}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">This Week</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{bookingSummary.bookings_this_week}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">This Month</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{bookingSummary.bookings_this_month}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === "cars" && (
          <Card className="p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground mb-4">Car Utilization</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Model</th>
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">License Plate</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Bookings</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {carUtilization.map((car) => (
                    <tr key={car.car_id} className="border-b border-input/50 hover:bg-card/50 transition-colors">
                      <td className="py-3 px-4 text-foreground">{car.model}</td>
                      <td className="py-3 px-4 text-foreground font-mono">{car.license_plate}</td>
                      <td className="py-3 px-4 text-right text-foreground">{car.total_bookings}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 bg-input rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-green-500 h-full"
                              style={{ width: `${Math.min(car.utilization_percentage, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-muted-foreground text-xs w-10">{car.utilization_percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === "users" && (
          <Card className="p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground mb-4">Top Users</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Email</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Bookings</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Last Booking</th>
                  </tr>
                </thead>
                <tbody>
                  {userActivity.map((user) => (
                    <tr key={user.user_id} className="border-b border-input/50 hover:bg-card/50 transition-colors">
                      <td className="py-3 px-4 text-foreground text-xs">{user.email}</td>
                      <td className="py-3 px-4 text-right text-foreground">{user.total_bookings}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground text-xs">
                        {user.last_booking_date || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === "revenue" && (
          <div className="space-y-6">
            {/* Daily Revenue Chart */}
            {dailyRevenue.length > 0 && (
              <Card className="p-6 shadow-lg">
                <h2 className="text-lg font-semibold text-foreground mb-4">Daily Revenue (Last 7 Days)</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#f3f4f6" }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: "#10b981", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Revenue Summary */}
            {dailyRevenue.length > 0 && (
              <Card className="p-6 shadow-lg">
                <h2 className="text-lg font-semibold text-foreground mb-4">Revenue Summary</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-sm">Total Revenue (7 days)</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      ${dailyRevenue.reduce((sum, d) => sum + d.revenue, 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Total Bookings (7 days)</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {dailyRevenue.reduce((sum, d) => sum + d.total_bookings, 0)}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Date Range Search */}
            <Card className="p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-foreground mb-4">Search by Date Range</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-2 bg-card text-foreground border-input"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-2 bg-card text-foreground border-input"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleDateRangeSearch}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Search
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
