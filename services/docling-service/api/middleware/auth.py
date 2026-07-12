from fastapi import Header, HTTPException

async def get_current_tenant(x_tenant_id: str = Header(...)) -> str:
    """Extract tenant ID from request header"""
    if not x_tenant_id:
        raise HTTPException(status_code=401, detail="Tenant ID required")
    return x_tenant_id
