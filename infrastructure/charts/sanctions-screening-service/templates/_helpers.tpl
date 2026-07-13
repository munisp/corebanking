{{- define "sanctions-screening-service.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- define "sanctions-screening-service.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}
{{- define "sanctions-screening-service.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- define "sanctions-screening-service.labels" -}}
helm.sh/chart: {{ include "sanctions-screening-service.chart" . }}
{{ include "sanctions-screening-service.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
{{- define "sanctions-screening-service.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sanctions-screening-service.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
{{- define "sanctions-screening-service.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "sanctions-screening-service.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
