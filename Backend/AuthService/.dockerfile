FROM python:3.12-slim

ENV PORT=8000

WORKDIR /app
COPY AuthService AuthService
RUN pip install -r AuthService/requirements.txt


COPY Utility Utility
RUN pip install -r Utility/requirements.txt


EXPOSE 8000
CMD uvicorn AuthService.authentifcation:app --host 0.0.0.0 --port $PORT --reload
