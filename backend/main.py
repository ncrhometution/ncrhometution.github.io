from fastapi import (
    FastAPI,
    Request,
    HTTPException,
    Depends,
    Header
)

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, EmailStr

from typing import Optional

from datetime import datetime, timedelta, timezone

from uuid import uuid4

import bcrypt
import secrets
import os


# ============================================================
# SUPABASE
# ============================================================
#
# Reads credentials from environment variables.
# Set SUPABASE_URL and SUPABASE_KEY in the Vercel dashboard
# (or in a local .env file for development).
#
# ============================================================

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


from supabase import create_client


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_KEY environment variables are required"
    )


supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)


# ============================================================
# RAZORPAY
# ============================================================
#
# RAZORPAY-ONLY ADDITION
#
# Reads credentials from environment variables:
#
#   RAZORPAY_KEY_ID
#   RAZORPAY_KEY_SECRET
#   RAZORPAY_WEBHOOK_SECRET
#
# If the keys are missing the payment endpoints will return
# a 500 error via require_razorpay(). The rest of the API
# keeps working normally.
#
# ============================================================

import razorpay
import hmac
import hashlib
import json


RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")


razorpay_client = None

if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:

    razorpay_client = razorpay.Client(
        auth=(
            RAZORPAY_KEY_ID,
            RAZORPAY_KEY_SECRET
        )
    )


def require_razorpay():

    if not razorpay_client:

        raise HTTPException(
            status_code=500,
            detail=(
                "Razorpay is not configured. "
                "Set RAZORPAY_KEY_ID and "
                "RAZORPAY_KEY_SECRET."
            )
        )


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="Student & Tutor API",
    version="2.0.0"
)


app.add_middleware(
    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ============================================================
# CONSTANTS
# ============================================================

DEFAULT_PAGE_SIZE = 18

MAX_PAGE_SIZE = 100


PUBLIC_FIELDS = [
    "id",
    "type",
    "name",
    "course",
    "subject",
    "qualification",
    "experience_years",
    "payment",
    "payment_type",
    "preferred_mode",
    "language",
    "city",
    "country",
    "status",
    "joined_date"
]


PRIVATE_FIELDS = [
    "email",
    "mobile_no",
    "timezone",
    "ip_address",
    "user_agent",
    "source"
]


# ============================================================
# ADMIN LOGIN MODEL
# ============================================================

class AdminLogin(BaseModel):

    username: str

    password: str


# ============================================================
# TUTOR MODEL
# ============================================================

class TutorBase(BaseModel):

    name: str

    mobile_no: str

    email: EmailStr

    course: str

    subject: str

    qualification: Optional[str] = None

    # IMPORTANT:
    # Store experience as a NUMBER.
    #
    # Example:
    # 1
    # 2.5
    # 5
    # 8.5
    # 10
    # 15
    experience_years: Optional[float] = None

    # Example:
    # 500
    # 1000
    payment: Optional[float] = None

    # Example:
    # per_hour
    # per_class
    # per_month
    payment_type: Optional[str] = "per_hour"

    preferred_mode: Optional[str] = "online"

    language: Optional[str] = "English"

    country: Optional[str] = "India"

    city: Optional[str] = None

    timezone: Optional[str] = "Asia/Kolkata"


# ============================================================
# STUDENT MODEL
# ============================================================

class StudentBase(BaseModel):

    name: str

    mobile_no: str

    email: EmailStr

    course: str

    subject: str

    Preferred_Gender: Optional[str] = None

    qualification: Optional[str] = None

    experience_years: Optional[float] = None

    payment: Optional[float] = None

    payment_type: Optional[str] = "per_hour"

    preferred_mode: Optional[str] = "online"

    language: Optional[str] = "English"

    country: Optional[str] = "India"

    city: Optional[str] = None

    timezone: Optional[str] = "Asia/Kolkata"


# ============================================================
# UPDATE MODEL
# ============================================================

class UpdateUser(BaseModel):

    name: Optional[str] = None

    mobile_no: Optional[str] = None

    course: Optional[str] = None

    subject: Optional[str] = None

    qualification: Optional[str] = None

    experience_years: Optional[float] = None

    payment: Optional[float] = None

    payment_type: Optional[str] = None

    preferred_mode: Optional[str] = None

    language: Optional[str] = None

    country: Optional[str] = None

    city: Optional[str] = None

    timezone: Optional[str] = None

    status: Optional[str] = None


# ============================================================
# RAZORPAY MODELS
# ============================================================
#
# RAZORPAY-ONLY ADDITION
#
# ============================================================

class CreateOrderRequest(BaseModel):

    # Email of the person paying.
    email: EmailStr

    # Mobile number of the person paying.
    mobile_no: str

    # Amount in RUPEES (not paise).
    #
    # Example:
    # 500
    # 999
    amount: float

    currency: str = "INR"

    # Who is being paid for: "student" or "tutor".
    user_type: str = "student"

    # Comma-separated list of user ids (students or tutors)
    # that this payment covers.
    #
    # Example:
    # "abf9699e-8813-439f-93e2-e3c9ac2bde90,fdee704f-37eb-42d8-a334-4eed8a0f9101"
    user_ids: str


class VerifyPaymentRequest(BaseModel):

    razorpay_order_id: str

    razorpay_payment_id: str

    razorpay_signature: str


# ============================================================
# PASSWORD FUNCTIONS
# ============================================================

def hash_password(password: str) -> str:

    return bcrypt.hashpw(
        password.encode(),
        bcrypt.gensalt()
    ).decode()


def verify_password(
    password: str,
    hashed: str
) -> bool:

    try:

        return bcrypt.checkpw(
            password.encode(),
            hashed.encode()
        )

    except Exception:

        return False


def generate_session_token():

    return secrets.token_hex(32)


# ============================================================
# ADMIN SESSION
# ============================================================

def get_admin_session(
    x_admin_token: str = Header(None)
):

    if not x_admin_token:

        return None


    try:

        res = (
            supabase
            .table("admin_sessions")
            .select("*")
            .eq(
                "session_token",
                x_admin_token
            )
            .execute()
        )

    except Exception:

        return None


    if not res.data:

        return None


    session = res.data[0]


    if session.get("expires_at"):

        try:

            expires_at = datetime.fromisoformat(
                session["expires_at"]
                .replace("Z", "+00:00")
            )

            if (
                expires_at <
                datetime.now(timezone.utc)
            ):

                return None

        except Exception:

            return None


    return session


# ============================================================
# PUBLIC / PRIVATE DATA
# ============================================================

def filter_data(
    record: dict,
    is_admin: bool
):

    if is_admin:

        return record


    return {
        key: record[key]
        for key in PUBLIC_FIELDS
        if key in record
    }


def public_view(record: dict):

    return {
        key: record[key]
        for key in PUBLIC_FIELDS
        if key in record
    }


# ============================================================
# PAGINATION
# ============================================================

def normalize_pagination(
    page: int,
    per_page: int
):

    if page < 1:

        page = 1


    if per_page < 1:

        per_page = DEFAULT_PAGE_SIZE


    if per_page > MAX_PAGE_SIZE:

        per_page = MAX_PAGE_SIZE


    start = (
        page - 1
    ) * per_page


    end = (
        start
        + per_page
        - 1
    )


    return page, per_page, start, end


# ============================================================
# EXPERIENCE FILTER
# ============================================================
#
# Accepted values:
#
# 0-2
# 2-5
# 5-10
# 10+
#
# Ranges are handled as:
#
# 0-2   => >= 0 and < 2
# 2-5   => >= 2 and < 5
# 5-10  => >= 5 and < 10
# 10+   => >= 10
#
# This prevents overlap.
#
# ============================================================

VALID_EXPERIENCE_FILTERS = [
    "0-2",
    "2-5",
    "5-10",
    "10+"
]


def apply_experience_filter(
    query,
    experience: Optional[str]
):

    if not experience:

        return query


    experience = (
        experience
        .strip()
        .lower()
    )


    if experience not in VALID_EXPERIENCE_FILTERS:

        raise HTTPException(
            status_code=400,
            detail={
                "message":
                    "Invalid experience filter",

                "allowed":
                    VALID_EXPERIENCE_FILTERS
            }
        )


    if experience == "0-2":

        query = query.gte(
            "experience_years",
            0
        )

        query = query.lt(
            "experience_years",
            2
        )


    elif experience == "2-5":

        query = query.gte(
            "experience_years",
            2
        )

        query = query.lt(
            "experience_years",
            5
        )


    elif experience == "5-10":

        query = query.gte(
            "experience_years",
            5
        )

        query = query.lt(
            "experience_years",
            10
        )


    elif experience == "10+":

        query = query.gte(
            "experience_years",
            10
        )


    return query


# ============================================================
# SORT OPTIONS
# ============================================================

SORT_OPTIONS = {

    "newest": (
        "created_at",
        True
    ),

    "oldest": (
        "created_at",
        False
    ),

    "name_asc": (
        "name",
        False
    ),

    "name_desc": (
        "name",
        True
    ),

    "payment_low": (
        "payment",
        False
    ),

    "payment_high": (
        "payment",
        True
    ),

    "experience_low": (
        "experience_years",
        False
    ),

    "experience_high": (
        "experience_years",
        True
    )
}


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():

    return {

        "status": "success",

        "message":
            "FastAPI + Supabase running",

        "version":
            "2.0.0",

        "routes": [

            "POST /student",

            "POST /tutor",

            "GET /students",

            "GET /tutors",

            "GET /search",

            "GET /cities",

            "GET /tutor/{id}",

            "GET /student/{id}",

            "PUT /student/{id}",

            "PUT /tutor/{id}",

            "POST /admin/create",

            "POST /admin/login",

            # RAZORPAY-ONLY ADDITION
            "POST /payments/create-order",

            "POST /payments/verify",

            "POST /payments/webhook",

            "GET /payments",

            "GET /payments/my",

            "GET /payments/my/profiles",

            "GET /payments/{payment_id}",

            "GET /payments/order/{razorpay_order_id}",

            "GET /payments/razorpay/{razorpay_payment_id}"
        ]
    }


# ============================================================
# CREATE ADMIN
# ============================================================

@app.post("/admin/create")
def create_admin(
    username: str,
    password: str
):

    admin = {

        "id": str(uuid4()),

        "username": username,

        "password_hash":
            hash_password(password)
    }


    try:

        res = (
            supabase
            .table("admins")
            .insert(admin)
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    return {

        "status": "success",

        "message":
            "Admin created",

        "data":
            res.data[0]
            if res.data
            else None
    }


# ============================================================
# CREATE STUDENT
# ============================================================

@app.post("/student")
def create_student(
    data: StudentBase,
    request: Request
):

    now = datetime.utcnow().isoformat()


    record = {

        "id": str(uuid4()),

        "type": "student",

        **data.dict(),

        "status": "active",

        "joined_date": now,

        "created_at": now,

        "updated_at": None,

        "ip_address":
            request.client.host
            if request.client
            else None,

        "user_agent":
            request.headers.get(
                "user-agent",
                "unknown"
            ),

        "source": "website"
    }


    try:

        res = (
            supabase
            .table("students")
            .insert(record)
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    return {

        "status": "success",

        "message":
            "Student created",

        "data":
            res.data[0]
            if res.data
            else record
    }


# ============================================================
# CREATE TUTOR
# ============================================================

@app.post("/tutor")
def create_tutor(
    data: TutorBase,
    request: Request
):

    now = datetime.utcnow().isoformat()


    record = {

        "id": str(uuid4()),

        "type": "tutor",

        **data.dict(),

        "status": "active",

        "joined_date": now,

        "created_at": now,

        "updated_at": None,

        "ip_address":
            request.client.host
            if request.client
            else None,

        "user_agent":
            request.headers.get(
                "user-agent",
                "unknown"
            ),

        "source": "website"
    }


    try:

        res = (
            supabase
            .table("tutors")
            .insert(record)
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    return {

        "status": "success",

        "message":
            "Tutor created",

        "data":
            res.data[0]
            if res.data
            else record
    }


# ============================================================
# GET TUTORS
# ============================================================

@app.get("/tutors")
def get_tutors(

    page: int = 1,

    per_page: int = DEFAULT_PAGE_SIZE,

    session=Depends(
        get_admin_session
    )
):

    page, per_page, start, end = (
        normalize_pagination(
            page,
            per_page
        )
    )


    try:

        res = (
            supabase
            .table("tutors")
            .select(
                "*",
                count="exact"
            )
            .eq(
                "status",
                "active"
            )
            .order(
                "created_at",
                desc=True
            )
            .order(
                "id",
                desc=False
            )
            .range(
                start,
                end
            )
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    total = res.count or 0


    total_pages = (
        (total + per_page - 1)
        // per_page
        if total
        else 0
    )


    is_admin = session is not None


    return {

        "status": "success",

        "page": page,

        "per_page": per_page,

        "total": total,

        "total_pages": total_pages,

        "has_next":
            page < total_pages,

        "has_previous":
            page > 1,

        "admin":
            is_admin,

        "data": [
            filter_data(
                record,
                is_admin
            )
            for record in res.data
        ]
    }


# ============================================================
# GET STUDENTS
# ============================================================

@app.get("/students")
def get_students(

    page: int = 1,

    per_page: int = DEFAULT_PAGE_SIZE,

    session=Depends(
        get_admin_session
    )
):

    page, per_page, start, end = (
        normalize_pagination(
            page,
            per_page
        )
    )


    try:

        res = (
            supabase
            .table("students")
            .select(
                "*",
                count="exact"
            )
            .eq(
                "status",
                "active"
            )
            .order(
                "created_at",
                desc=True
            )
            .order(
                "id",
                desc=False
            )
            .range(
                start,
                end
            )
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    total = res.count or 0


    total_pages = (
        (total + per_page - 1)
        // per_page
        if total
        else 0
    )


    is_admin = session is not None


    return {

        "status": "success",

        "page": page,

        "per_page": per_page,

        "total": total,

        "total_pages": total_pages,

        "has_next":
            page < total_pages,

        "has_previous":
            page > 1,

        "admin":
            is_admin,

        "data": [
            filter_data(
                record,
                is_admin
            )
            for record in res.data
        ]
    }


# ============================================================
# MAIN SEARCH API
# ============================================================
#
# Examples:
#
# /search?type=tutor
#
# /search?type=tutor&city=Delhi
#
# /search?type=tutor&subject=Mathematics
#
# /search?type=tutor&experience=0-2
#
# /search?type=tutor&experience=2-5
#
# /search?type=tutor&experience=5-10
#
# /search?type=tutor&experience=10+
#
# /search?type=tutor&payment_min=300&payment_max=700
#
# /search?type=tutor&sort=payment_low
#
# /search?type=tutor&sort=experience_high
#
# ============================================================

@app.get("/search")
def search_users(

    # --------------------------------------------------------
    # USER TYPE
    # --------------------------------------------------------

    type: str = "tutor",

    # --------------------------------------------------------
    # MAIN KEYWORD
    # --------------------------------------------------------

    keyword: Optional[str] = None,

    # --------------------------------------------------------
    # MAIN FILTERS
    # --------------------------------------------------------

    city: Optional[str] = None,

    subject: Optional[str] = None,

    course: Optional[str] = None,

    # --------------------------------------------------------
    # EXPERIENCE FILTER
    #
    # 0-2
    # 2-5
    # 5-10
    # 10+
    # --------------------------------------------------------

    experience: Optional[str] = None,

    # --------------------------------------------------------
    # OPTIONAL EXACT EXPERIENCE RANGE
    # --------------------------------------------------------

    experience_min: Optional[float] = None,

    experience_max: Optional[float] = None,

    # --------------------------------------------------------
    # PAYMENT
    # --------------------------------------------------------

    payment_min: Optional[float] = None,

    payment_max: Optional[float] = None,

    # --------------------------------------------------------
    # OTHER FILTERS
    # --------------------------------------------------------

    preferred_mode: Optional[str] = None,

    language: Optional[str] = None,

    country: Optional[str] = None,

    status: str = "active",

    # --------------------------------------------------------
    # SORT
    # --------------------------------------------------------

    sort: str = "newest",

    # --------------------------------------------------------
    # PAGINATION
    # --------------------------------------------------------

    page: int = 1,

    per_page: int = DEFAULT_PAGE_SIZE,

    # --------------------------------------------------------
    # ADMIN
    # --------------------------------------------------------

    session=Depends(
        get_admin_session
    )
):

    # ========================================================
    # VALIDATE TYPE
    # ========================================================

    type = (
        type
        .strip()
        .lower()
    )


    if type not in (
        "student",
        "tutor"
    ):

        raise HTTPException(
            status_code=400,
            detail=
                "type must be student or tutor"
        )


    table = (
        "students"
        if type == "student"
        else "tutors"
    )


    # ========================================================
    # PAGINATION
    # ========================================================

    page, per_page, start, end = (
        normalize_pagination(
            page,
            per_page
        )
    )


    # ========================================================
    # BASE QUERY
    # ========================================================

    qb = (
        supabase
        .table(table)
        .select(
            "*",
            count="exact"
        )
    )


    # ========================================================
    # STATUS
    # ========================================================

    if status:

        qb = qb.eq(
            "status",
            status.strip()
        )


    # ========================================================
    # CITY
    # ========================================================

    if city:

        city = city.strip()

        if city:

            qb = qb.ilike(
                "city",
                f"%{city}%"
            )


    # ========================================================
    # SUBJECT
    # ========================================================

    if subject:

        subject = subject.strip()

        if subject:

            qb = qb.ilike(
                "subject",
                f"%{subject}%"
            )


    # ========================================================
    # COURSE
    # ========================================================

    if course:

        course = course.strip()

        if course:

            qb = qb.ilike(
                "course",
                f"%{course}%"
            )


    # ========================================================
    # COUNTRY
    # ========================================================

    if country:

        country = country.strip()

        if country:

            qb = qb.ilike(
                "country",
                f"%{country}%"
            )


    # ========================================================
    # PREFERRED MODE
    # ========================================================

    if preferred_mode:

        preferred_mode = (
            preferred_mode
            .strip()
        )

        if preferred_mode:

            qb = qb.ilike(
                "preferred_mode",
                f"%{preferred_mode}%"
            )


    # ========================================================
    # LANGUAGE
    # ========================================================

    if language:

        language = language.strip()

        if language:

            qb = qb.ilike(
                "language",
                f"%{language}%"
            )


    # ========================================================
    # EXPERIENCE CATEGORY
    # ========================================================

    if experience:

        qb = apply_experience_filter(
            qb,
            experience
        )


    # ========================================================
    # EXACT EXPERIENCE MIN
    # ========================================================

    if experience_min is not None:

        if experience_min < 0:

            raise HTTPException(
                status_code=400,
                detail=
                    "experience_min cannot be negative"
            )


        qb = qb.gte(
            "experience_years",
            experience_min
        )


    # ========================================================
    # EXACT EXPERIENCE MAX
    # ========================================================

    if experience_max is not None:

        if experience_max < 0:

            raise HTTPException(
                status_code=400,
                detail=
                    "experience_max cannot be negative"
            )


        qb = qb.lte(
            "experience_years",
            experience_max
        )


    # ========================================================
    # PAYMENT MIN
    # ========================================================

    if payment_min is not None:

        if payment_min < 0:

            raise HTTPException(
                status_code=400,
                detail=
                    "payment_min cannot be negative"
            )


        qb = qb.gte(
            "payment",
            payment_min
        )


    # ========================================================
    # PAYMENT MAX
    # ========================================================

    if payment_max is not None:

        if payment_max < 0:

            raise HTTPException(
                status_code=400,
                detail=
                    "payment_max cannot be negative"
            )


        qb = qb.lte(
            "payment",
            payment_max
        )


    # ========================================================
    # CHECK RANGE VALIDITY
    # ========================================================

    if (
        experience_min is not None
        and
        experience_max is not None
        and
        experience_min > experience_max
    ):

        raise HTTPException(
            status_code=400,
            detail=
                "experience_min cannot be greater than experience_max"
        )


    if (
        payment_min is not None
        and
        payment_max is not None
        and
        payment_min > payment_max
    ):

        raise HTTPException(
            status_code=400,
            detail=
                "payment_min cannot be greater than payment_max"
        )


    # ========================================================
    # KEYWORD SEARCH
    # ========================================================
    #
    # Searches:
    #
    # name
    # course
    # subject
    # qualification
    # city
    # language
    #
    # ========================================================

    if keyword:

        keyword = keyword.strip()

        if keyword:

            # Prevent breaking PostgREST .or_ syntax
            safe_keyword = (
                keyword
                .replace(",", " ")
                .replace("(", " ")
                .replace(")", " ")
            )


            qb = qb.or_(
                f"name.ilike.%{safe_keyword}%,"
                f"course.ilike.%{safe_keyword}%,"
                f"subject.ilike.%{safe_keyword}%,"
                f"qualification.ilike.%{safe_keyword}%,"
                f"city.ilike.%{safe_keyword}%,"
                f"language.ilike.%{safe_keyword}%"
            )


    # ========================================================
    # SORT VALIDATION
    # ========================================================

    if sort not in SORT_OPTIONS:

        raise HTTPException(
            status_code=400,

            detail={
                "message":
                    "Invalid sort option",

                "allowed":
                    list(
                        SORT_OPTIONS.keys()
                    )
            }
        )


    sort_column, descending = (
        SORT_OPTIONS[sort]
    )


    # ========================================================
    # SORT
    # ========================================================
    #
    # SECONDARY ID SORT IS IMPORTANT.
    #
    # It prevents records with the same payment,
    # experience, etc. from randomly moving between pages.
    #
    # ========================================================

    qb = qb.order(
        sort_column,
        desc=descending,
        nullsfirst=False
    )


    qb = qb.order(
        "id",
        desc=False
    )


    # ========================================================
    # EXECUTE
    # ========================================================

    try:

        res = (
            qb
            .range(
                start,
                end
            )
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail={
                "message":
                    "Search failed",

                "error":
                    str(e)
            }
        )


    # ========================================================
    # TOTAL
    # ========================================================

    total = res.count or 0


    total_pages = (
        (total + per_page - 1)
        // per_page
        if total > 0
        else 0
    )


    # ========================================================
    # ADMIN
    # ========================================================

    is_admin = session is not None


    # ========================================================
    # FILTER OUTPUT
    # ========================================================

    data = [

        filter_data(
            record,
            is_admin
        )

        for record in res.data
    ]


    # ========================================================
    # RESPONSE
    # ========================================================

    return {

        "status": "success",

        "type": type,

        "filters": {

            "keyword": keyword,

            "city": city,

            "subject": subject,

            "course": course,

            "experience": experience,

            "experience_min":
                experience_min,

            "experience_max":
                experience_max,

            "payment_min":
                payment_min,

            "payment_max":
                payment_max,

            "preferred_mode":
                preferred_mode,

            "language":
                language,

            "country":
                country,

            "status":
                status,

            "sort":
                sort
        },

        "pagination": {

            "page": page,

            "per_page": per_page,

            "total": total,

            "total_pages":
                total_pages,

            "has_next":
                page < total_pages,

            "has_previous":
                page > 1
        },

        "admin":
            is_admin,

        "data":
            data
    }


# ============================================================
# GET UNIQUE CITIES
# ============================================================

@app.get("/cities")
def get_unique_cities():

    try:

        student_res = (
            supabase
            .table("students")
            .select("city")
            .eq("status", "active")
            .execute()
        )


        tutor_res = (
            supabase
            .table("tutors")
            .select("city")
            .eq("status", "active")
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    cities = set()


    for record in student_res.data:

        value = record.get("city")

        if value:

            cities.add(
                value.strip()
            )


    for record in tutor_res.data:

        value = record.get("city")

        if value:

            cities.add(
                value.strip()
            )


    city_list = sorted(
        cities,
        key=lambda x: x.lower()
    )


    return {

        "status": "success",

        "count":
            len(city_list),

        "cities":
            city_list
    }


# ============================================================
# GET TUTOR BY ID
# ============================================================

@app.get("/tutor/{user_id}")
def get_tutor_by_id(

    user_id: str,

    session=Depends(
        get_admin_session
    )
):

    try:

        res = (
            supabase
            .table("tutors")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=404,
            detail="Tutor not found"
        )


    if not res.data:

        raise HTTPException(
            status_code=404,
            detail="Tutor not found"
        )


    is_admin = session is not None


    return filter_data(
        res.data,
        is_admin
    )


# ============================================================
# GET STUDENT BY ID
# ============================================================

@app.get("/student/{user_id}")
def get_student_by_id(

    user_id: str,

    session=Depends(
        get_admin_session
    )
):

    try:

        res = (
            supabase
            .table("students")
            .select("*")
            .eq("id", user_id)
            .single()
            .execute()
        )

    except Exception:

        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )


    if not res.data:

        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )


    is_admin = session is not None


    return filter_data(
        res.data,
        is_admin
    )


# ============================================================
# UPDATE STUDENT
# ============================================================

@app.put("/student/{user_id}")
def update_student(

    user_id: str,

    data: UpdateUser
):

    updates = data.dict(
        exclude_unset=True
    )


    if not updates:

        raise HTTPException(
            status_code=400,
            detail="No fields to update"
        )


    updates["updated_at"] = (
        datetime.utcnow()
        .isoformat()
    )


    try:

        res = (
            supabase
            .table("students")
            .update(updates)
            .eq("id", user_id)
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    if not res.data:

        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )


    return {

        "status": "success",

        "message":
            "Student updated",

        "data":
            res.data[0]
    }


# ============================================================
# UPDATE TUTOR
# ============================================================

@app.put("/tutor/{user_id}")
def update_tutor(

    user_id: str,

    data: UpdateUser
):

    updates = data.dict(
        exclude_unset=True
    )


    if not updates:

        raise HTTPException(
            status_code=400,
            detail="No fields to update"
        )


    updates["updated_at"] = (
        datetime.utcnow()
        .isoformat()
    )


    try:

        res = (
            supabase
            .table("tutors")
            .update(updates)
            .eq("id", user_id)
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    if not res.data:

        raise HTTPException(
            status_code=404,
            detail="Tutor not found"
        )


    return {

        "status": "success",

        "message":
            "Tutor updated",

        "data":
            res.data[0]
    }


# ============================================================
# ADMIN LOGIN
# ============================================================

@app.post("/admin/login")
def admin_login(
    data: AdminLogin
):

    try:

        res = (
            supabase
            .table("admins")
            .select("*")
            .eq(
                "username",
                data.username
            )
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    if not res.data:

        raise HTTPException(
            status_code=401,
            detail=
                "Invalid username or password"
        )


    admin = res.data[0]


    if not verify_password(
        data.password,
        admin["password_hash"]
    ):

        raise HTTPException(
            status_code=401,
            detail=
                "Invalid username or password"
        )


    token = generate_session_token()


    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(hours=8)
    ).isoformat()


    session = {

        "id":
            str(uuid4()),

        "admin_id":
            admin["id"],

        "session_token":
            token,

        "expires_at":
            expires_at
    }


    try:

        supabase \
            .table("admin_sessions") \
            .insert(session) \
            .execute()

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    return {

        "status": "success",

        "message":
            "Login successful",

        "session_token":
            token,

        "expires_at":
            expires_at
    }


# ============================================================
# EXPERIENCE FILTER OPTIONS
# ============================================================
#
# Frontend can call:
#
# GET /experience-options
#
# ============================================================

@app.get("/experience-options")
def get_experience_options():

    return {

        "status": "success",

        "experience": [

            {
                "value": "0-2",
                "label": "0 - 2 years"
            },

            {
                "value": "2-5",
                "label": "2 - 5 years"
            },

            {
                "value": "5-10",
                "label": "5 - 10 years"
            },

            {
                "value": "10+",
                "label": "10+ years"
            }
        ]
    }


# ============================================================
# SORT OPTIONS
# ============================================================

@app.get("/sort-options")
def get_sort_options():

    return {

        "status": "success",

        "sort": [

            {
                "value": "newest",
                "label": "Newest"
            },

            {
                "value": "oldest",
                "label": "Oldest"
            },

            {
                "value": "experience_high",
                "label":
                    "Experience: High to Low"
            },

            {
                "value": "experience_low",
                "label":
                    "Experience: Low to High"
            },

            {
                "value": "payment_low",
                "label":
                    "Payment: Low to High"
            },

            {
                "value": "payment_high",
                "label":
                    "Payment: High to Low"
            },

            {
                "value": "name_asc",
                "label":
                    "Name: A to Z"
            },

            {
                "value": "name_desc",
                "label":
                    "Name: Z to A"
            }
        ]
    }


# ============================================================
# RAZORPAY PAYMENTS
# ============================================================
#
# RAZORPAY-ONLY ADDITION
#
# All payment records are stored in the "payments" table.
#
# Payment status flow:
#
#   created  ->  authorized  ->  captured
#                          \->  failed
#   captured ->  refunded
#
# ============================================================


# ============================================================
# CREATE ORDER
# ============================================================
#
# POST /payments/create-order
#
# Creates a Razorpay order and stores a "created" payment
# record in the payments table.
#
# Request body:
#
# {
#   "email": "abc@gmail.com",
#   "mobile_no": "6388574919",
#   "amount": 999,                 // RUPEES (converted to paise internally)
#   "currency": "INR",
#   "user_type": "student",        // "student" or "tutor"
#   "user_ids": "uuid1,uuid2"      // comma-separated list of user ids
# }
#
# Response:
#
# {
#   "status": "success",
#   "payment_id": "LOCAL-UUID",
#   "razorpay_order_id": "order_xxxxxxxxx",
#   "amount": 99900,               // PAISE
#   "currency": "INR",
#   "key_id": "rzp_test_xxxxx",
#   "status": "created"
# }
#
# ============================================================

@app.post("/payments/create-order")
def create_payment_order(
    data: CreateOrderRequest
):

    require_razorpay()


    if data.amount <= 0:

        raise HTTPException(
            status_code=400,
            detail="amount must be greater than 0"
        )


    # Convert rupees to paise (Razorpay uses the smallest unit).
    amount_paise = int(
        round(
            data.amount * 100
        )
    )


    # Parse comma-separated user_ids into a list.
    user_ids_list = [
        uid.strip()
        for uid in data.user_ids.split(",")
        if uid.strip()
    ]


    order_payload = {

        "amount": amount_paise,

        "currency": data.currency,

        "receipt": f"rcpt_{uuid4().hex[:12]}",

        "notes": {
            "email": data.email,
            "mobile_no": data.mobile_no,
            "user_type": data.user_type,
            "user_ids": user_ids_list
        }
    }


    try:

        order = razorpay_client.order.create(
            order_payload
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail={
                "message":
                    "Failed to create Razorpay order",

                "error":
                    str(e)
            }
        )


    razorpay_order_id = order.get("id")


    now = datetime.utcnow().isoformat()


    record = {

        "id": str(uuid4()),

        "email":
            data.email,

        "mobile_no":
            data.mobile_no,

        "amount":
            data.amount,

        "amount_paise":
            amount_paise,

        "currency":
            data.currency,

        "status":
            "created",

        "user_type":
            data.user_type,

        "user_ids":
            user_ids_list,

        "razorpay_order_id":
            razorpay_order_id,

        "razorpay_payment_id":
            None,

        "razorpay_signature":
            None,

        "created_at":
            now,

        "paid_at":
            None
    }


    try:

        res = (
            supabase
            .table("payments")
            .insert(record)
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail={
                "message":
                    "Failed to store payment order",

                "error":
                    str(e)
            }
        )


    return {

        "status": "success",

        "payment_id":
            record["id"],

        "razorpay_order_id":
            razorpay_order_id,

        "amount":
            amount_paise,

        "currency":
            data.currency,

        "key_id":
            RAZORPAY_KEY_ID,

        "status":
            "created"
    }


# ============================================================
# VERIFY PAYMENT
# ============================================================
#
# POST /payments/verify
#
# Verifies the Razorpay payment signature and marks the
# payment as "paid".
#
# This endpoint is IDEMPOTENT: if the same
# razorpay_payment_id is verified again, the existing
# payment record is returned instead of creating a
# duplicate.
#
# Request body:
#
# {
#   "razorpay_payment_id": "pay_xxxxx",
#   "razorpay_order_id": "order_xxxxx",
#   "razorpay_signature": "xxxxx"
# }
#
# Response (200):
#
# {
#   "status": "success",
#   "message": "Payment verified",
#   "already_verified": false,
#   "payment": {
#     "id": "local-payment-uuid",
#     "email": "abc@gmail.com",
#     "mobile_no": "6388574919",
#     "amount": 999,
#     "currency": "INR",
#     "status": "paid",
#     "user_type": "student",
#     "user_ids": [
#       "abf9699e-8813-439f-93e2-e3c9ac2bde90",
#       "fdee704f-37eb-42d8-a334-4eed8a0f9101"
#     ],
#     "razorpay_order_id": "order_xxxxx",
#     "razorpay_payment_id": "pay_xxxxx",
#     "razorpay_signature": "xxxxx",
#     "created_at": "2026-08-27T16:47:00+00:00",
#     "paid_at": "2026-08-27T16:48:12+00:00"
#   }
# }
#
# ============================================================

@app.post("/payments/verify")
def verify_payment(
    data: VerifyPaymentRequest
):

    require_razorpay()


    # --------------------------------------------------------
    # DUPLICATE / REPEATED VERIFICATION CHECK
    # --------------------------------------------------------
    #
    # If a payment with this razorpay_payment_id already
    # exists and is already paid, return it instead of
    # re-verifying. This prevents double counting.
    #
    # --------------------------------------------------------

    try:

        existing = (
            supabase
            .table("payments")
            .select("*")
            .eq(
                "razorpay_payment_id",
                data.razorpay_payment_id
            )
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    if existing.data:

        existing_record = existing.data[0]

        if existing_record.get("status") == "paid":

            return {

                "status": "success",

                "message":
                    "Payment already verified",

                "already_verified":
                    True,

                "payment":
                    existing_record
            }


    # --------------------------------------------------------
    # VERIFY SIGNATURE
    # --------------------------------------------------------

    expected_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        (
            data.razorpay_order_id
            + "|"
            + data.razorpay_payment_id
        ).encode(),
        hashlib.sha256
    ).hexdigest()


    if not hmac.compare_digest(
        expected_signature,
        data.razorpay_signature
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid payment signature"
        )


    # --------------------------------------------------------
    # FETCH PAYMENT FROM RAZORPAY (optional sanity check)
    # --------------------------------------------------------

    try:

        razorpay_payment = razorpay_client.payment.fetch(
            data.razorpay_payment_id
        )

    except Exception:

        razorpay_payment = None


    razorpay_status = (
        razorpay_payment.get("status")
        if razorpay_payment
        else None
    )


    # Map Razorpay status to our status.
    # Only "captured" is treated as paid.
    if razorpay_status == "captured":

        new_status = "paid"

    elif razorpay_status in (
        "authorized",
        "failed",
        "refunded"
    ):

        new_status = razorpay_status

    else:

        new_status = "paid"


    now = datetime.utcnow().isoformat()


    # --------------------------------------------------------
    # UPDATE EXISTING ORDER RECORD (by razorpay_order_id)
    # --------------------------------------------------------

    updates = {

        "razorpay_payment_id":
            data.razorpay_payment_id,

        "razorpay_signature":
            data.razorpay_signature,

        "status":
            new_status,

        "paid_at":
            now
    }


    try:

        res = (
            supabase
            .table("payments")
            .update(updates)
            .eq(
                "razorpay_order_id",
                data.razorpay_order_id
            )
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    # If no order record matched, insert a new payment record.
    if not res.data:

        record = {

            "id": str(uuid4()),

            "email":
                None,

            "mobile_no":
                None,

            "amount":
                None,

            "amount_paise":
                None,

            "currency":
                "INR",

            "status":
                new_status,

            "user_type":
                None,

            "user_ids":
                [],

            "razorpay_order_id":
                data.razorpay_order_id,

            "razorpay_payment_id":
                data.razorpay_payment_id,

            "razorpay_signature":
                data.razorpay_signature,

            "created_at":
                now,

            "paid_at":
                now
        }

        try:

            ins = (
                supabase
                .table("payments")
                .insert(record)
                .execute()
            )

            payment_record = (
                ins.data[0]
                if ins.data
                else record
            )

        except Exception as e:

            raise HTTPException(
                status_code=500,
                detail=str(e)
            )

    else:

        payment_record = res.data[0]


    return {

        "status": "success",

        "message":
            "Payment verified",

        "already_verified":
            False,

        "payment":
            payment_record
    }


# ============================================================
# RAZORPAY WEBHOOK
# ============================================================
#
# POST /payments/webhook
#
# Razorpay sends webhook events to this URL. The signature
# is verified using RAZORPAY_WEBHOOK_SECRET.
#
# Supported events:
#
#   payment.captured
#   payment.authorized
#   payment.failed
#   payment.refunded
#
# ============================================================

@app.post("/payments/webhook")
async def razorpay_webhook(
    request: Request
):

    require_razorpay()


    if not RAZORPAY_WEBHOOK_SECRET:

        raise HTTPException(
            status_code=500,
            detail="RAZORPAY_WEBHOOK_SECRET is not configured"
        )


    payload = await request.body()

    signature = request.headers.get(
        "X-Razorpay-Signature"
    )


    if not signature:

        raise HTTPException(
            status_code=400,
            detail="Missing X-Razorpay-Signature header"
        )


    # --------------------------------------------------------
    # VERIFY WEBHOOK SIGNATURE
    # --------------------------------------------------------

    expected = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()


    if not hmac.compare_digest(
        expected,
        signature
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid webhook signature"
        )


    # --------------------------------------------------------
    # PARSE EVENT
    # --------------------------------------------------------

    try:

        event = json.loads(payload)

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid JSON payload"
        )


    event_type = event.get("event")

    payment_entity = (
        event
        .get("payload", {})
        .get("payment", {})
        .get("entity", {})
    )


    razorpay_payment_id = (
        payment_entity.get("id")
    )

    razorpay_order_id = (
        payment_entity.get("order_id")
    )

    razorpay_status = (
        payment_entity.get("status")
    )


    # Map Razorpay status to our status.
    # Only "captured" is treated as paid.
    if razorpay_status == "captured":

        new_status = "paid"

    elif razorpay_status in (
        "authorized",
        "failed",
        "refunded"
    ):

        new_status = razorpay_status

    else:

        new_status = razorpay_status


    now = datetime.utcnow().isoformat()


    updates = {

        "status":
            new_status,

        "paid_at":
            now
    }


    if razorpay_payment_id:

        updates["razorpay_payment_id"] = (
            razorpay_payment_id
        )


    # --------------------------------------------------------
    # UPDATE PAYMENT RECORD
    # --------------------------------------------------------

    updated = False

    try:

        if razorpay_payment_id:

            res = (
                supabase
                .table("payments")
                .update(updates)
                .eq(
                    "razorpay_payment_id",
                    razorpay_payment_id
                )
                .execute()
            )

            if res.data:

                updated = True


        if not updated and razorpay_order_id:

            res = (
                supabase
                .table("payments")
                .update(updates)
                .eq(
                    "razorpay_order_id",
                    razorpay_order_id
                )
                .execute()
            )

            if res.data:

                updated = True

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    # Always return 200 so Razorpay does not retry forever.
    return {

        "status": "success",

        "event":
            event_type,

        "updated":
            updated
    }


# ============================================================
# LIST PAYMENTS
# ============================================================
#
# GET /payments
#
# Admin only. Pass the admin session token in the
# X-Admin-Token header.
#
# Query params:
#
#   page        (default 1)
#   per_page    (default 18, max 100)
#   status      (optional: created, paid, authorized, failed, refunded)
#   user_type   (optional: student, tutor)
#   user_id     (optional: a single user id inside user_ids)
#
# ============================================================

@app.get("/payments")
def list_payments(

    page: int = 1,

    per_page: int = DEFAULT_PAGE_SIZE,

    status: Optional[str] = None,

    user_type: Optional[str] = None,

    user_id: Optional[str] = None,

    session=Depends(
        get_admin_session
    )
):

    if session is None:

        raise HTTPException(
            status_code=401,
            detail="Admin authentication required"
        )


    page, per_page, start, end = (
        normalize_pagination(
            page,
            per_page
        )
    )


    qb = (
        supabase
        .table("payments")
        .select(
            "*",
            count="exact"
        )
    )


    if status:

        qb = qb.eq(
            "status",
            status.strip()
        )


    if user_type:

        qb = qb.eq(
            "user_type",
            user_type.strip()
        )


    if user_id:

        # user_ids is a jsonb array; use PostgREST contains filter.
        qb = qb.contains(
            "user_ids",
            [user_id]
        )


    qb = qb.order(
        "created_at",
        desc=True
    )


    try:

        res = (
            qb
            .range(
                start,
                end
            )
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    total = res.count or 0


    total_pages = (
        (total + per_page - 1)
        // per_page
        if total > 0
        else 0
    )


    return {

        "status": "success",

        "pagination": {

            "page": page,

            "per_page": per_page,

            "total": total,

            "total_pages":
                total_pages,

            "has_next":
                page < total_pages,

            "has_previous":
                page > 1
        },

        "data":
            res.data
    }


# ============================================================
# GET MY PAYMENTS (PUBLIC)
# ============================================================
#
# GET /payments/my?email=...&mobile_no=...
#
# Public endpoint used by the "My Purchased Leads" feature.
# Returns all PAID payments that match the given email AND
# mobile_no (the logged-in user's credentials).
#
# NOTE: Must be defined BEFORE /payments/{payment_id} so
# FastAPI does not treat "my" as a payment id.
#
# ============================================================

@app.get("/payments/my")
def get_my_payments(
    email: str,
    mobile_no: str
):

    email = email.strip().lower()
    mobile_no = mobile_no.strip()

    try:

        res = (
            supabase
            .table("payments")
            .select("*")
            .ilike("email", email)
            .eq("mobile_no", mobile_no)
            .eq("status", "paid")
            .order("paid_at", desc=True)
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    return {

        "status": "success",

        "count":
            len(res.data),

        "data":
            res.data
    }


# ============================================================
# GET MY PURCHASED PROFILES (PUBLIC)
# ============================================================
#
# GET /payments/my/profiles?email=...&mobile_no=...
#
# Public endpoint used by the "My Purchased Leads" feature.
#
# 1. Finds all PAID payments matching the given email AND
#    mobile_no (the logged-in user's credentials).
# 2. Collects the user_ids from those payments.
# 3. Resolves each id against the tutors and students
#    tables.
# 4. Returns the FULL profile records (including email and
#    mobile_no) because the user paid for them.
#
# NOTE: Must be defined BEFORE /payments/{payment_id} so
# FastAPI does not treat "my" as a payment id.
#
# ============================================================

@app.get("/payments/my/profiles")
def get_my_purchased_profiles(
    email: str,
    mobile_no: str
):

    email = email.strip().lower()
    mobile_no = mobile_no.strip()

    # --------------------------------------------------------
    # 1. FIND PAID PAYMENTS FOR THIS BUYER
    # --------------------------------------------------------

    try:

        res = (
            supabase
            .table("payments")
            .select("*")
            .ilike("email", email)
            .eq("mobile_no", mobile_no)
            .eq("status", "paid")
            .order("paid_at", desc=True)
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    payments = res.data or []

    # --------------------------------------------------------
    # 2. COLLECT ALL USER IDS
    # --------------------------------------------------------

    ids = []

    for payment in payments:

        for uid in parse_user_ids(
            payment.get("user_ids")
        ):

            if uid not in ids:

                ids.append(uid)

    if not ids:

        return {

            "status": "success",

            "count": 0,

            "data": []
        }

    # --------------------------------------------------------
    # 3. RESOLVE PROFILES (tutors + students)
    # --------------------------------------------------------

    profiles_by_id = {}

    try:

        tutor_res = (
            supabase
            .table("tutors")
            .select("*")
            .in_("id", ids)
            .execute()
        )

        for record in (
            tutor_res.data
            or []
        ):

            profiles_by_id[record["id"]] = {
                "profile": record,
                "type": "tutor"
            }

    except Exception:

        pass

    try:

        student_res = (
            supabase
            .table("students")
            .select("*")
            .in_("id", ids)
            .execute()
        )

        for record in (
            student_res.data
            or []
        ):

            profiles_by_id[record["id"]] = {
                "profile": record,
                "type": "student"
            }

    except Exception:

        pass

    # --------------------------------------------------------
    # 4. BUILD OUTPUT (profile + payment metadata)
    # --------------------------------------------------------

    result = []

    for payment in payments:

        for uid in parse_user_ids(
            payment.get("user_ids")
        ):

            entry = profiles_by_id.get(uid)

            if not entry:

                continue

            result.append({

                "profile":
                    entry["profile"],

                "type":
                    entry["type"],

                "payment": {

                    "id":
                        payment.get("id"),

                    "amount":
                        payment.get("amount"),

                    "amount_paise":
                        payment.get("amount_paise"),

                    "currency":
                        payment.get("currency"),

                    "status":
                        payment.get("status"),

                    "paid_at":
                        payment.get("paid_at"),

                    "created_at":
                        payment.get("created_at"),

                    "razorpay_order_id":
                        payment.get("razorpay_order_id"),

                    "razorpay_payment_id":
                        payment.get("razorpay_payment_id")
                }
            })

    return {

        "status": "success",

        "count":
            len(result),

        "data":
            result
    }


# ============================================================
# PARSE USER IDS
# ============================================================
#
# user_ids is stored as a jsonb array, but some database
# viewers / older rows may expose it as a JSON string.
# This helper accepts both forms.
#
# ============================================================

def parse_user_ids(value):

    if isinstance(value, list):

        return value

    if isinstance(value, str):

        try:

            parsed = json.loads(value)

            if isinstance(parsed, list):

                return parsed

        except Exception:

            pass

        return [
            uid.strip()
            for uid in value.split(",")
            if uid.strip()
        ]

    return []


# ============================================================
# GET PAYMENT BY INTERNAL ID
# ============================================================
#
# GET /payments/{payment_id}
#
# Returns a single payment by its internal UUID.
#
# ============================================================

@app.get("/payments/{payment_id}")
def get_payment_by_id(
    payment_id: str
):

    try:

        res = (
            supabase
            .table("payments")
            .select("*")
            .eq("id", payment_id)
            .single()
            .execute()
        )

    except Exception:

        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )


    if not res.data:

        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )


    return {

        "status": "success",

        "payment":
            res.data
    }


# ============================================================
# GET PAYMENT BY RAZORPAY ORDER ID
# ============================================================
#
# GET /payments/order/{razorpay_order_id}
#
# Returns the payment record for a Razorpay order id
# (e.g. order_xxxxxxxx).
#
# ============================================================

@app.get("/payments/order/{razorpay_order_id}")
def get_payment_by_order_id(
    razorpay_order_id: str
):

    try:

        res = (
            supabase
            .table("payments")
            .select("*")
            .eq(
                "razorpay_order_id",
                razorpay_order_id
            )
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    if not res.data:

        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )


    return {

        "status": "success",

        "payment":
            res.data[0]
    }


# ============================================================
# GET PAYMENT BY RAZORPAY PAYMENT ID
# ============================================================
#
# GET /payments/razorpay/{razorpay_payment_id}
#
# Returns the payment record for a Razorpay payment id
# (e.g. pay_xxxxxxxx).
#
# ============================================================

@app.get("/payments/razorpay/{razorpay_payment_id}")
def get_payment_by_razorpay_payment_id(
    razorpay_payment_id: str
):

    try:

        res = (
            supabase
            .table("payments")
            .select("*")
            .eq(
                "razorpay_payment_id",
                razorpay_payment_id
            )
            .execute()
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


    if not res.data:

        raise HTTPException(
            status_code=404,
            detail="Payment not found"
        )


    return {

        "status": "success",

        "payment":
            res.data[0]
    }


# ============================================================
# RUN
# ============================================================

# if __name__ == "__main__":

#     import uvicorn

#     uvicorn.run(
#         "main:app",
#         host="0.0.0.0",
#         port=8000,
#         reload=True
#     )