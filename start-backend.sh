#!/bin/bash
# ============================================================
#  백엔드 전용 실행 스크립트 (Vibe 개발 환경용)
#
#  Vibe Preview가 프론트엔드를 처리하므로,
#  이 스크립트는 백엔드(Phoenix)와 크롤러 환경만 실행합니다.
#
#  종료하려면 Ctrl+C 를 누르세요.
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
NC='\033[0m'

BACKEND_PORT=4000

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/.logs"
mkdir -p "$LOG_DIR"

BACKEND_LOG="$LOG_DIR/backend.log"

# ─── 사전 확인 ───────────────────────────────────────────────
check_requirement() {
  if ! command -v "$1" &>/dev/null; then
    echo ""
    echo -e "  ${RED}[오류]${NC} $2 이(가) 설치되어 있지 않습니다."
    echo -e "  먼저 ${YELLOW}./setup.sh${NC} 를 실행해주세요."
    echo ""
    exit 1
  fi
}

check_requirement "elixir" "Elixir"
check_requirement "python3" "Python 3"

# ─── 포트 충돌 확인 ──────────────────────────────────────────
pids=$(lsof -iTCP:"$BACKEND_PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [ -n "$pids" ]; then
  proc_info=$(lsof -iTCP:"$BACKEND_PORT" -sTCP:LISTEN -P 2>/dev/null | tail -1 || true)
  echo ""
  echo -e "  ${YELLOW}[알림]${NC} 포트 ${YELLOW}$BACKEND_PORT${NC} (백엔드) 이(가) 이미 사용 중입니다."
  echo -e "  ${DIM}  $proc_info${NC}"
  echo ""
  echo -n -e "  기존 프로세스를 종료하고 계속할까요? (Y/n, 5초 후 자동 진행) "
  if read -t 5 -r answer; then
    answer=${answer:-Y}
  else
    answer="Y"
    echo ""
  fi
  if [[ "$answer" =~ ^[Nn]$ ]]; then
    echo -e "  ${RED}중단합니다.${NC}"
    echo ""
    exit 1
  fi
  echo "$pids" | xargs kill 2>/dev/null || true
  sleep 1
  pids=$(lsof -iTCP:"$BACKEND_PORT" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
  echo -e "  ${GREEN}[완료]${NC} 포트 $BACKEND_PORT 정리 완료."
fi

# ─── 시작 ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  백엔드 서버를 시작합니다${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ─── 설치 여부 확인 ──────────────────────────────────────────
if [ ! -d "$PROJECT_DIR/lead_researcher/_build" ]; then
  echo -e "  ${YELLOW}[알림]${NC} 첫 실행이네요! 프로젝트를 자동으로 설치합니다..."
  echo ""
  bash "$PROJECT_DIR/setup.sh"
  echo ""
fi

# ─── 의존성 확인 ─────────────────────────────────────────────
echo -e "  ${BLUE}[1/3]${NC} 의존성 확인 중..."

cd "$PROJECT_DIR/lead_researcher"
if ! mix deps.get --quiet; then
  echo -e "  ${RED}[오류]${NC} Elixir 의존성 설치에 실패했습니다."
  exit 1
fi

if ! mix ecto.migrate 2>&1 | tee -a "$BACKEND_LOG" > /dev/null; then
  echo -e "  ${RED}[오류]${NC} 데이터베이스 마이그레이션에 실패했습니다."
  echo -e "  로그: ${DIM}$BACKEND_LOG${NC}"
  exit 1
fi

cd "$PROJECT_DIR"
echo -e "  ${GREEN}[완료]${NC} 의존성 준비 완료."

# ─── 크롤러용 Python 가상환경 활성화 ────────────────────────
echo -e "  ${BLUE}[2/3]${NC} 크롤러 환경 확인 중..."
if [ -d "$PROJECT_DIR/crawler/venv" ]; then
  export PATH="$PROJECT_DIR/crawler/venv/bin:$PATH"
  echo -e "  ${GREEN}[완료]${NC} 크롤러 준비 완료."
else
  echo -e "  ${YELLOW}[알림]${NC} 크롤러 환경을 설정합니다..."
  cd "$PROJECT_DIR/crawler"
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt --quiet
  deactivate
  export PATH="$PROJECT_DIR/crawler/venv/bin:$PATH"
  cd "$PROJECT_DIR"
  echo -e "  ${GREEN}[완료]${NC} 크롤러 준비 완료."
fi

# ─── 서버 시작 ───────────────────────────────────────────────
echo -e "  ${BLUE}[3/3]${NC} 백엔드 서버를 시작합니다..."
echo ""

cleanup() {
  echo ""
  echo -e "  ${YELLOW}백엔드를 종료합니다...${NC}"
  kill $BACKEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  echo -e "  ${GREEN}종료 완료.${NC}"
  echo ""
  exit 0
}

trap cleanup SIGINT SIGTERM

cd "$PROJECT_DIR/lead_researcher"
mix phx.server > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# ─── Health check ────────────────────────────────────────────
echo -e "  백엔드 시작 대기 중..."

max_wait=30
waited=0
while [ $waited -lt $max_wait ]; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo -e "  ${RED}[오류]${NC} 백엔드 프로세스가 비정상 종료되었습니다."
    echo -e "  ${RED}[오류 로그]${NC}"
    echo -e "  ${DIM}$(tail -20 "$BACKEND_LOG")${NC}"
    echo ""
    exit 1
  fi

  if curl -s -o /dev/null -w '' "http://localhost:$BACKEND_PORT/api/health" 2>/dev/null; then
    break
  fi

  sleep 1
  waited=$((waited + 1))
done

if [ $waited -ge $max_wait ]; then
  echo ""
  echo -e "  ${RED}[오류]${NC} 백엔드가 ${max_wait}초 안에 시작되지 않았습니다."
  echo -e "  ${RED}[오류 로그]${NC}"
  echo -e "  ${DIM}$(tail -20 "$BACKEND_LOG")${NC}"
  echo ""
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

# ─── 결과 안내 ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}백엔드가 정상적으로 실행 중입니다!${NC}"
echo ""
echo -e "  API: ${YELLOW}http://localhost:${BACKEND_PORT}${NC}"
echo ""
echo -e "  ${DIM}프론트엔드는 Vibe Preview에서 확인하세요.${NC}"
echo ""
echo -e "  종료하려면: ${RED}Ctrl+C${NC}"
echo -e "  로그: ${DIM}$BACKEND_LOG${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

wait $BACKEND_PID
