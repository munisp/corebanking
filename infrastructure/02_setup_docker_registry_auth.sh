#!/bin/bash

NS=54link-dev
CONFIG_FILE_LOCATION="./config/docker.json"

kubectl create secret generic credential \
  --from-file=.dockerconfigjson="$CONFIG_FILE_LOCATION" \
  --type=kubernetes.io/dockerconfigjson \
  --namespace "$NS"

kubectl patch serviceaccount 54link-dev -p '{"imagePullSecrets": [{"name": "credential"}]}' -n "$NS"
