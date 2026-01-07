# Test Assets

测试图片目录：`/private/tmp/yorutsuke-test/`

## 生成测试图片

```bash
# 重新生成测试图片 (5 个 8-bit JPEG, ~1.5MB each)
rm -rf /private/tmp/yorutsuke-test/* && mkdir -p /private/tmp/yorutsuke-test
magick -size 2400x2400 plasma:red-orange -depth 8 -quality 92 /private/tmp/yorutsuke-test/receipt1.jpg
magick -size 2400x2400 plasma:blue-cyan -depth 8 -quality 92 /private/tmp/yorutsuke-test/receipt2.jpg
magick -size 2400x2400 plasma:green-yellow -depth 8 -quality 92 /private/tmp/yorutsuke-test/receipt3.jpg
magick -size 2400x2400 plasma:purple-pink -depth 8 -quality 92 /private/tmp/yorutsuke-test/receipt4.jpg
magick -size 2400x2400 plasma:gray-white -depth 8 -quality 92 /private/tmp/yorutsuke-test/receipt5.jpg
```

## 文件规格

| File | Format | Size | Notes |
|------|--------|------|-------|
| `receipt1-5.jpg` | JPEG 8-bit | ~1.5MB | 2400x2400, plasma textures |

## 注意事项

- Rust `image` crate 只支持 8-bit JPEG，12-bit JPEG 会报错
- 使用 ImageMagick 的 `plasma:` 生成器创建随机纹理
- `-depth 8` 确保生成 8-bit 图片
