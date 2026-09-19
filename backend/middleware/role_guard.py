from fastapi import Depends, HTTPException, status

from api.auth import get_current_user


def require_role(required_role):

    def checker(user=Depends(get_current_user)):

        if user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied."
            )

        return user

    return checker