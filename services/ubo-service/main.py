"""
UBO (Ultimate Beneficial Owner) Identification Service
Analyzes ownership structures to identify individuals with >25% ownership
"""

import os
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import structlog
import networkx as nx

logger = structlog.get_logger()

app = FastAPI(
    title="54link-dev UBO Identification Service",
    description="Ultimate Beneficial Owner identification and verification",
    version="1.0.0"
)

class OwnershipNode(BaseModel):
    entity_id: str
    entity_name: str
    entity_type: str  # "individual" or "company"
    ownership_percentage: float

class OwnershipStructureRequest(BaseModel):
    company_rc_number: str
    company_name: str
    shareholders: List[OwnershipNode]

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/api/v1/identify-ubo")
async def identify_ubo(request: OwnershipStructureRequest, x_tenant_id: str = Header(...)):
    """
    Identify Ultimate Beneficial Owners (individuals with >25% ownership)
    """
    try:
        # Build ownership graph
        G = nx.DiGraph()
        
        # Add company node
        G.add_node(request.company_rc_number, 
                   name=request.company_name, 
                   type="company")
        
        # Add shareholder nodes and edges
        for shareholder in request.shareholders:
            G.add_node(shareholder.entity_id,
                       name=shareholder.entity_name,
                       type=shareholder.entity_type)
            G.add_edge(shareholder.entity_id, request.company_rc_number,
                       ownership=shareholder.ownership_percentage)
        
        # Identify UBOs (individuals with >25% ownership)
        ubos = []
        for node in G.nodes():
            node_data = G.nodes[node]
            if node_data.get("type") == "individual":
                # Calculate total ownership
                edges = list(G.out_edges(node, data=True))
                if edges:
                    ownership = edges[0][2].get("ownership", 0)
                    if ownership > 25.0:
                        ubos.append({
                            "individual_id": node,
                            "name": node_data["name"],
                            "ownership_percentage": ownership,
                            "ubo_status": "confirmed",
                            "requires_kyc": True
                        })
        
        logger.info(
            "UBO identification completed",
            company=request.company_name,
            ubos_found=len(ubos)
        )
        
        return {
            "company_rc_number": request.company_rc_number,
            "company_name": request.company_name,
            "ubos": ubos,
            "ubo_count": len(ubos),
            "identification_date": datetime.utcnow().isoformat(),
            "requires_ubo_kyc": len(ubos) > 0
        }
        
    except Exception as e:
        logger.error(f"UBO identification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"UBO identification failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8021)))
