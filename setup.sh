#!/bin/bash
# ============================================================
#  프로젝트 최초 설치 스크립트
#  이 스크립트는 처음 한 번만 실행하면 됩니다.
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_ok() {
  echo -e "  ${GREEN}[완료]${NC} $1"
}

print_warn() {
  echo -e "  ${YELLOW}[알림]${NC} $1"
}

print_fail() {
  echo -e "  ${RED}[오류]${NC} $1"
}

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  프로젝트 설치를 시작합니다${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  이 과정은 처음 한 번만 필요하며,"
echo "  인터넷 연결 상태에 따라 5~15분 정도 걸릴 수 있습니다."
echo ""

# ─── 1. Homebrew ────────────────────────────────────────────
print_step "1/5  Homebrew 확인 중..."

if command -v brew &>/dev/null; then
  print_ok "Homebrew가 이미 설치되어 있습니다."
else
  print_warn "Homebrew를 설치합니다. 비밀번호를 입력하라는 창이 나타날 수 있습니다."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Apple Silicon Mac 경로 설정
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    # 영구 설정
    SHELL_RC="$HOME/.zprofile"
    if ! grep -q 'homebrew' "$SHELL_RC" 2>/dev/null; then
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$SHELL_RC"
    fi
  fi

  if command -v brew &>/dev/null; then
    print_ok "Homebrew 설치 완료."
  else
    print_fail "Homebrew 설치에 실패했습니다."
    echo "  아래 주소에서 수동으로 설치해주세요: https://brew.sh"
    exit 1
  fi
fi

# ─── 2. Node.js ─────────────────────────────────────────────
print_step "2/5  Node.js 확인 중..."

if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  print_ok "Node.js ${NODE_VER} 이 이미 설치되어 있습니다."
else
  print_warn "Node.js를 설치합니다..."
  brew install node
  print_ok "Node.js $(node -v) 설치 완료."
fi

# ─── 3. Elixir ──────────────────────────────────────────────
print_step "3/5  Elixir 확인 중..."

if command -v elixir &>/dev/null; then
  ELIXIR_VER=$(elixir -v | grep Elixir | awk '{print $2}')
  print_ok "Elixir ${ELIXIR_VER} 이 이미 설치되어 있습니다."
else
  print_warn "Elixir를 설치합니다... (시간이 좀 걸릴 수 있습니다)"
  brew install elixir
  print_ok "Elixir 설치 완료."
fi

# ─── 4. Python 3 ────────────────────────────────────────────
print_step "4/5  Python 3 확인 중..."

if command -v python3 &>/dev/null; then
  PY_VER=$(python3 --version)
  print_ok "${PY_VER} 이 이미 설치되어 있습니다."
else
  print_warn "Python 3을 설치합니다..."
  brew install python3
  print_ok "Python 3 설치 완료."
fi

# ─── 5. 프로젝트 세팅 ───────────────────────────────────────
print_step "5/5  프로젝트 구성 요소를 세팅합니다..."

echo ""
echo "  [1/3] 백엔드(서버) 설정 중..."
cd "$PROJECT_DIR/lead_researcher"
mix local.hex --force --if-missing >/dev/null 2>&1
mix local.rebar --force --if-missing >/dev/null 2>&1
mix deps.get
mix ecto.create 2>/dev/null || true
mix ecto.migrate
print_ok "백엔드 설정 완료."

echo ""
echo "  [2/3] 프론트엔드(화면) 설정 중..."
cd "$PROJECT_DIR/frontend"
npm install
print_ok "프론트엔드 설정 완료."

echo ""
echo "  [3/3] 크롤러(수집기) 설정 중..."
cd "$PROJECT_DIR/crawler"
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate
print_ok "크롤러 설정 완료."

# ─── 완료 ────────────────────────────────────────────────────
cd "$PROJECT_DIR"

echo ""
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  설치가 모두 완료되었습니다!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  이제 아래 명령어로 프로젝트를 실행할 수 있습니다:"
echo ""
echo -e "    ${YELLOW}./start.sh${NC}"
echo ""
echo "  (이 setup.sh는 다시 실행할 필요 없습니다)"
echo ""
