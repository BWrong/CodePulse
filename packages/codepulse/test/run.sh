#!/usr/bin/env bash
# codepulse CLI + zsh 插件冒烟测试
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$ROOT/bin/codepulse"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

echo "== 1. 无 api_key 时报错 =="
out="$("$CLI" heartbeat --config /nonexistent.cfg --project x --dry-run 2>&1)"; rc=$?
[[ $rc -ne 0 ]] && ok "无 config 返回非零 ($rc)" || bad "无 config 应报错"

echo "== 2. git 仓库 project 探测（子目录定位 git root） =="
TMP="$(mktemp -d)"
git -C "$TMP" init -q; git -C "$TMP" config user.email t@t; git -C "$TMP" config user.name t
mkdir -p "$TMP/a/b"; cd "$TMP/a/b"
out="$(WAKATIME_API_KEY=fake "$CLI" heartbeat --entity "npm run dev" --dry-run 2>&1)"
echo "$out" | grep -q "\"project\":\"${TMP##*/}\"" && ok "git root basename 作为 project" || bad "project 应为 ${TMP##*/}: $out"
echo "$out" | grep -q "\"branch\"" && ok "自动带 branch" || bad "应自动带 branch: $out"

echo "== 3. 非 git 目录 project 探测 =="
TMP2="$(mktemp -d)"; cd "$TMP2"
out="$(WAKATIME_API_KEY=fake "$CLI" heartbeat --entity ls --dry-run 2>&1)"
echo "$out" | grep -q "\"project\":\"${TMP2##*/}\"" && ok "非 git 用文件夹名" || bad "应为 ${TMP2##*/}: $out"

echo "== 4. JSON 转义（反解一致） =="
out="$(WAKATIME_API_KEY=fake "$CLI" heartbeat --project P --entity 'echo "a\"b" \ c' --dry-run 2>&1)"
raw='echo "a\"b" \ c'
got="$(echo "${out#*BODY: }" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["entity"])' 2>/dev/null)"
[[ "$got" == "$raw" ]] && ok "特殊字符正确转义" || bad "转义错误 got=$got raw=$raw"

echo "== 5. 鉴权失败路径（假 key 真请求 → 401） =="
out="$(WAKATIME_API_KEY=definitely_wrong_key_zzz "$CLI" heartbeat --project __codepulse_test__ --entity test --time 1000000000 2>&1)"; rc=$?
[[ $rc -ne 0 ]] && echo "$out" | grep -q "401" && ok "401 鉴权失败被正确捕获" || bad "应报 401: rc=$rc out=$out"

echo "== 6. zsh 插件普通命令触发（mock cli 拦截参数） =="
MOCK="$TMP2/mock-codepulse"
printf '#!/usr/bin/env bash\necho "$*" >> "%s/mock.log"\n' "$TMP2" > "$MOCK"; chmod +x "$MOCK"
CODEPULSE_CLI="$MOCK" CODEPULSE_INTERVAL=5 zsh -f -c '
  source "$1"
  _codepulse_preexec "vim src/App.vue"
  _codepulse_precmd
  sleep 0.6
' _ "$ROOT/shell/codepulse.zsh" 2>/dev/null
if [[ -f "$TMP2/mock.log" ]]; then
  args="$(cat "$TMP2/mock.log")"
  echo "$args" | grep -q -- "--project ${TMP2##*/}" && \
  echo "$args" | grep -q "vim src/App.vue" && \
  echo "$args" | grep -q -- "--write" && \
  ok "插件触发并传参正确" || bad "插件参数不符: $args"
else
  bad "插件未触发 mock cli"
fi

echo "== 7. 长驻 CLI（codex/claude）周期心跳 =="
MOCK2="$TMP2/mock-long"
printf '#!/usr/bin/env bash\necho "$*" >> "%s/mock-long.log"\n' "$TMP2" > "$MOCK2"; chmod +x "$MOCK2"
CODEPULSE_CLI="$MOCK2" CODEPULSE_INTERVAL=1 zsh -f -c '
  source "$1"
  _codepulse_preexec "codex"
  sleep 2.5
  _codepulse_precmd
  sleep 0.6
' _ "$ROOT/shell/codepulse.zsh" 2>/dev/null
n="$(wc -l < "$TMP2/mock-long.log" 2>/dev/null | tr -d ' ')"
if [[ -n "$n" && "$n" -ge 3 ]] && grep -q -- "--entity codex" "$TMP2/mock-long.log"; then
  ok "长驻命令运行期间发出多条心跳（$n 条）"
else
  bad "长驻命令应 ≥3 条心跳且含 codex，实得 ${n:-0}"
fi

echo "== 8. init-zsh 生成可移植变量形式 =="
# A. CODEPULSE_ROOT 自定义 → CODEPULSE_ROOT 变量形式
T3="$(mktemp -d)"
CODEPULSE_ROOT="$ROOT" ZDOTDIR="$T3" "$CLI" init-zsh --yes >/dev/null 2>&1
grep -qF 'source "$CODEPULSE_ROOT/shell/codepulse.zsh"' "$T3/.zshrc" \
  && ok "CODEPULSE_ROOT 生成变量形式" || bad "应为 CODEPULSE_ROOT 变量形式: $(cat "$T3/.zshrc")"
# B. npm 全局安装 → 命令替换形式（mock npm root -g）
T5="$(mktemp -d)"
mkdir -p "$T5/bin" "$T5/zd" "$T5/lib/node_modules/@bwrong/codepulse/shell"
cp "$ROOT/shell/codepulse.zsh" "$T5/lib/node_modules/@bwrong/codepulse/shell/"
printf '#!/usr/bin/env bash\necho "%s/lib/node_modules"\n' "$T5" > "$T5/bin/npm"; chmod +x "$T5/bin/npm"
PATH="$T5/bin:$PATH" CODEPULSE_ROOT= ZDOTDIR="$T5/zd" "$CLI" init-zsh --yes >/dev/null 2>&1
grep -qF 'source "$(npm root -g)/@bwrong/codepulse/shell/codepulse.zsh"' "$T5/zd/.zshrc" \
  && ok "npm 全局生成命令替换形式" || bad "应为 npm root -g 形式: $(cat "$T5/zd/.zshrc")"
# C. 重复运行跳过
CODEPULSE_ROOT="$ROOT" ZDOTDIR="$T3" "$CLI" init-zsh --yes 2>&1 | grep -q "已包含" \
  && ok "重复运行跳过" || bad "重复运行应跳过"
rm -rf "$T3" "$T5"

echo "== 9. 心跳携带工具来源标识 user_agent =="
out="$(WAKATIME_API_KEY=fake "$CLI" heartbeat --project P --entity test --dry-run 2>&1)"
echo "$out" | grep -q '"user_agent":"codepulse-cli/' \
  && ok "心跳携带 user_agent 工具标识" || bad "缺少 user_agent: $out"

echo "== 10. --agent 工具标识 =="
out="$(WAKATIME_API_KEY=fake "$CLI" heartbeat --project P --entity codex --agent codex --dry-run 2>&1)"
echo "$out" | grep -q '"user_agent":"codepulse-cli/codex"' \
  && ok "--agent codex 拼入 user_agent" || bad "应 codepulse-cli/codex: $out"
out="$(WAKATIME_API_KEY=fake "$CLI" heartbeat --project P --entity npm --dry-run 2>&1)"
echo "$out" | grep -q '"user_agent":"codepulse-cli/cli"' \
  && ok "默认 agent 为 cli" || bad "应 codepulse-cli/cli: $out"

echo "== 11. zsh 插件识别 agent =="
MOCK3="$TMP2/mock-agent"
printf '#!/usr/bin/env bash\necho "$*" >> "%s/mock-agent.log"\n' "$TMP2" > "$MOCK3"; chmod +x "$MOCK3"
CODEPULSE_CLI="$MOCK3" CODEPULSE_INTERVAL=5 zsh -f -c '
  source "$1"
  _codepulse_preexec "codex"
  _codepulse_precmd
  _codepulse_preexec "npm run dev"
  _codepulse_precmd
  sleep 0.6
' _ "$ROOT/shell/codepulse.zsh" 2>/dev/null
log="$(cat "$TMP2/mock-agent.log" 2>/dev/null)"
echo "$log" | grep -q -- "--agent codex" && echo "$log" | grep -q -- "--agent cli" \
  && ok "插件识别 codex→codex、普通命令→cli" || bad "agent 识别不符: $log"

echo "== 12. 扩展 agent 识别（opencode/omp 等主流） =="
MOCK4="$TMP2/mock-agent2"
printf '#!/usr/bin/env bash\necho "$*" >> "%s/mock-agent2.log"\n' "$TMP2" > "$MOCK4"; chmod +x "$MOCK4"
CODEPULSE_CLI="$MOCK4" CODEPULSE_INTERVAL=5 zsh -f -c '
  source "$1"
  _codepulse_preexec "opencode"
  _codepulse_precmd
  _codepulse_preexec "omp"
  _codepulse_precmd
  _codepulse_preexec "aider --model o3"
  _codepulse_precmd
  sleep 0.6
' _ "$ROOT/shell/codepulse.zsh" 2>/dev/null
log="$(cat "$TMP2/mock-agent2.log" 2>/dev/null)"
echo "$log" | grep -q -- "--agent opencode" && echo "$log" | grep -q -- "--agent omp" && echo "$log" | grep -q -- "--agent aider" \
  && ok "识别 opencode/omp/aider" || bad "扩展识别不符: $log"

rm -rf "$TMP" "$TMP2"
echo
echo "结果: $PASS 通过, $FAIL 失败"
[[ $FAIL -eq 0 ]]
