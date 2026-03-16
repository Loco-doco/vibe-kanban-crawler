#!/bin/bash
# ============================================================
#  로컬 실행 스크립트
#  프로젝트를 한 번에 실행합니다.
#  종료하려면 이 터미널에서 Ctrl+C 를 누르세요.
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
NC='\033[0m'

BACKEND_PORT=4000
FRONTEND_PORT=5173

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/.logs"
mkdir -p "$LOG_DIR"

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

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

check_requirement "node" "Node.js"
check_requirement "elixir" "Elixir"
check_requirement "python3" "Python 3"

# ─── 포트 충돌 확인 ──────────────────────────────────────────
check_port() {
  local port=$1
  local name=$2
  if lsof -iTCP:"$port" -sTCP:LISTEN -t &>/dev/null; then
    echo ""
    echo -e "  ${RED}[오류]${NC} 포트 ${YELLOW}$port${NC} 이(가) 이미 사용 중입니다. ($name)"
    echo -e "  다른 프로세스가 해당 포트를 점유하고 있습니다."
    echo -e "  확인: ${DIM}lsof -iTCP:$port -sTCP:LISTEN${NC}"
    echo ""
    exit 1
  fi
}

check_port $BACKEND_PORT "백엔드"
check_port $FRONTEND_PORT "프론트엔드"

# ─── 시작 ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  프로젝트를 시작합니다${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ─── 설치 여부 확인 (setup.sh를 안 했으면 자동 실행) ─────────
if [ ! -d "$PROJECT_DIR/lead_researcher/_build" ] || [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
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
  echo -e "  로그를 확인해주세요."
  exit 1
fi

if ! mix ecto.migrate 2>&1 | tee -a "$BACKEND_LOG" > /dev/null; then
  echo -e "  ${RED}[오류]${NC} 데이터베이스 마이그레이션에 실패했습니다."
  echo -e "  로그: ${DIM}$BACKEND_LOG${NC}"
  exit 1
fi

cd "$PROJECT_DIR/frontend"
if ! npm install --silent; then
  echo -e "  ${RED}[오류]${NC} npm 의존성 설치에 실패했습니다."
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
echo -e "  ${BLUE}[3/3]${NC} 서버를 시작합니다..."
echo ""

# 종료 시 모든 백그라운드 프로세스 정리
cleanup() {
  echo ""
  echo ""
  echo -e "  ${YELLOW}프로젝트를 종료합니다...${NC}"
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID 2>/dev/null
  echo -e "  ${GREEN}종료 완료.${NC}"
  echo ""
  exit 0
}

trap cleanup SIGINT SIGTERM

# 백엔드 시작 (stderr 표시, stdout은 로그로)
cd "$PROJECT_DIR/lead_researcher"
mix phx.server > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# 프론트엔드 시작 (포트 명시 + strictPort)
cd "$PROJECT_DIR/frontend"
npx vite --host --port "$FRONTEND_PORT" --strictPort > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

# ─── Health check ────────────────────────────────────────────
wait_for_server() {
  local url=$1
  local name=$2
  local pid=$3
  local max_wait=30
  local waited=0

  while [ $waited -lt $max_wait ]; do
    # 프로세스가 죽었으면 즉시 실패
    if ! kill -0 "$pid" 2>/dev/null; then
      echo ""
      echo -e "  ${RED}[오류]${NC} $name 프로세스가 비정상 종료되었습니다."
      return 1
    fi

    if curl -s -o /dev/null -w '' "$url" 2>/dev/null; then
      return 0
    fi

    sleep 1
    waited=$((waited + 1))
  done

  echo ""
  echo -e "  ${RED}[오류]${NC} $name 이(가) ${max_wait}초 안에 시작되지 않았습니다."
  return 1
}

BACKEND_OK=true
FRONTEND_OK=true

echo -e "  서버 시작 대기 중..."

if ! wait_for_server "http://localhost:$BACKEND_PORT/api/health" "백엔드" "$BACKEND_PID"; then
  BACKEND_OK=false
  echo -e "  ${RED}[백엔드 오류 로그]${NC}"
  echo -e "  ${DIM}$(tail -20 "$BACKEND_LOG")${NC}"
  echo ""
fi

if ! wait_for_server "http://localhost:$FRONTEND_PORT" "프론트엔드" "$FRONTEND_PID"; then
  FRONTEND_OK=false
  echo -e "  ${RED}[프론트엔드 오류 로그]${NC}"
  echo -e "  ${DIM}$(tail -20 "$FRONTEND_LOG")${NC}"
  echo ""
fi

# 둘 다 실패하면 종료
if [ "$BACKEND_OK" = false ] && [ "$FRONTEND_OK" = false ]; then
  echo -e "  ${RED}백엔드와 프론트엔드 모두 시작에 실패했습니다.${NC}"
  echo ""
  echo -e "  전체 로그 확인:"
  echo -e "    백엔드:    ${DIM}$BACKEND_LOG${NC}"
  echo -e "    프론트엔드: ${DIM}$FRONTEND_LOG${NC}"
  echo ""
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  exit 1
fi

# ─── 결과 안내 ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
  echo -e "  ${GREEN}프로젝트가 정상적으로 실행 중입니다!${NC}"
else
  if [ "$BACKEND_OK" = false ]; then
    echo -e "  ${YELLOW}[경고]${NC} 백엔드가 시작되지 않았습니다. 일부 기능이 동작하지 않을 수 있습니다."
    echo -e "         로그: ${DIM}$BACKEND_LOG${NC}"
  fi
  if [ "$FRONTEND_OK" = false ]; then
    echo -e "  ${YELLOW}[경고]${NC} 프론트엔드가 시작되지 않았습니다."
    echo -e "         로그: ${DIM}$FRONTEND_LOG${NC}"
  fi
fi

echo ""
echo -e "  브라우저에서 아래 주소를 열어주세요:"
echo ""
echo -e "    ${YELLOW}http://localhost:${FRONTEND_PORT}${NC}"
echo ""
echo -e "  종료하려면: ${RED}Ctrl+C${NC}"
echo ""
echo -e "  ${DIM}로그 위치:${NC}"
echo -e "  ${DIM}  백엔드:    $BACKEND_LOG${NC}"
echo -e "  ${DIM}  프론트엔드: $FRONTEND_LOG${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 두 프로세스가 모두 살아있는 동안 대기
wait $BACKEND_PID $FRONTEND_PID
