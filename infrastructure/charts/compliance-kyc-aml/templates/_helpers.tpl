{{- define "compliance-kyc-aml.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "compliance-kyc-aml.fullname" -}}
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

{{- define "compliance-kyc-aml.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "compliance-kyc-aml.labels" -}}
helm.sh/chart: {{ include "compliance-kyc-aml.chart" . }}
{{ include "compliance-kyc-aml.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "compliance-kyc-aml.selectorLabels" -}}
app.kubernetes.io/name: {{ include "compliance-kyc-aml.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "compliance-kyc-aml.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "compliance-kyc-aml.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
