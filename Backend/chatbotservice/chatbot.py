# chatbot.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
from sqlalchemy import text
from connect import connect_database
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os

# --- Configuration ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyCZkjmDr9nySOBtoIsdgjID80bII-WE-_0")
SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_SECRET_KEY")  # Must match AuthService
ALGORITHM = "HS256"

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

# --- Create engine ---
engine = connect_database()

# --- FastAPI app ---
app = FastAPI(title="Chatbot Service")

# --- Security ---
security = HTTPBearer()

# --- Pydantic models ---
class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[int] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: int
    timestamp: str

class ConversationHistory(BaseModel):
    conversation_id: int
    user_message: str
    bot_response: str
    timestamp: str

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

# --- Helper functions ---
def get_or_create_conversation(user_id: int, conversation_id: Optional[int] = None) -> int:
    """Get existing conversation or create new one"""
    with engine.connect() as conn:
        if conversation_id:
            # Verify conversation belongs to user
            result = conn.execute(
                text("SELECT conversation_id FROM conversations WHERE conversation_id = :conv_id AND user_id = :user_id"),
                {"conv_id": conversation_id, "user_id": user_id}
            ).fetchone()
            if result:
                return conversation_id
        
        # Create new conversation
        conn.execute(
            text("INSERT INTO conversations (user_id, created_at) VALUES (:user_id, :created_at)"),
            {"user_id": user_id, "created_at": datetime.now()}
        )
        conn.commit()
        
        new_conv_id = conn.execute(
            text("SELECT LAST_INSERT_ID()")
        ).fetchone()[0]
        
        return new_conv_id

def save_chat_message(conversation_id: int, user_message: str, bot_response: str):
    """Save chat message to database"""
    with engine.connect() as conn:
        conn.execute(
            text("""
                INSERT INTO chat_messages (conversation_id, user_message, bot_response, timestamp)
                VALUES (:conv_id, :user_msg, :bot_resp, :timestamp)
            """),
            {
                "conv_id": conversation_id,
                "user_msg": user_message,
                "bot_resp": bot_response,
                "timestamp": datetime.now()
            }
        )
        conn.commit()

def get_conversation_context(conversation_id: int, limit: int = 5) -> str:
    """Get recent conversation history for context"""
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT user_message, bot_response
                FROM chat_messages
                WHERE conversation_id = :conv_id
                ORDER BY timestamp DESC
                LIMIT :limit
            """),
            {"conv_id": conversation_id, "limit": limit}
        ).fetchall()
    
    context = ""
    for msg in reversed(result):
        context += f"User: {msg[0]}\nAssistant: {msg[1]}\n\n"
    
    return context

def get_database_context(user_message: str, user_id: int) -> str:
    """Fetch relevant information from database based on actual schema"""
    context_parts = []
    message_lower = user_message.lower()
    
    try:
        with engine.connect() as conn:
            
            # 1. CARS TABLE WITH DETAILED AVAILABILITY CHECK
            # Always fetch cars for any car-related query
            if any(keyword in message_lower for keyword in ['car', 'vehicle', 'available', 'rent', 'model', 'license', 'toyota', 'camry', 'have', 'get', 'book', 'show', 'free', 'when']):
                # Get all cars
                all_cars = conn.execute(
                    text("SELECT car_id, model, license_plate FROM cars")
                ).fetchall()
                
                if all_cars:
                    context_parts.append("=== DETAILED CAR AVAILABILITY (2-Hour Slots: 8 AM - 6 PM) ===")
                    available_count = 0
                    booked_count = 0
                    now = datetime.now()
                    
                    for car in all_cars:
                        car_id = car[0]
                        
                        # Get all reservations for this car
                        reservations = conn.execute(
                            text("""
                                SELECT reservation_id, reservation_date
                                FROM reservations
                                WHERE car_id = :car_id
                                ORDER BY reservation_date ASC
                            """),
                            {"car_id": car_id}
                        ).fetchall()
                        
                        if not reservations:
                            # Car is completely available
                            status_icon = "✅"
                            context_parts.append(
                                f"{status_icon} Car ID: {car[0]} | Model: {car[1]} | License: {car[2]} | "
                                f"Status: AVAILABLE NOW | No reservations"
                            )
                            available_count += 1
                        else:
                            # Car has reservations - find current and next availability
                            current_reservation = None
                            next_reservation = None
                            future_reservations = []
                            
                            for res in reservations:
                                res_start = res[1]
                                res_end = res_start + timedelta(hours=2)  # Each booking is 2 hours
                                
                                # Check if currently booked
                                if res_start <= now < res_end:
                                    current_reservation = (res_start, res_end)
                                
                                # Future reservations
                                if res_start > now:
                                    future_reservations.append((res_start, res_end))
                            
                            if current_reservation:
                                # Car is currently booked
                                status_icon = "🔴"
                                available_after = current_reservation[1].strftime("%Y-%m-%d %H:%M")
                                context_parts.append(
                                    f"{status_icon} Car ID: {car[0]} | Model: {car[1]} | License: {car[2]} | "
                                    f"Status: CURRENTLY BOOKED | Available after: {available_after}"
                                )
                                
                                # Show future reservations
                                if future_reservations:
                                    context_parts.append(f"   📅 Upcoming reservations:")
                                    for future_start, future_end in future_reservations[:3]:  # Show next 3
                                        context_parts.append(
                                            f"      - {future_start.strftime('%Y-%m-%d %H:%M')} to {future_end.strftime('%H:%M')}"
                                        )
                                
                                booked_count += 1
                            else:
                                # Car is available now but has future bookings
                                status_icon = "✅"
                                if future_reservations:
                                    next_booking = future_reservations[0][0].strftime("%Y-%m-%d %H:%M")
                                    context_parts.append(
                                        f"{status_icon} Car ID: {car[0]} | Model: {car[1]} | License: {car[2]} | "
                                        f"Status: AVAILABLE NOW | Next booking: {next_booking}"
                                    )
                                else:
                                    context_parts.append(
                                        f"{status_icon} Car ID: {car[0]} | Model: {car[1]} | License: {car[2]} | "
                                        f"Status: AVAILABLE NOW | No upcoming bookings"
                                    )
                                available_count += 1
                            
                            context_parts.append(f"   Total reservations: {len(reservations)}")
                    
                    context_parts.append(f"\n📊 Summary: {available_count} Available Now | {booked_count} Currently Booked")
                    context_parts.append(f"⏰ Current Time: {now.strftime('%Y-%m-%d %H:%M')}")
                else:
                    context_parts.append("=== ALL CARS IN SYSTEM ===")
                    context_parts.append("No cars found in the database.")
            
            # 2. USERS TABLE (user_id, name, email, phone_number)
            if any(keyword in message_lower for keyword in ['user', 'profile', 'account', 'my info', 'my details', 'contact']):
                user = conn.execute(
                    text("""
                        SELECT user_id, name, email, phone_number
                        FROM users
                        WHERE user_id = :user_id
                    """),
                    {"user_id": user_id}
                ).fetchone()
                
                if user:
                    context_parts.append("\n=== YOUR ACCOUNT INFO ===")
                    context_parts.append(f"User ID: {user[0]}")
                    context_parts.append(f"Name: {user[1]}")
                    context_parts.append(f"Email: {user[2]}")
                    context_parts.append(f"Phone: {user[3]}")
            
            # 3. RESERVATIONS TABLE (reservation_id, reservation_date, user_id, car_id)
            if any(keyword in message_lower for keyword in ['booking', 'reservation', 'my rental', 'rented', 'reserve', 'booked']):
                reservations = conn.execute(
                    text("""
                        SELECT r.reservation_id, r.reservation_date, r.car_id, c.model, c.license_plate
                        FROM reservations r
                        JOIN cars c ON r.car_id = c.car_id
                        WHERE r.user_id = :user_id
                        ORDER BY r.reservation_date DESC
                    """),
                    {"user_id": user_id}
                ).fetchall()
                
                if reservations:
                    context_parts.append("\n=== YOUR RESERVATIONS ===")
                    for res in reservations:
                        context_parts.append(
                            f"Reservation #{res[0]} | Date: {res[1]} | "
                            f"Car: {res[3]} (ID: {res[2]}) | License: {res[4]}"
                        )
                else:
                    context_parts.append("\n=== YOUR RESERVATIONS ===")
                    context_parts.append("You currently have no reservations.")
                
                # Also show ALL reservations if asking about booked cars
                if any(word in message_lower for word in ['which', 'what', 'show', 'list', 'all']):
                    all_reservations = conn.execute(
                        text("""
                            SELECT r.reservation_id, r.reservation_date, r.user_id, u.name, c.model, c.license_plate
                            FROM reservations r
                            JOIN users u ON r.user_id = u.user_id
                            JOIN cars c ON r.car_id = c.car_id
                            ORDER BY r.reservation_date DESC
                        """)
                    ).fetchall()
                    
                    if all_reservations:
                        context_parts.append("\n=== ALL SYSTEM RESERVATIONS ===")
                        for res in all_reservations:
                            context_parts.append(
                                f"Reservation #{res[0]} | Date: {res[1]} | "
                                f"User: {res[3]} (ID: {res[2]}) | Car: {res[4]} | License: {res[5]}"
                            )
            
            # 4. CONVERSATIONS TABLE
            if any(keyword in message_lower for keyword in ['conversation', 'chat history', 'previous chat', 'my chats']):
                conversations = conn.execute(
                    text("""
                        SELECT conversation_id, created_at
                        FROM conversations
                        WHERE user_id = :user_id
                        ORDER BY created_at DESC
                        LIMIT 10
                    """),
                    {"user_id": user_id}
                ).fetchall()
                
                if conversations:
                    context_parts.append("\n=== YOUR CONVERSATIONS ===")
                    for conv in conversations:
                        context_parts.append(f"Conversation ID: {conv[0]} | Started: {conv[1]}")
            
            # 5. STATISTICS
            if any(keyword in message_lower for keyword in ['how many', 'total', 'count', 'stats', 'statistics', 'number of']):
                # Count total cars
                total_cars = conn.execute(text("SELECT COUNT(*) FROM cars")).fetchone()[0]
                
                # Count user's reservations
                user_reservations = conn.execute(
                    text("SELECT COUNT(*) FROM reservations WHERE user_id = :user_id"),
                    {"user_id": user_id}
                ).fetchone()[0]
                
                # Count all reservations
                total_reservations = conn.execute(text("SELECT COUNT(*) FROM reservations")).fetchone()[0]
                
                # Count total users
                total_users = conn.execute(text("SELECT COUNT(*) FROM users")).fetchone()[0]
                
                context_parts.append("\n=== SYSTEM STATISTICS ===")
                context_parts.append(f"Total cars: {total_cars}")
                context_parts.append(f"Total reservations: {total_reservations}")
                context_parts.append(f"Your reservations: {user_reservations}")
                context_parts.append(f"Total users: {total_users}")
            
            # 6. Search for specific car by ID
            if 'car id' in message_lower or 'car #' in message_lower or 'id' in message_lower:
                import re
                car_id_match = re.search(r'\b(\d+)\b', user_message)
                if car_id_match:
                    car_id = int(car_id_match.group(1))
                    car = conn.execute(
                        text("""
                            SELECT car_id, model, license_plate
                            FROM cars
                            WHERE car_id = :car_id
                        """),
                        {"car_id": car_id}
                    ).fetchone()
                    
                    if car:
                        context_parts.append("\n=== SPECIFIC CAR DETAILS ===")
                        context_parts.append(f"Car ID: {car[0]} | Model: {car[1]} | License Plate: {car[2]}")
                        
                        # Check if this car is reserved
                        reservations = conn.execute(
                            text("""
                                SELECT r.reservation_id, r.reservation_date, u.name
                                FROM reservations r
                                JOIN users u ON r.user_id = u.user_id
                                WHERE r.car_id = :car_id
                                ORDER BY r.reservation_date DESC
                            """),
                            {"car_id": car_id}
                        ).fetchall()
                        
                        if reservations:
                            context_parts.append("Reservations for this car:")
                            for res in reservations:
                                context_parts.append(f"  - Reservation #{res[0]} on {res[1]} by {res[2]}")
                        else:
                            context_parts.append("This car has no reservations.")
            
    except Exception as e:
        print(f"Database context error: {str(e)}")
        import traceback
        traceback.print_exc()
        context_parts.append(f"\n[Database Error: {str(e)}]")
    
    return "\n".join(context_parts) if context_parts else "No relevant database information found for this query."

def generate_chatbot_response(user_message: str, conversation_context: str = "", user_id: int = None) -> str:
    """Generate response using Gemini API with database context"""
    try:
        # Use the free Gemini 2.5 Flash model
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Get database context
        db_context = get_database_context(user_message, user_id)
        
        # Build comprehensive prompt
        full_prompt = f"""You are a helpful car rental assistant with access to a real-time car booking system.

IMPORTANT: Our booking system uses 2-HOUR TIME SLOTS from 8:00 AM to 6:00 PM daily.

CRITICAL INSTRUCTIONS:
1. The DATABASE shows REAL-TIME availability with exact reservation times
2. ✅ = Available NOW | 🔴 = Currently booked with "Available after" time
3. When a car is CURRENTLY BOOKED, you MUST tell the user the EXACT time it becomes available
4. Each reservation is exactly 2 hours long
5. Show upcoming reservations when relevant
6. Current time is shown at the bottom of the database info

DATABASE INFORMATION (REAL-TIME WITH EXACT TIMES):
{db_context}

Previous conversation:
{conversation_context}

Current user message: {user_message}

RESPONSE GUIDELINES:
- For AVAILABLE cars: "The [car model] is available NOW! Would you like to book it?"
- For BOOKED cars: "The [car model] is currently booked until [exact time]. It will be available after that."
- Always mention the "Available after" time when a car is booked
- Show next booking times if user asks "when"
- Be specific with times (use the exact datetime from database)
- Offer to help book when cars are available

Please provide a helpful response with EXACT availability times:"""
        
        response = model.generate_content(full_prompt)
        return response.text
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

# --- API endpoints ---
@app.get("/", summary="Health check")
def root():
    """Check if the service is running"""
    return {"status": "Chatbot Service is running", "port": 8280}

@app.get("/debug-db", summary="Debug database structure")
def debug_database():
    """Check actual database structure and data"""
    try:
        with engine.connect() as conn:
            # Check what tables exist
            tables = conn.execute(text("SHOW TABLES")).fetchall()
            
            result = {"tables": [t[0] for t in tables]}
            
            # Check cars table structure
            if 'cars' in result['tables']:
                cars_structure = conn.execute(text("DESCRIBE cars")).fetchall()
                result['cars_columns'] = [{"column": c[0], "type": c[1]} for c in cars_structure]
                
                cars_count = conn.execute(text("SELECT COUNT(*) FROM cars")).fetchone()[0]
                result['cars_count'] = cars_count
                
                if cars_count > 0:
                    sample_car = conn.execute(text("SELECT * FROM cars LIMIT 1")).fetchone()
                    result['sample_car'] = dict(zip([c[0] for c in cars_structure], sample_car))
            
            # Check reservations table structure
            if 'reservations' in result['tables']:
                res_structure = conn.execute(text("DESCRIBE reservations")).fetchall()
                result['reservations_columns'] = [{"column": c[0], "type": c[1]} for c in res_structure]
                
                res_count = conn.execute(text("SELECT COUNT(*) FROM reservations")).fetchone()[0]
                result['reservations_count'] = res_count
            
            # Check users table
            if 'users' in result['tables']:
                users_structure = conn.execute(text("DESCRIBE users")).fetchall()
                result['users_columns'] = [{"column": c[0], "type": c[1]} for c in users_structure]
            
            return result
            
    except Exception as e:
        return {"error": str(e)}

@app.get("/test-models", summary="List available Gemini models")
def test_models():
    """List available Gemini models for your API key"""
    try:
        models = genai.list_models()
        available = [
            {
                "name": m.name,
                "supported_methods": m.supported_generation_methods
            }
            for m in models if 'generateContent' in m.supported_generation_methods
        ]
        return {"available_models": available}
    except Exception as e:
        return {"error": str(e)}

@app.get("/test-api-key", summary="Test API key")
def test_api_key():
    """Test if Gemini API key is valid"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content("Hello, test message")
        return {"status": "API key is valid", "test_response": response.text}
    except Exception as e:
        return {"error": str(e)}

@app.post("/chat", response_model=ChatResponse, summary="Send a chat message")
def chat(
    message: ChatMessage,
    user_id: int = Depends(get_current_user)
):
    """Send a message and get chatbot response with full database context"""
    
    # Get or create conversation
    conversation_id = get_or_create_conversation(user_id, message.conversation_id)
    
    # Get conversation context
    context = get_conversation_context(conversation_id) if conversation_id else ""
    
    # Generate response using Gemini with database context
    bot_response = generate_chatbot_response(message.message, context, user_id)
    
    # Save message to database
    save_chat_message(conversation_id, message.message, bot_response)
    
    return ChatResponse(
        response=bot_response,
        conversation_id=conversation_id,
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )

@app.get("/conversations", summary="Get user's conversations")
def get_conversations(user_id: int = Depends(get_current_user)):
    """Get all conversations for the authenticated user"""
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT conversation_id, created_at
                FROM conversations
                WHERE user_id = :user_id
                ORDER BY created_at DESC
            """),
            {"user_id": user_id}
        ).fetchall()
    
    return [
        {
            "conversation_id": r[0],
            "created_at": r[1].strftime("%Y-%m-%d %H:%M:%S")
        }
        for r in result
    ]

@app.get("/conversations/{conversation_id}/history", response_model=List[ConversationHistory], summary="Get conversation history")
def get_history(
    conversation_id: int,
    user_id: int = Depends(get_current_user)
):
    """Get all messages in a conversation"""
    with engine.connect() as conn:
        # Verify conversation belongs to user
        conv_check = conn.execute(
            text("SELECT conversation_id FROM conversations WHERE conversation_id = :conv_id AND user_id = :user_id"),
            {"conv_id": conversation_id, "user_id": user_id}
        ).fetchone()
        
        if not conv_check:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        result = conn.execute(
            text("""
                SELECT conversation_id, user_message, bot_response, timestamp
                FROM chat_messages
                WHERE conversation_id = :conv_id
                ORDER BY timestamp ASC
            """),
            {"conv_id": conversation_id}
        ).fetchall()
    
    return [
        ConversationHistory(
            conversation_id=r[0],
            user_message=r[1],
            bot_response=r[2],
            timestamp=r[3].strftime("%Y-%m-%d %H:%M:%S")
        )
        for r in result
    ]

@app.delete("/conversations/{conversation_id}", summary="Delete a conversation")
def delete_conversation(
    conversation_id: int,
    user_id: int = Depends(get_current_user)
):
    """Delete a conversation and all its messages"""
    with engine.connect() as conn:
        # Verify conversation belongs to user
        conv_check = conn.execute(
            text("SELECT conversation_id FROM conversations WHERE conversation_id = :conv_id AND user_id = :user_id"),
            {"conv_id": conversation_id, "user_id": user_id}
        ).fetchone()
        
        if not conv_check:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Delete messages first
        conn.execute(
            text("DELETE FROM chat_messages WHERE conversation_id = :conv_id"),
            {"conv_id": conversation_id}
        )
        
        # Delete conversation
        conn.execute(
            text("DELETE FROM conversations WHERE conversation_id = :conv_id"),
            {"conv_id": conversation_id}
        )
        
        conn.commit()
    
    return {"message": "Conversation deleted successfully"}

# --- Run server ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8280, reload=True)