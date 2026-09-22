from datetime import datetime, timedelta, timezone
import os

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Participant

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60)
)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="auth/login"
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


def authenticate_user(db, username, password):

    user = db.query(Participant).filter(
        Participant.username == username
    ).first()

    if not user:
        return None

    if not pwd_context.verify(password, user.password_hash):
        return None

    return user


def create_access_token(data):

    payload = data.copy()

    payload["exp"] = (
        datetime.now(timezone.utc)
        + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


from fastapi import Request

@router.post("/login")
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    username = None
    password = None

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            username = body.get("username") or body.get("email")
            password = body.get("password")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            username = form.get("username")
            password = form.get("password")
        except Exception:
            pass

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required."
        )

    # Resolve email alias to canonical actor if needed
    clean_user = username.strip().lower()
    if clean_user in ["manufacturer@demo.pharmachain.test", "manufacturer@pharmachain.test"]:
        lookup_name = "manu_a"
    elif clean_user in ["distributor@demo.pharmachain.test", "distributor@pharmachain.test"]:
        lookup_name = "dist_a"
    elif clean_user in ["pharmacy@demo.pharmachain.test", "hospital@pharmachain.test", "pharmacy@pharmachain.test"]:
        lookup_name = "hosp_a"
    elif "@" in clean_user:
        lookup_name = clean_user.split("@")[0]
    else:
        lookup_name = clean_user

    user = authenticate_user(db, lookup_name, password)

    if not user:
        # Fallback check direct username
        user = authenticate_user(db, clean_user, password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials."
        )

    token = create_access_token(
        {
            "sub": user.username,
            "role": user.role
        }
    )

    return {
        "access_token": token,
        "token": token,
        "token_type": "bearer",
        "user": {
            "name": user.name,
            "username": user.username,
            "email": f"{user.username}@pharmachain.test",
            "role": "pharmacy" if user.role == "hospital" else user.role
        }
    }



def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate token."
    )

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        username = payload.get("sub")

        if username is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(Participant).filter(
        Participant.username == username
    ).first()

    if user is None:
        raise credentials_exception

    return user