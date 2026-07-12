"""Unit and integration tests for Business Service."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from database import get_session
from models import Base
from utils import ValidationError, BusinessNotFoundError


# Setup test database
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create test database."""
    Base.metadata.create_all(bind=engine)
    yield TestingSessionLocal()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    """Create test client."""
    def override_get_db():
        yield db
    
    app.dependency_overrides[get_session] = override_get_db
    return TestClient(app)


class TestHealthEndpoints:
    """Test health and system endpoints."""
    
    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Business Service"
    
    def test_readiness_check(self, client):
        """Test readiness check endpoint."""
        response = client.get("/api/v1/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"


class TestBusinessEndpoints:
    """Test business endpoints."""
    
    @pytest.fixture
    def headers(self):
        """Create required headers."""
        return {
            "x-tenant-id": "test-tenant",
            "x-keycloak-id": "test-user-id",
            "x-keycloak-realm": "54link-dev",
        }
    
    def test_create_business(self, client, headers):
        """Test creating a business."""
        payload = {
            "name": "Test Company",
            "registration_number": "RC123456",
            "business_type": "limited_company",
            "industry_code": "6201",
            "headquarters_address": "123 Test St",
            "headquarters_location": "Lagos, Nigeria",
            "website_url": "https://test.com",
            "phone_number": "+234801234567",
            "email_address": "info@test.com",
        }
        
        response = client.post("/api/v1/business", json=payload, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Company"
        assert data["registration_number"] == "RC123456"
        assert data["verification_status"] == "unverified"
        assert data["compliance_status"] == "pending_review"
    
    def test_get_business(self, client, headers):
        """Test getting a business."""
        # First create a business
        payload = {
            "name": "Test Company",
            "registration_number": "RC123456",
            "business_type": "limited_company",
        }
        
        create_response = client.post("/api/v1/business", json=payload, headers=headers)
        business_id = create_response.json()["id"]
        
        # Then get it
        response = client.get(f"/api/v1/business/{business_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == business_id
        assert data["name"] == "Test Company"
    
    def test_list_businesses(self, client, headers):
        """Test listing businesses."""
        response = client.get("/api/v1/business/all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "businesses" in data
        assert "total" in data


class TestMissingHeaders:
    """Test required headers validation."""
    
    def test_missing_tenant_id(self, client):
        """Test missing x-tenant-id header."""
        headers = {
            "x-keycloak-id": "test-user",
            "x-keycloak-realm": "54link-dev",
        }
        response = client.post(
            "/api/v1/business",
            json={"name": "Test"},
            headers=headers
        )
        assert response.status_code == 400
    
    def test_excluded_paths_no_headers(self, client):
        """Test that excluded paths don't require headers."""
        response = client.get("/health")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
