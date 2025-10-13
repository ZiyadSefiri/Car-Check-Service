FROM python:3.12-slim

ENV PORT=8080

WORKDIR /app
COPY BookingService BookingService
RUN pip install -r BookingService/requirements.txt


COPY Utility Utility
RUN pip install -r Utility/requirements.txt


EXPOSE 8080
CMD uvicorn BookingService.booking:app --host 0.0.0.0 --port $PORT --reload
