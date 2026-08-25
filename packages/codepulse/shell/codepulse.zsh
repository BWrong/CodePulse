# codepulse.zsh — CodePulse 终端 CLI 编码时间采集
#
# 每次敲命令（preexec）记录实体，命令运行期间由后台循环周期性发送心跳
# （默认每 60s，可用 CODEPULSE_INTERVAL 调整），命令结束（precmd）时停止
# 循环并补发一条结束心跳。
#
# 这样 codex / claude code 等长驻交互式 CLI 工具的编码时间也能被完整统计，
# 与官方 WakaTime 编辑器插件同源同后端。
#
# 安装：在 ~/.zshrc 中 source 本文件（并把 bin/codepulse 加入 PATH，或用
#       CODEPULSE_CLI 环境变量指向 cli 绝对路径）。

_codepulse_cli="${CODEPULSE_CLI:-codepulse}"
_codepulse_interval="${CODEPULSE_INTERVAL:-60}"
_codepulse_hb_pid=""

_codepulse_project_of() {
  local dir="$1" root
  root="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)"
  if [[ -n "$root" ]]; then
    print -r -- "${root:t}"   # git root 的文件夹名，与编辑器心跳的项目名一致
  else
    print -r -- "${dir:t}"    # 非 git 目录退化为当前文件夹名
  fi
}

# 从命令第一个词识别编码 agent（可扩展），未识别归为 cli
_codepulse_agent_of() {
  local cmd="$1" name
  name="${cmd%% *}"      # 第一个 token
  name="${name:t}"       # basename
  case "$name" in
    codex)      print -r -- "codex" ;;
    claude)     print -r -- "claude-code" ;;
    pi)         print -r -- "pi" ;;
    cursor)     print -r -- "cursor-agent" ;;
    opencode)   print -r -- "opencode" ;;
    omp)        print -r -- "omp" ;;
    aider)      print -r -- "aider" ;;
    gemini)     print -r -- "gemini" ;;
    copilot)    print -r -- "copilot" ;;
    *)          print -r -- "cli" ;;
  esac
}

_codepulse_preexec() {
  _codepulse_entity="$1"
  [[ -n "$_codepulse_entity" ]] || return
  _codepulse_project="$(_codepulse_project_of "$PWD")"
  _codepulse_agent="$(_codepulse_agent_of "$_codepulse_entity")"
  _codepulse_hb_pid=""
  # 命令运行期间的后台周期心跳循环；终端关闭（父 zsh 退出）时循环自行终止
  (
    local interval="$_codepulse_interval"
    while kill -0 "$PPID" 2>/dev/null; do
      command "$_codepulse_cli" heartbeat \
        --project "$_codepulse_project" \
        --entity "$_codepulse_entity" \
        --type app --category coding --write \
        --agent "$_codepulse_agent" \
        --time "$(date +%s)" >/dev/null 2>&1 || true
      sleep "$interval"
    done
  ) &!
  _codepulse_hb_pid=$!
}

_codepulse_precmd() {
  local pid="${_codepulse_hb_pid:-}"
  _codepulse_hb_pid=""
  [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  [[ -n "${_codepulse_entity:-}" ]] || return
  # 结束心跳
  command "$_codepulse_cli" heartbeat \
    --project "$_codepulse_project" \
    --entity "$_codepulse_entity" \
    --type app --category coding --write \
    --agent "$_codepulse_agent" \
    --time "$(date +%s)" >/dev/null 2>&1 &!
  _codepulse_entity=""
}

# cli 可用时才挂载钩子
if command -v "$_codepulse_cli" >/dev/null 2>&1 || [[ -x "$_codepulse_cli" ]]; then
  autoload -Uz add-zsh-hook
  add-zsh-hook preexec _codepulse_preexec
  add-zsh-hook precmd _codepulse_precmd
fi
