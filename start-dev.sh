#!/bin/bash
# ============================================================
#  Vibe 개발 서버 스크립트
#
#  Vibe의 "개발 서버 스크립트" 설정에 등록해서 사용합니다.
#  워크트리마다 고유한 포트를 자동 할당하여 병렬 작업이 가능합니다.
#
#  포트 할당 규칙:
#    백엔드:    4000 + offset  (기본 4000)
#    프론트엔드: 5173 + offset  (기본 5173)
#    offset = 워크트리 경로 해시 % 100 (0~99)
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
DIM='\033[2m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── 워크트리 기반 포트 자동 할당 ────────────────────────────
# 워크트리 경로에서 고유 offset을 계산 (0~99)
# 같은 워크트리에서는 항상 같은 포트를 사용
OFFSET=$(echo "$PROJECT_DIR" | cksum | awk '{print $1 % 100}')
BACKEND_PORT=$((4000 + OFFSET))
FRONTEND_PORT=$((5173 + OFFSET))

LOG_DIR="$PROJECT_DIR/.logs"
mkdir -p "$LOG_DIR"
BACKEND_LOG="$LOG_DIR/backend.log"

echo ""
echo -e "${GREEN}[Vibe Dev]${NC} 포트 할당: 백엔드=${YELLOW}$BACKEND_PORT${NC}, 프론트=${YELLOW}$FRONTEND_PORT${NC}"
echo ""

# ─── 자동 셋업 (의존성 없으면 자동 설치) ──────────────────────
needs_setup=false

if [ ! -d "$PROJECT_DIR/lead_researcher/_build" ] || [ ! -d "$PROJECT_DIR/lead_researcher/deps" ]; then
  needs_setup=true
  echo -e "${YELLOW}[셋업]${NC} 백엔드 의존성을 설치합니다..."
  cd "$PROJECT_DIR/lead_researcher"
  mix local.hex --force --if-missing > /dev/null 2>&1
  mix local.rebar --force --if-missing > /dev/null 2>&1
  mix deps.get --quiet
  mix ecto.create 2>/dev/null || true
  mix ecto.migrate 2>/dev/null || true
  cd "$PROJECT_DIR"
  echo -e "${GREEN}[완료]${NC} 백엔드 준비 완료"
fi

if [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
  needs_setup=true
  echo -e "${YELLOW}[셋업]${NC} 프론트엔드 의존성을 설치합니다..."
  cd "$PROJECT_DIR/frontend" && npm install --silent
  cd "$PROJECT_DIR"
  echo -e "${GREEN}[완료]${NC} 프론트엔드 준비 완료"
fi

if [ ! -d "$PROJECT_DIR/crawler/venv" ]; then
  needs_setup=true
  echo -e "${YELLOW}[셋업]${NC} 크롤러 환경을 설정합니다..."
  cd "$PROJECT_DIR/crawler"
  python3 -m venv venv
  "$PROJECT_DIR/crawler/venv/bin/pip" install -r requirements.txt --quiet
  cd "$PROJECT_DIR"
  echo -e "${GREEN}[완료]${NC} 크롤러 준비 완료"
fi

if [ "$needs_setup" = true ]; then
  echo ""
fi

# ─── 크롤러용 Python 가상환경 ────────────────────────────────
if [ -d "$PROJECT_DIR/crawler/venv" ]; then
  export PATH="$PROJECT_DIR/crawler/venv/bin:$PATH"
fi

# ─── 마이그레이션 실행 (매번) ────────────────────────────────
cd "$PROJECT_DIR/lead_researcher"
mix ecto.migrate > /dev/null 2>&1 || true
cd "$PROJECT_DIR"

# ─── 백엔드 시작 ─────────────────────────────────────────────
# 해당 포트에 이미 프로세스가 있으면 정리
pids=$(lsof -iTCP:"$BACKEND_PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [ -n "$pids" ]; then
  echo "$pids" | xargs kill 2>/dev/null || true
  sleep 1
fi

cd "$PROJECT_DIR/lead_researcher"
PORT=$BACKEND_PORT mix phx.server > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# ─── 백엔드 health check (최대 30초) ────────────────────────
echo -e "${DIM}백엔드 시작 대기 중...${NC}"
waited=0
while [ $waited -lt 30 ]; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "${RED}[오류]${NC} 백엔드가 시작되지 않았습니다."
    echo -e "${DIM}$(tail -10 "$BACKEND_LOG")${NC}"
    break
  fi
  if curl -s -o /dev/null "http://localhost:$BACKEND_PORT/api/health" 2>/dev/null; then
    echo -e "${GREEN}[완료]${NC} 백엔드 실행 중 (port $BACKEND_PORT)"
    break
  fi
  sleep 1
  waited=$((waited + 1))
done

if [ $waited -ge 30 ]; then
  echo -e "${YELLOW}[경고]${NC} 백엔드가 30초 안에 응답하지 않았습니다. 계속 진행합니다."
  echo -e "${DIM}로그: $BACKEND_LOG${NC}"
fi

# ─── 종료 시 백엔드도 정리 ───────────────────────────────────
cleanup() {
  kill $BACKEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# ─── 프론트엔드 시작 (foreground — Vibe가 출력을 감지) ───────
echo ""
cd "$PROJECT_DIR/frontend"
exec env VITE_PORT="$FRONTEND_PORT" VITE_API_PORT="$BACKEND_PORT" npx vite --host --port "$FRONTEND_PORT" --strictPort
