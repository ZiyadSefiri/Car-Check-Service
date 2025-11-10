"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getAuthHeader } from "@/lib/auth"
import { ArrowLeft, LogOut } from "lucide-react"

interface Car {
  car_id: number
  model: string
  license_plate: string
}

interface AvailableSlot {
  start_time: string
  end_time: string
}

interface BookingPageProps {
  onBack: () => void
  onLogout: () => void
}

export default function BookingPage({ onBack, onLogout }: BookingPageProps) {
  const [cars, setCars] = useState<Car[]>([])
  const [selectedCar, setSelectedCar] = useState<Car | null>(null)
  const [selectedDate, setSelectedDate] = useState("")
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Fetch cars on mount
  useEffect(() => {
    const fetchCars = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("http://localhost:8000/cars")
        if (!response.ok) throw new Error("Failed to fetch cars")
        const data = await response.json()
        setCars(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cars")
      } finally {
        setIsLoading(false)
      }
    }

    fetchCars()
  }, [])

  // Fetch available slots when car and date change
  useEffect(() => {
    if (!selectedCar || !selectedDate) {
      setAvailableSlots([])
      return
    }

    const fetchSlots = async () => {
      setIsLoadingSlots(true)
      setError("")
      try {
        const response = await fetch(`http://localhost:8000/availability/${selectedCar.car_id}?day=${selectedDate}`)
        if (!response.ok) throw new Error("Failed to fetch availability")
        const data = await response.json()
        setAvailableSlots(data)
        setSelectedSlot(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load availability")
        setAvailableSlots([])
      } finally {
        setIsLoadingSlots(false)
      }
    }

    fetchSlots()
  }, [selectedCar, selectedDate])

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCar || !selectedDate || !selectedSlot) {
      setError("Please select a car, date, and time slot")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("http://localhost:8000/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          start_time: selectedSlot.start_time,
          day: selectedDate,
          car_model: selectedCar.model,
          car_license_plate: selectedCar.license_plate,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Booking failed")
      }

      setSuccess("Booking confirmed! Check your email for details.")
      setSelectedCar(null)
      setSelectedDate("")
      setSelectedSlot(null)
      setAvailableSlots([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed")
    } finally {
      setIsLoading(false)
    }
  }

  // Get minimum date (today)
  const minDate = new Date().toISOString().split("T")[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-card p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Book a Car</h1>
            <p className="text-muted-foreground mt-1">Reserve your vehicle for a specific date and time</p>
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

        {/* Booking Form */}
        <form onSubmit={handleBooking} className="space-y-6">
          {/* Step 1: Select Car */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Step 1: Select a Car</h2>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading cars...</div>
            ) : cars.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No cars available</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {cars.map((car) => (
                  <button
                    key={car.car_id}
                    type="button"
                    onClick={() => {
                      setSelectedCar(car)
                      setSelectedDate("")
                      setAvailableSlots([])
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedCar?.car_id === car.car_id
                        ? "border-primary bg-primary/5"
                        : "border-input bg-card hover:border-primary/50"
                    }`}
                  >
                    <p className="font-semibold text-foreground">{car.model}</p>
                    <p className="text-sm text-muted-foreground">{car.license_plate}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Step 2: Select Date */}
          {selectedCar && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Step 2: Select a Date</h2>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={minDate}
                className="bg-card text-foreground border-input"
              />
            </Card>
          )}

          {/* Step 3: Select Time Slot */}
          {selectedDate && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Step 3: Select a Time Slot</h2>
              {isLoadingSlots ? (
                <div className="text-center py-8 text-muted-foreground">Loading available slots...</div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No available slots for this date. Please try another date.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableSlots.map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 rounded-lg border-2 transition-all text-center ${
                        selectedSlot?.start_time === slot.start_time
                          ? "border-primary bg-primary/5"
                          : "border-input bg-card hover:border-primary/50"
                      }`}
                    >
                      <p className="font-semibold text-foreground">
                        {slot.start_time} - {slot.end_time}
                      </p>
                      <p className="text-xs text-muted-foreground">2 hours</p>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Booking Summary */}
          {selectedCar && selectedDate && selectedSlot && (
            <Card className="p-6 bg-primary/5 border-primary/20">
              <h3 className="font-semibold text-foreground mb-3">Booking Summary</h3>
              <div className="space-y-2 text-sm text-foreground mb-6">
                <p>
                  <span className="text-muted-foreground">Car:</span> {selectedCar.model} ({selectedCar.license_plate})
                </p>
                <p>
                  <span className="text-muted-foreground">Date:</span> {selectedDate}
                </p>
                <p>
                  <span className="text-muted-foreground">Time:</span> {selectedSlot.start_time} -{" "}
                  {selectedSlot.end_time}
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isLoading ? "Booking..." : "Confirm Booking"}
              </Button>
            </Card>
          )}

          {/* Messages */}
          {error && <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          {success && <div className="p-4 rounded-lg bg-green-500/10 text-green-600 text-sm">{success}</div>}
        </form>
      </div>
    </div>
  )
}
