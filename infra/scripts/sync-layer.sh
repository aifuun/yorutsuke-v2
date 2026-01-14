#!/bin/bash

################################################################################
# sync-layer.sh - Lambda Layer 快速同步脚本
#
# 功能：自动打包、发布、更新 Lambda Layer
# 场景：修改 infra/lambda/shared-layer/nodejs/shared/*.mjs 后使用
#
# 用法：
#   ./infra/scripts/sync-layer.sh [--profile dev|prod]
#   ./infra/scripts/sync-layer.sh --profile dev --skip-verify
#
# 设计原则：
#   1. Fail-fast: 任何错误立即中止
#   2. Deterministic: 清晰的成功/失败状态
#   3. Idempotent: 多次运行结果一致
#   4. Audit-friendly: 输出便于事后审计
################################################################################

set -euo pipefail

# ============================================================================
# 配置
# ============================================================================

PROFILE="${1:-dev}"
SKIP_VERIFY="${2:-false}"

LAYER_NAME="yorutsuke-shared-${PROFILE}"
COMPATIBLE_RUNTIME="nodejs20.x"
REGION="us-east-1"
ACCOUNT_ID="696249060859"

# Lambda 函数列表（关联同一个 Layer）
LAMBDA_FUNCTIONS=(
  "yorutsuke-instant-processor-us-${PROFILE}"
  "yorutsuke-batch-processor-us-${PROFILE}"
)

# 临时文件
LAYER_ZIP="/tmp/layer-${LAYER_NAME}-$$.zip"
LOG_FILE="/tmp/sync-layer-${LAYER_NAME}-$$.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# 工具函数
# ============================================================================

log_info() {
  echo -e "${BLUE}ℹ${NC} $*" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}✓${NC} $*" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}✗${NC} $*" | tee -a "$LOG_FILE"
}

die() {
  log_error "$*"
  exit 1
}

# ============================================================================
# 前置条件检查
# ============================================================================

check_prerequisites() {
  log_info "检查前置条件..."

  # 检查必要工具
  for cmd in aws jq zip unzip; do
    if ! command -v "$cmd" &> /dev/null; then
      die "缺少必要工具: $cmd (请先安装)"
    fi
  done
  log_success "所有必要工具已安装"

  # 检查 AWS 凭证
  if ! aws sts get-caller-identity --profile "$PROFILE" &> /dev/null; then
    die "AWS 凭证配置有问题 (profile: $PROFILE)"
  fi
  log_success "AWS 凭证验证成功 (profile: $PROFILE)"

  # 检查源文件目录
  local shared_layer_dir="infra/lambda/shared-layer"
  if [[ ! -d "$shared_layer_dir" ]]; then
    die "目录不存在: $shared_layer_dir (请从项目根目录运行脚本)"
  fi
  log_success "源目录验证成功: $shared_layer_dir"
}

# ============================================================================
# 打包 Layer
# ============================================================================

package_layer() {
  log_info "打包 Lambda Layer..."

  local shared_layer_dir="infra/lambda/shared-layer"

  # 清空旧 zip
  rm -f "$LAYER_ZIP"

  # 进入 shared-layer 目录并打包（确保 nodejs/ 是根目录）
  (
    cd "$shared_layer_dir"
    zip -r "$LAYER_ZIP" nodejs/ -q
  )

  if [[ ! -f "$LAYER_ZIP" ]]; then
    die "打包失败"
  fi

  local file_size
  file_size=$(du -h "$LAYER_ZIP" | cut -f1)
  log_success "打包完成: $LAYER_ZIP ($file_size)"

  # 验证压缩包结构
  log_info "验证压缩包结构..."
  if ! unzip -t "$LAYER_ZIP" &> /dev/null; then
    die "压缩包损坏，解压验证失败"
  fi

  # 检查是否包含关键文件
  if ! unzip -l "$LAYER_ZIP" | grep -q "nodejs/shared/.*\.mjs"; then
    die "压缩包缺少必要的 mjs 文件"
  fi

  log_success "压缩包结构验证成功"
}

# ============================================================================
# 发布新 Layer 版本
# ============================================================================

publish_layer() {
  log_info "发布新 Layer 版本..."

  local publish_output
  publish_output=$(aws lambda publish-layer-version \
    --layer-name "$LAYER_NAME" \
    --zip-file "fileb://$LAYER_ZIP" \
    --compatible-runtimes "$COMPATIBLE_RUNTIME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    2>&1)

  if [[ $? -ne 0 ]]; then
    die "发布 Layer 失败:\n$publish_output"
  fi

  # 提取版本号和 ARN
  NEW_VERSION=$(echo "$publish_output" | jq -r '.Version')
  NEW_ARN=$(echo "$publish_output" | jq -r '.LayerVersionArn')

  if [[ -z "$NEW_VERSION" ]] || [[ "$NEW_VERSION" == "null" ]]; then
    die "无法提取 Layer 版本号"
  fi

  log_success "新 Layer 版本发布成功"
  log_info "版本号: $NEW_VERSION"
  log_info "ARN: $NEW_ARN"
}

# ============================================================================
# 更新 Lambda 函数
# ============================================================================

update_lambda_functions() {
  log_info "更新所有关联 Lambda 函数..."

  for func in "${LAMBDA_FUNCTIONS[@]}"; do
    log_info "更新函数: $func"

    if ! aws lambda update-function-configuration \
      --function-name "$func" \
      --layers "$NEW_ARN" \
      --region "$REGION" \
      --profile "$PROFILE" &> /dev/null; then
      log_warning "函数更新失败或函数不存在: $func (可能该 profile 没有此函数)"
      continue
    fi

    log_success "函数已更新: $func"
  done
}

# ============================================================================
# 验证所有函数
# ============================================================================

verify_all_functions() {
  log_info "验证所有函数都指向新 Layer..."

  local verification_passed=true

  for func in "${LAMBDA_FUNCTIONS[@]}"; do
    local current_arn
    current_arn=$(aws lambda get-function-configuration \
      --function-name "$func" \
      --region "$REGION" \
      --profile "$PROFILE" 2>/dev/null \
      | jq -r '.Layers[0].Arn // "NONE"' || echo "NONE")

    if [[ "$current_arn" == "NONE" ]]; then
      log_warning "函数不存在或未配置 Layer: $func"
      continue
    fi

    if [[ "$current_arn" == "$NEW_ARN" ]]; then
      log_success "✓ $func → $NEW_ARN"
    else
      log_error "✗ $func 未使用新 Layer"
      log_info "  当前: $current_arn"
      log_info "  期望: $NEW_ARN"
      verification_passed=false
    fi
  done

  if [[ "$verification_passed" == false ]]; then
    die "验证失败：并非所有函数都指向新 Layer"
  fi

  log_success "所有函数验证成功！"
}

# ============================================================================
# 清理
# ============================================================================

cleanup() {
  rm -f "$LAYER_ZIP"
  log_success "临时文件已清理"
}

# ============================================================================
# 生成审计日志
# ============================================================================

generate_audit_log() {
  log_info "生成审计日志..."

  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local audit_entry
  read -r -d '' audit_entry << EOF || true
{
  "timestamp": "$timestamp",
  "action": "sync-layer",
  "profile": "$PROFILE",
  "layer_name": "$LAYER_NAME",
  "new_version": "$NEW_VERSION",
  "new_arn": "$NEW_ARN",
  "functions_updated": $(printf '%s\n' "${LAMBDA_FUNCTIONS[@]}" | jq -Rs 'split("\n")[:-1]'),
  "status": "success"
}
EOF

  # 将审计信息附加到日志文件
  echo "$audit_entry" >> "$LOG_FILE"

  log_success "审计日志已保存: $LOG_FILE"
}

# ============================================================================
# 显示总结
# ============================================================================

show_summary() {
  cat << EOF

$(log_success '══════════════════════════════════════════════════════════════')
$(log_success '                    Layer 同步完成！                         ')
$(log_success '══════════════════════════════════════════════════════════════')

📦 Layer 信息：
   名称：$LAYER_NAME
   版本：$NEW_VERSION
   ARN：$NEW_ARN

🔗 更新的函数：
EOF

  for func in "${LAMBDA_FUNCTIONS[@]}"; do
    echo "   • $func"
  done

  cat << EOF

📝 日志文件：$LOG_FILE

💡 下一步：
   1. 验证 Lambda 函数已收到新代码
      aws lambda invoke \\
        --function-name ${LAMBDA_FUNCTIONS[0]} \\
        --region $REGION \\
        --profile $PROFILE \\
        /tmp/response.json

   2. 查看 CloudWatch 日志
      aws logs tail /aws/lambda/${LAMBDA_FUNCTIONS[0]} \\
        --region $REGION \\
        --profile $PROFILE \\
        --follow

   3. 提交变更
      git add infra/lambda/shared-layer/
      git commit -m "fix: update shared layer (Layer v$NEW_VERSION)"

$(log_success '══════════════════════════════════════════════════════════════')
EOF
}

# ============================================================================
# 主函数
# ============================================================================

main() {
  echo "" > "$LOG_FILE"  # 清空日志文件

  log_info "=========================================="
  log_info "Lambda Layer 快速同步脚本"
  log_info "=========================================="
  log_info "时间: $(date)"
  log_info "Profile: $PROFILE"
  log_info "Layer: $LAYER_NAME"
  echo ""

  # 前置检查
  check_prerequisites

  echo ""

  # 主要流程
  package_layer
  echo ""

  publish_layer
  echo ""

  update_lambda_functions
  echo ""

  # 验证
  if [[ "$SKIP_VERIFY" != "--skip-verify" ]]; then
    verify_all_functions
    echo ""
  else
    log_warning "跳过验证 (使用了 --skip-verify)"
    echo ""
  fi

  # 清理和总结
  cleanup
  generate_audit_log
  echo ""

  show_summary
}

# ============================================================================
# 错误处理
# ============================================================================

trap cleanup EXIT

# 如果任何子函数失败，捕获错误
trap 'die "脚本执行失败" ' ERR

# ============================================================================
# 执行
# ============================================================================

main "$@"
