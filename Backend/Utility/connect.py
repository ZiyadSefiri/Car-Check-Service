import os
from sqlalchemy import create_engine

user = "dev"
password = ""
host = "localhost"
port = 3306
database = "car_service"

def connect_database():
    # Check if environment variable exists
    if "URL" in os.environ:
        url = os.environ["URL"]
        print("Using environment variable URL:", url)
    else:
        url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
        print("Using default URL:", url)

    try:
        engine = create_engine(url)
    except Exception as e:
        print("Failed to create engine:", e)
        raise
    return engine
