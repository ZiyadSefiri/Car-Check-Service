
FROM python:3.12-slim

ENV PORT=8180

WORKDIR /app
COPY ReportService ReportService
RUN pip install -r ReportService/requirements.txt


COPY Utility Utility
RUN pip install -r Utility/requirements.txt


EXPOSE 8180
CMD uvicorn ReportService.Report:app --host 0.0.0.0 --port $PORT --reload
