#!/bin/bash

NS="54link-dev"

kubectl apply -f "./manifests/service-account.yaml" -n "$NS"
