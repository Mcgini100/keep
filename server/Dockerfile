FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY keep_server ./keep_server

ENV KEEP_DOWNLOAD_DIR=/data
VOLUME ["/data"]
EXPOSE 8000

# yt-dlp changes often; refresh it on every container start so links keep working.
CMD pip install --no-cache-dir -U yt-dlp >/dev/null 2>&1; \
    uvicorn keep_server.main:app --host 0.0.0.0 --port 8000
