#!/bin/bash
# 54Bank mTLS Certificate Generation Script
# Usage: ./generate-certs.sh <service-name> [output-dir]

set -euo pipefail

SERVICE_NAME="${1:-all}"
OUTPUT_DIR="${2:-./certs}"
CA_DIR="${OUTPUT_DIR}/ca"
DAYS_CA=365
DAYS_SVC=90

mkdir -p "${CA_DIR}" "${OUTPUT_DIR}/services"

# Generate CA if not exists
if [ ! -f "${CA_DIR}/ca.key" ]; then
    echo "Generating CA key pair..."
    openssl genrsa -out "${CA_DIR}/ca.key" 4096
    openssl req -x509 -new -nodes -key "${CA_DIR}/ca.key" -sha256 \
        -days ${DAYS_CA} -out "${CA_DIR}/ca.crt" \
        -subj "/CN=54Bank Internal CA/O=54Bank/C=NG/ST=Lagos/L=Victoria Island"
    echo "CA certificate generated: ${CA_DIR}/ca.crt"
fi

generate_service_cert() {
    local svc="$1"
    local svc_dir="${OUTPUT_DIR}/services/${svc}"
    mkdir -p "${svc_dir}"
    
    echo "Generating certificate for ${svc}..."
    
    # Generate key
    openssl genrsa -out "${svc_dir}/service.key" 2048
    
    # Generate CSR with SAN
    cat > "${svc_dir}/san.cnf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req

[req_distinguished_name]
CN = ${svc}.54bank.internal

[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${svc}.54bank.internal
DNS.2 = ${svc}.default.svc.cluster.local
DNS.3 = localhost
IP.1 = 127.0.0.1
EOF
    
    openssl req -new -key "${svc_dir}/service.key" \
        -out "${svc_dir}/service.csr" \
        -subj "/CN=${svc}.54bank.internal/O=54Bank/C=NG" \
        -config "${svc_dir}/san.cnf"
    
    # Sign with CA
    openssl x509 -req -in "${svc_dir}/service.csr" \
        -CA "${CA_DIR}/ca.crt" -CAkey "${CA_DIR}/ca.key" \
        -CAcreateserial -out "${svc_dir}/service.crt" \
        -days ${DAYS_SVC} -sha256 \
        -extensions v3_req -extfile "${svc_dir}/san.cnf"
    
    # Cleanup
    rm -f "${svc_dir}/service.csr" "${svc_dir}/san.cnf"
    
    echo "  Certificate: ${svc_dir}/service.crt (expires in ${DAYS_SVC} days)"
}

if [ "${SERVICE_NAME}" = "all" ]; then
    echo "Generating certificates for all services..."
    for svc_dir in ../../services/*/; do
        svc=$(basename "${svc_dir}")
        generate_service_cert "${svc}"
    done
else
    generate_service_cert "${SERVICE_NAME}"
fi

echo ""
echo "Certificate generation complete."
echo "CA cert: ${CA_DIR}/ca.crt"
echo "Service certs: ${OUTPUT_DIR}/services/<service>/service.{crt,key}"
