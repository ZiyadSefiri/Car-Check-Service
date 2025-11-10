"use client"

import { useEffect, useState } from "react"
import LoginForm from "@/components/login-form"
import RegisterForm from "@/components/register-form"
import Dashboard from "@/components/dashboard"
import BookingPage from "@/components/booking-page"
import AdminDashboard from "@/components/admin-dashboard"
import { getAuthToken, decodeToken } from "@/lib/auth"

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [currentView, setCurrentView] = useState<"dashboard" | "booking" | "admin">("dashboard")
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      setIsLoggedIn(true)
      const decoded = decodeToken(token)
      setIsAdmin(decoded?.is_admin === true)
    }
    setIsLoading(false)
  }, [])

  const handleLoginSuccess = () => {
    setIsLoggedIn(true)
    const token = getAuthToken()
    if (token) {
      const decoded = decodeToken(token)
      setIsAdmin(decoded?.is_admin === true)
    }
  }

  const handleRegisterSuccess = () => {
    setIsRegistering(false)
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem("auth_token")
    setIsLoggedIn(false)
    setIsRegistering(false)
    setCurrentView("dashboard")
    setIsAdmin(false)
  }

  const handleNavigateToBooking = () => {
    setCurrentView("booking")
  }

  const handleNavigateToAdmin = () => {
    setCurrentView("admin")
  }

  const handleBackToDashboard = () => {
    setCurrentView("dashboard")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    )
  }

  if (isLoggedIn) {
    if (currentView === "booking") {
      return <BookingPage onBack={handleBackToDashboard} onLogout={handleLogout} />
    }
    if (currentView === "admin" && isAdmin) {
      return <AdminDashboard onBack={handleBackToDashboard} onLogout={handleLogout} />
    }
    return (
      <Dashboard
        onLogout={handleLogout}
        onNavigateToBooking={handleNavigateToBooking}
        onNavigateToAdmin={isAdmin ? handleNavigateToAdmin : undefined}
        isAdmin={isAdmin}
      />
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-card p-4">
      {isRegistering ? (
        <RegisterForm onSuccess={handleRegisterSuccess} onSwitchToLogin={() => setIsRegistering(false)} />
      ) : (
        <LoginForm onSuccess={handleLoginSuccess} onSwitchToRegister={() => setIsRegistering(true)} />
      )}
    </div>
  )
}
