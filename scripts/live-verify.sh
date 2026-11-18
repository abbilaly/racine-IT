#!/usr/bin/env bash
# Live production verification.
#
# Creates clearly-labelled temporary records (one product, two banners), proves
# the write paths against the deployed Worker, and removes every row and stored
# object it created. Never touches orders, customers or existing catalogue data.
#
# Usage: BASE=https://racine-it.abbilaly.workers.dev bash scripts/live-verify.sh
set -uo pipefail

BASE=${BASE:-https://racine-it.abbilaly.workers.dev}
JAR=$(mktemp)
STAMP=$(date +%s)
SLUG="zz-live-test-$STAMP"
IMAGE="public/images/h-electro-pulse-banner-1.webp"
pass=0; fail=0

check() { if [ "$2" = "$3" ]; then echo "PASS  $1 ($3)"; pass=$((pass+1)); else echo "FAIL  $1 (expected $2, got $3)"; fail=$((fail+1)); fi; }
cleanup_fail=0

echo "== admin login =="
check "admin login" 200 "$(curl -s -c "$JAR" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/login" -H 'Content-Type: application/json' --data "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"

echo "== admin screens =="
for U in /admin /admin/products /admin/banners /admin/categories /admin/brands /admin/orders /admin/customers /admin/inventory /admin/settings; do
  check "screen $U" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE$U")"
done

echo "== banners: upload image =="
BIMG=$(curl -s -b "$JAR" -X POST "$BASE/api/admin/catalogue/images?kind=homepage-banner" -F "file=@$IMAGE;type=image/webp")
BURL=$(printf '%s' "$BIMG" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("path",""))' 2>/dev/null)
BOBJ=$(printf '%s' "$BIMG" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("objectPath",""))' 2>/dev/null)
check "banner image stored" "yes" "$([ -n "$BURL" ] && echo yes || echo no)"

echo "== banners: create active + hidden =="
CREATE=$(curl -s -b "$JAR" -o /tmp/lb1.json -w '%{http_code}' -X POST "$BASE/api/admin/banners" -H 'Content-Type: application/json' \
  --data "{\"title\":\"ZZ Live Test Banner $STAMP\",\"kicker\":\"VERIFY\",\"subtitle\":\"Temporary banner created by the release verification run.\",\"imagePath\":\"$BURL\",\"ctaLabel\":\"Shop now\",\"ctaHref\":\"/shop\",\"isActive\":true,\"position\":0}")
check "active banner created" 201 "$CREATE"
B1=$(python3 -c 'import json;print(json.load(open("/tmp/lb1.json")).get("id",""))')
HID=$(curl -s -b "$JAR" -o /tmp/lb2.json -w '%{http_code}' -X POST "$BASE/api/admin/banners" -H 'Content-Type: application/json' \
  --data "{\"title\":\"ZZ Live Hidden Banner $STAMP\",\"imagePath\":\"$BURL\",\"ctaLabel\":\"Shop now\",\"ctaHref\":\"/shop\",\"isActive\":false,\"position\":1}")
check "hidden banner created" 201 "$HID"
B2=$(python3 -c 'import json;print(json.load(open("/tmp/lb2.json")).get("id",""))')

echo "== banners: admin list sees both =="
check "admin list count" 2 "$(curl -s -b "$JAR" "$BASE/api/admin/banners" | python3 -c 'import json,sys;print(len(json.load(sys.stdin).get("rows",[])))')"

echo "== banners: anon RLS sees only the active one =="
ANON=$(curl -s "$SUPABASE_URL/rest/v1/homepage_banners?select=title,is_active" -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY")
check "anon read count" 1 "$(printf '%s' "$ANON" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')"
check "anon read hides inactive" "no" "$(printf '%s' "$ANON" | grep -qF "ZZ Live Hidden Banner $STAMP" && echo yes || echo no)"

echo "== banners: storefront shows the active banner =="
HOME=$(curl -s "$BASE/")
check "home has active banner" "yes" "$(printf '%s' "$HOME" | grep -qF "ZZ Live Test Banner $STAMP" && echo yes || echo no)"
check "home hides inactive banner" "no" "$(printf '%s' "$HOME" | grep -qF "ZZ Live Hidden Banner $STAMP" && echo yes || echo no)"

echo "== banners: edit =="
check "banner edit" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X PATCH "$BASE/api/admin/banners" -H 'Content-Type: application/json' \
  --data "{\"id\":\"$B1\",\"title\":\"ZZ Live Test Banner $STAMP edited\",\"kicker\":\"VERIFY\",\"subtitle\":\"Edited during the release verification run.\",\"imagePath\":\"$BURL\",\"ctaLabel\":\"Shop now\",\"ctaHref\":\"/shop\",\"isActive\":true,\"position\":0}")"
check "storefront reflects edit" "yes" "$(curl -s "$BASE/" | grep -qF "ZZ Live Test Banner $STAMP edited" && echo yes || echo no)"

echo "== banners: delete and restore fallback =="
if [ -n "$B1" ]; then check "active banner deleted" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X DELETE "$BASE/api/admin/banners?id=$B1")"; fi
if [ -n "$B2" ]; then check "hidden banner deleted" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X DELETE "$BASE/api/admin/banners?id=$B2")"; fi
check "home has no test banner" "no" "$(curl -s "$BASE/" | grep -qF "ZZ Live Test Banner $STAMP" && echo yes || echo no)"
check "home falls back to built-in hero" "yes" "$(curl -s "$BASE/" | grep -qF "Latest Tech, One Store" && echo yes || echo no)"

echo "== product: create, image upload/replace, delete =="
CAT_ID=$(curl -s -b "$JAR" "$BASE/api/admin/categories" | python3 -c 'import json,sys;d=json.load(sys.stdin);rows=d.get("categories") or d.get("rows") or d;print(next(r["id"] for r in rows if not r.get("parent_id")))')
CREATE_P=$(curl -s -b "$JAR" -o /tmp/lp.json -w '%{http_code}' -X POST "$BASE/api/admin/products" -H 'Content-Type: application/json' \
  --data "{\"title\":\"ZZ Live Test Product\",\"slug\":\"$SLUG\",\"categoryId\":\"$CAT_ID\",\"shortDescription\":\"Temporary product created by the release verification run.\",\"priceCents\":1000,\"is_active\":false}")
check "product created" 201 "$CREATE_P"
PID=$(python3 -c 'import json;print(json.load(open("/tmp/lp.json")).get("id",""))')
UP1=$(curl -s -b "$JAR" -o /tmp/lpu1.json -w '%{http_code}' -X POST "$BASE/api/admin/products/$PID/images" -F "kind=primary" -F "file=@$IMAGE;type=image/webp")
check "primary image upload" 201 "$UP1"
OBJ1=$(python3 -c 'import json;print(json.load(open("/tmp/lpu1.json")).get("objectPath",""))' 2>/dev/null)
PURL=$(python3 -c 'import json;print(json.load(open("/tmp/lpu1.json")).get("path",""))' 2>/dev/null)
check "image URL public" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$PURL")"
check "primary image replace" 201 "$(curl -s -b "$JAR" -o /tmp/lpu2.json -w '%{http_code}' -X POST "$BASE/api/admin/products/$PID/images" -F "kind=primary" -F "file=@$IMAGE;type=image/webp")"
OBJ2=$(python3 -c 'import json;print(json.load(open("/tmp/lpu2.json")).get("objectPath",""))' 2>/dev/null)
EDIT=$(curl -s -b "$JAR" "$BASE/admin/products/$PID/edit")
check "editor page" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE/admin/products/$PID/edit")"
check "editor shows image" "yes" "$(printf '%s' "$EDIT" | grep -qF "${PURL##*/product-images/}" && echo yes || echo no)"
check "image slot deleted" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X DELETE "$BASE/api/admin/products/$PID/images?kind=primary")"
check "product deleted" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X DELETE "$BASE/api/admin/products?id=$PID")"
check "test product gone" "no" "$(curl -s -b "$JAR" "$BASE/api/admin/products?q=zz-live-test" | grep -qF "$SLUG" && echo yes || echo no)"

echo "== storefront routes =="
for U in / /shop /cart /checkout /product/macbook-pro-16-m3-gray-2025; do
  check "storefront $U" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$U")"
done

echo "== unauthorized access =="
for U in /api/admin/banners /api/admin/orders /api/admin/customers; do
  check "anon API $U" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$U")"
done
check "anon image upload" 401 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/products/00000000-0000-0000-0000-000000000000/images" -F "kind=primary")"

echo "== cleanup stored objects =="
for OBJ in "$BOBJ" "$OBJ1" "$OBJ2"; do
  [ -n "$OBJ" ] || continue
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$SUPABASE_URL/storage/v1/object/product-images/$OBJ" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY")
  echo "INFO  storage cleanup $OBJ -> $CODE"
  [ "$CODE" = "200" ] || cleanup_fail=1
done

curl -s -o /dev/null -b "$JAR" -c "$JAR" -X POST "$BASE/api/admin/logout"
rm -f "$JAR"

echo
echo "SUMMARY pass=$pass fail=$fail cleanup_issues=$cleanup_fail"
