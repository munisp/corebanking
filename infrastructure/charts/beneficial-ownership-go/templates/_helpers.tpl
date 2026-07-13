{{- define "beneficial-ownership-go.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- define "beneficial-ownership-go.fullname" -}}
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
{{- define "beneficial-ownership-go.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- define "beneficial-ownership-go.labels" -}}
helm.sh/chart: {{ include "beneficial-ownership-go.chart" . }}
{{ include "beneficial-ownership-go.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
{{- define "beneficial-ownership-go.selectorLabels" -}}
app.kubernetes.io/name: {{ include "beneficial-ownership-go.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
{{- define "beneficial-ownership-go.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "beneficial-ownership-go.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
