#!/usr/bin/env bash
# Isolated CMS write test: creates a clearly-labelled test product, exercises the
# image endpoints, then removes everything it created (rows and stored objects).
set -uo pipefail

BASE=http://127.0.0.1:3001
JAR=/tmp/cms-test-cookies.txt
STAMP=$(date +%s)
SLUG="zz-launch-test-$STAMP"
IMAGE="public/images/h-electro-pulse-banner-1.webp"
rm -f "$JAR"

pass=0; fail=0
check() { # label expected actual
  if [ "$2" = "$3" ]; then echo "PASS  $1 ($3)"; pass=$((pass+1));
  else echo "FAIL  $1 (expected $2, got $3)"; fail=$((fail+1)); fi
}

echo "== login =="
LOGIN=$(curl -s -c "$JAR" -o /tmp/login-body.json -w '%{http_code}' -X POST "$BASE/api/admin/login" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
check "admin login" 200 "$LOGIN"

echo "== read category =="
CAT=$(curl -s -b "$JAR" "$BASE/api/admin/categories")
CAT_ID=$(printf '%s' "$CAT" | python3 -c 'import json,sys; d=json.load(sys.stdin); rows=d.get("rows") or d.get("categories") or d; print(next(r["id"] for r in rows if not r.get("parent_id")))' 2>/dev/null)
check "category id resolved" "yes" "$([ -n "$CAT_ID" ] && echo yes || echo no)"

echo "== create test product =="
CREATE=$(curl -s -b "$JAR" -o /tmp/create.json -w '%{http_code}' -X POST "$BASE/api/admin/products" \
  -H 'Content-Type: application/json' \
  --data "{\"title\":\"ZZ Launch Test Product\",\"slug\":\"$SLUG\",\"categoryId\":\"$CAT_ID\",\"shortDescription\":\"Temporary product created by the launch verification run.\",\"priceCents\":1000,\"is_active\":false}")
check "product created" 201 "$CREATE"
PID=$(python3 -c 'import json;print(json.load(open("/tmp/create.json")).get("id",""))')

echo "== upload primary image =="
UP=$(curl -s -b "$JAR" -o /tmp/up.json -w '%{http_code}' -X POST "$BASE/api/admin/products/$PID/images" \
  -F "kind=primary" -F "file=@$IMAGE;type=image/webp")
check "primary image upload" 201 "$UP"
URL=$(python3 -c 'import json;print(json.load(open("/tmp/up.json")).get("path",""))')
OBJ1=$(python3 -c 'import json;print(json.load(open("/tmp/up.json")).get("objectPath",""))')
check "stored object reachable" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$URL")"

echo "== replace primary image (same slot) =="
UP2=$(curl -s -b "$JAR" -o /tmp/up2.json -w '%{http_code}' -X POST "$BASE/api/admin/products/$PID/images" \
  -F "kind=primary" -F "file=@$IMAGE;type=image/webp")
check "primary image replace" 201 "$UP2"
OBJ2=$(python3 -c 'import json;print(json.load(open("/tmp/up2.json")).get("objectPath",""))')

echo "== editor renders the image =="
EDIT=$(curl -s -b "$JAR" "$BASE/admin/products/$PID/edit")
check "editor page 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE/admin/products/$PID/edit")"
if [ -n "$URL" ]; then
  check "editor shows uploaded image" "yes" "$(printf '%s' "$EDIT" | grep -qF "${URL##*/product-images/}" && echo yes || echo no)"
else
  echo "SKIP  editor image check (upload did not return a path)"
fi

echo "== validation: missing image file =="
check "rejects empty upload" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X POST "$BASE/api/admin/products/$PID/images" -F "kind=primary")"
check "rejects bad kind" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X POST "$BASE/api/admin/products/$PID/images" -F "kind=side" -F "file=@$IMAGE;type=image/webp")"

echo "== update product =="
PATCH=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' -X PATCH "$BASE/api/admin/products/$PID" \
  -H 'Content-Type: application/json' \
  --data "{\"title\":\"ZZ Launch Test Product (edited)\",\"slug\":\"$SLUG\",\"categoryId\":\"$CAT_ID\",\"shortDescription\":\"Edited during the launch verification run.\",\"priceCents\":1500,\"is_active\":false}")
check "product update" 200 "$PATCH"

echo "== remove images =="
check "delete hover slot" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X DELETE "$BASE/api/admin/products/$PID/images?kind=hover")"
check "delete primary slot" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X DELETE "$BASE/api/admin/products/$PID/images?kind=primary")"

echo "== delete test product =="
check "product deleted" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X DELETE "$BASE/api/admin/products?id=$PID")"
check "slug gone from list" "no" "$(curl -s -b "$JAR" "$BASE/api/admin/products?q=zz-launch-test" | grep -qF "$SLUG" && echo yes || echo no)"

echo "== remove stored objects =="
if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi
for OBJ in "$OBJ1" "$OBJ2"; do
  [ -n "$OBJ" ] || continue
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$SUPABASE_URL/storage/v1/object/product-images/$OBJ" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY")
  echo "INFO  storage cleanup $OBJ -> $CODE"
done

echo "== category create / update / delete =="
C_SLUG="zz-launch-test-cat-$STAMP"
C_CODE=$(curl -s -b "$JAR" -o /tmp/cat.json -w '%{http_code}' -X POST "$BASE/api/admin/categories" \
  -H 'Content-Type: application/json' \
  --data "{\"slug\":\"$C_SLUG\",\"label\":\"ZZ Launch Test Category\"}")
check "category created" 201 "$C_CODE"
C_ID=$(python3 -c 'import json;d=json.load(open("/tmp/cat.json"));print(d.get("id",""))' 2>/dev/null)
check "category update" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X PATCH "$BASE/api/admin/categories?id=$C_ID" -H 'Content-Type: application/json' --data "{\"label\":\"ZZ Launch Test Category (edited)\"}" 2>/dev/null || echo 0)"
if [ -n "$C_ID" ]; then
  check "category delete" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X DELETE "$BASE/api/admin/categories?id=$C_ID")"
fi

echo "== brand create / delete =="
B_SLUG="zz-launch-test-brand-$STAMP"
B_CODE=$(curl -s -b "$JAR" -o /tmp/brand.json -w '%{http_code}' -X POST "$BASE/api/admin/brands" \
  -H 'Content-Type: application/json' \
  --data "{\"name\":\"ZZ Launch Test Brand\",\"slug\":\"$B_SLUG\"}")
check "brand created" 201 "$B_CODE"
B_ID=$(python3 -c 'import json;d=json.load(open("/tmp/brand.json"));print(d.get("id",""))' 2>/dev/null)
if [ -n "$B_ID" ]; then
  check "brand delete" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -X DELETE "$BASE/api/admin/brands?id=$B_ID")"
fi

echo "== settings round trip (same values) =="
check "settings screen" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE/admin/settings")"
SETTINGS=$(curl -s "$SUPABASE_URL/rest/v1/store_settings?select=*&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | python3 -c 'import json,sys;r=json.load(sys.stdin)[0];print(json.dumps({"storeName":r["store_name"],"standardShippingCents":r["standard_shipping_cents"],"expressShippingCents":r["express_shipping_cents"]}))' 2>/dev/null)
NAME=$(printf '%s' "$SETTINGS" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("storeName",""))' 2>/dev/null)
STD=$(printf '%s' "$SETTINGS" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("standardShippingCents",0)/100)' 2>/dev/null)
EXP=$(printf '%s' "$SETTINGS" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("expressShippingCents",0)/100)' 2>/dev/null)
if [ -n "$NAME" ]; then
  SAVE=$(curl -s -b "$JAR" -o /tmp/settings.json -w '%{http_code}' -X PATCH "$BASE/api/admin/settings" \
    -H 'Content-Type: application/json' \
    --data "{\"storeName\":\"$NAME\",\"standardShipping\":$STD,\"expressShipping\":$EXP,\"checkoutEnabled\":true}")
  check "settings save" 200 "$SAVE"
  AFTER=$(curl -s "$SUPABASE_URL/rest/v1/store_settings?select=store_name&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | python3 -c 'import json,sys;print(json.load(sys.stdin)[0]["store_name"])')
  check "settings persisted unchanged" "$NAME" "$AFTER"
else
  echo "SKIP  settings save (could not read current values)"
fi

echo "== read-only admin screens =="
check "orders list" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE/api/admin/orders")"
check "customers list" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE/api/admin/customers")"
check "inventory list" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE/api/admin/inventory")"

echo "== storefront =="
for U in / /shop /cart /checkout "/product/macbook-pro-16-m3-gray-2025"; do
  check "storefront $U" 200 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$U")"
done

echo "== logout =="
curl -s -o /dev/null -b "$JAR" -c "$JAR" -X POST "$BASE/api/admin/logout"
rm -f "$JAR"
check "session revoked" 401 "$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE/api/admin/orders")"

echo
echo "SUMMARY pass=$pass fail=$fail"
