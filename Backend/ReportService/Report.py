# report.py
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import text
from Utility.connect import connect_database
from jose import jwt, JWTError

# --- JWT settings ---
SECRET_KEY = "YOUR_SECRET_KEY"  # Must match the AuthService secret
ALGORITHM = "HS256"

# --- Create engine using utility function ---
engine = connect_database()

# --- FastAPI app ---
app = FastAPI(title="Report Service")

# --- Security ---
security = HTTPBearer()

# --- Pydantic models ---
class BookingSummary(BaseModel):
    total_bookings: int
    total_users: int
    total_cars: int
    bookings_today: int
    bookings_this_week: int
    bookings_this_month: int

class CarUtilization(BaseModel):
    car_id: int
    model: str
    license_plate: str
    total_bookings: int
    utilization_percentage: float

class UserActivity(BaseModel):
    user_id: int
    email: str
    total_bookings: int
    last_booking_date: Optional[str]

class PopularSlot(BaseModel):
    time_slot: str
    booking_count: int

class DailyRevenue(BaseModel):
    date: str
    total_bookings: int
    revenue: float

class DashboardSummary(BaseModel):
    total_bookings: int
    active_users: int
    total_cars: int
    today_bookings: int
    upcoming_bookings: int
    popular_car: Optional[str]
    busiest_time: Optional[str]

# --- JWT dependency ---
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    """Validate JWT token and return user_id"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return int(user_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# --- API endpoints ---
@app.get("/", summary="Health check")
def root():
    """Check if the service is running"""
    return {"status": "Report Service is running", "port": 8081}

@app.get("/reports/bookings/summary", response_model=BookingSummary, summary="Get booking summary")
def get_booking_summary(user_id: int = Depends(get_current_user)):
    """Get overall booking statistics"""
    with engine.connect() as conn:
        # Total bookings
        total_bookings = conn.execute(text("SELECT COUNT(*) FROM reservations")).fetchone()[0]
        
        # Total users
        total_users = conn.execute(text("SELECT COUNT(*) FROM users")).fetchone()[0]
        
        # Total cars
        total_cars = conn.execute(text("SELECT COUNT(*) FROM cars")).fetchone()[0]
        
        # Bookings today
        today = datetime.now().date()
        bookings_today = conn.execute(
            text("SELECT COUNT(*) FROM reservations WHERE DATE(reservation_date) = :today"),
            {"today": today}
        ).fetchone()[0]
        
        # Bookings this week
        week_start = today - timedelta(days=today.weekday())
        bookings_this_week = conn.execute(
            text("SELECT COUNT(*) FROM reservations WHERE DATE(reservation_date) >= :week_start"),
            {"week_start": week_start}
        ).fetchone()[0]
        
        # Bookings this month
        month_start = today.replace(day=1)
        bookings_this_month = conn.execute(
            text("SELECT COUNT(*) FROM reservations WHERE DATE(reservation_date) >= :month_start"),
            {"month_start": month_start}
        ).fetchone()[0]
    
    return BookingSummary(
        total_bookings=total_bookings,
        total_users=total_users,
        total_cars=total_cars,
        bookings_today=bookings_today,
        bookings_this_week=bookings_this_week,
        bookings_this_month=bookings_this_month
    )

@app.get("/reports/cars/utilization", response_model=List[CarUtilization], summary="Get car utilization")
def get_car_utilization(
    user_id: int = Depends(get_current_user),
    days: int = Query(30, description="Number of days to analyze")
):
    """Get car usage analytics"""
    start_date = datetime.now().date() - timedelta(days=days)
    
    query = text("""
        SELECT 
            c.car_id,
            c.model,
            c.license_plate,
            COUNT(r.reservation_id) as total_bookings,
            (COUNT(r.reservation_id) * 2.0 / (:days * 5)) * 100 as utilization_percentage
        FROM cars c
        LEFT JOIN reservations r ON c.car_id = r.car_id 
            AND DATE(r.reservation_date) >= :start_date
        GROUP BY c.car_id, c.model, c.license_plate
        ORDER BY total_bookings DESC
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {"start_date": start_date, "days": days}).fetchall()
    
    return [
        CarUtilization(
            car_id=r[0],
            model=r[1],
            license_plate=r[2],
            total_bookings=r[3],
            utilization_percentage=round(r[4], 2)
        )
        for r in result
    ]

@app.get("/reports/users/activity", response_model=List[UserActivity], summary="Get user activity")
def get_user_activity(
    user_id: int = Depends(get_current_user),
    limit: int = Query(10, description="Number of users to return")
):
    """Get most active users"""
    query = text("""
        SELECT 
            u.user_id,
            u.email,
            COUNT(r.reservation_id) as total_bookings,
            MAX(r.reservation_date) as last_booking_date
        FROM users u
        LEFT JOIN reservations r ON u.user_id = r.user_id
        GROUP BY u.user_id, u.email
        ORDER BY total_bookings DESC
        LIMIT :limit
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {"limit": limit}).fetchall()
    
    return [
        UserActivity(
            user_id=r[0],
            email=r[1],
            total_bookings=r[2],
            last_booking_date=r[3].strftime("%Y-%m-%d %H:%M") if r[3] else None
        )
        for r in result
    ]

@app.get("/reports/popular-slots", response_model=List[PopularSlot], summary="Get popular time slots")
def get_popular_slots(
    user_id: int = Depends(get_current_user),
    days: int = Query(30, description="Number of days to analyze")
):
    """Get most booked time slots"""
    start_date = datetime.now().date() - timedelta(days=days)
    
    query = text("""
        SELECT 
            TIME_FORMAT(reservation_date, '%H:00') as time_slot,
            COUNT(*) as booking_count
        FROM reservations
        WHERE DATE(reservation_date) >= :start_date
        GROUP BY time_slot
        ORDER BY booking_count DESC
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {"start_date": start_date}).fetchall()
    
    return [
        PopularSlot(
            time_slot=r[0],
            booking_count=r[1]
        )
        for r in result
    ]

@app.get("/reports/revenue/daily", response_model=List[DailyRevenue], summary="Get daily revenue")
def get_daily_revenue(
    user_id: int = Depends(get_current_user),
    days: int = Query(7, description="Number of days to analyze"),
    price_per_booking: float = Query(50.0, description="Price per 2-hour booking")
):
    """Get daily revenue breakdown"""
    start_date = datetime.now().date() - timedelta(days=days)
    
    query = text("""
        SELECT 
            DATE(reservation_date) as booking_date,
            COUNT(*) as total_bookings
        FROM reservations
        WHERE DATE(reservation_date) >= :start_date
        GROUP BY booking_date
        ORDER BY booking_date DESC
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {"start_date": start_date}).fetchall()
    
    return [
        DailyRevenue(
            date=r[0].strftime("%Y-%m-%d"),
            total_bookings=r[1],
            revenue=r[1] * price_per_booking
        )
        for r in result
    ]

@app.get("/reports/dashboard", response_model=DashboardSummary, summary="Get admin dashboard summary")
def get_dashboard_summary(user_id: int = Depends(get_current_user)):
    """Get comprehensive dashboard data for admins"""
    with engine.connect() as conn:
        # Total bookings
        total_bookings = conn.execute(text("SELECT COUNT(*) FROM reservations")).fetchone()[0]
        
        # Active users (users with at least one booking)
        active_users = conn.execute(
            text("SELECT COUNT(DISTINCT user_id) FROM reservations")
        ).fetchone()[0]
        
        # Total cars
        total_cars = conn.execute(text("SELECT COUNT(*) FROM cars")).fetchone()[0]
        
        # Today's bookings
        today = datetime.now().date()
        today_bookings = conn.execute(
            text("SELECT COUNT(*) FROM reservations WHERE DATE(reservation_date) = :today"),
            {"today": today}
        ).fetchone()[0]
        
        # Upcoming bookings (future)
        now = datetime.now()
        upcoming_bookings = conn.execute(
            text("SELECT COUNT(*) FROM reservations WHERE reservation_date > :now"),
            {"now": now}
        ).fetchone()[0]
        
        # Most popular car
        popular_car_result = conn.execute(
            text("""
                SELECT c.model, c.license_plate, COUNT(*) as booking_count
                FROM reservations r
                JOIN cars c ON r.car_id = c.car_id
                GROUP BY c.car_id, c.model, c.license_plate
                ORDER BY booking_count DESC
                LIMIT 1
            """)
        ).fetchone()
        popular_car = f"{popular_car_result[0]} ({popular_car_result[1]})" if popular_car_result else None
        
        # Busiest time
        busiest_time_result = conn.execute(
            text("""
                SELECT TIME_FORMAT(reservation_date, '%H:00') as time_slot, COUNT(*) as count
                FROM reservations
                GROUP BY time_slot
                ORDER BY count DESC
                LIMIT 1
            """)
        ).fetchone()
        busiest_time = busiest_time_result[0] if busiest_time_result else None
    
    return DashboardSummary(
        total_bookings=total_bookings,
        active_users=active_users,
        total_cars=total_cars,
        today_bookings=today_bookings,
        upcoming_bookings=upcoming_bookings,
        popular_car=popular_car,
        busiest_time=busiest_time
    )

@app.get("/reports/bookings/by-date", summary="Get bookings by date range")
def get_bookings_by_date(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    user_id: int = Depends(get_current_user)
):
    """Get all bookings within a date range"""
    try:
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    
    query = text("""
        SELECT 
            r.reservation_id,
            r.reservation_date,
            u.email,
            c.model,
            c.license_plate
        FROM reservations r
        JOIN users u ON r.user_id = u.user_id
        JOIN cars c ON r.car_id = c.car_id
        WHERE DATE(r.reservation_date) BETWEEN :start_date AND :end_date
        ORDER BY r.reservation_date DESC
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {"start_date": start_date, "end_date": end_date}).fetchall()
    
    return [
        {
            "reservation_id": r[0],
            "reservation_date": r[1].strftime("%Y-%m-%d %H:%M"),
            "user_email": r[2],
            "car_model": r[3],
            "car_license_plate": r[4]
        }
        for r in result
    ]

# --- Run server ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8180, reload=True)