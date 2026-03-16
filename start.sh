#!/bin/bash
# ============================================================
#  프로젝트 실행 스크립트
#  실행하면 자동으로 최신 코드를 가져와서 실행합니다.
#  종료하려면 이 터미널에서 Ctrl+C 를 누르세요.
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

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

# ─── 시작 ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  프로젝트를 시작합니다${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ─── 최신 코드 자동 반영 (main 브랜치 기준) ───────────────────
echo -e "  ${BLUE}[1/4]${NC} 최신 코드 확인 중..."
if git fetch origin main --quiet 2>/dev/null; then
  git reset --hard origin/main --quiet 2>/dev/null
  echo -e "  ${GREEN}[완료]${NC} 최신 완성본으로 업데이트했습니다."
else
  echo -e "  ${YELLOW}[알림]${NC} 오프라인 상태 — 현재 코드로 실행합니다."
fi

# ─── 설치 여부 확인 (setup.sh를 안 했으면 자동 실행) ─────────
if [ ! -d "$PROJECT_DIR/lead_researcher/_build" ] || [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
  echo -e "  ${YELLOW}[알림]${NC} 첫 실행이네요! 프로젝트를 자동으로 설치합니다..."
  echo ""
  bash "$PROJECT_DIR/setup.sh"
  echo ""
fi

# ─── 변경사항 반영 ───────────────────────────────────────────
echo -e "  ${BLUE}[2/4]${NC} 변경사항 반영 중..."
cd "$PROJECT_DIR/lead_researcher"
mix deps.get --quiet 2>/dev/null
mix ecto.migrate 2>/dev/null
cd "$PROJECT_DIR/frontend"
npm install --silent 2>/dev/null
cd "$PROJECT_DIR"
echo -e "  ${GREEN}[완료]${NC} 준비 완료."

# ─── 크롤러용 Python 가상환경 활성화 ────────────────────────
echo -e "  ${BLUE}[3/4]${NC} 크롤러 환경 활성화 중..."
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
echo -e "  ${BLUE}[4/4]${NC} 서버를 시작합니다..."
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

# 백엔드 시작
cd "$PROJECT_DIR/lead_researcher"
mix phx.server &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# 프론트엔드 시작
cd "$PROJECT_DIR/frontend"
npx vite --host 2>/dev/null &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

# 서버가 뜰 때까지 잠시 대기
sleep 4

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  프로젝트가 실행 중입니다!"
echo ""
echo -e "  브라우저에서 아래 주소를 열어주세요:"
echo ""
echo -e "    ${YELLOW}http://localhost:5173${NC}"
echo ""
echo -e "  종료하려면: ${RED}Ctrl+C${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 두 프로세스가 모두 살아있는 동안 대기
wait $BACKEND_PID $FRONTEND_PID
