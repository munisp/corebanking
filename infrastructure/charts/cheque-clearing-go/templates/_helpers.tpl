{{- define "cheque-clearing-go.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- define "cheque-clearing-go.fullname" -}}
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
{{- define "cheque-clearing-go.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- define "cheque-clearing-go.labels" -}}
helm.sh/chart: {{ include "cheque-clearing-go.chart" . }}
{{ include "cheque-clearing-go.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
{{- define "cheque-clearing-go.selectorLabels" -}}
app.kubernetes.io/name: {{ include "cheque-clearing-go.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
{{- define "cheque-clearing-go.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "cheque-clearing-go.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
