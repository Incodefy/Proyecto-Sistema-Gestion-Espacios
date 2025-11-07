#!/usr/bin/env bash
# Sondea /health cada 2s, N veces, y guarda log + resumen

API_URL="${1:-http://localhost:3000/health}"
ITERATIONS="${2:-20}"
SLEEP="${3:-2}"

LOGFILE="health_logs_$(date +%Y%m%d_%H%M%S).log"
OK=0
BAD=0

echo "---- Health monitor run $(date) ----" | tee -a "$LOGFILE"
echo "URL=$API_URL ITERATIONS=$ITERATIONS SLEEP=${SLEEP}s" | tee -a "$LOGFILE"

for i in $(seq 1 "$ITERATIONS"); do
  TS="$(date -Is)"
  RESP="$(curl -s -m 5 "$API_URL")"
  STATUS="$(echo "$RESP" | jq -r '.status // "unknown"')"
  RT="$(echo "$RESP" | jq -r '.responseTime // empty')"

  echo "[$TS] #$i $STATUS ${RT:+rt=$RT} $RESP" | tee -a "$LOGFILE"

  if [ "$STATUS" = "healthy" ]; then
    OK=$((OK+1))
  else
    BAD=$((BAD+1))
  fi

  sleep "$SLEEP"
done

echo "---- Summary ----" | tee -a "$LOGFILE"
echo "Healthy: $OK" | tee -a "$LOGFILE"
echo "Unhealthy/Other: $BAD" | tee -a "$LOGFILE"
echo "Log file: $LOGFILE"
