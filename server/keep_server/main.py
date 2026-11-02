"""
Keep — download engine.

A small, self-hosted HTTP service that wraps yt-dlp. The mobile app sends it a
link, the engine fetches the media (merging audio/video with ffmpeg where
needed) and then streams the finished file back to the phone.

Endpoints
---------
GET    /health                  liveness + yt-dlp version
POST   /api/info                metadata for a link (title, thumbnail, ...)
POST   /api/jobs                start a download job
GET    /api/jobs/{id}           job status and progress
GET    /api/jobs/{id}/file      stream the finished file
DELETE /api/jobs/{id}           cancel a job and delete its files
"""

from __future__ import annotations

import os
import re
import shutil
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Optional

import yt_dlp
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .links import detect_platform, normalise_url

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

DOWNLOAD_DIR = Path(os.getenv("KEEP_DOWNLOAD_DIR", "./downloads")).resolve()
API_KEY = os.getenv("KEEP_API_KEY", "").strip()
FILE_TTL_SECONDS = int(os.getenv("KEEP_FILE_TTL", str(60 * 60)))  # 1 hour
MAX_CONCURRENT = int(os.getenv("KEEP_MAX_CONCURRENT", "2"))
COOKIES_FILE = os.getenv("KEEP_COOKIES_FILE", "").strip()  # optional, for private IG

DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Keep download engine", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_key(x_keep_key: Optional[str] = Header(default=None)) -> None:
    """If KEEP_API_KEY is set, every /api call must present it."""
    if API_KEY and x_keep_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing access key.")


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #

Kind = Literal["video", "audio"]
Quality = Literal["best", "1080", "720", "480", "360"]
Status = Literal["queued", "downloading", "processing", "ready", "error", "cancelled"]


class LinkIn(BaseModel):
    url: str = Field(..., min_length=8, max_length=2048)


class JobIn(LinkIn):
    kind: Kind = "video"
    quality: Quality = "best"


@dataclass
class Job:
    id: str
    url: str
    platform: str
    kind: Kind
    quality: Quality
    status: Status = "queued"
    progress: float = 0.0  # 0..1
    speed: Optional[float] = None  # bytes / second
    eta: Optional[int] = None  # seconds
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    uploader: Optional[str] = None
    duration: Optional[float] = None
    filename: Optional[str] = None
    filesize: Optional[int] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    cancel_event: threading.Event = field(default_factory=threading.Event, repr=False)

    @property
    def workdir(self) -> Path:
        return DOWNLOAD_DIR / self.id

    def public(self) -> dict:
        return {
            "id": self.id,
            "url": self.url,
            "platform": self.platform,
            "kind": self.kind,
            "quality": self.quality,
            "status": self.status,
            "progress": round(self.progress, 4),
            "speed": self.speed,
            "eta": self.eta,
            "title": self.title,
            "thumbnail": self.thumbnail,
            "uploader": self.uploader,
            "duration": self.duration,
            "filename": self.filename,
            "filesize": self.filesize,
            "error": self.error,
        }


JOBS: dict[str, Job] = {}
JOBS_LOCK = threading.Lock()
SLOTS = threading.BoundedSemaphore(MAX_CONCURRENT)


class Cancelled(Exception):
    pass


# --------------------------------------------------------------------------- #
# yt-dlp helpers
# --------------------------------------------------------------------------- #


def _format_selector(kind: Kind, quality: Quality) -> str:
    if kind == "audio":
        return "bestaudio/best"
    if quality == "best":
        # Prefer mp4/m4a so the result plays natively on iOS & Android.
        return "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b"
    h = int(quality)
    return (
        f"bv*[height<={h}][ext=mp4]+ba[ext=m4a]/"
        f"bv*[height<={h}]+ba/b[height<={h}]/b"
    )


def _base_opts() -> dict:
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "restrictfilenames": True,
        "socket_timeout": 30,
        "retries": 5,
        "fragment_retries": 5,
        "concurrent_fragment_downloads": 4,
    }
    if COOKIES_FILE and Path(COOKIES_FILE).exists():
        opts["cookiefile"] = COOKIES_FILE
    return opts


def _friendly_error(exc: Exception) -> str:
    msg = re.sub(r"\x1b\[[0-9;]*m", "", str(exc))  # strip ANSI colour codes
    msg = msg.replace("ERROR: ", "").strip()
    lowered = msg.lower()
    if "private" in lowered or "login" in lowered or "sign in" in lowered:
        return "This post is private or needs a login."
    if "unavailable" in lowered or "removed" in lowered:
        return "This video is unavailable."
    if "unsupported url" in lowered:
        return "This link isn't supported."
    if "rate" in lowered and "limit" in lowered:
        return "The platform is rate limiting requests. Try again shortly."
    if any(k in lowered for k in ("unable to download", "proxyerror", "timed out", "connection")):
        return "The engine couldn't reach the platform. Check its internet connection."
    return msg[:240] or "Something went wrong."


def _run_job(job: Job) -> None:
    with SLOTS:
        if job.cancel_event.is_set():
            job.status = "cancelled"
            return
        job.status = "downloading"
        job.workdir.mkdir(parents=True, exist_ok=True)

        def on_progress(d: dict) -> None:
            if job.cancel_event.is_set():
                raise Cancelled()
            if d.get("status") == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                done = d.get("downloaded_bytes") or 0
                if total:
                    job.progress = max(job.progress, min(done / total, 0.99))
                job.speed = d.get("speed")
                job.eta = d.get("eta")
            elif d.get("status") == "finished":
                job.status = "processing"

        def on_post(d: dict) -> None:
            if job.cancel_event.is_set():
                raise Cancelled()
            if d.get("status") == "started":
                job.status = "processing"

        opts = _base_opts() | {
            "format": _format_selector(job.kind, job.quality),
            "outtmpl": str(job.workdir / "%(title).80B [%(id)s].%(ext)s"),
            "progress_hooks": [on_progress],
            "postprocessor_hooks": [on_post],
        }
        if job.kind == "audio":
            opts["postprocessors"] = [
                {"key": "FFmpegExtractAudio", "preferredcodec": "m4a"},
                {"key": "FFmpegMetadata"},
            ]
        else:
            opts["merge_output_format"] = "mp4"
            opts["postprocessors"] = [
                {"key": "FFmpegVideoRemuxer", "preferedformat": "mp4"},
            ]

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(job.url, download=True)
                if info and info.get("_type") == "playlist" and info.get("entries"):
                    info = info["entries"][0]
                if info:
                    job.title = info.get("title") or job.title
                    job.thumbnail = info.get("thumbnail") or job.thumbnail
                    job.uploader = info.get("uploader") or info.get("channel")
                    job.duration = info.get("duration")

            files = [p for p in job.workdir.iterdir() if p.is_file() and not p.name.endswith(".part")]
            if not files:
                raise RuntimeError("No file was produced.")
            final = max(files, key=lambda p: p.stat().st_size)
            job.filename = final.name
            job.filesize = final.stat().st_size
            job.progress = 1.0
            job.status = "ready"
        except Cancelled:
            job.status = "cancelled"
            shutil.rmtree(job.workdir, ignore_errors=True)
        except Exception as exc:  # noqa: BLE001 - surface any yt-dlp failure
            if job.cancel_event.is_set():
                job.status = "cancelled"
            else:
                job.status = "error"
                job.error = _friendly_error(exc)
            shutil.rmtree(job.workdir, ignore_errors=True)
        finally:
            job.finished_at = time.time()


def _janitor() -> None:
    """Delete finished jobs and their files after FILE_TTL_SECONDS."""
    while True:
        time.sleep(60)
        now = time.time()
        with JOBS_LOCK:
            stale = [
                j for j in JOBS.values()
                if j.finished_at and now - j.finished_at > FILE_TTL_SECONDS
            ]
            for j in stale:
                JOBS.pop(j.id, None)
        for j in stale:
            shutil.rmtree(j.workdir, ignore_errors=True)


threading.Thread(target=_janitor, daemon=True, name="keep-janitor").start()


def _get_job(job_id: str) -> Job:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "name": "keep",
        "version": app.version,
        "yt_dlp": yt_dlp.version.__version__,
        "ffmpeg": shutil.which("ffmpeg") is not None,
        "auth": bool(API_KEY),
    }


@app.post("/api/info", dependencies=[Depends(require_key)])
def info(body: LinkIn) -> dict:
    url = normalise_url(body.url)
    platform = detect_platform(url)
    if not platform:
        raise HTTPException(status_code=422, detail="Only YouTube and Instagram links are supported.")
    try:
        with yt_dlp.YoutubeDL(_base_opts() | {"skip_download": True}) as ydl:
            data = ydl.extract_info(url, download=False)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=_friendly_error(exc)) from exc
    if data and data.get("_type") == "playlist" and data.get("entries"):
        data = data["entries"][0]
    return {
        "url": url,
        "platform": platform,
        "title": data.get("title"),
        "thumbnail": data.get("thumbnail"),
        "uploader": data.get("uploader") or data.get("channel"),
        "duration": data.get("duration"),
    }


@app.post("/api/jobs", dependencies=[Depends(require_key)], status_code=201)
def create_job(body: JobIn) -> dict:
    url = normalise_url(body.url)
    platform = detect_platform(url)
    if not platform:
        raise HTTPException(status_code=422, detail="Only YouTube and Instagram links are supported.")
    job = Job(id=uuid.uuid4().hex, url=url, platform=platform, kind=body.kind, quality=body.quality)
    with JOBS_LOCK:
        JOBS[job.id] = job
    threading.Thread(target=_run_job, args=(job,), daemon=True, name=f"job-{job.id[:8]}").start()
    return job.public()


@app.get("/api/jobs/{job_id}", dependencies=[Depends(require_key)])
def get_job(job_id: str) -> dict:
    return _get_job(job_id).public()


@app.get("/api/jobs/{job_id}/file", dependencies=[Depends(require_key)])
def get_file(job_id: str) -> FileResponse:
    job = _get_job(job_id)
    if job.status != "ready" or not job.filename:
        raise HTTPException(status_code=409, detail="File isn't ready yet.")
    path = job.workdir / job.filename
    if not path.exists():
        raise HTTPException(status_code=410, detail="File has expired.")
    media = "audio/mp4" if job.kind == "audio" else "video/mp4"
    return FileResponse(path, media_type=media, filename=job.filename)


@app.delete("/api/jobs/{job_id}", dependencies=[Depends(require_key)])
def delete_job(job_id: str) -> dict:
    job = _get_job(job_id)
    job.cancel_event.set()
    if job.status in ("ready", "error", "cancelled"):
        with JOBS_LOCK:
            JOBS.pop(job.id, None)
        shutil.rmtree(job.workdir, ignore_errors=True)
    elif job.status == "queued":
        job.status = "cancelled"
    return {"ok": True}
